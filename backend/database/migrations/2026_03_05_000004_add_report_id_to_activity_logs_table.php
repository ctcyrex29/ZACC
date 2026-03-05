<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('activity_logs', 'report_id')) {
                $table->foreignId('report_id')->nullable()->after('subject_id')->constrained('reports')->nullOnDelete();
                $table->index('report_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            if (Schema::hasColumn('activity_logs', 'report_id')) {
                $table->dropForeign(['report_id']);
                $table->dropColumn('report_id');
            }
        });
    }
};
