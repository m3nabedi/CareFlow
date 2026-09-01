<?php

namespace Modules\Clinic\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateQuestionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $questionnaire = $this->route('questionnaire');
        $clinic = $this->route('clinic') ?? $questionnaire?->clinic;

        return $clinic !== null && $this->user()?->isClinicAdministrator($clinic) === true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'key' => ['sometimes', 'required', 'string', 'max:120'],
            'type' => ['sometimes', 'required', 'string', 'max:100'],
            'label' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'placeholder' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'is_required' => ['sometimes', 'boolean'],
            'options' => ['sometimes', 'nullable', 'array'],
            'validation' => ['sometimes', 'nullable', 'array'],
            'settings' => ['sometimes', 'nullable', 'array'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
