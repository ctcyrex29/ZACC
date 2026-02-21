<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update the enum values in the database
        // Note: For MySQL/PostgreSQL, we might need a raw query or change() 
        // In Laravel 11+, we can use change() for enums if dbal is installed, 
        // but often it's safer to use raw for enum updates if unsure.
        // However, I'll use the standard Laravel way first.
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->change();
        });

        // Migrate existing 'admin' to 'investigator'
        \DB::table('users')->where('role', 'admin')->update(['role' => 'investigator']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['user', 'admin'])->default('user')->change();
        });
    }
};
