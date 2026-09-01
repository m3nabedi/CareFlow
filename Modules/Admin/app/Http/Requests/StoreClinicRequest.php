<?php

namespace Modules\Admin\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreClinicRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->filled('public_domain')) {
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
        return [
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'alpha_dash', 'max:120', Rule::unique('clinics', 'slug')],
            'public_domain' => ['nullable', 'string', 'max:253', Rule::unique('clinics', 'public_domain')],
            'settings' => ['nullable', 'array'],
            'branding' => ['nullable', 'array'],
            'members' => ['nullable', 'array'],
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
