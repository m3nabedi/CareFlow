<?php

namespace Modules\Clinic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Modules\Clinic\Http\Requests\StoreQuestionnaireSubmissionRequest;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Models\Submission;
use Modules\Clinic\Services\ConfirmationService;
use Modules\Clinic\Services\FormRuntimeService;
use Throwable;

class SubmissionController extends Controller
{
    public function clinicEvaluate(Request $request, Clinic $clinic, Questionnaire $questionnaire, FormRuntimeService $runtime): JsonResponse
    {
        return $this->evaluate($request, $questionnaire, $runtime);
    }

    public function clinicIndex(Request $request, Clinic $clinic, Questionnaire $questionnaire): JsonResponse
    {
        return $this->index($request, $questionnaire);
    }

    public function clinicStore(StoreQuestionnaireSubmissionRequest $request, Clinic $clinic, Questionnaire $questionnaire, FormRuntimeService $runtime): JsonResponse
    {
        return $this->store($request, $questionnaire, $runtime);
    }

    public function evaluate(Request $request, Questionnaire $questionnaire, FormRuntimeService $runtime): JsonResponse
    {
        abort_unless($questionnaire->status === 'published', 404);

        $answers = $request->input('answers', []);
        if (is_string($answers)) {
            $answers = json_decode($answers, true);
        }

        abort_unless(is_array($answers), 422, 'The answers must be a JSON object.');

        $answers = $runtime->hydrateServerValues($questionnaire, $answers);
        $visibleFields = collect($runtime->fields($questionnaire))
            ->filter(fn (array $field): bool => $runtime->isVisible($field, $answers))
            ->pluck('key')
            ->values()
            ->all();

        return response()->json(['data' => [
            'visibleFields' => $visibleFields,
            'gateViolations' => $runtime->gateViolations($questionnaire, $answers),
            'recommendations' => $runtime->recommendations($questionnaire, $answers),
            'derivedAnswers' => collect($answers)->only(['wpforms_75', 'wpforms_76', 'wpforms_78', 'wpforms_87', 'wpforms_92', 'wpforms_93', 'wpforms_94', 'wpforms_95'])->all(),
        ]]);
    }

    public function index(Request $request, Questionnaire $questionnaire): JsonResponse
    {
        abort_unless(
            $questionnaire->clinic_id !== null && $request->user()?->clinics()->whereKey($questionnaire->clinic_id)->exists(),
            403,
        );

        $submissions = $questionnaire->submissions()
            ->with('answers')
            ->latest('submitted_at')
            ->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $submissions->getCollection()->map(fn (Submission $submission): array => $this->submissionData($submission, $questionnaire))->all(),
            'meta' => [
                'current_page' => $submissions->currentPage(),
                'last_page' => $submissions->lastPage(),
                'per_page' => $submissions->perPage(),
                'total' => $submissions->total(),
            ],
        ]);
    }

    public function store(StoreQuestionnaireSubmissionRequest $request, Questionnaire $questionnaire, FormRuntimeService $runtime): JsonResponse
    {
        abort_unless($questionnaire->status === 'published', 404);

        $validated = $request->validated();
        $questions = $questionnaire->questions()->get()->keyBy('key');
        $fields = collect($runtime->fields($questionnaire))->keyBy('key');
        $answers = $runtime->hydrateServerValues($questionnaire, $validated['answers']);
        $files = $request->file('files', []);
        $files = is_array($files) ? $files : [];

        foreach ($fields as $key => $field) {
            if (! $runtime->isVisible($field, $answers) && ! ($field['hidden'] ?? false)) {
                unset($answers[$key]);
            }
        }

        $storedPaths = [];

        try {
            $submission = DB::transaction(function () use ($questionnaire, $validated, $questions, $files, &$answers, &$storedPaths) {
                $submission = $questionnaire->submissions()->create([
                    'status' => 'submitted',
                    'metadata' => $validated['metadata'] ?? null,
                    'submitted_at' => now(),
                ]);

                foreach ($files as $key => $file) {
                    $question = $questions->get($key);
                    if ($question === null) {
                        continue;
                    }

                    $extension = $file->extension();
                    $filename = Str::random(40).($extension === '' ? '' : '.'.$extension);
                    $directory = "clinics/clinic-{$questionnaire->clinic_id}/submissions/{$submission->uuid}/question-{$question->id}";
                    $path = Storage::disk('local')->putFileAs($directory, $file, $filename);
                    $storedPaths[] = $path;
                    $answers[$key] = [
                        'attachment_id' => (string) Str::uuid(),
                        'disk' => 'local',
                        'storage_path' => $path,
                        'original_name' => basename($file->getClientOriginalName()),
                        'mime_type' => $file->getMimeType(),
                        'size' => $file->getSize(),
                    ];
                }

                foreach ($answers as $key => $value) {
                    $question = $questions->get($key);
                    if ($question === null) {
                        continue;
                    }

                    $displayValue = is_array($value)
                        ? ($value['original_name'] ?? implode(', ', array_filter($value, 'is_scalar')))
                        : (string) $value;

                    $submission->answers()->create([
                        'question_id' => $question->id,
                        'question_key' => $key,
                        'value' => ['value' => $value],
                        'display_value' => $displayValue,
                    ]);
                }

                return $submission;
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($storedPaths);

            throw $exception;
        }

        $submission->load('answers');
        $data = $this->submissionData($submission, $questionnaire);
        $data['confirmation'] = app(ConfirmationService::class)->resolve($questionnaire, $answers);

        return response()->json(['data' => $data], 201);
    }

    /** @return array<string, mixed> */
    private function submissionData(Submission $submission, ?Questionnaire $questionnaire = null): array
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
            'answers' => $submission->answers->mapWithKeys(function ($answer): array {
                $value = $answer->value['value'] ?? null;

                if (is_array($value) && isset($value['attachment_id'])) {
                    unset($value['disk'], $value['storage_path']);
                }

                return [$answer->question_key => $value];
            })->all(),
            'recommendations' => $questionnaire === null ? [] : app(FormRuntimeService::class)->recommendations(
                $questionnaire,
                $submission->answers->mapWithKeys(fn ($answer): array => [$answer->question_key => $answer->value['value'] ?? null])->all(),
            ),
        ];
    }
}
