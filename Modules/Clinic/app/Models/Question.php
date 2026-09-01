<?php

namespace Modules\Clinic\Models;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Modules\Clinic\Database\Factories\QuestionFactory;

class Question extends Model
{
    /** @use HasFactory<QuestionFactory> */
    use HasFactory;

    protected $fillable = ['questionnaire_id', 'uuid', 'key', 'type', 'label', 'description', 'placeholder', 'is_required', 'options', 'validation', 'settings', 'sort_order'];

    protected function casts(): array
    {
        return ['is_required' => 'boolean', 'options' => 'array', 'validation' => 'array', 'settings' => 'array'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $question): void {
            $question->uuid ??= (string) Str::uuid();
        });
    }

    public function questionnaire(): BelongsTo
    {
        return $this->belongsTo(Questionnaire::class);
    }

    protected static function newFactory(): Factory
    {
        return QuestionFactory::new();
    }
}
