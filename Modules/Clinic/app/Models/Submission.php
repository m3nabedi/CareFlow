<?php

namespace Modules\Clinic\Models;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Modules\Clinic\Database\Factories\SubmissionFactory;

class Submission extends Model
{
    /** @use HasFactory<SubmissionFactory> */
    use HasFactory;

    protected $fillable = ['questionnaire_id', 'uuid', 'status', 'metadata', 'submitted_at'];

    protected function casts(): array
    {
        return ['metadata' => 'array', 'submitted_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $submission): void {
            $submission->uuid ??= (string) Str::uuid();
        });

        static::deleting(function (self $submission): void {
            $submission->loadMissing('answers');

            foreach ($submission->answers as $answer) {
                $attachment = $answer->value['value'] ?? null;
                if (is_array($attachment) && isset($attachment['disk'], $attachment['storage_path'])) {
                    Storage::disk($attachment['disk'])->delete($attachment['storage_path']);
                }
            }
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

    protected static function newFactory(): Factory
    {
        return SubmissionFactory::new();
    }
}
