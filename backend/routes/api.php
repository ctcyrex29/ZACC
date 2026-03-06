<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AIController;
use App\Http\Controllers\Api\PublicReportController;
use App\Http\Controllers\Api\CaseStageController;
use App\Http\Controllers\Api\AuditController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/reports/anonymous', [PublicReportController::class, 'storeAnonymous']);
Route::get('/reports/track/{trackingCode}', [PublicReportController::class, 'track']);
Route::post('/reports/dispute/{trackingCode}', [PublicReportController::class, 'publicDispute']);
Route::post('/reports/evidence/{trackingCode}', [PublicReportController::class, 'uploadEvidence']);
Route::get('/stats/public', [PublicReportController::class, 'publicStats']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth routes
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);

    // Report routes
    Route::get('/reports', [ReportController::class, 'index']);
    Route::get('/cases', [ReportController::class, 'index']); // Frontend alias
    Route::post('/reports', [ReportController::class, 'store']);
    Route::get('/reports/stats', [ReportController::class, 'stats']);
    Route::get('/reports/{id}', [ReportController::class, 'show']);
    Route::put('/reports/{id}', [ReportController::class, 'update']);
    Route::put('/reports/{id}/status', [ReportController::class, 'updateStatus']);
    Route::post('/reports/{id}/dispute', [ReportController::class, 'dispute']);
    Route::get('/reports/{id}/verify', [ReportController::class, 'verify']);
    Route::post('/reports/{id}/stages', [CaseStageController::class, 'store']);
    Route::get('/reports/{id}/stages', [CaseStageController::class, 'index']);
    Route::get('/notifications', [CaseStageController::class, 'notifications']);
    Route::get('/audit/logs', [AuditController::class, 'index']);

    // AI routes
    Route::post('/ai/analyze-report', [AIController::class, 'analyzeReport']);

    // User management routes (admin only)
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
});
