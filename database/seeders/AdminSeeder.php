<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\User::updateOrCreate(
            ['email' => 'admin@zacc.org.zw'],
            [
                'name' => 'System Admin',
                'password' => \Hash::make('password'),
                'role' => \App\Models\User::ROLE_ADMIN,
            ]
        );

        \App\Models\User::updateOrCreate(
            ['email' => 'investigator@zacc.org.zw'],
            [
                'name' => 'Chief Investigator',
                'password' => \Hash::make('password'),
                'role' => \App\Models\User::ROLE_INVESTIGATOR,
            ]
        );
    }
}
