<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('procurement_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignId('bond_measure_id')->nullable()->constrained('bond_measures')->nullOnDelete();
            $table->enum('event_type', [
                'rfq_issued',
                'rfp_issued',
                'award',
                'contract_executed',
                'board_approval',
                'notice_of_intent',
            ]);
            $table->string('service_type')->nullable();
            $table->string('title');
            $table->date('issue_date')->nullable();
            $table->date('due_date')->nullable();
            $table->date('award_date')->nullable();
            $table->string('awarded_to')->nullable();
            $table->bigInteger('estimated_value')->nullable();
            $table->string('source_url')->nullable();
            $table->string('source_document_title')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('procurement_events');
    }
};
