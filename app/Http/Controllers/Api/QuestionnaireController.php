<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\QuestionnaireResource;
use App\Models\Questionnaire;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class QuestionnaireController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $questionnaires = QueryBuilder::for(Questionnaire::class)
            ->where('status', 'published')
            ->allowedFilters(AllowedFilter::exact('status'), AllowedFilter::partial('name'))
            ->allowedSorts('name', 'created_at', 'updated_at')
            ->withCount('submissions')
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
            ->with('questions')
            ->firstOrFail();

        return new QuestionnaireResource($questionnaire);
    }
}
