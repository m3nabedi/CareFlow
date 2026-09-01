<?php

namespace Modules\Clinic\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Modules\Clinic\Models\Questionnaire;

class FormRuntimeService
{
    public function __construct(private FormSchemaService $schemas) {}

    /** @param array<string, mixed> $answers @return array<string, mixed> */
    public function hydrateServerValues(Questionnaire $questionnaire, array $answers): array
    {
        $fields = $this->fields($questionnaire);

        foreach ($fields as $field) {
            if (! ($field['readOnly'] ?? false)) {
                continue;
            }

            $default = $field['defaultValue'] ?? null;
            if (! $this->isEmpty($default)) {
                $answers[$field['key']] = $this->resolveDefault($default);
            } else {
                unset($answers[$field['key']]);
            }
        }

        foreach ($questionnaire->questions as $question) {
            $raw = $question->settings['wpforms'] ?? [];
            $formula = trim((string) ($raw['calculation_code'] ?? ''));

            if (preg_match('/^years\(\$F(\d+),\s*now\(\)\)$/', $formula, $matches) === 1) {
                $date = $answers['wpforms_'.$matches[1]] ?? null;
                $age = $this->age($date);
                if ($age !== null) {
                    $answers[$question->key] = $age;
                }
            }
        }

        foreach ($fields as $field) {
            if (($field['readOnly'] ?? false) && ! ($field['hidden'] ?? false) && $this->isVisible($field, $answers)) {
                $default = $field['defaultValue'] ?? null;
                if ($default !== null && $default !== '') {
                    $answers[$field['key']] = $default;
                }
            }
        }

        if (($questionnaire->settings['wpforms_form_id'] ?? null) === '1836') {
            foreach (['wpforms_75', 'wpforms_76', 'wpforms_78'] as $doctorKey) {
                unset($answers[$doctorKey]);
            }

            foreach ($this->recommendations($questionnaire, $answers) as $recommendation) {
                $answers[$recommendation['key']] = $recommendation['name'];
            }
        }

        foreach ($questionnaire->questions as $question) {
            $formula = trim((string) (($question->settings['wpforms']['calculation_code'] ?? '')));
            if (! str_starts_with($formula, 'join(')) {
                continue;
            }

            preg_match_all('/\$F(\d+)/', $formula, $matches);
            $values = collect($matches[1] ?? [])->map(fn (string $id): mixed => $answers['wpforms_'.$id] ?? null)->filter(fn (mixed $value): bool => ! $this->isEmpty($value))->values()->all();
            $answers[$question->key] = implode(' OR ', $values);
        }

        $age = $answers['wpforms_95'] ?? null;
        if (is_numeric($age)) {
            $answers['wpforms_92'] = (int) $age;
            $answers['wpforms_93'] = (int) $age < 18 ? 'child' : 'adult';
        }

        if (! $this->isEmpty($answers['wpforms_87'] ?? null)) {
            $answers['wpforms_94'] = $answers['wpforms_87'];
        }

        return $answers;
    }

    /** @param array<string, mixed> $answers @return array<int, array<string, mixed>> */
    public function recommendations(Questionnaire $questionnaire, array $answers): array
    {
        if (($questionnaire->settings['wpforms_form_id'] ?? null) !== '1836') {
            return [];
        }

        $age = $answers['wpforms_95'] ?? null;
        if (! is_numeric($age)) {
            return [];
        }

        $age = (int) $age;
        $reasons = array_map('strval', (array) ($answers['wpforms_69'] ?? []));
        $history = array_map('strval', (array) ($answers['wpforms_71'] ?? []));
        $physicalHealth = (string) ($answers['wpforms_73'] ?? '');
        $privateFunding = (string) ($answers['wpforms_67'] ?? '');
        $candidates = [
            ['key' => 'wpforms_75', 'sourceId' => '75', 'name' => 'Dr Eliot Frickey', 'eligible' => $age > 17 && ! in_array('19', $reasons, true), 'reason' => 'Adult pathway and referral reason is supported.'],
            ['key' => 'wpforms_76', 'sourceId' => '76', 'name' => 'Dr Sean Mayne', 'eligible' => $age < 65 && collect(['19', '6', '16'])->every(fn (string $excluded): bool => ! in_array($excluded, $reasons, true)) && ! in_array('8', $history, true), 'reason' => 'Under-65 pathway without excluded referral or history choices.'],
            ['key' => 'wpforms_78', 'sourceId' => '78', 'name' => 'Dr Omolola Oboro', 'eligible' => $age < 51 && ! in_array('19', $reasons, true) && $physicalHealth === '2' && $privateFunding === '2', 'reason' => 'Under-51 pathway without excluded reason, significant physical-health impact, or private funding.'],
        ];

        return collect($candidates)
            ->filter(fn (array $candidate): bool => $candidate['eligible'])
            ->map(fn (array $candidate): array => Arr::except($candidate, 'eligible') + ['status' => 'eligible'])
            ->values()
            ->all();
    }

