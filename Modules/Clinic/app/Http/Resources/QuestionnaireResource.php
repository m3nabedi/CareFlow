<?php

namespace Modules\Clinic\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Clinic\Services\FormSchemaService;

class QuestionnaireResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'status' => $this->status,
            'clinic' => $this->whenLoaded('clinic', fn (): array => [
                'id' => $this->clinic->id,
                'name' => $this->clinic->name,
                'slug' => $this->clinic->slug,
                'branding' => $this->clinic->branding,
                'regional' => $this->clinic->regionalSettings(),
            ]),
            'settings' => [
                'source' => $this->settings['source'] ?? null,
                'theme' => $this->settings['wpforms_settings']['themes'] ?? null,
            ],
            'layout' => $this->layout,
            'questionsCount' => $this->whenCounted('questions'),
            'submissionsCount' => $this->whenCounted('submissions'),
            'execution' => $this->whenLoaded('questions', fn (): array => app(FormSchemaService::class)->build($this->resource)),
            'questions' => $this->whenLoaded('questions', fn (): array => $this->questions->map(fn ($question): array => [
                'id' => $question->id,
                'uuid' => $question->uuid,
                'key' => $question->key,
                'type' => $question->type,
                'label' => $question->label,
                'description' => $question->description,
                'placeholder' => $question->placeholder,
                'required' => $question->is_required,
                'options' => $question->options,
                'validation' => $question->validation,
                'sortOrder' => $question->sort_order,
            ])->all()),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
