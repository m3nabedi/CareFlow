<?php

namespace Database\Factories;

use App\Models\Answer;
use App\Models\Submission;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Answer>
 */
class AnswerFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'submission_id' => Submission::factory(),
            'question_key' => fake()->slug(2, '_'),
            'value' => ['value' => fake()->word()],
            'display_value' => fake()->word(),
        ];
    }
}
