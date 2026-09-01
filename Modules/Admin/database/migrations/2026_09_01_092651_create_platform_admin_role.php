<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table(config('permission.table_names.roles'))->updateOrInsert(
            ['name' => 'platform-admin', 'guard_name' => 'web'],
            ['created_at' => now(), 'updated_at' => now()],
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Roles can be assigned after this migration has run, so rolling back must not remove live authorization data.
    }
};
