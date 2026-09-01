<?php

namespace Modules\Clinic\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Question;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Models\Submission;
use Tests\TestCase;

class ClinicIsolationTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_scoped_questionnaire_lookup_does_not_cross_clinic_boundaries(): void
    {
        $clinicA = Clinic::factory()->create(['slug' => 'clinic-a']);
        $clinicB = Clinic::factory()->create(['slug' => 'clinic-b']);
        $questionnaire = Questionnaire::factory()->for($clinicA)->create(['slug' => 'intake-a']);

        $this->getJson("/api/clinics/{$clinicA->slug}/questionnaires/{$questionnaire->slug}")
            ->assertOk()
            ->assertJsonPath('data.clinic.slug', 'clinic-a');

        $this->getJson("/api/clinics/{$clinicB->slug}/questionnaires/{$questionnaire->slug}")
            ->assertNotFound();
    }

    public function test_response_lists_require_authentication_and_keep_scoped_bindings(): void
    {
        $clinicA = Clinic::factory()->create(['slug' => 'clinic-a']);
        $clinicB = Clinic::factory()->create(['slug' => 'clinic-b']);
        $questionnaire = Questionnaire::factory()->for($clinicA)->create(['slug' => 'intake-a']);

        $this->getJson("/api/clinics/{$clinicA->slug}/questionnaires/{$questionnaire->slug}/responses")
            ->assertUnauthorized();

        $user = User::factory()->create();
        $clinicA->users()->attach($user);
        Sanctum::actingAs($user);

        $this->getJson("/api/clinics/{$clinicB->slug}/questionnaires/{$questionnaire->slug}/responses")
            ->assertNotFound();
        $this->getJson("/api/clinics/{$clinicA->slug}/questionnaires/{$questionnaire->slug}/responses")
            ->assertOk();
    }

    public function test_clinics_expose_independent_validated_regional_phone_settings(): void
    {
        $clinicA = Clinic::factory()->create(['settings' => [
            'locale' => 'en',
            'timezone' => 'Europe/Paris',
            'default_calling_code' => '+33',
            'allowed_calling_codes' => [['country' => 'France', 'iso' => 'FR', 'label' => 'France (+33)', 'callingCode' => '+33']],
        ]]);
        $clinicB = Clinic::factory()->create(['settings' => [
            'locale' => 'en',
            'timezone' => 'Australia/Sydney',
            'default_calling_code' => '+61',
            'allowed_calling_codes' => [['country' => 'Australia', 'iso' => 'AU', 'label' => 'Australia (+61)', 'callingCode' => '+61']],
        ]]);

        $this->getJson("/api/clinics/{$clinicA->slug}")
            ->assertOk()
            ->assertJsonPath('data.regional.defaultCallingCode', '+33');
        $this->getJson("/api/clinics/{$clinicB->slug}")
            ->assertOk()
            ->assertJsonPath('data.regional.defaultCallingCode', '+61');

        $this->expectException(\InvalidArgumentException::class);
        Clinic::factory()->create(['settings' => [
            'default_calling_code' => '+1',
            'allowed_calling_codes' => [['country' => 'France', 'iso' => 'FR', 'label' => 'France (+33)', 'callingCode' => '+33']],
        ]]);
    }

    public function test_uploads_use_private_non_colliding_clinic_and_submission_paths_and_are_deleted_with_submission(): void
    {
        Storage::fake('local');
        $clinicA = Clinic::factory()->create();
        $clinicB = Clinic::factory()->create();
        $questionnaireA = $this->uploadQuestionnaire($clinicA, 'clinic-a-upload');
        $questionnaireB = $this->uploadQuestionnaire($clinicB, 'clinic-b-upload');

        $responseA = $this->submitFile($clinicA, $questionnaireA, 'referral.pdf');
        $responseB = $this->submitFile($clinicB, $questionnaireB, 'referral.pdf');

        $responseA->assertCreated()
            ->assertJsonPath('data.answers.wpforms_7.original_name', 'referral.pdf')
            ->assertJsonMissingPath('data.answers.wpforms_7.storage_path')
            ->assertJsonMissingPath('data.answers.wpforms_7.disk');
        $responseB->assertCreated();

        $submissionA = Submission::query()->whereBelongsTo($questionnaireA)->with('answers')->sole();
        $submissionB = Submission::query()->whereBelongsTo($questionnaireB)->with('answers')->sole();
        $pathA = $submissionA->answers->sole()->value['value']['storage_path'];
        $pathB = $submissionB->answers->sole()->value['value']['storage_path'];

        $this->assertStringStartsWith("clinics/clinic-{$clinicA->id}/submissions/{$submissionA->uuid}/question-", $pathA);
        $this->assertStringStartsWith("clinics/clinic-{$clinicB->id}/submissions/{$submissionB->uuid}/question-", $pathB);
        $this->assertNotSame($pathA, $pathB);
        Storage::disk('local')->assertExists([$pathA, $pathB]);

        $submissionA->delete();

        Storage::disk('local')->assertMissing($pathA);
        Storage::disk('local')->assertExists($pathB);
    }

    private function uploadQuestionnaire(Clinic $clinic, string $slug): Questionnaire
    {
        $questionnaire = Questionnaire::factory()->for($clinic)->create(['slug' => $slug]);
        Question::factory()->for($questionnaire)->create([
            'key' => 'wpforms_7',
            'type' => 'file',
            'label' => 'Referral document',
            'is_required' => true,
            'settings' => ['wpforms' => ['id' => '7', 'type' => 'file-upload']],
        ]);

        return $questionnaire;
    }

    private function submitFile(Clinic $clinic, Questionnaire $questionnaire, string $filename): TestResponse
    {
        return $this->post(
            "/api/clinics/{$clinic->slug}/questionnaires/{$questionnaire->slug}/responses",
            ['answers' => json_encode([], JSON_THROW_ON_ERROR), 'files' => ['wpforms_7' => UploadedFile::fake()->create($filename, 100, 'application/pdf')]],
            ['Accept' => 'application/json'],
        );
    }
}
