<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bond_measures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->string('measure_name');
            $table->string('measure_number')->nullable();
            $table->date('election_date')->nullable();
            $table->enum('result', ['passed', 'failed', 'pending', 'cancelled'])->default('pending');
            $table->decimal('vote_pct', 5, 2)->nullable();
            $table->bigInteger('bond_amount')->nullable();
            $table->text('bond_purpose')->nullable();
            $table->json('project_categories')->nullable();
            $table->bigInteger('authorized_amount')->nullable();
            $table->bigInteger('issued_amount')->nullable();
            $table->bigInteger('unissued_amount')->nullable();
            $table->string('source_url')->nullable();
            $table->string('source_document_title')->nullable();
            $table->date('source_date')->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bond_measures');
    }
};
