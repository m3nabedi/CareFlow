<?php

namespace Modules\Clinic\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Questionnaire;

class WpFormsImportService
{
    /** @param array<int, array<string, mixed>> $forms @return array{created: int, replaced: int, skipped: int} */
    public function import(array $forms, bool $replaceExisting = false, ?Clinic $clinic = null): array
    {
        $result = ['created' => 0, 'replaced' => 0, 'skipped' => 0];

        foreach ($forms as $form) {
            if (! is_array($form) || ! isset($form['id'], $form['fields'])) {
                throw new InvalidArgumentException('The JSON file does not contain a valid WPForms export.');
            }

            DB::transaction(function () use ($form, $replaceExisting, $clinic, &$result): void {
                /** @var array<string, mixed> $settings */
                $settings = Arr::get($form, 'settings', []);
                $sourceId = (string) $form['id'];
                $questionnaire = Questionnaire::query()
                    ->where('settings->wpforms_form_id', $sourceId)
                    ->when($clinic, fn ($query) => $query->whereBelongsTo($clinic))
                    ->first();

                if ($questionnaire !== null && ! $replaceExisting) {
                    $result['skipped']++;

                    return;
                }

                if ($questionnaire !== null) {
                    $questionnaire->questions()->delete();
                    $result['replaced']++;
                } else {
                    $questionnaire = new Questionnaire;
                    $result['created']++;
                }

                $questionnaire->fill([
                    'clinic_id' => $clinic?->id,
                    'name' => (string) ($settings['form_title'] ?? "WPForms {$sourceId}"),
                    'slug' => $this->uniqueSlug((string) ($settings['form_title'] ?? "wpforms-{$sourceId}"), $questionnaire->id),
                    'description' => $settings['form_desc'] ?? null,
                    'status' => 'published',
                    'settings' => ['source' => 'wpforms', 'wpforms_form_id' => $sourceId, 'wpforms_settings' => $settings, 'wpforms_providers' => Arr::get($form, 'providers', []), 'wpforms_meta' => Arr::get($form, 'meta', [])],
                    'layout' => $this->layout($form),
                ]);
                $questionnaire->save();

                foreach (array_values($form['fields']) as $position => $field) {
                    if (! is_array($field)) {
                        continue;
                    }

                    $fieldId = (string) ($field['id'] ?? $position + 1);
                    $questionnaire->questions()->create([
                        'key' => "wpforms_{$fieldId}",
                        'type' => $this->fieldType((string) ($field['type'] ?? 'text')),
                        'label' => (string) ($field['label'] ?? $field['name'] ?? ''),
                        'description' => $field['description'] ?? null,
                        'placeholder' => $field['placeholder'] ?? $field['date_placeholder'] ?? null,
                        'is_required' => ($field['required'] ?? '0') === '1',
                        'options' => $this->options($field),
                        'validation' => Arr::only($field, ['min', 'max', 'format', 'date_format', 'date_type', 'time_format', 'input_mask', 'confirmation']),
                        'settings' => ['source' => 'wpforms', 'wpforms_field_id' => $fieldId, 'wpforms_type' => $field['type'] ?? 'text', 'wpforms' => $field],
                        'sort_order' => $position + 1,
                    ]);
                }
            });
        }

        return $result;
    }

    /** @param array<string, mixed> $form */
    private function layout(array $form): array
    {
        return [
            'source' => 'wpforms',
            'field_order' => array_map(static fn (mixed $field): string => (string) ($field['id'] ?? ''), array_values($form['fields'])),
            'layouts' => array_values(array_filter($form['fields'], static fn (mixed $field): bool => is_array($field) && ($field['type'] ?? null) === 'layout')),
            'pages' => array_values(array_filter($form['fields'], static fn (mixed $field): bool => is_array($field) && ($field['type'] ?? null) === 'pagebreak')),
        ];
    }

    /** @param array<string, mixed> $field */
    private function options(array $field): ?array
    {
        if (! isset($field['choices']) || ! is_array($field['choices'])) {
            return null;
        }

        $isList = array_is_list($field['choices']);

        return collect($field['choices'])->map(fn (mixed $choice, mixed $id): array => [
            'id' => (string) ($isList ? $id + 1 : $id),
            ...(is_array($choice) ? $choice : ['label' => (string) $choice]),
        ])->values()->all();
    }

    private function fieldType(string $type): string
    {
        return match ($type) {
            'date-time' => 'date',
            'file-upload' => 'file',
            default => $type,
        };
    }

    private function uniqueSlug(string $name, mixed $ignoreId): string
    {
        $base = Str::slug($name) ?: 'questionnaire';
        $slug = $base;
        $suffix = 2;

        while (Questionnaire::query()->where('slug', $slug)->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))->exists()) {
            $slug = "{$base}-{$suffix}";
            $suffix++;
        }

        return $slug;
    }
}
