<?php

namespace App\Mcp\Servers;

use App\Mcp\Tools\CreateQuestionnaire;
use App\Mcp\Tools\ListQuestionnaires;
use Laravel\Mcp\Server;
use Laravel\Mcp\Server\Attributes\Instructions;
use Laravel\Mcp\Server\Attributes\Name;
use Laravel\Mcp\Server\Attributes\Version;

#[Name('Questionnaire Server')]
#[Version('1.0.0')]
#[Instructions('Use these tools to inspect published questionnaires and create new draft questionnaires. When creating a form, provide clear labels and stable machine-readable keys for every field. Review the returned draft before publishing it through the application.')]
class QuestionnaireServer extends Server
{
    protected array $tools = [
        ListQuestionnaires::class,
        CreateQuestionnaire::class,
    ];

    protected array $resources = [
        //
    ];

    protected array $prompts = [
        //
    ];
}
