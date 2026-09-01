<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\Questionnaire;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuestionnaireApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_published_questionnaires(): void
    {
        $questionnaire = Questionnaire::factory()->create(['name' => 'Patient Intake']);
        Questionnaire::factory()->create(['status' => 'draft']);

        $response = $this->getJson('/api/questionnaires');

        $response->assertOk()
            ->assertJsonPath('data.0.id', $questionnaire->id)
            ->assertJsonPath('data.0.name', 'Patient Intake');
    }

    public function test_it_returns_a_questionnaire_with_its_questions(): void
    {
        $questionnaire = Questionnaire::factory()->create(['slug' => 'patient-intake']);
        Question::factory()->for($questionnaire)->create([
            'key' => 'full_name',
            'label' => 'Full name',
            'is_required' => true,
        ]);

        $response = $this->getJson('/api/questionnaires/patient-intake');

        $response->assertOk()
            ->assertJsonPath('data.slug', 'patient-intake')
            ->assertJsonPath('data.questions.0.key', 'full_name')
            ->assertJsonPath('data.questions.0.required', true);
    }

    public function test_it_records_answers_for_a_questionnaire_response(): void
    {
        $questionnaire = Questionnaire::factory()->create();
        Question::factory()->for($questionnaire)->create([
            'key' => 'full_name',
            'label' => 'Full name',
            'is_required' => true,
        ]);

        $response = $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", [
            'answers' => ['full_name' => 'Ada Lovelace'],
            'metadata' => ['source' => 'web'],
        ]);

        $response->assertCreated()->assertJsonPath('data.status', 'submitted');
        $this->assertDatabaseHas('answers', [
            'question_key' => 'full_name',
            'display_value' => 'Ada Lovelace',
        ]);
    }

    public function test_it_requires_answers_for_required_questions(): void
    {
        $questionnaire = Questionnaire::factory()->create();
        Question::factory()->for($questionnaire)->create([
            'key' => 'full_name',
            'label' => 'Full name',
            'is_required' => true,
        ]);

        $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => []])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('answers.full_name');
    }
}
