<?php

namespace App\Models;

use Database\Factories\SubmissionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Submission extends Model
{
    /** @use HasFactory<SubmissionFactory> */
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'submitted_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $submission): void {
            $submission->uuid ??= (string) Str::uuid();
        });
    }

    public function questionnaire(): BelongsTo
    {
        return $this->belongsTo(Questionnaire::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(Answer::class);
    }
}
