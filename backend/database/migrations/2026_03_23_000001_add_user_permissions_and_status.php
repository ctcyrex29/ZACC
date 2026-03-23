<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('role');
            $table->json('allowed_case_types')->nullable()->after('is_active');
            $table->string('password_reset_token')->nullable()->after('allowed_case_types');
            $table->timestamp('password_reset_token_expires_at')->nullable()->after('password_reset_token');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_active', 'allowed_case_types', 'password_reset_token', 'password_reset_token_expires_at']);
        });
    }
};
