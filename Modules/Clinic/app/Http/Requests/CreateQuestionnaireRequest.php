<?php

namespace Modules\Clinic\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateQuestionnaireRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->clinics()->wherePivotIn('role', ['owner', 'admin'])->exists() === true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'wpforms_export' => ['nullable', 'array'],
            'wpforms_export.*' => ['array'],
            'wpforms_export.*.id' => ['required_with:wpforms_export', 'string'],
            'wpforms_export.*.fields' => ['required_with:wpforms_export', 'array'],
            'replace_existing' => ['sometimes', 'boolean'],
            'name' => ['required_without:wpforms_export', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'alpha_dash', 'max:120', Rule::unique('questionnaires', 'slug')],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', 'string', 'in:draft,published,archived'],
            'settings' => ['nullable', 'array'],
            'layout' => ['nullable', 'array'],
            'questions' => ['required_without:wpforms_export', 'array', 'min:1'],
            'questions.*' => ['array:key,type,label,description,placeholder,is_required,options,validation,settings,sort_order'],
            'questions.*.key' => ['required_without:wpforms_export', 'string', 'max:120', 'distinct'],
            'questions.*.type' => ['required_without:wpforms_export', 'string', 'max:100'],
            'questions.*.label' => ['required_without:wpforms_export', 'nullable', 'string', 'max:5000'],
            'questions.*.description' => ['nullable', 'string', 'max:10000'],
            'questions.*.placeholder' => ['nullable', 'string', 'max:1000'],
            'questions.*.is_required' => ['nullable', 'boolean'],
            'questions.*.options' => ['nullable', 'array'],
            'questions.*.validation' => ['nullable', 'array'],
            'questions.*.settings' => ['nullable', 'array'],
            'questions.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
