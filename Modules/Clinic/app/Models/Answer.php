<?php

namespace Modules\Clinic\Models;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Clinic\Database\Factories\AnswerFactory;

class Answer extends Model
{
    /** @use HasFactory<AnswerFactory> */
    use HasFactory;

    protected $fillable = ['submission_id', 'question_id', 'question_key', 'value', 'display_value'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    protected static function newFactory(): Factory
    {
        return AnswerFactory::new();
    }
}
