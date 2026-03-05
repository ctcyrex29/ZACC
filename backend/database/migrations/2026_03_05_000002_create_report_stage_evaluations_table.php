<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_stage_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('report_id')->constrained('reports')->cascadeOnDelete();
            $table->foreignId('investigator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('stage');
            $table->text('investigator_notes');
            $table->unsignedTinyInteger('expert_score');
            $table->unsignedTinyInteger('manual_score')->nullable();
            $table->unsignedTinyInteger('final_score');
            $table->json('expert_context')->nullable();
            $table->timestamps();

            $table->index(['report_id', 'stage']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_stage_evaluations');
    }
};
