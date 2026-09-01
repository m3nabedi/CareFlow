<?php

namespace Database\Factories;

use App\Models\Questionnaire;
use App\Models\Submission;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Submission>
 */
class SubmissionFactory extends Factory
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
            'status' => 'submitted',
            'submitted_at' => now(),
        ];
    }
}
