<?php

use App\Http\Controllers\Api\QuestionnaireController;
use App\Http\Controllers\Api\SubmissionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/questionnaires', [QuestionnaireController::class, 'index']);
Route::get('/questionnaires/{identifier}', [QuestionnaireController::class, 'show']);
Route::get('/questionnaires/{questionnaire}/responses', [SubmissionController::class, 'index']);
Route::post('/questionnaires/{questionnaire}/responses', [SubmissionController::class, 'store']);
