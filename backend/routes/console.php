<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Clear out sign-in tokens that have expired (only matters when SANCTUM_EXPIRATION is set).
Schedule::command('sanctum:prune-expired --hours=24')->daily();
