<?php

use App\Mcp\Servers\QuestionnaireServer;
use Laravel\Mcp\Facades\Mcp;

Mcp::web('/mcp/questionnaires', QuestionnaireServer::class)
    ->middleware('auth:sanctum');
