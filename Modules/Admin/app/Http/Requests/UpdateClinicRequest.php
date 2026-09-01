<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Clinic\Models\Clinic;

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
        return $this->user()?->isPlatformAdministrator() ?? false;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        /** @var Clinic $clinic */
        $clinic = $this->route('clinic');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'required', 'string', 'alpha_dash', 'max:120', Rule::unique('clinics', 'slug')->ignore($clinic)],
            'public_domain' => ['sometimes', 'nullable', 'string', 'max:253', Rule::unique('clinics', 'public_domain')->ignore($clinic)],
            'settings' => ['sometimes', 'nullable', 'array'],
            'branding' => ['sometimes', 'nullable', 'array'],
            'members' => ['sometimes', 'array'],
            'members.*' => ['required', 'array:user_id,role'],
            'members.*.user_id' => ['required', 'integer', 'distinct', Rule::exists('users', 'id')],
            'members.*.role' => ['required', 'string', Rule::in(['owner', 'admin'])],
        ];
    }

    private function normalizedDomain(string $domain): string
    {
        return mb_strtolower(preg_replace('#^https?://#', '', trim($domain)) ?? '');
    }
}
