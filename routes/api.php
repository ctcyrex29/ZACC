<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AIController;

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

    // AI routes
    Route::post('/ai/analyze-report', [AIController::class, 'analyzeReport']);

    // User management routes (admin only)
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
});
