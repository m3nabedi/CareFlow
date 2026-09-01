<?php

namespace App\Models;

use Database\Factories\QuestionnaireFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Questionnaire extends Model
{
    /** @use HasFactory<QuestionnaireFactory> */
    use HasFactory;

    protected $guarded = [];

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
}
