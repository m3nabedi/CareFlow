<?php

namespace Modules\Clinic\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Clinic\Models\Questionnaire;
use Modules\Clinic\Services\WpFormsImportService;
use Tests\TestCase;

class WpFormsImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_preserves_wpforms_settings_and_layouts(): void
    {
        $result = app(WpFormsImportService::class)->import([[
            'id' => 42,
            'fields' => [
                '1' => ['id' => '1', 'type' => 'radio', 'label' => 'Contact preference', 'required' => '1', 'choices' => ['1' => ['label' => 'Email', 'value' => 'email']], 'conditional_logic' => '1'],
                '2' => ['id' => '2', 'type' => 'layout', 'label' => 'Layout', 'columns' => [['fields' => [1]]]],
            ],
            'settings' => ['form_title' => 'Referral form', 'form_desc' => 'Imported from WPForms', 'submit_text' => 'Send referral'],
            'providers' => ['airtable' => ['connection' => ['base_id' => 'base']]],
            'meta' => ['template' => 'blank'],
        ]]);

        $this->assertSame(['created' => 1, 'replaced' => 0, 'skipped' => 0], $result);

        $questionnaire = Questionnaire::query()->with('questions')->sole();

        $this->assertSame('Referral form', $questionnaire->name);
        $this->assertSame('42', $questionnaire->settings['wpforms_form_id']);
        $this->assertSame('Send referral', $questionnaire->settings['wpforms_settings']['submit_text']);
        $this->assertSame('base', $questionnaire->settings['wpforms_providers']['airtable']['connection']['base_id']);
        $this->assertCount(2, $questionnaire->questions);
        $this->assertTrue($questionnaire->questions->first()->is_required);
        $this->assertSame('radio', $questionnaire->questions->first()->type);
        $this->assertSame(1, $questionnaire->layout['layouts'][0]['columns'][0]['fields'][0]);

        $skipped = app(WpFormsImportService::class)->import([['id' => 42, 'fields' => [], 'settings' => []]]);

        $this->assertSame(['created' => 0, 'replaced' => 0, 'skipped' => 1], $skipped);
    }
}
