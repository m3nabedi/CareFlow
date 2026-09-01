<?php

namespace Modules\Admin\Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Models\Submission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PlatformAdminApiTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_returns_401_when_platform_admin_token_is_missing(): void
    {
        $this->getJson('/api/platform-admin/dashboard')->assertUnauthorized();
    }

    public function test_returns_403_when_authenticated_user_is_not_a_platform_administrator(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/platform-admin/dashboard')->assertForbidden();
    }

    public function test_platform_administrator_can_log_in_and_receive_a_sanctum_token(): void
    {
        $platformAdministrator = $this->platformAdministrator(['email' => 'owner@example.test', 'password' => 'correct-password']);

        $response = $this->postJson('/api/platform-admin/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'correct-password',
            'device_name' => 'Platform dashboard',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.user.id', $platformAdministrator->id)
            ->assertJsonPath('data.user.email', 'owner@example.test')
            ->assertJsonStructure(['data' => ['token', 'user']]);
        $this->assertNotSame('', $response->json('data.token'));

        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $platformAdministrator->id,
            'tokenable_type' => User::class,
            'name' => 'Platform dashboard',
        ]);
    }

    public function test_platform_administrator_can_view_dashboard_aggregate_counts(): void
    {
        $initialClinicCount = Clinic::query()->count();
        $initialClinicAdministratorCount = User::query()
            ->whereHas('clinics', fn ($query) => $query->whereIn('clinic_user.role', ['owner', 'admin']))
            ->distinct()
            ->count('users.id');
        $initialQuestionnaireCount = Questionnaire::query()->count();
        $initialSubmissionCount = Submission::query()->count();
        $platformAdministrator = $this->platformAdministrator();
        $clinicA = Clinic::factory()->create();
        $clinicB = Clinic::factory()->create();
        $clinicAdministrator = User::factory()->create();
        $clinicA->users()->attach($clinicAdministrator, ['role' => 'owner']);
        $questionnaire = Questionnaire::factory()->for($clinicA)->create();
        Submission::factory()->for($questionnaire)->create();

        Sanctum::actingAs($platformAdministrator);

        $this->getJson('/api/platform-admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.clinicsCount', $initialClinicCount + 2)
            ->assertJsonPath('data.clinicAdministratorsCount', $initialClinicAdministratorCount + 1)
            ->assertJsonPath('data.questionnairesCount', $initialQuestionnaireCount + 1)
            ->assertJsonPath('data.submissionsCount', $initialSubmissionCount + 1);
    }

    public function test_platform_administrator_can_create_update_filter_and_view_clinics_with_members(): void
    {
        $platformAdministrator = $this->platformAdministrator();
        $clinicAdministrator = User::factory()->create();
        Sanctum::actingAs($platformAdministrator);

        $createResponse = $this->postJson('/api/platform-admin/clinics', [
            'name' => 'North Clinic',
            'slug' => 'north-clinic',
            'public_domain' => 'https://north.example.test',
            'settings' => ['timezone' => 'America/Toronto'],
            'members' => [
                ['user_id' => $clinicAdministrator->id, 'role' => 'owner'],
            ],
        ]);

        $clinicId = $createResponse->json('data.id');
        $createResponse
            ->assertCreated()
            ->assertJsonPath('data.slug', 'north-clinic')
            ->assertJsonPath('data.publicDomain', 'north.example.test')
            ->assertJsonPath('data.members.0.role', 'owner');
        $this->assertDatabaseHas('clinics', ['id' => $clinicId, 'name' => 'North Clinic']);
        $this->assertDatabaseHas('clinic_user', ['clinic_id' => $clinicId, 'user_id' => $clinicAdministrator->id, 'role' => 'owner']);

        $this->patchJson("/api/platform-admin/clinics/{$clinicId}", [
            'name' => 'North Health Clinic',
            'members' => [
                ['user_id' => $clinicAdministrator->id, 'role' => 'admin'],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'North Health Clinic')
            ->assertJsonPath('data.members.0.role', 'admin');

        $this->getJson('/api/platform-admin/clinics?filter[name]=North%20Health')
            ->assertOk()
            ->assertJsonPath('data.0.id', $clinicId)
            ->assertJsonPath('meta.total', 1);
        $this->getJson("/api/platform-admin/clinics/{$clinicId}")
            ->assertOk()
            ->assertJsonPath('data.members.0.email', $clinicAdministrator->email);
    }

    public function test_returns_422_when_platform_administrator_creates_clinic_without_required_name(): void
    {
        Sanctum::actingAs($this->platformAdministrator());

        $this->postJson('/api/platform-admin/clinics', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name'])
            ->assertJsonPath('errors.name.0', 'The name field is required.');
    }

    /** @param array<string, mixed> $attributes */
    private function platformAdministrator(array $attributes = []): User
    {
        $user = User::factory()->create($attributes);
        Role::findOrCreate('platform-admin', 'web');
        $user->assignRole('platform-admin');

        return $user;
    }
}
