<?php

namespace Modules\Clinic\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;
use Modules\Clinic\Database\Factories\ClinicFactory;

class Clinic extends Model
{
    /** @use HasFactory<ClinicFactory> */
    use HasFactory;

    protected $fillable = ['name', 'slug', 'settings', 'branding'];

    protected function casts(): array
    {
        return ['settings' => 'array', 'branding' => 'array'];
    }

    protected static function booted(): void
    {
        static::saving(function (self $clinic): void {
            $settings = $clinic->settings ?? [];
            $default = $settings['default_calling_code'] ?? null;
            $allowed = collect($settings['allowed_calling_codes'] ?? [])->map(
                fn (mixed $entry): mixed => is_array($entry) ? ($entry['callingCode'] ?? $entry['calling_code'] ?? null) : $entry,
            );

            if ($default !== null && ! $allowed->containsStrict($default)) {
                throw new InvalidArgumentException('The clinic default calling code must be included in its allowed calling codes.');
            }
        });
    }

    public function questionnaires(): HasMany
    {
        return $this->hasMany(Questionnaire::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    /** @return array<string, mixed> */
    public function regionalSettings(): array
    {
        $settings = $this->settings ?? [];

        return [
            'locale' => $settings['locale'] ?? 'en',
            'timezone' => $settings['timezone'] ?? 'UTC',
            'defaultCallingCode' => $settings['default_calling_code'] ?? null,
            'allowedCallingCodes' => $settings['allowed_calling_codes'] ?? [],
        ];
    }

    protected static function newFactory(): Factory
    {
        return ClinicFactory::new();
    }
}
