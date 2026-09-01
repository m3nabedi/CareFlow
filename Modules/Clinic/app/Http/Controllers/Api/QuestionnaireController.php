<?php

namespace Modules\Clinic\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Modules\Clinic\Http\Resources\QuestionnaireResource;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Questionnaire;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class QuestionnaireController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $questionnaires = QueryBuilder::for(Questionnaire::class)
            ->where('status', 'published')
            ->allowedFilters(AllowedFilter::exact('clinic_id'), AllowedFilter::exact('status'), AllowedFilter::partial('name'))
            ->allowedSorts('name', 'created_at', 'updated_at')
            ->with('clinic')
            ->withCount(['questions', 'submissions'])
            ->paginate($request->integer('per_page', 20));

        return QuestionnaireResource::collection($questionnaires);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $identifier): QuestionnaireResource
    {
        $questionnaire = Questionnaire::query()
            ->where(function ($query) use ($identifier): void {
                $query->where('id', $identifier)->orWhere('slug', $identifier);
            })
            ->where('status', 'published')
            ->with(['clinic', 'questions'])
            ->firstOrFail();

        return new QuestionnaireResource($questionnaire);
    }

    public function clinicIndex(Request $request, Clinic $clinic): AnonymousResourceCollection
    {
        $questionnaires = QueryBuilder::for($clinic->questionnaires()->where('status', 'published'))
            ->allowedFilters(AllowedFilter::partial('name'))
            ->allowedSorts('name', 'created_at', 'updated_at')
            ->with('clinic')
            ->withCount(['questions', 'submissions'])
            ->paginate($request->integer('per_page', 20));

        return QuestionnaireResource::collection($questionnaires);
    }

    public function clinicShow(Clinic $clinic, Questionnaire $questionnaire): QuestionnaireResource
    {
        abort_unless($questionnaire->status === 'published', 404);

        return new QuestionnaireResource($questionnaire->load(['clinic', 'questions']));
    }
}
