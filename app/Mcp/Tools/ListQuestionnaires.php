<?php

namespace App\Mcp\Tools;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;
use Modules\Clinic\Models\Questionnaire;

#[Description('List the questionnaires available in CareFlow, including form field and submission counts.')]
#[IsReadOnly]
class ListQuestionnaires extends Tool
{
    /**
     * Handle the tool request.
     */
    public function handle(Request $request): Response
    {
        return Response::structured([
            'questionnaires' => Questionnaire::query()
                ->with('clinic:id,name,slug')
                ->withCount(['questions', 'submissions'])
                ->orderBy('name')
                ->get(['id', 'clinic_id', 'uuid', 'name', 'slug', 'description', 'status'])
                ->map(fn (Questionnaire $questionnaire): array => [
                    'id' => $questionnaire->id,
                    'uuid' => $questionnaire->uuid,
                    'name' => $questionnaire->name,
                    'slug' => $questionnaire->slug,
                    'description' => $questionnaire->description,
                    'status' => $questionnaire->status,
                    'clinic' => $questionnaire->clinic === null ? null : ['name' => $questionnaire->clinic->name, 'slug' => $questionnaire->clinic->slug],
                    'questions_count' => $questionnaire->questions_count,
                    'submissions_count' => $questionnaire->submissions_count,
                ])
                ->all(),
        ]);
    }

    /**
     * Get the tool's input schema.
     *
     * @return array<string, Type>
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            //
        ];
    }
}
