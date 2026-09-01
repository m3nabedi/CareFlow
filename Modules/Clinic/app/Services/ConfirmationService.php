<?php

namespace Modules\Clinic\Services;

use DOMDocument;
use DOMElement;
use DOMNode;
use Illuminate\Support\Arr;
use Modules\Clinic\Models\Questionnaire;

class ConfirmationService
{
    /** @return array<int, array<string, mixed>> */
    public function definitions(Questionnaire $questionnaire): array
    {
        $confirmations = $questionnaire->settings['wpforms_settings']['confirmations'] ?? [];

        if (! is_array($confirmations)) {
            return [$this->fallback()];
        }

        $definitions = [];

        foreach ($confirmations as $id => $confirmation) {
            if (! is_array($confirmation)) {
                continue;
            }

            $definitions[] = array_filter([
                'id' => (string) $id,
                'title' => 'Thank you',
                'type' => $this->type($confirmation['type'] ?? null),
                'message' => $this->messageTemplate((string) ($confirmation['message'] ?? '')),
                'page' => $this->page($confirmation['page'] ?? null),
                'redirect' => $this->safeUrl($confirmation['redirect'] ?? null),
                'when' => ($confirmation['conditional_logic'] ?? '0') === '1'
                    ? [
                        'effect' => ($confirmation['conditional_type'] ?? 'go') === 'stop' ? 'stop' : 'go',
                        'groups' => $this->conditionGroups($confirmation['conditionals'] ?? []),
                    ]
                    : null,
            ], static fn (mixed $value): bool => $value !== null && $value !== '');
        }

        return $definitions === [] ? [$this->fallback()] : $definitions;
    }

    /** @param array<string, mixed> $answers @return array<string, mixed> */
    public function resolve(Questionnaire $questionnaire, array $answers): array
    {
        $definitions = $this->definitions($questionnaire);
        $conditional = collect($definitions)
            ->filter(fn (array $definition): bool => isset($definition['when']))
            ->first(fn (array $definition): bool => $this->applies($definition['when'], $answers));
        $selected = $conditional
            ?? collect($definitions)->first(fn (array $definition): bool => ! isset($definition['when']))
            ?? $this->fallback();

        unset($selected['when']);
        $selected['message'] = $this->resolveMessage($questionnaire, (string) $selected['message'], $answers);

        return $selected;
    }

    /** @return array<string, mixed> */
    public function default(Questionnaire $questionnaire): array
    {
        $definition = collect($this->definitions($questionnaire))
            ->first(fn (array $item): bool => ! isset($item['when']))
            ?? $this->fallback();

        unset($definition['when']);

        return $definition;
    }

    /** @param array<string, mixed> $when @param array<string, mixed> $answers */
    private function applies(array $when, array $answers): bool
    {
        $groups = $when['groups'] ?? [];
        $matches = collect($groups)->contains(
            fn (array $group): bool => collect($group)->every(
                fn (array $condition): bool => $this->matches($condition, $answers),
            ),
        );

        return ($when['effect'] ?? 'go') === 'stop' ? ! $matches : $matches;
    }

    /** @param array<string, mixed> $condition @param array<string, mixed> $answers */
    private function matches(array $condition, array $answers): bool
    {
        $answer = Arr::get($answers, $condition['field']);
        $operator = html_entity_decode((string) ($condition['operator'] ?? '=='));
        $expected = $condition['value'] ?? null;
        $actualValues = is_array($answer) ? array_map('strval', $answer) : [(string) $answer];

        return match ($operator) {
            '==' => in_array((string) $expected, $actualValues, true),
            '!=' => ! in_array((string) $expected, $actualValues, true),
            'e' => $this->isEmpty($answer),
            '!e' => ! $this->isEmpty($answer),
            '>' => is_numeric($answer) && (float) $answer > (float) $expected,
            '<' => is_numeric($answer) && (float) $answer < (float) $expected,
            '>=' => is_numeric($answer) && (float) $answer >= (float) $expected,
            '<=' => is_numeric($answer) && (float) $answer <= (float) $expected,
            'contains' => str_contains((string) $answer, (string) $expected),
            'not_contains' => ! str_contains((string) $answer, (string) $expected),
            default => false,
        };
    }

