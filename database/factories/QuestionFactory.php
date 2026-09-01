<?php

namespace Database\Factories;

use App\Models\Question;
use App\Models\Questionnaire;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Question>
 */
class QuestionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'questionnaire_id' => Questionnaire::factory(),
            'uuid' => fake()->uuid(),
            'key' => fake()->unique()->slug(2, '_'),
            'type' => 'text',
            'label' => fake()->sentence(3),
            'is_required' => false,
            'sort_order' => 0,
        ];
    }
}
