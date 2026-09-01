<?php

namespace Modules\Clinic\Services;

use Modules\Clinic\Models\Question;
use Modules\Clinic\Models\Questionnaire;

class FormSchemaService
{
    public function __construct(private ConfirmationService $confirmations) {}

    /** @return array<string, mixed> */
    public function build(Questionnaire $questionnaire): array
    {
        $questionnaire->loadMissing('questions');
        $settings = $questionnaire->settings['wpforms_settings'] ?? [];
        $steps = $this->steps($questionnaire);

        return [
            'version' => 1,
            'answerFormat' => ['encoding' => 'multipart/form-data', 'answers' => 'JSON object keyed by field key', 'files' => 'Binary files keyed as files[field_key]'],
            'pagination' => [
                'enabled' => count($steps) > 1,
                'style' => $questionnaire->layout['pages'][0]['indicator'] ?? 'progress',
                'color' => $questionnaire->layout['pages'][0]['indicator_color'] ?? null,
                'progressText' => $questionnaire->layout['pages'][0]['progress_text'] ?? null,
            ],
            'steps' => $steps,
            'gates' => $this->gates($settings['mcp_frontend_rules'] ?? []),
            'calculations' => $this->calculations($questionnaire),
            'completion' => [
                'submitText' => $settings['submit_text'] ?? 'Submit',
                'processingText' => $settings['submit_text_processing'] ?? null,
                'confirmation' => $this->confirmations->default($questionnaire),
                'confirmations' => $this->confirmations->definitions($questionnaire),
            ],
            'workflows' => [
                'notifications' => $this->workflowItems($settings['notifications'] ?? []),
                'providers' => $this->providerItems($questionnaire->settings['wpforms_providers'] ?? []),
            ],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function steps(Questionnaire $questionnaire): array
    {
        $steps = [['id' => 'step-1', 'index' => 1, 'title' => null, 'elements' => [], 'navigation' => ['previousText' => null, 'nextText' => 'Next']]];
        $stepIndex = 0;

        foreach ($questionnaire->questions as $question) {
            $raw = $this->raw($question);

            if ($question->type === 'pagebreak') {
                $position = $raw['position'] ?? null;

                if ($position === 'top') {
                    $steps[0]['title'] = $raw['title'] ?? null;

                    continue;
                }

                $steps[$stepIndex]['navigation'] = [
                    'previousText' => $raw['prev'] ?? ($stepIndex > 0 ? 'Previous' : null),
                    'nextText' => $position === 'bottom' ? null : ($raw['next'] ?? 'Next'),
                ];

                if ($position !== 'bottom') {
                    $stepIndex++;
                    $steps[] = [
                        'id' => 'step-'.($stepIndex + 1),
                        'index' => $stepIndex + 1,
                        'title' => $raw['title'] ?? null,
                        'elements' => [],
                        'navigation' => ['previousText' => $raw['prev'] ?? 'Previous', 'nextText' => 'Next'],
                    ];
                }

                continue;
            }

            $steps[$stepIndex]['elements'][] = $this->element($question);
        }

        return array_values(array_filter($steps, static fn (array $step): bool => $step['elements'] !== []));
    }

    /** @return array<string, mixed> */
    private function element(Question $question): array
    {
        $raw = $this->raw($question);
        $sourceId = (string) ($raw['id'] ?? $question->key);

        if ($question->type === 'layout') {
            return [
                'kind' => 'layout',
                'key' => $question->key,
                'label' => $question->label,
                'display' => $raw['display'] ?? 'rows',
                'columns' => array_map(static fn (array $column): array => [
                    'width' => ($column['width_custom'] ?? '') ?: ($column['width_preset'] ?? '100'),
                    'fields' => array_map(static fn (mixed $id): string => 'wpforms_'.$id, $column['fields'] ?? []),
                ], $raw['columns'] ?? []),
            ];
        }

        if ($question->type === 'content') {
            return ['kind' => 'content', 'key' => $question->key, 'content' => $raw['content'] ?? '', 'visibility' => $this->visibility($raw)];
        }

        $type = $this->fieldType((string) ($raw['type'] ?? $question->type));
        $hidden = $type === 'hidden' || str_contains((string) ($raw['css'] ?? ''), 'wpforms-hidden');

        return [
            'kind' => 'field',
            'id' => $question->id,
            'key' => $question->key,
            'sourceId' => $sourceId,
            'type' => $type,
            'label' => $question->label,
            'description' => $question->description,
            'placeholder' => $question->placeholder,
            'required' => $question->is_required,
            'hidden' => $hidden,
            'readOnly' => ($raw['read_only'] ?? '0') === '1' || $hidden,
            'defaultValue' => $this->defaultValue($type, $raw),
            'choices' => $this->choices($raw, $question),
            'compound' => $this->compound($type, $raw),
            'validation' => $this->validation($type, $raw, $question),
            'visibility' => $this->visibility($raw),
            'upload' => $type === 'file' ? $this->upload($raw) : null,
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function choices(array $raw, Question $question): array
    {
        $choices = $raw['choices'] ?? $question->options ?? [];
        $result = [];
        $isList = array_is_list($choices);

        foreach ($choices as $id => $choice) {
            $choice = is_array($choice) ? $choice : ['label' => (string) $choice];
            $canonicalId = (string) ($choice['id'] ?? ($isList ? $id + 1 : $id));
            $result[] = [
                'id' => $canonicalId,
                'label' => (string) ($choice['label'] ?? $choice['value'] ?? $id),
                'value' => $canonicalId,
                'displayValue' => (string) (($choice['value'] ?? '') !== '' ? $choice['value'] : ($choice['label'] ?? $id)),
                'selected' => ($choice['default'] ?? '0') === '1',
            ];
        }

        return $result;
    }

    /** @return array<string, mixed>|null */
    private function compound(string $type, array $raw): ?array
    {
        if ($type === 'email' && ($raw['confirmation'] ?? '0') === '1') {
            return ['shape' => 'object', 'inputs' => [['key' => 'value', 'label' => 'Email'], ['key' => 'confirmation', 'label' => 'Confirm Email']], 'mustMatch' => true];
        }

        if ($type === 'name') {
            $parts = match ($raw['format'] ?? 'first-last') {
                'simple' => ['value'],
                'first-middle-last' => ['first', 'middle', 'last'],
                default => ['first', 'last'],
            };

            return ['shape' => 'object', 'inputs' => array_map(static fn (string $part): array => ['key' => $part, 'label' => ucfirst($part)], $parts)];
        }

        return null;
    }

    private function defaultValue(string $type, array $raw): mixed
    {
        $explicit = $raw['default_value'] ?? $raw['simple_default'] ?? null;
        if ($explicit !== null && $explicit !== '') {
            return $explicit;
        }

        if (! in_array($type, ['checkbox', 'radio', 'select'], true) || ! is_array($raw['choices'] ?? null)) {
            return null;
        }

        $choices = $raw['choices'];
        $isList = array_is_list($choices);
        $selected = [];

        foreach ($choices as $id => $choice) {
            if (! is_array($choice) || ($choice['default'] ?? '0') !== '1') {
                continue;
            }

            $selected[] = (string) ($choice['id'] ?? ($isList ? $id + 1 : $id));
        }

        return $type === 'checkbox' ? $selected : ($selected[0] ?? null);
    }

    /** @return array<string, mixed> */
    private function validation(string $type, array $raw, Question $question): array
    {
        return array_filter([
            'type' => $type,
            'min' => $raw['min'] ?? $question->validation['min'] ?? null,
            'max' => $raw['max'] ?? $question->validation['max'] ?? null,
            'format' => $raw['date_format'] ?? $raw['format'] ?? $question->validation['format'] ?? null,
            'inputMask' => $raw['input_mask'] ?? $question->validation['input_mask'] ?? null,
            'choiceLimit' => $raw['choice_limit'] ?? null,
        ], static fn (mixed $value): bool => $value !== null && $value !== '');
    }

    /** @return array<string, mixed> */
    private function visibility(array $raw): array
    {
        if (($raw['conditional_logic'] ?? '0') !== '1') {
            return ['effect' => 'show', 'groups' => []];
        }

        return ['effect' => ($raw['conditional_type'] ?? 'show') === 'hide' ? 'hide' : 'show', 'groups' => $this->conditionGroups($raw['conditionals'] ?? [])];
    }

    /** @return array<int, array<string, mixed>> */
    private function gates(mixed $rules): array
    {
        if (! is_array($rules)) {
            return [];
        }

        return array_map(fn (array $rule): array => [
            'key' => (string) ($rule['key'] ?? ''),
            'type' => $rule['type'] ?? 'page_next_gate',
            'step' => (int) ($rule['page'] ?? 1),
            'passWhen' => ['mode' => $rule['mode'] ?? 'all', 'conditions' => array_map(fn (array $condition): array => $this->condition($condition), $rule['conditions'] ?? [])],
            'blocked' => [
                'title' => $rule['messageTitle'] ?? $rule['message'] ?? 'Cannot continue',
                'message' => $rule['message'] ?? null,
                'style' => $rule['messageStyle'] ?? 'error',
                'hideNext' => (bool) ($rule['hideNextUntilClear'] ?? false),
                'cta' => array_filter(['text' => $rule['ctaText'] ?? null, 'url' => $rule['ctaUrl'] ?? null]),
            ],
        ], array_values(array_filter($rules, 'is_array')));
    }

    /** @return array<int, array<string, mixed>> */
    private function calculations(Questionnaire $questionnaire): array
    {
        return $questionnaire->questions->map(function (Question $question): ?array {
            $formula = trim((string) ($this->raw($question)['calculation_code'] ?? ''));

            if (preg_match('/^years\(\$F(\d+),\s*now\(\)\)$/', $formula, $matches) === 1) {
                return ['target' => $question->key, 'operation' => 'ageFromDate', 'sources' => ['wpforms_'.$matches[1]], 'serverAuthoritative' => true];
            }

            if (str_starts_with($formula, 'join(')) {
                preg_match_all('/\$F(\d+)/', $formula, $matches);

                return ['target' => $question->key, 'operation' => 'joinVisibleValues', 'sources' => array_map(static fn (string $id): string => 'wpforms_'.$id, $matches[1] ?? []), 'separator' => ' OR ', 'serverAuthoritative' => true];
            }

            return null;
        })->filter()->values()->all();
    }

    /** @return array<int, array<string, mixed>> */
    private function workflowItems(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        $result = [];

        foreach ($items as $id => $item) {
            if (! is_array($item)) {
                continue;
            }

            $result[] = [
                'id' => (string) $id,
                'name' => $item['name'] ?? $item['notification_name'] ?? null,
                'type' => $item['type'] ?? null,
                'message' => $item['message'] ?? null,
                'redirect' => $item['redirect'] ?? null,
                'when' => ($item['conditional_logic'] ?? '0') === '1' ? ['effect' => $item['conditional_type'] ?? 'go', 'groups' => $this->conditionGroups($item['conditionals'] ?? [])] : null,
            ];
        }

        return $result;
    }

    /** @return array<int, array<string, mixed>> */
    private function providerItems(mixed $providers): array
    {
        if (! is_array($providers)) {
            return [];
        }

        $result = [];
        foreach ($providers as $provider => $connections) {
            if (! is_array($connections)) {
                continue;
            }

            foreach ($connections as $id => $connection) {
                if (! is_array($connection)) {
                    continue;
                }

                $result[] = [
                    'id' => (string) $id,
                    'provider' => (string) $provider,
                    'name' => $connection['name'] ?? null,
                    'action' => $connection['action'] ?? null,
                    'when' => ($connection['conditional_logic'] ?? '0') === '1' ? [
                        'effect' => $connection['conditional_type'] ?? 'go',
                        'groups' => $this->conditionGroups($connection['conditionals'] ?? []),
                    ] : null,
                ];
            }
        }

        return $result;
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

        $groups = [];
        foreach ($values as $group) {
            if (! is_array($group)) {
                continue;
            }

            $conditions = [];
            foreach (array_values($group) as $condition) {
                if (is_array($condition) && isset($condition['field'])) {
                    $conditions[] = $this->condition($condition);
                }
            }

            if ($conditions !== []) {
                $groups[] = $conditions;
            }
        }

        return $groups;
    }

    /** @return array<string, mixed> */
    private function condition(array $condition): array
    {
        return array_filter([
            'field' => 'wpforms_'.($condition['field'] ?? ''),
            'operator' => html_entity_decode((string) ($condition['operator'] ?? '==')),
            'value' => $condition['value'] ?? null,
            'exclusiveChoice' => $condition['exclusiveChoice'] ?? null,
            'exclusiveLast' => isset($condition['exclusiveLast']) ? (bool) $condition['exclusiveLast'] : null,
        ], static fn (mixed $value): bool => $value !== null);
    }

    /** @return array<string, mixed> */
    private function upload(array $raw): array
    {
        $extensions = preg_split('/\s*,\s*/', (string) ($raw['extensions'] ?? 'pdf,jpg,jpeg,png,doc,docx')) ?: [];

        return [
            'policySource' => 'careflow',
            'extensions' => ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
            'maxKilobytes' => 10240,
            'maxFiles' => 1,
            'sourceConstraints' => [
                'extensions' => array_values(array_filter($extensions)),
                'maxFileSizeMegabytes' => isset($raw['max_file_size']) && $raw['max_file_size'] !== '' ? (int) $raw['max_file_size'] : null,
                'maxFiles' => isset($raw['max_file_number']) && $raw['max_file_number'] !== '' ? (int) $raw['max_file_number'] : null,
            ],
        ];
    }

    private function fieldType(string $type): string
    {
        return match ($type) {
            'date-time' => 'date',
            'file-upload' => 'file',
            default => $type,
        };
    }

    /** @return array<string, mixed> */
    private function raw(Question $question): array
    {
        return is_array($question->settings['wpforms'] ?? null) ? $question->settings['wpforms'] : [];
    }
}
