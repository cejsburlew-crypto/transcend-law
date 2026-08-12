<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->nullable()->constrained('agencies')->nullOnDelete();
            $table->string('url');
            $table->string('title')->nullable();
            $table->string('document_type')->nullable();
            $table->string('source_name')->nullable();
            $table->date('published_date')->nullable();
            $table->timestamp('scraped_at')->nullable();
            $table->string('content_hash')->nullable();
            $table->longText('raw_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_documents');
    }
};
