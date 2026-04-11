<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('report_language', 10)->default('en')->after('is_encrypted');
            $table->unsignedTinyInteger('text_clarity_score')->default(0)->after('report_language');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropColumn(['report_language', 'text_clarity_score']);
        });
    }
};
