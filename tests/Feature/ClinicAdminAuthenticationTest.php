<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Clinic\Models\Answer;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Models\Submission;
use Tests\TestCase;

class ClinicAdminAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registers_a_clinic_owner_and_returns_a_sanctum_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'firstName' => 'Ada',
            'lastName' => 'Lovelace',
            'clinicName' => 'North Clinic',
            'email' => 'ada@example.com',
            'phone' => '+14165550100',
            'password' => 'an-secure-password',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.name', 'Ada Lovelace')
            ->assertJsonPath('clinic.name', 'North Clinic')
            ->assertJsonStructure(['token', 'user', 'clinic']);

        $user = User::query()->where('email', 'ada@example.com')->sole();
        $clinic = Clinic::query()->where('name', 'North Clinic')->sole();
        $this->assertDatabaseHas('clinic_user', [
            'clinic_id' => $clinic->id,
            'user_id' => $user->id,
            'role' => 'owner',
        ]);
    }

    public function test_clinic_owner_can_view_and_update_their_clinic_but_not_another_clinic_questionnaire(): void
    {
        $owner = User::factory()->create();
        $clinic = Clinic::factory()->create(['public_domain' => 'north.example.test']);
        $otherClinic = Clinic::factory()->create();
        $clinic->users()->attach($owner, ['role' => 'owner']);
        $otherQuestionnaire = Questionnaire::factory()->for($otherClinic)->create();
        $token = $owner->createToken('test', ['clinic:admin'])->plainTextToken;

        $this->withToken($token)->getJson('/api/admin/clinic')
            ->assertOk()
            ->assertJsonPath('data.id', $clinic->id);

        $this->withToken($token)->patchJson('/api/admin/clinic', ['public_domain' => 'portal.north.example.test'])
            ->assertOk()
            ->assertJsonPath('data.publicDomain', 'portal.north.example.test');
        $this->assertDatabaseHas('clinics', ['id' => $clinic->id, 'public_domain' => 'portal.north.example.test']);

        $this->withToken($token)->getJson("/api/admin/clinic/questionnaires/{$otherQuestionnaire->id}")
            ->assertNotFound();
    }

    public function test_resolves_a_clinic_from_a_public_domain_with_a_port(): void
    {
        $clinic = Clinic::factory()->create(['public_domain' => 'forms.north.example.test']);

        $this->getJson('/api/public/clinics/resolve?domain=forms.north.example.test:3000')
            ->assertOk()
            ->assertJsonPath('data.id', $clinic->id)
            ->assertJsonPath('data.publicDomain', 'forms.north.example.test');
    }

    public function test_clinic_admin_can_create_a_questionnaire_with_its_questions(): void
    {
        $user = User::factory()->create();
        $clinic = Clinic::factory()->create();
        $clinic->users()->attach($user, ['role' => 'admin']);
        $token = $user->createToken('test', ['clinic:admin'])->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/admin/clinic/questionnaires', [
            'name' => 'New patient intake',
            'description' => 'Please complete this before your visit.',
            'questions' => [[
                'key' => 'full_name',
                'type' => 'text',
                'label' => 'Full name',
                'is_required' => true,
                'settings' => ['conditional_logic' => false],
            ]],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'New patient intake')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.questions.0.key', 'full_name');
        $this->assertDatabaseHas('questionnaires', ['clinic_id' => $clinic->id, 'name' => 'New patient intake']);
        $this->assertDatabaseHas('questions', ['key' => 'full_name', 'label' => 'Full name']);
    }

    public function test_phone_login_uses_a_development_code_in_the_testing_environment(): void
    {
        $user = User::factory()->create(['phone' => '+14165550101']);
        $clinic = Clinic::factory()->create();
        $clinic->users()->attach($user, ['role' => 'admin']);

        $request = $this->postJson('/api/auth/phone/request', ['phone' => '+14165550101']);
        $request->assertAccepted()->assertJsonStructure(['developmentCode']);

        $this->postJson('/api/auth/phone/verify', [
            'phone' => '+14165550101',
            'code' => $request->json('developmentCode'),
        ])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('clinic.id', $clinic->id)
            ->assertJsonStructure(['token', 'user', 'clinic']);
    }

    public function test_returns_503_when_google_authentication_is_not_configured(): void
    {
        config()->set('services.google.client_id', null);
        config()->set('services.google.client_secret', null);
        config()->set('services.google.redirect', null);

        $this->get('/api/auth/google/redirect')
            ->assertServiceUnavailable();
    }

    public function test_clinic_admin_can_update_the_status_of_their_submission(): void
    {
        $user = User::factory()->create();
        $clinic = Clinic::factory()->create();
        $clinic->users()->attach($user, ['role' => 'admin']);
        $questionnaire = Questionnaire::factory()->for($clinic)->create();
        $submission = Submission::factory()->for($questionnaire)->create(['status' => 'submitted']);
        $token = $user->createToken('test', ['clinic:admin'])->plainTextToken;

        $response = $this->withToken($token)->patchJson(
            "/api/admin/clinic/questionnaires/{$questionnaire->id}/responses/{$submission->id}",
            ['status' => 'follow_up'],
        );

        $response->assertOk()->assertJsonPath('data.status', 'follow_up');
        $this->assertDatabaseHas('submissions', [
            'id' => $submission->id,
            'status' => 'follow_up',
        ]);
    }

    public function test_clinic_admin_cannot_update_another_clinics_submission(): void
    {
        $user = User::factory()->create();
        $clinic = Clinic::factory()->create();
        $otherClinic = Clinic::factory()->create();
        $clinic->users()->attach($user, ['role' => 'admin']);
        $questionnaire = Questionnaire::factory()->for($clinic)->create();
        $otherQuestionnaire = Questionnaire::factory()->for($otherClinic)->create();
        $otherSubmission = Submission::factory()->for($otherQuestionnaire)->create(['status' => 'submitted']);
        $token = $user->createToken('test', ['clinic:admin'])->plainTextToken;

        $response = $this->withToken($token)->patchJson(
            "/api/admin/clinic/questionnaires/{$questionnaire->id}/responses/{$otherSubmission->id}",
            ['status' => 'archived'],
        );

        $response->assertNotFound();
        $this->assertDatabaseHas('submissions', [
            'id' => $otherSubmission->id,
            'status' => 'submitted',
        ]);
    }

    public function test_unified_responses_only_returns_the_current_clinics_submissions_with_questionnaire_metadata(): void
    {
        $user = User::factory()->create();
        $clinic = Clinic::factory()->create();
        $otherClinic = Clinic::factory()->create();
        $clinic->users()->attach($user, ['role' => 'admin']);
        $firstQuestionnaire = Questionnaire::factory()->for($clinic)->create(['name' => 'First intake']);
        $secondQuestionnaire = Questionnaire::factory()->for($clinic)->create(['name' => 'Second intake']);
        $otherQuestionnaire = Questionnaire::factory()->for($otherClinic)->create();
        $firstSubmission = Submission::factory()->for($firstQuestionnaire)->create(['submitted_at' => now()->subHour()]);
        $secondSubmission = Submission::factory()->for($secondQuestionnaire)->create(['submitted_at' => now()]);
        $otherSubmission = Submission::factory()->for($otherQuestionnaire)->create(['submitted_at' => now()->addHour()]);
        Answer::factory()->for($secondSubmission)->create(['question_key' => 'patient_name', 'value' => ['value' => 'Ada Lovelace']]);
        $token = $user->createToken('test', ['clinic:admin'])->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/admin/clinic/responses?per_page=999');

        $response->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 200)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $secondSubmission->id)
            ->assertJsonPath('data.0.questionnaire.id', $secondQuestionnaire->id)
            ->assertJsonPath('data.0.questionnaire.name', 'Second intake')
            ->assertJsonPath('data.0.answers.patient_name', 'Ada Lovelace')
            ->assertJsonPath('data.1.id', $firstSubmission->id)
            ->assertJsonMissing(['id' => $otherSubmission->id]);

        $this->withToken($token)->getJson("/api/admin/clinic/questionnaires/{$firstQuestionnaire->id}/responses?per_page=999")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $firstSubmission->id)
            ->assertJsonPath('meta.per_page', 200);
    }

    public function test_submission_status_must_be_a_supported_workflow_status(): void
    {
        $user = User::factory()->create();
        $clinic = Clinic::factory()->create();
        $clinic->users()->attach($user, ['role' => 'admin']);
        $questionnaire = Questionnaire::factory()->for($clinic)->create();
        $submission = Submission::factory()->for($questionnaire)->create(['status' => 'submitted']);
        $token = $user->createToken('test', ['clinic:admin'])->plainTextToken;

        $this->withToken($token)->patchJson(
            "/api/admin/clinic/questionnaires/{$questionnaire->id}/responses/{$submission->id}",
            ['status' => 'invalid-status'],
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
        $this->assertDatabaseHas('submissions', ['id' => $submission->id, 'status' => 'submitted']);
    }
}
