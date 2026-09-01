<?php

namespace Modules\Clinic\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RegisterClinicAdminRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (! $this->filled('name') && ($this->filled('firstName') || $this->filled('lastName'))) {
            $this->merge(['name' => trim($this->string('firstName')->toString().' '.$this->string('lastName')->toString())]);
        }

        if (! $this->has('clinic') && $this->filled('clinicName')) {
            $this->merge([
                'clinic' => array_filter([
                    'name' => $this->string('clinicName')->toString(),
                    'slug' => $this->filled('clinicSlug') ? $this->string('clinicSlug')->toString() : null,
                ], static fn (mixed $value): bool => $value !== null),
            ]);
        }

        if ($this->filled('email')) {
            $this->merge(['email' => mb_strtolower($this->string('email')->trim()->toString())]);
        }

        if ($this->filled('phone')) {
            $this->merge(['phone' => preg_replace('/[\s()-]+/', '', $this->string('phone')->toString())]);
        }

        if ($this->filled('clinic.public_domain')) {
            $this->merge([
                'clinic' => array_replace($this->input('clinic', []), [
                    'public_domain' => $this->normalizedDomain($this->string('clinic.public_domain')->toString()),
                ]),
            ]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'firstName' => ['nullable', 'string', 'max:120'],
            'lastName' => ['nullable', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'regex:/^\+[1-9][0-9]{6,31}$/', Rule::unique('users', 'phone')],
            'password' => ['required', 'string', 'min:12', 'max:255'],
            'clinic' => ['required', 'array:name,slug,public_domain,settings,branding'],
            'clinicName' => ['nullable', 'string', 'max:255'],
            'clinicSlug' => ['nullable', 'string', 'alpha_dash', 'max:120'],
            'clinic.name' => ['required', 'string', 'max:255'],
            'clinic.slug' => ['nullable', 'string', 'alpha_dash', 'max:120', Rule::unique('clinics', 'slug')],
            'clinic.public_domain' => ['nullable', 'string', 'max:253', Rule::unique('clinics', 'public_domain')],
            'clinic.settings' => ['nullable', 'array'],
            'clinic.branding' => ['nullable', 'array'],
        ];
    }

    private function normalizedDomain(string $domain): string
    {
        return mb_strtolower(preg_replace('#^https?://#', '', trim($domain)) ?? '');
    }
}
