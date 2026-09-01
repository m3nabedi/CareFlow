<?php

namespace App\Mcp\Tools;

use App\Models\Questionnaire;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\JsonSchema\Types\Type;
use Illuminate\Support\Str;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\Server\Attributes\Description;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Server\Tools\Annotations\IsDestructive;

#[Description('Create a draft CareFlow questionnaire with dynamic fields. The result must be reviewed and published in the application before it is shown to respondents.')]
#[IsDestructive]
class CreateQuestionnaire extends Tool
{
    /**
     * Handle the tool request.
     */
    public function handle(Request $request): Response
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.key' => ['required', 'string', 'max:100', 'regex:/^[a-z][a-z0-9_]*$/', 'distinct'],
            'questions.*.label' => ['required', 'string', 'max:500'],
            'questions.*.type' => ['required', 'string', 'in:text,textarea,email,phone,number,date,select,radio,checkbox,hidden'],
            'questions.*.required' => ['sometimes', 'boolean'],
            'questions.*.options' => ['sometimes', 'array'],
            'questions.*.description' => ['nullable', 'string'],
            'questions.*.placeholder' => ['nullable', 'string'],
        ]);

        $questionnaire = Questionnaire::create([
            'name' => $data['name'],
            'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(6)),
            'description' => $data['description'] ?? null,
            'status' => 'draft',
            'settings' => ['created_via' => 'mcp'],
        ]);

        foreach ($data['questions'] as $index => $question) {
            $questionnaire->questions()->create([
                'key' => $question['key'],
                'type' => $question['type'],
                'label' => $question['label'],
                'description' => $question['description'] ?? null,
                'placeholder' => $question['placeholder'] ?? null,
                'is_required' => $question['required'] ?? false,
                'options' => $question['options'] ?? [],
                'sort_order' => $index,
            ]);
        }

        return Response::structured([
            'id' => $questionnaire->id,
            'uuid' => $questionnaire->uuid,
            'name' => $questionnaire->name,
            'slug' => $questionnaire->slug,
            'status' => $questionnaire->status,
            'questions_count' => $questionnaire->questions()->count(),
            'message' => 'Draft questionnaire created. Publish it in CareFlow when it is ready for respondents.',
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
            'name' => $schema->string()->description('Questionnaire title.')->required(),
            'description' => $schema->string()->description('Optional explanation shown to respondents.')->nullable(),
            'questions' => $schema->array()
                ->items($schema->object([
                    'key' => $schema->string()->description('Stable lowercase snake_case field key.')->required(),
                    'label' => $schema->string()->description('Human-readable field label.')->required(),
                    'type' => $schema->string()->enum(['text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'radio', 'checkbox', 'hidden'])->required(),
                    'required' => $schema->boolean()->description('Whether a response is required.'),
                    'options' => $schema->array()->items($schema->string())->description('Options for select, radio, or checkbox fields.'),
                    'description' => $schema->string()->nullable(),
                    'placeholder' => $schema->string()->nullable(),
                ]))->min(1)->required(),
        ];
    }
}
