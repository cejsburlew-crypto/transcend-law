<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agencies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('normalized_name')->unique();
            $table->enum('agency_type', [
                'k12_district',
                'community_college',
                'university',
                'city',
                'county',
                'water_district',
                'hospital_district',
                'transit',
                'airport',
                'port',
                'special_district',
            ]);
            $table->char('state', 2);
            $table->string('county')->nullable();
            $table->string('city')->nullable();
            $table->string('website')->nullable();
            $table->integer('population')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agencies');
    }
};
