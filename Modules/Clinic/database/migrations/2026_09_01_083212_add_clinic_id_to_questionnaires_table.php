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
        Schema::table('questionnaires', function (Blueprint $table) {
            $table->foreignId('clinic_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });

        $clinicId = DB::table('clinics')->where('slug', 'empowered-minds-clinic')->value('id');
        if ($clinicId === null) {
            $clinicId = DB::table('clinics')->insertGetId([
                'name' => 'Empowered Minds Clinic',
                'slug' => 'empowered-minds-clinic',
                'settings' => json_encode([], JSON_THROW_ON_ERROR),
                'branding' => json_encode([], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('questionnaires')
            ->whereIn('slug', ['appointment-form-main-by-imi-v2', 'internal-patient-follow-up-contact'])
            ->update(['clinic_id' => $clinicId]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('questionnaires', function (Blueprint $table) {
            $table->dropConstrainedForeignId('clinic_id');
        });
    }
};
