<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('consultants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->enum('service_type', [
                'program_manager',
                'construction_manager',
                'architect',
                'geotechnical',
                'materials_testing',
                'inspector',
                'safety_consultant',
                'pmis_vendor',
                'owner_rep',
                'other',
            ]);
            $table->string('firm_name');
            $table->bigInteger('contract_amount')->nullable();
            $table->date('contract_date')->nullable();
            $table->string('source_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consultants');
    }
};
