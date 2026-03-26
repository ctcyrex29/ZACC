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
        Schema::table('reports', function (Blueprint $table) {
            // Track which stage the case was at when it was closed (for dispute re-entry)
            if (!Schema::hasColumn('reports', 'closed_at_stage')) {
                $table->string('closed_at_stage')->nullable()->after('dispute_reason');
                $table->index('closed_at_stage');
            }
            // Assigned investigator reference (skip if already exists from earlier migration)
            if (!Schema::hasColumn('reports', 'assigned_to')) {
                $table->unsignedBigInteger('assigned_to')->nullable()->after('user_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex(['closed_at_stage']);
            $table->dropColumn(['closed_at_stage', 'assigned_to']);
        });
    }
};
