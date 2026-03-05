<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE reports MODIFY user_id BIGINT UNSIGNED NULL');
            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE reports ALTER COLUMN user_id DROP NOT NULL');
            return;
        }

        Schema::table('reports', function (Blueprint $table) {
            if (method_exists($table, 'foreignId')) {
                $table->foreignId('user_id')->nullable()->change();
            }
        });
    }

    public function down(): void
    {
        // Intentionally left empty to avoid destructive rollback on existing anonymous data.
    }
};
