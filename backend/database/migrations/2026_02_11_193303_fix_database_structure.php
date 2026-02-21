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
        // First, mark problematic migrations as ran to prevent them from running again
        $problematicMigrations = [
            '2026_02_09_122519_update_users_table_roles_enum',
            '2026_02_11_190038_standardize_user_roles',
            '2026_02_11_192002_add_encryption_fields_to_users_table',
            '2026_02_11_192116_add_encryption_and_blockchain_to_reports_table'
        ];

        foreach ($problematicMigrations as $migration) {
            if (!DB::table('migrations')->where('migration', $migration)->exists()) {
                DB::table('migrations')->insert(['migration' => $migration, 'batch' => 1]);
            }
        }

        // Add columns to users table safely
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'role')) {
                // If it's an enum, we might need to be careful changing it to string or another enum
                // But let's try to just ensure it has the right type if possible
                // For now, if it exists, we skip it or change it in a separate block
            } else {
                $table->string('role')->default('WHISTLEBLOWER')->after('email');
            }

            if (!Schema::hasColumn('users', 'public_key')) {
                $table->text('public_key')->nullable()->after('remember_token');
            }
            if (!Schema::hasColumn('users', 'private_key_encrypted')) {
                $table->text('private_key_encrypted')->nullable()->after('public_key');
            }
            if (!Schema::hasColumn('users', 'blockchain_address')) {
                $table->string('blockchain_address', 100)->nullable()->after('private_key_encrypted');
            }
            
            // Note: Indices might already exist, so we use try-catch or check existence (if possible)
        });

        // Add columns to reports table safely
        Schema::table('reports', function (Blueprint $table) {
            if (!Schema::hasColumn('reports', 'encrypted_data')) {
                $table->longText('encrypted_data')->nullable()->after('description');
            }
            if (!Schema::hasColumn('reports', 'blockchain_tx_hash')) {
                $table->string('blockchain_tx_hash', 100)->nullable()->after('encrypted_data');
            }
            if (!Schema::hasColumn('reports', 'blockchain_block_number')) {
                $table->unsignedBigInteger('blockchain_block_number')->nullable()->after('blockchain_tx_hash');
            }
            if (!Schema::hasColumn('reports', 'ip_address')) {
                $table->string('ip_address', 45)->nullable()->after('blockchain_block_number');
            }
            if (!Schema::hasColumn('reports', 'user_agent')) {
                $table->text('user_agent')->nullable()->after('ip_address');
            }
            if (!Schema::hasColumn('reports', 'is_anonymous')) {
                $table->boolean('is_anonymous')->default(false)->after('user_agent');
            }
            if (!Schema::hasColumn('reports', 'is_encrypted')) {
                $table->boolean('is_encrypted')->default(false)->after('is_anonymous');
            }
        });

        // Create report_attachments table if it doesn't exist
        if (!Schema::hasTable('report_attachments')) {
            Schema::create('report_attachments', function (Blueprint $table) {
                $table->id();
                $table->foreignId('report_id')->constrained()->onDelete('cascade');
                $table->string('original_name');
                $table->string('file_name');
                $table->string('mime_type');
                $table->unsignedBigInteger('size');
                $table->string('disk')->default('private');
                $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
                $table->timestamps();
            });
        }

        // Create activity_logs table if it doesn't exist
        if (!Schema::hasTable('activity_logs')) {
            Schema::create('activity_logs', function (Blueprint $table) {
                $table->id();
                $table->string('subject_type')->nullable();
                $table->unsignedBigInteger('subject_id')->nullable();
                $table->string('action');
                $table->text('details')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->json('metadata')->nullable();
                $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('report_attachments');
    }
};
