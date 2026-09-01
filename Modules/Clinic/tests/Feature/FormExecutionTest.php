<?php

namespace Modules\Clinic\Tests\Feature;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Modules\Clinic\Models\Question;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Services\FormRuntimeService;
use Modules\Clinic\Services\WpFormsImportService;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class FormExecutionTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_returns_explicit_multistep_execution_contract_with_canonical_choice_ids(): void
    {
        $questionnaire = $this->importAppointmentForm();

        $response = $this->getJson("/api/questionnaires/{$questionnaire->slug}");

        $response->assertOk()
            ->assertJsonCount(3, 'data.execution.steps')
            ->assertJsonPath('data.execution.steps.0.elements.1.compound.mustMatch', true)
            ->assertJsonPath('data.execution.steps.1.elements.0.choices.8.value', '9')
            ->assertJsonPath('data.execution.steps.1.elements.0.choices.8.displayValue', 'None of the above')
            ->assertJsonPath('data.execution.steps.2.elements.0.kind', 'layout')
            ->assertJsonPath('data.execution.steps.2.elements.0.columns.0.fields.0', 'wpforms_96')
            ->assertJsonPath('data.execution.calculations.0.operation', 'ageFromDate')
            ->assertJsonPath('data.execution.calculations.1.operation', 'joinVisibleValues')
            ->assertJsonMissingPath('data.execution.calculations.0.formula');
    }

    public function test_validates_required_fields_only_when_their_conditions_are_visible(): void
    {
        $questionnaire = Questionnaire::factory()->create();
        Question::factory()->for($questionnaire)->create([
            'key' => 'wpforms_1',
            'type' => 'radio',
            'label' => 'Contact method',
            'is_required' => true,
            'settings' => ['wpforms' => ['id' => '1', 'type' => 'radio', 'choices' => ['1' => ['label' => 'Email'], '2' => ['label' => 'Phone']]]],
        ]);
        Question::factory()->for($questionnaire)->create([
            'key' => 'wpforms_2',
            'type' => 'email',
            'label' => 'Email',
            'is_required' => true,
            'settings' => ['wpforms' => ['id' => '2', 'type' => 'email', 'conditional_logic' => '1', 'conditional_type' => 'show', 'conditionals' => [[['field' => '1', 'operator' => '==', 'value' => '1']]]]],
        ]);
        Question::factory()->for($questionnaire)->create([
            'key' => 'wpforms_3',
            'type' => 'phone',
            'label' => 'Phone',
            'is_required' => true,
            'settings' => ['wpforms' => ['id' => '3', 'type' => 'phone', 'conditional_logic' => '1', 'conditional_type' => 'show', 'conditionals' => [[['field' => '1', 'operator' => '==', 'value' => '2']]]]],
        ]);

        $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => ['wpforms_1' => '1', 'wpforms_2' => 'patient@example.ca']])
            ->assertCreated();

        $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => ['wpforms_1' => '2']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('answers.wpforms_3')
            ->assertJsonMissingValidationErrors('answers.wpforms_2');
    }

    public function test_enforces_page_gates_and_persists_structured_doctor_recommendations(): void
    {
        $this->travelTo('2026-09-01 12:00:00');
        $questionnaire = $this->importAppointmentForm();
        $baseAnswers = [
            'wpforms_47' => 'Morgan Lee',
            'wpforms_49' => ['value' => 'morgan@example.ca', 'confirmation' => 'morgan@example.ca'],
            'wpforms_50' => '+1 416 555 0100',
            'wpforms_54' => ['9'],
            'wpforms_62' => ['9'],
            'wpforms_96' => '01/09/1996',
            'wpforms_69' => ['1'],
            'wpforms_71' => ['1'],
            'wpforms_67' => '2',
            'wpforms_73' => '2',
        ];

        $blocked = $baseAnswers;
        $blocked['wpforms_54'] = ['1'];
        $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => $blocked])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('workflow.gates.urgent-none-only');

        $response = $this->postJson("/api/questionnaires/{$questionnaire->id}/responses", ['answers' => $baseAnswers]);

        $response->assertCreated()
            ->assertJsonCount(3, 'data.recommendations')
            ->assertJsonPath('data.answers.wpforms_95', 30)
            ->assertJsonPath('data.answers.wpforms_87', 'Dr Eliot Frickey OR Dr Omolola Oboro OR Dr Sean Mayne');
        $this->assertDatabaseHas('answers', ['question_key' => 'wpforms_87', 'display_value' => 'Dr Eliot Frickey OR Dr Omolola Oboro OR Dr Sean Mayne']);
    }

    #[DataProvider('doctorBoundaryProvider')]
    public function test_applies_doctor_age_boundaries(int $age, array $expectedDoctors): void
    {
        $questionnaire = $this->importAppointmentForm();

        $recommendations = app(FormRuntimeService::class)->recommendations($questionnaire, [
            'wpforms_95' => $age,
            'wpforms_69' => ['1'],
            'wpforms_71' => ['1'],
            'wpforms_67' => '2',
            'wpforms_73' => '2',
        ]);

        $this->assertSame($expectedDoctors, collect($recommendations)->pluck('name')->all());
    }

    public static function doctorBoundaryProvider(): array
    {
        return [
            'age 17' => [17, ['Dr Sean Mayne', 'Dr Omolola Oboro']],
            'age 18' => [18, ['Dr Eliot Frickey', 'Dr Sean Mayne', 'Dr Omolola Oboro']],
            'age 50' => [50, ['Dr Eliot Frickey', 'Dr Sean Mayne', 'Dr Omolola Oboro']],
            'age 51' => [51, ['Dr Eliot Frickey', 'Dr Sean Mayne']],
            'age 64' => [64, ['Dr Eliot Frickey', 'Dr Sean Mayne']],
            'age 65' => [65, ['Dr Eliot Frickey']],
        ];
    }

    private function importAppointmentForm(): Questionnaire
    {
        $choices = fn (int $count): array => array_map(fn (int $index): array => ['label' => $index === $count - 1 ? 'None of the above' : 'Choice '.($index + 1)], range(0, $count - 1));
        $fields = [
            ['id' => '4', 'type' => 'pagebreak', 'position' => 'top', 'indicator' => 'circles'],
            ['id' => '47', 'type' => 'text', 'label' => 'Name', 'required' => '1'],
            ['id' => '49', 'type' => 'email', 'label' => 'Email', 'required' => '1', 'confirmation' => '1'],
            ['id' => '50', 'type' => 'phone', 'label' => 'Phone', 'required' => '1'],
            ['id' => '46', 'type' => 'pagebreak', 'next' => 'Next'],
            ['id' => '54', 'type' => 'checkbox', 'label' => 'Urgent needs', 'required' => '1', 'choices' => $choices(9)],
            ['id' => '62', 'type' => 'checkbox', 'label' => 'Service fit', 'required' => '1', 'choices' => $choices(9)],
            ['id' => '3', 'type' => 'pagebreak', 'next' => 'Next', 'prev' => 'Previous'],
            ['id' => '33', 'type' => 'layout', 'label' => 'Clinical details', 'columns' => [['width_preset' => '100', 'fields' => [96, 69, 71, 67, 73]]]],
            ['id' => '96', 'type' => 'date-time', 'label' => 'Date of birth', 'required' => '1', 'date_format' => 'd/m/Y'],
            ['id' => '95', 'type' => 'number', 'label' => 'Age', 'css' => 'wpforms-hidden', 'calculation_code' => 'years($F96, now())'],
            ['id' => '69', 'type' => 'checkbox', 'label' => 'Referral reasons', 'choices' => $choices(19)],
            ['id' => '71', 'type' => 'checkbox', 'label' => 'History', 'choices' => $choices(8)],
            ['id' => '67', 'type' => 'radio', 'label' => 'Private funder', 'choices' => ['1' => ['label' => 'Yes'], '2' => ['label' => 'No']]],
            ['id' => '73', 'type' => 'radio', 'label' => 'Physical health impact', 'choices' => ['1' => ['label' => 'Yes'], '2' => ['label' => 'No']]],
            ['id' => '75', 'type' => 'text', 'label' => 'Dr Eliot Frickey', 'read_only' => '1', 'default_value' => 'Dr Eliot Frickey'],
            ['id' => '76', 'type' => 'text', 'label' => 'Dr Sean Mayne', 'read_only' => '1', 'default_value' => 'Dr Sean Mayne'],
            ['id' => '78', 'type' => 'text', 'label' => 'Dr Omolola Oboro', 'read_only' => '1', 'default_value' => 'Dr Omolola Oboro'],
            ['id' => '87', 'type' => 'hidden', 'label' => 'Recommended doctors', 'calculation_code' => "join( ' OR ', \$F75, \$F78, \$F76 )"],
            ['id' => '5', 'type' => 'pagebreak', 'position' => 'bottom'],
        ];

        app(WpFormsImportService::class)->import([[
            'id' => '1836',
            'fields' => array_combine(array_column($fields, 'id'), $fields),
            'settings' => [
                'form_title' => 'Appointment Form Main by imi V2',
                'mcp_frontend_rules' => [
                    ['key' => 'urgent-none-only', 'type' => 'page_next_gate', 'page' => 2, 'mode' => 'all', 'message' => 'Urgent care is required.', 'conditions' => [['field' => '54', 'operator' => 'checkbox_choice_only', 'exclusiveChoice' => '9']]],
                    ['key' => 'service-fit-none-only', 'type' => 'page_next_gate', 'page' => 2, 'mode' => 'all', 'message' => 'This clinic is not the right pathway.', 'conditions' => [['field' => '62', 'operator' => 'checkbox_choice_only', 'exclusiveChoice' => '9']]],
                ],
            ],
        ]]);

        return Questionnaire::query()->with('questions')->where('settings->wpforms_form_id', '1836')->sole();
    }
}
