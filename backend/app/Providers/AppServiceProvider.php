<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('auth', function (Request $request): array {
            return [
                // Protect login/register endpoints from brute force and abuse.
                Limit::perMinute(12)->by('auth:' . ($request->user()?->id ?? $request->ip())),
            ];
        });

        RateLimiter::for('public-reports', function (Request $request): array {
            return [
                Limit::perMinute(20)->by('public-reports:' . ($request->user()?->id ?? $request->ip())),
            ];
        });

        RateLimiter::for('chatbot', function (Request $request): array {
            return [
                Limit::perMinute(30)->by('chatbot:' . ($request->user()?->id ?? $request->ip())),
            ];
        });
    }
}
