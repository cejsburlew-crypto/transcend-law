<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outreach_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained('agencies')->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->enum('action_type', ['email', 'call', 'linkedin', 'meeting', 'proposal', 'follow_up']);
            $table->enum('status', ['planned', 'sent', 'responded', 'converted', 'no_response'])->default('planned');
            $table->text('notes')->nullable();
            $table->date('action_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outreach_actions');
    }
};
