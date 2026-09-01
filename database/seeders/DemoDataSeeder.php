<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Modules\Clinic\Models\Clinic;
use Modules\Clinic\Models\Question;
use Modules\Clinic\Models\Questionnaire;
use Spatie\Permission\Models\Role;

class DemoDataSeeder extends Seeder
{
    /**
     * Seed local demonstration accounts and fictional patient submissions.
     *
     * This seeder is deliberately opt-in; it is not called by DatabaseSeeder
     * so production deployments cannot accidentally receive demo credentials.
     */
    public function run(): void
    {
        $platformOwner = User::query()->updateOrCreate(
            ['email' => 'platform@careflow.test'],
            [
                'name' => 'CareFlow Platform Owner',
                'phone' => '+14165550101',
                'password' => Hash::make('PlatformDemo2026!'),
                'email_verified_at' => now(),
            ],
        );
        $platformOwner->syncRoles([Role::findOrCreate('platform-admin', 'web')]);

        $clinic = Clinic::query()->firstOrCreate(
            ['slug' => 'empowered-minds-clinic'],
            [
                'name' => 'Empowered Minds Clinic',
                'settings' => [
                    'locale' => 'en',
                    'timezone' => 'America/Toronto',
                    'default_calling_code' => '+1',
                    'allowed_calling_codes' => [['iso' => 'CA', 'label' => 'Canada (+1)', 'callingCode' => '+1']],
                ],
                'branding' => ['primary_color' => '#155EEF'],
            ],
        );

        $clinicAdministrator = User::query()->updateOrCreate(
            ['email' => 'admin@empoweredminds.test'],
            [
                'name' => 'Empowered Minds Administrator',
                'phone' => '+14165550102',
                'password' => Hash::make('ClinicDemo2026!'),
                'email_verified_at' => now(),
            ],
        );
        $clinic->users()->syncWithoutDetaching([$clinicAdministrator->id => ['role' => 'owner']]);

        $northstar = Clinic::query()->firstOrCreate(
            ['slug' => 'northstar-wellness-centre'],
            [
                'name' => 'Northstar Wellness Centre',
                'settings' => [
                    'locale' => 'en',
                    'timezone' => 'America/Vancouver',
                    'default_calling_code' => '+1',
                    'allowed_calling_codes' => [['iso' => 'CA', 'label' => 'Canada (+1)', 'callingCode' => '+1']],
                ],
                'branding' => ['primary_color' => '#0E7490'],
            ],
        );

        $northstarQuestionnaire = Questionnaire::query()->firstOrCreate(
            ['clinic_id' => $northstar->id, 'slug' => 'new-patient-wellbeing-check-in'],
            [
                'name' => 'New Patient Wellbeing Check-in',
                'description' => 'A short intake questionnaire for new patients.',
                'status' => 'published',
                'settings' => ['source' => 'careflow-demo'],
                'layout' => [],
            ],
        );

        if (! $northstarQuestionnaire->questions()->exists()) {
            foreach ([
                ['key' => 'full_name', 'type' => 'text', 'label' => 'Full name', 'is_required' => true],
                ['key' => 'email', 'type' => 'email', 'label' => 'Email address', 'is_required' => true],
                ['key' => 'care_goal', 'type' => 'textarea', 'label' => 'How can we support you?', 'is_required' => true],
                ['key' => 'contact_method', 'type' => 'radio', 'label' => 'Preferred contact method', 'options' => [['id' => 'email', 'label' => 'Email', 'value' => 'email'], ['id' => 'phone', 'label' => 'Phone', 'value' => 'phone']], 'is_required' => true],
            ] as $position => $question) {
                $northstarQuestionnaire->questions()->create([
                    ...$question,
                    'sort_order' => $position + 1,
                ]);
            }
        }

        Questionnaire::query()
            ->whereIn('clinic_id', [$clinic->id, $northstar->id])
            ->with('questions')
            ->get()
            ->each(fn (Questionnaire $questionnaire) => $this->seedSubmissions($questionnaire, 48));
    }

    private function seedSubmissions(Questionnaire $questionnaire, int $targetCount): void
    {
        $existingCount = $questionnaire->submissions()
            ->where('metadata->source', 'demo-seed')
            ->count();

        for ($position = $existingCount; $position < $targetCount; $position++) {
            $submission = $questionnaire->submissions()->create([
                'status' => 'submitted',
                'metadata' => ['source' => 'demo-seed', 'fictional' => true],
                'submitted_at' => now()->subMinutes(($position + 1) * 47),
            ]);

            $questionnaire->questions->each(function (Question $question) use ($submission, $position): void {
                $value = $this->answerFor($question, $position);
                $submission->answers()->create([
                    'question_id' => $question->id,
                    'question_key' => $question->key,
                    'value' => ['value' => $value],
                    'display_value' => is_array($value) ? implode(', ', $value) : (string) $value,
                ]);
            });
        }
    }

    private function answerFor(Question $question, int $position): mixed
    {
        return match ($question->type) {
            'email' => sprintf('patient-%03d@example.test', $position + 1),
            'phone' => sprintf('+1416555%04d', $position + 1),
            'number' => 18 + ($position % 55),
            'date' => now()->subYears(18 + ($position % 55))->toDateString(),
            'checkbox', 'multiple_checkboxes' => $this->choiceValues($question, true),
            'radio', 'select', 'dropdown' => $this->choiceValues($question),
            'hidden' => null,
            default => sprintf('Demo response %03d', $position + 1),
        };
    }

    private function choiceValues(Question $question, bool $multiple = false): mixed
    {
        $choices = collect($question->options ?? [])
            ->map(fn (mixed $choice): string => is_array($choice)
                ? (string) ($choice['value'] ?? $choice['id'] ?? $choice['label'] ?? '')
                : (string) $choice)
            ->filter()
            ->values();

        if ($multiple) {
            return $choices->take(2)->all();
        }

        return $choices->first() ?? 'Not specified';
    }
}
