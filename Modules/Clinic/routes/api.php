<?php

use Illuminate\Support\Facades\Route;
use Modules\Clinic\Http\Controllers\Api\ClinicController;
use Modules\Clinic\Http\Controllers\Api\QuestionnaireController;
use Modules\Clinic\Http\Controllers\Api\SubmissionController;

Route::get('/clinics', [ClinicController::class, 'index'])->name('clinics.index');
Route::get('/clinics/{clinic:slug}', [ClinicController::class, 'show'])->name('clinics.show');

Route::scopeBindings()->group(function (): void {
    Route::get('/clinics/{clinic:slug}/questionnaires', [QuestionnaireController::class, 'clinicIndex'])->name('clinics.questionnaires.index');
    Route::get('/clinics/{clinic:slug}/questionnaires/{questionnaire:slug}', [QuestionnaireController::class, 'clinicShow'])->name('clinics.questionnaires.show');
    Route::post('/clinics/{clinic:slug}/questionnaires/{questionnaire:slug}/evaluate', [SubmissionController::class, 'clinicEvaluate'])->name('clinics.questionnaires.evaluate');
    Route::get('/clinics/{clinic:slug}/questionnaires/{questionnaire:slug}/responses', [SubmissionController::class, 'clinicIndex'])->middleware('auth:sanctum')->name('clinics.questionnaires.responses.index');
    Route::post('/clinics/{clinic:slug}/questionnaires/{questionnaire:slug}/responses', [SubmissionController::class, 'clinicStore'])->name('clinics.questionnaires.responses.store');
});

Route::get('/questionnaires', [QuestionnaireController::class, 'index'])->name('questionnaires.index');
Route::get('/questionnaires/{identifier}', [QuestionnaireController::class, 'show'])->name('questionnaires.show');
Route::post('/questionnaires/{questionnaire}/evaluate', [SubmissionController::class, 'evaluate'])->name('questionnaires.evaluate');
Route::get('/questionnaires/{questionnaire}/responses', [SubmissionController::class, 'index'])->middleware('auth:sanctum')->name('questionnaires.responses.index');
Route::post('/questionnaires/{questionnaire}/responses', [SubmissionController::class, 'store'])->name('questionnaires.responses.store');
