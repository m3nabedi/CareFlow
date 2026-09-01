<?php

namespace Modules\Clinic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Modules\Clinic\Http\Requests\CreateQuestionnaireRequest;
use Modules\Clinic\Http\Requests\UpdateClinicRequest;
use Modules\Clinic\Http\Requests\UpdateQuestionnaireRequest;
use Modules\Clinic\Http\Requests\UpdateQuestionRequest;
use Modules\Clinic\Http\Requests\UpdateSubmissionAnswerRequest;
use Modules\Clinic\Http\Requests\UpdateSubmissionStatusRequest;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Question;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Models\Submission;
use Modules\Clinic\Services\WpFormsImportService;

class AdminClinicController extends Controller
{
    public function showCurrent(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->clinicData($this->currentClinic($request)->loadCount('questionnaires'))]);
    }

    public function updateCurrent(UpdateClinicRequest $request): JsonResponse
    {
        $clinic = $this->currentClinic($request);
        $clinic->update($request->validated());

        return response()->json(['data' => $this->clinicData($clinic->fresh()->loadCount('questionnaires'))]);
    }

    public function show(Clinic $clinic): JsonResponse
    {
        return response()->json(['data' => $this->clinicData($clinic->loadCount('questionnaires'))]);
    }

    public function update(UpdateClinicRequest $request, Clinic $clinic): JsonResponse
    {
        $clinic->update($request->validated());

        return response()->json(['data' => $this->clinicData($clinic->fresh()->loadCount('questionnaires'))]);
    }

    public function questionnaires(Clinic $clinic): JsonResponse
    {
        $questionnaires = $clinic->questionnaires()
            ->with('questions')
            ->withCount('submissions')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $questionnaires->map(fn (Questionnaire $questionnaire): array => $this->questionnaireData($questionnaire))->all()]);
    }

    public function currentQuestionnaires(Request $request): JsonResponse
    {
        return $this->questionnaires($this->currentClinic($request));
    }

    public function createCurrentQuestionnaire(CreateQuestionnaireRequest $request, WpFormsImportService $importer): JsonResponse
    {
        $clinic = $this->currentClinic($request);
        $validated = $request->validated();

        if (array_key_exists('wpforms_export', $validated)) {
            $result = $importer->import($validated['wpforms_export'], $validated['replace_existing'] ?? false, $clinic);

            return response()->json(['data' => [
                'result' => $result,
                'questionnaires' => $clinic->questionnaires()->with('questions')->withCount('submissions')->latest()->get()
                    ->map(fn (Questionnaire $questionnaire): array => $this->questionnaireData($questionnaire))->all(),
            ]], 201);
        }

        $questionnaire = DB::transaction(function () use ($clinic, $validated): Questionnaire {
            $questionnaire = $clinic->questionnaires()->create([
                'name' => $validated['name'],
                'slug' => $validated['slug'] ?? $this->availableQuestionnaireSlug($validated['name']),
                'description' => $validated['description'] ?? null,
                'status' => $validated['status'] ?? 'draft',
                'settings' => $validated['settings'] ?? [],
                'layout' => $validated['layout'] ?? [],
            ]);

            foreach ($validated['questions'] as $position => $question) {
                $questionnaire->questions()->create([
                    ...$question,
                    'is_required' => $question['is_required'] ?? false,
                    'sort_order' => $question['sort_order'] ?? $position,
                ]);
            }

            return $questionnaire;
        });

        return response()->json(['data' => $this->questionnaireData($questionnaire->load('questions')->loadCount('submissions'))], 201);
    }

    public function questionnaire(Clinic $clinic, Questionnaire $questionnaire): JsonResponse
    {
        return response()->json(['data' => $this->questionnaireData($questionnaire->load('questions')->loadCount('submissions'))]);
    }

    public function currentQuestionnaire(Request $request, Questionnaire $questionnaire): JsonResponse
    {
        $clinic = $this->currentClinic($request);
        abort_unless($questionnaire->clinic_id === $clinic->id, 404);

        return $this->questionnaire($clinic, $questionnaire);
    }

    public function updateQuestionnaire(UpdateQuestionnaireRequest $request, Clinic $clinic, Questionnaire $questionnaire): JsonResponse
    {
        $validated = $request->validated();
        if (array_key_exists('slug', $validated)) {
            validator($validated, [
                'slug' => [Rule::unique('questionnaires', 'slug')->ignore($questionnaire)],
            ])->validate();
        }
        $questionnaire->update($validated);

        return response()->json(['data' => $this->questionnaireData($questionnaire->fresh()->load('questions')->loadCount('submissions'))]);
    }

    public function updateCurrentQuestionnaire(UpdateQuestionnaireRequest $request, Questionnaire $questionnaire): JsonResponse
    {
        $clinic = $this->currentClinic($request);
        abort_unless($questionnaire->clinic_id === $clinic->id, 404);

        return $this->updateQuestionnaire($request, $clinic, $questionnaire);
    }

    public function updateQuestion(UpdateQuestionRequest $request, Clinic $clinic, Questionnaire $questionnaire, Question $question): JsonResponse
    {
        $validated = $request->validated();
        if (array_key_exists('key', $validated)) {
            validator($validated, [
                'key' => [Rule::unique('questions', 'key')->where('questionnaire_id', $questionnaire->id)->ignore($question)],
            ])->validate();
        }
        $question->update($validated);

        return response()->json(['data' => $this->questionData($question->fresh())]);
    }

    public function updateCurrentQuestion(UpdateQuestionRequest $request, Questionnaire $questionnaire, Question $question): JsonResponse
    {
        $clinic = $this->currentClinic($request);
        abort_unless($questionnaire->clinic_id === $clinic->id && $question->questionnaire_id === $questionnaire->id, 404);

        return $this->updateQuestion($request, $clinic, $questionnaire, $question);
    }

    public function responses(Request $request, Clinic $clinic, Questionnaire $questionnaire): JsonResponse
    {
        abort_unless($request->user()?->isClinicAdministrator($clinic), 403);
        $submissions = $questionnaire->submissions()
            ->with(['answers', 'questionnaire:id,clinic_id,name,slug'])
            ->latest('submitted_at')
            ->paginate($this->perPage($request));

        return response()->json([
            'data' => $submissions->getCollection()->map(fn (Submission $submission): array => $this->responseData($submission))->all(),
            'meta' => [
                'current_page' => $submissions->currentPage(),
                'last_page' => $submissions->lastPage(),
                'per_page' => $submissions->perPage(),
                'total' => $submissions->total(),
            ],
        ]);
    }

    public function currentResponses(Request $request, Questionnaire $questionnaire): JsonResponse
    {
        $clinic = $this->currentClinic($request);
        abort_unless($questionnaire->clinic_id === $clinic->id, 404);

        return $this->responses($request, $clinic, $questionnaire);
    }

    public function currentAllResponses(Request $request): JsonResponse
    {
        $clinic = $this->currentClinic($request);
        $submissions = Submission::query()
            ->whereHas('questionnaire', fn ($query) => $query->where('clinic_id', $clinic->id))
            ->with(['answers', 'questionnaire:id,clinic_id,name,slug'])
            ->latest('submitted_at')
            ->paginate($this->perPage($request));

        return response()->json([
            'data' => $submissions->getCollection()->map(fn (Submission $submission): array => $this->responseData($submission))->all(),
            'meta' => [
                'current_page' => $submissions->currentPage(),
                'last_page' => $submissions->lastPage(),
                'per_page' => $submissions->perPage(),
                'total' => $submissions->total(),
            ],
        ]);
    }

    public function updateCurrentResponse(
        UpdateSubmissionStatusRequest $request,
        Questionnaire $questionnaire,
        Submission $submission,
    ): JsonResponse {
        $clinic = $this->currentClinic($request);
        abort_unless(
            $questionnaire->clinic_id === $clinic->id && $submission->questionnaire_id === $questionnaire->id,
            404,
        );

        $submission->update($request->validated());

        return response()->json([
            'data' => $this->responseData($submission->fresh()->load(['answers', 'questionnaire:id,clinic_id,name,slug'])),
        ]);
    }

    public function updateCurrentResponseAnswer(
        UpdateSubmissionAnswerRequest $request,
        Questionnaire $questionnaire,
        Submission $submission,
        string $questionKey,
    ): JsonResponse {
        $clinic = $this->currentClinic($request);
        abort_unless(
            $questionnaire->clinic_id === $clinic->id && $submission->questionnaire_id === $questionnaire->id,
            404,
        );

        $question = $questionnaire->questions()->where('key', $questionKey)->firstOrFail();
        $value = $request->validated('value');
        $answer = $submission->answers()->firstOrNew(['question_key' => $questionKey]);
        $answer->question()->associate($question);
        $answer->value = ['value' => $value];
        $answer->display_value = is_scalar($value) ? (string) $value : null;
        $answer->save();

        return response()->json([
            'data' => $this->responseData($submission->fresh()->load(['answers', 'questionnaire:id,clinic_id,name,slug'])),
        ]);
    }

    private function currentClinic(Request $request): Clinic
    {
        $clinic = $request->user()?->clinics()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->orderBy('clinics.name')
            ->first();

        abort_unless($clinic instanceof Clinic, 403, 'This account does not have clinic administrator access.');

        return $clinic;
    }

    /** @return array<string, mixed> */
    private function clinicData(Clinic $clinic): array
    {
        return [
            'id' => $clinic->id,
            'name' => $clinic->name,
            'slug' => $clinic->slug,
            'publicDomain' => $clinic->public_domain,
            'settings' => $clinic->settings,
            'branding' => $clinic->branding,
            'questionnairesCount' => $clinic->questionnaires_count,
        ];
    }

    /** @return array<string, mixed> */
    private function questionnaireData(Questionnaire $questionnaire): array
    {
        return [
            'id' => $questionnaire->id,
            'uuid' => $questionnaire->uuid,
            'name' => $questionnaire->name,
            'slug' => $questionnaire->slug,
            'description' => $questionnaire->description,
            'status' => $questionnaire->status,
            'settings' => $this->redactedSettings($questionnaire->settings),
            'layout' => $questionnaire->layout,
            'submissionsCount' => $questionnaire->submissions_count,
            'questions' => $questionnaire->questions->map(fn (Question $question): array => $this->questionData($question))->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function questionData(Question $question): array
    {
        return [
            'id' => $question->id,
            'uuid' => $question->uuid,
            'key' => $question->key,
            'type' => $question->type,
            'label' => $question->label,
            'description' => $question->description,
            'placeholder' => $question->placeholder,
            'isRequired' => $question->is_required,
            'options' => $question->options,
            'validation' => $question->validation,
            'settings' => $question->settings,
            'sortOrder' => $question->sort_order,
        ];
    }

    /** @return array<string, mixed> */
    private function responseData(Submission $submission): array
    {
        return [
            'id' => $submission->id,
            'uuid' => $submission->uuid,
            'status' => $submission->status,
            'metadata' => $submission->metadata,
            'submittedAt' => $submission->submitted_at?->toISOString(),
            'questionnaire' => [
                'id' => $submission->questionnaire->id,
                'name' => $submission->questionnaire->name,
                'slug' => $submission->questionnaire->slug,
            ],
            'answers' => $submission->answers->mapWithKeys(fn ($answer): array => [$answer->question_key => $answer->value['value'] ?? null])->all(),
        ];
    }

    /** @param array<string, mixed>|null $settings @return array<string, mixed>|null */
    private function redactedSettings(?array $settings): ?array
    {
        if ($settings === null) {
            return null;
        }

        array_walk_recursive($settings, function (mixed &$value, string $key): void {
            if (preg_match('/(api[_-]?key|token|secret|password)$/i', $key) === 1) {
                $value = '[redacted]';
            }
        });

        return $settings;
    }

    private function availableQuestionnaireSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'questionnaire';
        $slug = $base;
        $suffix = 2;

        while (Questionnaire::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    private function perPage(Request $request): int
    {
        return min(max($request->integer('per_page', 50), 1), 200);
    }
}
