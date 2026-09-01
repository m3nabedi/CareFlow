<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('clinic_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['clinic_id', 'user_id']);
        });

        DB::table('clinics')->where('slug', 'empowered-minds-clinic')->update([
            'settings' => json_encode([
                'locale' => 'en',
                'timezone' => 'Australia/Sydney',
                'default_calling_code' => '+33',
                'allowed_calling_codes' => [['country' => 'France', 'iso' => 'FR', 'label' => 'France (+33)', 'callingCode' => '+33']],
            ], JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clinic_user');
    }
};