    /** @param array<string, mixed> $answers @return array<int, array<string, mixed>> */
    public function gateViolations(Questionnaire $questionnaire, array $answers): array
    {
        $gates = $this->schemas->build($questionnaire)['gates'];

        return array_values(array_filter($gates, function (array $gate) use ($answers): bool {
            $conditions = $gate['passWhen']['conditions'] ?? [];
            $results = array_map(fn (array $condition): bool => $this->matches($condition, $answers), $conditions);

            return ($gate['passWhen']['mode'] ?? 'all') === 'any'
                ? ! in_array(true, $results, true)
                : in_array(false, $results, true);
        }));
    }

    /** @param array<string, mixed> $field @param array<string, mixed> $answers */
    public function isVisible(array $field, array $answers): bool
    {
        $visibility = $field['visibility'] ?? ['effect' => 'show', 'groups' => []];
        $groups = $visibility['groups'] ?? [];

        if ($groups === []) {
            return true;
        }

        $conditionsMatch = collect($groups)->contains(fn (array $group): bool => collect($group)->every(fn (array $condition): bool => $this->matches($condition, $answers)));

        return ($visibility['effect'] ?? 'show') === 'hide' ? ! $conditionsMatch : $conditionsMatch;
    }

    /** @return array<int, array<string, mixed>> */
    public function fields(Questionnaire $questionnaire): array
    {
        return collect($this->schemas->build($questionnaire)['steps'])
            ->flatMap(fn (array $step): array => $step['elements'])
            ->filter(fn (array $element): bool => ($element['kind'] ?? null) === 'field')
            ->values()
            ->all();
    }

    /** @param array<string, mixed> $condition @param array<string, mixed> $answers */
    private function matches(array $condition, array $answers): bool
    {
        $answer = Arr::get($answers, $condition['field']);
        $operator = html_entity_decode((string) ($condition['operator'] ?? '=='));
        $expected = $condition['value'] ?? $condition['exclusiveChoice'] ?? null;

        if ($operator === 'checkbox_choice_only') {
            $selected = array_values(array_map('strval', is_array($answer) ? $answer : [$answer]));

            return $selected === [(string) $expected];
        }

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

    private function resolveDefault(mixed $default): mixed
    {
        if (! is_string($default)) {
            return $default;
        }

        if ($default === '{unique_value}') {
            return (string) Str::uuid();
        }

        if (str_starts_with($default, '{date ')) {
            return now()->format('Y-m-d H:i:s');
        }

        if (str_starts_with($default, '{user_')) {
            return null;
        }

        return $default;
    }

    private function age(mixed $date): ?int
    {
        if (! is_string($date) || $date === '') {
            return null;
        }

        foreach (['d/m/Y', 'Y-m-d'] as $format) {
            try {
                return CarbonImmutable::createFromFormat($format, $date)->age;
            } catch (\Throwable) {
            }
        }

        return null;
    }

    private function isEmpty(mixed $value): bool
    {
        if (is_array($value) && array_key_exists('value', $value)) {
            $value = $value['value'];
        }

        return $value === null || $value === '' || $value === [];
    }
}
