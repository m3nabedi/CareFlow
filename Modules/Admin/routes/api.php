<?php

use Illuminate\Support\Facades\Route;
use Modules\Admin\Http\Controllers\Api\PlatformAdminController;
use Modules\Admin\Http\Middleware\EnsurePlatformAdministrator;

Route::prefix('platform-admin')->name('platform-admin.')->group(function (): void {
    Route::post('/auth/login', [PlatformAdminController::class, 'login'])
        ->middleware('throttle:6,1')
        ->name('auth.login');

    Route::middleware(['auth:sanctum', EnsurePlatformAdministrator::class])->group(function (): void {
        Route::get('/dashboard', [PlatformAdminController::class, 'dashboard'])->name('dashboard');
        Route::apiResource('clinics', PlatformAdminController::class)
            ->only(['index', 'store', 'show', 'update']);
    });
});
