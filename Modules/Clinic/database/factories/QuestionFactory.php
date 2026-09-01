<?php

namespace Modules\Clinic\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Modules\Clinic\Models\Question;
use Modules\Clinic\Models\Questionnaire;

/**
 * @extends Factory<Question>
 */
class QuestionFactory extends Factory
{
    protected $model = Question::class;

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
