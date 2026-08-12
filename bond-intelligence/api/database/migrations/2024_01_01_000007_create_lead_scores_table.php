<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->unique()->constrained('agencies')->cascadeOnDelete();
            $table->tinyInteger('score')->unsigned()->default(0);
            $table->tinyInteger('confidence')->unsigned()->default(0);
            $table->enum('opportunity_stage', [
                'bond_passed',
                'bond_failed_retry',
                'bond_issued',
                'master_plan_active',
                'rfq_expected',
                'rfq_active',
                'consultant_awarded',
                'construction_active',
                'closeout',
            ])->nullable();
            $table->text('estimated_next_action')->nullable();
            $table->text('recommended_outreach_angle')->nullable();
            $table->json('scoring_factors')->nullable();
            $table->boolean('manual_review_flag')->default(false);
            $table->boolean('approach_now')->default(false);
            $table->timestamp('scored_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_scores');
    }
};
