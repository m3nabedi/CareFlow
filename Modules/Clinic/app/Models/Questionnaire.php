<?php

namespace Modules\Clinic\Models;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Modules\Clinic\Database\Factories\QuestionnaireFactory;

class Questionnaire extends Model
{
    /** @use HasFactory<QuestionnaireFactory> */
    use HasFactory;

    protected $fillable = ['clinic_id', 'uuid', 'name', 'slug', 'description', 'status', 'settings', 'layout'];

    protected function casts(): array
    {
        return ['settings' => 'array', 'layout' => 'array'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $questionnaire): void {
            $questionnaire->uuid ??= (string) Str::uuid();
        });
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('sort_order');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    protected static function newFactory(): Factory
    {
        return QuestionnaireFactory::new();
    }
}
