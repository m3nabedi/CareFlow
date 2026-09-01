<?php

use Illuminate\Support\Facades\Route;
use Modules\Clinic\Http\Controllers\Api\AdminClinicController;
use Modules\Clinic\Http\Controllers\Api\AuthController;
use Modules\Clinic\Http\Controllers\Api\ClinicController;
use Modules\Clinic\Http\Controllers\Api\QuestionnaireController;
use Modules\Clinic\Http\Controllers\Api\SubmissionController;

Route::get('/public/clinics/resolve', [ClinicController::class, 'resolveByDomain'])->name('public.clinics.resolve');

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:6,1')->name('auth.register');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1')->name('auth.login');
    Route::post('/phone/request', [AuthController::class, 'requestPhoneLogin'])->middleware('throttle:3,1')->name('auth.phone.request');
    Route::post('/phone/verify', [AuthController::class, 'verifyPhoneLogin'])->middleware('throttle:6,1')->name('auth.phone.verify');
    Route::get('/google/redirect', [AuthController::class, 'redirectToGoogle'])->middleware('throttle:6,1')->name('auth.google.redirect');
    Route::get('/google/callback', [AuthController::class, 'handleGoogleCallback'])->middleware('throttle:6,1')->name('auth.google.callback');
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout'])->name('auth.logout');
    Route::get('/auth/me', [AuthController::class, 'me'])->name('auth.me');

    Route::prefix('admin/clinic')->group(function (): void {
        Route::get('/', [AdminClinicController::class, 'showCurrent'])->name('admin.clinic.show');
        Route::patch('/', [AdminClinicController::class, 'updateCurrent'])->name('admin.clinic.update');
        Route::get('/questionnaires', [AdminClinicController::class, 'currentQuestionnaires'])->name('admin.clinic.questionnaires.index');
        Route::post('/questionnaires', [AdminClinicController::class, 'createCurrentQuestionnaire'])->name('admin.clinic.questionnaires.store');
        Route::get('/questionnaires/{questionnaire}', [AdminClinicController::class, 'currentQuestionnaire'])->name('admin.clinic.questionnaires.show');
        Route::patch('/questionnaires/{questionnaire}', [AdminClinicController::class, 'updateCurrentQuestionnaire'])->name('admin.clinic.questionnaires.update');
        Route::patch('/questionnaires/{questionnaire}/questions/{question}', [AdminClinicController::class, 'updateCurrentQuestion'])->name('admin.clinic.questionnaires.questions.update');
        Route::get('/questionnaires/{questionnaire}/responses', [AdminClinicController::class, 'currentResponses'])->name('admin.clinic.questionnaires.responses.index');
    });
});

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
