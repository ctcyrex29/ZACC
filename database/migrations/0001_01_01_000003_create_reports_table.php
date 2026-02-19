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
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->string('case_id')->unique(); // e.g., "ZACC-1234"
            $table->string('reference_code')->unique(); // e.g., "ZACC-REF-123"
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('type'); // BRIBERY, EMBEZZLEMENT, etc.
            $table->string('institution');
            $table->string('location')->nullable();
            $table->text('description');
            $table->string('status')->default('SUBMITTED'); // SUBMITTED, UNDER_REVIEW, INVESTIGATING, REFERRED, CLOSED, DISPUTED
            $table->string('priority')->default('MEDIUM'); // LOW, MEDIUM, HIGH, CRITICAL
            $table->integer('risk_score')->default(50); // 0-100
            $table->text('dispute_reason')->nullable();
            $table->timestamp('last_updated')->nullable();
            $table->timestamps();

            // Indexes for better query performance
            $table->index('user_id');
            $table->index('status');
            $table->index('priority');
            $table->index('case_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
