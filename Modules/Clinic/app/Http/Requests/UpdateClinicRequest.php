<?php

namespace Modules\Clinic\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateClinicRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('public_domain') && $this->input('public_domain') !== null) {
            $this->merge(['public_domain' => $this->normalizedDomain($this->string('public_domain')->toString())]);
        }
    }

    public function authorize(): bool
    {
        $clinic = $this->route('clinic') ?? $this->user()?->clinics()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->orderBy('clinics.name')
            ->first();

        return $clinic !== null && $this->user()?->isClinicAdministrator($clinic) === true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $clinic = $this->route('clinic') ?? $this->user()?->clinics()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->orderBy('clinics.name')
            ->first();

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'required', 'string', 'alpha_dash', 'max:120', Rule::unique('clinics', 'slug')->ignore($clinic)],
            'public_domain' => ['sometimes', 'nullable', 'string', 'max:253', Rule::unique('clinics', 'public_domain')->ignore($clinic)],
            'settings' => ['sometimes', 'nullable', 'array'],
            'branding' => ['sometimes', 'nullable', 'array'],
        ];
    }

    private function normalizedDomain(string $domain): string
    {
        return mb_strtolower(preg_replace('#^https?://#', '', trim($domain)) ?? '');
    }
}
