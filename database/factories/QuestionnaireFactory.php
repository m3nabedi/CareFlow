<?php

namespace Database\Factories;

use App\Models\Questionnaire;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Questionnaire>
 */
class QuestionnaireFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'uuid' => fake()->uuid(),
            'name' => fake()->sentence(3),
            'slug' => fake()->unique()->slug(3),
            'description' => fake()->sentence(),
            'status' => 'published',
            'settings' => [],
            'layout' => [],
        ];
    }
}
