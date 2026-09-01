<?php

namespace Modules\Clinic\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Services\FormRuntimeService;

class StoreQuestionnaireSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('answers'))) {
            $decoded = json_decode($this->string('answers')->toString(), true);
            $this->merge(['answers' => is_array($decoded) ? $decoded : null]);
        }

        if (is_string($this->input('metadata'))) {
            $decoded = json_decode($this->string('metadata')->toString(), true);
            $this->merge(['metadata' => is_array($decoded) ? $decoded : null]);
        }
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'answers' => ['present', 'array'],
            'metadata' => ['nullable', 'array'],
            'files' => ['nullable', 'array'],
            'files.*' => ['file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $questionnaire = $this->route('questionnaire');
            if (! $questionnaire instanceof Questionnaire || $validator->errors()->has('answers')) {
                return;
            }

            $runtime = app(FormRuntimeService::class);
            $answers = $runtime->hydrateServerValues($questionnaire, $this->input('answers', []));
            $fields = collect($runtime->fields($questionnaire))->keyBy('key');
            $files = $this->file('files', []);
            $files = is_array($files) ? $files : [];

            foreach (array_keys($this->input('answers', [])) as $key) {
                if (! $fields->has($key)) {
                    $validator->errors()->add('answers.'.$key, 'This field is not part of the questionnaire.');
                }
            }

            foreach ($files as $key => $file) {
                if (! $fields->has($key) || ($fields->get($key)['type'] ?? null) !== 'file') {
                    $validator->errors()->add('files.'.$key, 'This upload field is not part of the questionnaire.');
                }
            }

            foreach ($fields as $key => $field) {
                $visible = $runtime->isVisible($field, $answers);
                $value = $answers[$key] ?? null;
                $file = $files[$key] ?? null;

                if (! $visible) {
                    continue;
                }

                if (($field['required'] ?? false) && ($field['type'] ?? null) === 'file' && ! $file instanceof UploadedFile) {
                    $validator->errors()->add('files.'.$key, "The {$field['label']} field is required.");

                    continue;
                }

                if (($field['required'] ?? false) && ($field['type'] ?? null) !== 'file' && $this->isEmpty($value)) {
                    $validator->errors()->add('answers.'.$key, "The {$field['label']} field is required.");

                    continue;
                }

                if ($this->isEmpty($value)) {
                    continue;
                }

                $this->validateField($validator, $field, $value);
            }

            foreach ($runtime->gateViolations($questionnaire, $answers) as $gate) {
                $validator->errors()->add('workflow.gates.'.$gate['key'], $gate['blocked']['message'] ?? $gate['blocked']['title']);
            }
        }];
    }

    /** @param array<string, mixed> $field */
    private function validateField(Validator $validator, array $field, mixed $value): void
    {
        $key = $field['key'];
        $type = $field['type'];

        if ($type === 'email') {
            $email = is_array($value) ? ($value['value'] ?? null) : $value;
            if (! is_string($email) || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                $validator->errors()->add('answers.'.$key, "The {$field['label']} must be a valid email address.");
            }

            if (($field['compound']['mustMatch'] ?? false) && (! is_array($value) || ($value['confirmation'] ?? null) !== $email)) {
                $validator->errors()->add('answers.'.$key.'.confirmation', "The {$field['label']} confirmation does not match.");
            }
        }

        if ($type === 'name' && is_array($field['compound']['inputs'] ?? null)) {
            foreach ($field['compound']['inputs'] as $input) {
                if ($this->isEmpty(is_array($value) ? ($value[$input['key']] ?? null) : null)) {
                    $validator->errors()->add('answers.'.$key.'.'.$input['key'], "The {$field['label']} {$input['label']} field is required.");
                }
            }
        }

        if (in_array($type, ['radio', 'select'], true) || $type === 'checkbox') {
            $allowed = collect($field['choices'])->pluck('value')->map(fn (mixed $choice): string => (string) $choice)->all();
            $selected = is_array($value) ? $value : [$value];

            foreach ($selected as $choice) {
                if (! in_array((string) $choice, $allowed, true)) {
                    $validator->errors()->add('answers.'.$key, "The selected {$field['label']} option is invalid.");
                    break;
                }
            }
        }

        if ($type === 'number' && ! is_numeric($value)) {
            $validator->errors()->add('answers.'.$key, "The {$field['label']} must be a number.");
        }
    }

    private function isEmpty(mixed $value): bool
    {
        if (is_array($value) && array_key_exists('value', $value)) {
            $value = $value['value'];
        }

        return $value === null || $value === '' || $value === [];
    }
}
