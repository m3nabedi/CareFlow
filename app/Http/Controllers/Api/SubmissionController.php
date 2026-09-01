<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Questionnaire;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SubmissionController extends Controller
{
    public function index(Request $request, Questionnaire $questionnaire): JsonResponse
    {
        $submissions = $questionnaire->submissions()
            ->with('answers')
            ->latest('submitted_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $submissions->getCollection()->map(fn (Submission $submission): array => $this->submissionData($submission))->all(),
            'meta' => [
                'current_page' => $submissions->currentPage(),
                'last_page' => $submissions->lastPage(),
                'per_page' => $submissions->perPage(),
                'total' => $submissions->total(),
            ],
        ]);
    }

    public function store(Request $request, Questionnaire $questionnaire): JsonResponse
    {
        abort_unless($questionnaire->status === 'published', 404);

        $validated = $request->validate([
            'answers' => ['present', 'array'],
            'answers.*' => ['nullable'],
            'metadata' => ['nullable', 'array'],
        ]);

        $questions = $questionnaire->questions()->get()->keyBy('key');
        $errors = [];

        foreach ($questions->where('is_required', true) as $question) {
            $answer = $validated['answers'][$question->key] ?? null;

            if ($answer === null || $answer === '' || $answer === []) {
                $errors['answers.'.$question->key] = ["The {$question->label} field is required."];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $submission = DB::transaction(function () use ($questionnaire, $validated, $questions) {
            $submission = $questionnaire->submissions()->create([
                'status' => 'submitted',
                'metadata' => $validated['metadata'] ?? null,
                'submitted_at' => now(),
            ]);

            foreach ($validated['answers'] as $key => $value) {
                $question = $questions->get($key);

                if ($question === null) {
                    continue;
                }

                $submission->answers()->create([
                    'question_id' => $question->id,
                    'question_key' => $key,
                    'value' => ['value' => $value],
                    'display_value' => is_array($value) ? implode(', ', $value) : (string) $value,
                ]);
            }

            return $submission;
        });

        return response()->json(['data' => $this->submissionData($submission->load('answers'))], 201);
    }

    /** @return array<string, mixed> */
    private function submissionData(Submission $submission): array
    {
        return [
            'id' => $submission->id,
            'uuid' => $submission->uuid,
            'status' => $submission->status,
            'metadata' => $submission->metadata,
            'submittedAt' => $submission->submitted_at?->toISOString(),
            'createdAt' => $submission->created_at?->toISOString(),
            'submitted_at' => $submission->submitted_at?->toISOString(),
            'created_at' => $submission->created_at?->toISOString(),
            'answers' => $submission->answers->mapWithKeys(fn ($answer): array => [$answer->question_key => $answer->value['value'] ?? null])->all(),
        ];
    }
}