    /** @return array<int, array<int, array<string, mixed>>> */
    private function conditionGroups(mixed $conditionals): array
    {
        if (! is_array($conditionals)) {
            return [];
        }

        $values = array_values($conditionals);
        if (isset($values[0]['field'])) {
            $values = [$values];
        }

        return collect($values)
            ->filter(fn (mixed $group): bool => is_array($group))
            ->map(fn (array $group): array => collect(array_values($group))
                ->filter(fn (mixed $condition): bool => is_array($condition) && isset($condition['field']))
                ->map(fn (array $condition): array => [
                    'field' => 'wpforms_'.(string) $condition['field'],
                    'operator' => html_entity_decode((string) ($condition['operator'] ?? '==')),
                    'value' => $condition['value'] ?? null,
                ])
                ->all())
            ->filter()
            ->values()
            ->all();
    }

    /** @param array<string, mixed> $answers */
    private function resolveMessage(Questionnaire $questionnaire, string $message, array $answers): string
    {
        return (string) preg_replace_callback('/\{\{wpforms_(\d+)\}\}/', function (array $matches) use ($questionnaire, $answers): string {
            $key = 'wpforms_'.$matches[1];

            return e($this->displayValue($questionnaire, $key, $answers[$key] ?? null));
        }, $message);
    }

    private function displayValue(Questionnaire $questionnaire, string $key, mixed $value): string
    {
        if (! is_array($value)) {
            return (string) ($value ?? '');
        }

        if (! array_is_list($value)) {
            return collect($value)->filter(fn (mixed $part): bool => is_scalar($part))->implode(' ');
        }

        $question = $questionnaire->questions->firstWhere('key', $key);
        $choices = collect($question?->settings['wpforms']['choices'] ?? [])->mapWithKeys(
            fn (mixed $choice, mixed $id): array => [(string) $id => (string) (is_array($choice) ? (($choice['value'] ?? '') ?: ($choice['label'] ?? $id)) : $choice)],
        );

        return collect($value)->map(fn (mixed $item): string => $choices->get((string) $item, (string) $item))->implode(', ');
    }

    private function messageTemplate(string $message): string
    {
        $message = preg_replace('/\{field_id=["\'](\d+)["\']\}/', '%%CAREFLOW_FIELD_$1%%', $message) ?? '';
        $message = preg_replace('/\{[^{}]+\}/', '', $message) ?? '';
        $message = preg_replace('/%%CAREFLOW_FIELD_(\d+)%%/', '{{wpforms_$1}}', $message) ?? '';

        return $this->sanitizeHtml($message);
    }

    private function sanitizeHtml(string $html): string
    {
        if (trim($html) === '') {
            return '<p>Your response has been submitted successfully.</p>';
        }

        $document = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $document->loadHTML('<?xml encoding="UTF-8"><div>'.$html.'</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->documentElement;
        if (! $root instanceof DOMElement) {
            return '<p>Your response has been submitted successfully.</p>';
        }

        $result = '';
        foreach ($root->childNodes as $child) {
            $result .= $this->safeNode($child);
        }

        return trim($result) === '' ? '<p>Your response has been submitted successfully.</p>' : trim($result);
    }

    private function safeNode(DOMNode $node): string
    {
        if ($node->nodeType === XML_TEXT_NODE) {
            return htmlspecialchars($node->nodeValue ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        }

        if (! $node instanceof DOMElement) {
            return '';
        }

        $contents = '';
        foreach ($node->childNodes as $child) {
            $contents .= $this->safeNode($child);
        }

        $tag = mb_strtolower($node->tagName);
        if (! in_array($tag, ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'], true)) {
            return $contents;
        }

        if ($tag === 'br') {
            return '<br>';
        }

        $attributes = '';
        if ($tag === 'a') {
            $href = $this->safeUrl($node->getAttribute('href'));
            if ($href !== null) {
                $attributes = ' href="'.e($href).'" rel="noopener noreferrer nofollow"';
            }
        }

        return "<{$tag}{$attributes}>{$contents}</{$tag}>";
    }

    private function type(mixed $type): string
    {
        return in_array($type, ['message', 'page', 'redirect'], true) ? $type : 'message';
    }

    private function page(mixed $page): ?string
    {
        if (! is_scalar($page) || trim((string) $page) === '') {
            return null;
        }

        return trim((string) $page);
    }

    private function safeUrl(mixed $url): ?string
    {
        if (! is_string($url) || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        return in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true) ? $url : null;
    }

    private function isEmpty(mixed $value): bool
    {
        return $value === null || $value === '' || $value === [];
    }

    /** @return array<string, mixed> */
    private function fallback(): array
    {
        return [
            'id' => 'default',
            'title' => 'Thank you',
            'type' => 'message',
            'message' => '<p>Your response has been submitted successfully.</p>',
        ];
    }
}
