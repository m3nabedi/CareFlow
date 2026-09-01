<?php

namespace Modules\Clinic\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateQuestionnaireRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'required', 'string', 'alpha_dash', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'required', 'string', 'in:draft,published,archived'],
            'settings' => ['sometimes', 'nullable', 'array'],
            'layout' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
