<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // First update existing records to avoid enum constraints if they exist
        DB::table('users')->where('role', 'user')->update(['role' => 'WHISTLEBLOWER']);
        DB::table('users')->where('role', 'investigator')->update(['role' => 'INVESTIGATOR']);
        DB::table('users')->where('role', 'admin')->update(['role' => 'ADMIN']);

        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('WHISTLEBLOWER')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->change();
        });
        
        DB::table('users')->where('role', 'WHISTLEBLOWER')->update(['role' => 'user']);
        DB::table('users')->where('role', 'INVESTIGATOR')->update(['role' => 'investigator']);
        DB::table('users')->where('role', 'ADMIN')->update(['role' => 'admin']);
    }
};
