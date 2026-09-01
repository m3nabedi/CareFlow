<?php

namespace Modules\Clinic\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Services\WpFormsImportService;
use Tests\TestCase;

class ConfirmationTest extends TestCase
{
    use RefreshDatabase;

    public function test_internal_form_uses_imported_confirmation_and_hydrates_hidden_selected_defaults(): void
    {
        $questionnaire = $this->import([[
            'id' => '1899',
            'fields' => [
                '1' => ['id' => '1', 'type' => 'text', 'label' => 'Patient name', 'required' => '1'],
                '9' => ['id' => '9', 'type' => 'select', 'label' => 'Staff status', 'required' => '1', 'css' => 'wpforms-hidden', 'choices' => ['1' => ['default' => '1', 'label' => 'New referral', 'value' => 'New-Referral-Staff']]],
                '10' => ['id' => '10', 'type' => 'select', 'label' => 'Clinic code', 'required' => '1', 'css' => 'wpforms-hidden', 'choices' => ['1' => ['default' => '1', 'label' => '291', 'value' => '291']]],
            ],
            'settings' => [
                'form_title' => 'Internal Patient Follow-Up Contact',
                'confirmations' => ['1' => ['name' => 'Internal save confirmation', 'type' => 'message', 'message' => '<p>Saved. The patient contact details were recorded.</p>']],
            ],
        ]]);

        $this->getJson("/api/questionnaires/{$questionnaire->slug}")
            ->assertOk()
            ->assertJsonPath('data.execution.completion.confirmation.message', '<p>Saved. The patient contact details were recorded.</p>');

        $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => ['wpforms_1' => 'Morgan Lee']])
            ->assertCreated()
            ->assertJsonPath('data.answers.wpforms_9', '1')
            ->assertJsonPath('data.answers.wpforms_10', '1')
            ->assertJsonPath('data.confirmation.message', '<p>Saved. The patient contact details were recorded.</p>');
    }

    public function test_appointment_form_returns_matching_adult_confirmation_with_escaped_answer_values(): void
    {
        $questionnaire = $this->import([$this->appointmentForm()]);

        $response = $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => [
            'wpforms_47' => '<script>Morgan</script>',
            'wpforms_95' => 30,
        ]]);

        $response->assertCreated()
            ->assertJsonPath('data.confirmation.id', '2')
            ->assertJsonPath('data.confirmation.type', 'message')
            ->assertJsonFragment(['redirect' => 'https://booking.example.com/adult'])
            ->assertJsonMissing(['api_key' => 'secret-provider-key']);

        $message = (string) $response->json('data.confirmation.message');
        $this->assertStringContainsString('&lt;script&gt;Morgan&lt;/script&gt;', $message);
        $this->assertStringContainsString('Dr Eliot Frickey OR Dr Sean Mayne', $message);
        $this->assertStringNotContainsString('<script>', $message);
        $this->assertStringNotContainsString('javascript:', $message);
    }

    public function test_appointment_form_returns_matching_child_confirmation(): void
    {
        $questionnaire = $this->import([$this->appointmentForm()]);

        $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => [
            'wpforms_47' => 'Taylor Lee',
            'wpforms_95' => 10,
        ]])
            ->assertCreated()
            ->assertJsonPath('data.confirmation.id', '3')
            ->assertJsonPath('data.confirmation.page', '42')
            ->assertJsonPath('data.confirmation.message', '<p>Child pathway for Taylor Lee: Dr Sean Mayne</p>');
    }

    /** @param array<int, array<string, mixed>> $forms */
    private function import(array $forms): Questionnaire
    {
        app(WpFormsImportService::class)->import($forms);

        return Questionnaire::query()->with('questions')->where('settings->wpforms_form_id', (string) $forms[0]['id'])->sole();
    }

    /** @return array<string, mixed> */
    private function appointmentForm(): array
    {
        return [
            'id' => '1836',
            'fields' => [
                '47' => ['id' => '47', 'type' => 'text', 'label' => 'Name', 'required' => '1'],
                '95' => ['id' => '95', 'type' => 'number', 'label' => 'Age', 'required' => '1'],
                '75' => ['id' => '75', 'type' => 'text', 'label' => 'Dr Eliot Frickey', 'read_only' => '1', 'default_value' => 'Dr Eliot Frickey'],
                '76' => ['id' => '76', 'type' => 'text', 'label' => 'Dr Sean Mayne', 'read_only' => '1', 'default_value' => 'Dr Sean Mayne'],
                '78' => ['id' => '78', 'type' => 'text', 'label' => 'Dr Omolola Oboro', 'read_only' => '1', 'default_value' => 'Dr Omolola Oboro'],
                '87' => ['id' => '87', 'type' => 'hidden', 'label' => 'Recommended doctors', 'calculation_code' => "join( ' OR ', \$F75, \$F78, \$F76 )"],
            ],
            'settings' => [
                'form_title' => 'Appointment Form Main by imi V2',
                'confirmations' => [
                    '1' => ['name' => 'General Confirmation', 'type' => 'message', 'message' => '<p>Thank you for your submission.</p>'],
                    '2' => [
                        'name' => 'Adult Confirmation',
                        'type' => 'message',
                        'message' => '<p>Adult pathway for {field_id="47"}: <strong>{field_id="87"}</strong><script>alert(1)</script><a href="javascript:alert(2)">Unsafe</a></p>',
                        'redirect' => 'https://booking.example.com/adult',
                        'conditional_logic' => '1',
                        'conditional_type' => 'go',
                        'conditionals' => [[['field' => '95', 'operator' => '>', 'value' => '17'], ['field' => '87', 'operator' => '!e']]],
                    ],
                    '3' => [
                        'name' => 'Child Confirmation',
                        'type' => 'page',
                        'page' => '42',
                        'message' => '<p>Child pathway for {field_id="47"}: {field_id="87"}</p>',
                        'conditional_logic' => '1',
                        'conditional_type' => 'go',
                        'conditionals' => [[['field' => '95', 'operator' => '<', 'value' => '18'], ['field' => '87', 'operator' => '!e']]],
                    ],
                ],
            ],
            'providers' => ['airtable' => ['connection' => ['api_key' => 'secret-provider-key']]],
        ];
    }
}
