<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
            'settings' => $this->settings,
            'layout' => $this->layout,
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
                'settings' => $question->settings,
                'sortOrder' => $question->sort_order,
            ])->all()),
            'createdAt' => $this->created_at?->toISOString(),
            'updatedAt' => $this->updated_at?->toISOString(),
        ];
    }
}
