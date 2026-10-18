<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Appends;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token', 'avatar_path'])]
#[Appends(['avatar_url'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Built from the current request's host rather than APP_URL, so a phone on the LAN gets a URL it can reach.
     */
    protected function avatarUrl(): Attribute
    {
        return Attribute::get(fn () => $this->avatar_path ? asset('storage/'.$this->avatar_path) : null);
    }

    public function workouts(): HasMany
    {
        return $this->hasMany(Workout::class);
    }

    /**
     * Only one workout runs at a time: starting (or reopening) another is refused until the one in progress
     * is finished or deleted. Call inside the transaction that creates it.
     */
    public function ensureNoWorkoutInProgress(): void
    {
        // Lock the user so two quick taps can't both start one.
        self::query()->whereKey($this->id)->lockForUpdate()->first();

        $active = $this->workouts()->whereNull('completed_at')->first();

        if ($active) {
            abort(409, "Finish or delete “{$active->name}” before starting another workout.");
        }
    }

    public function workoutTemplates(): HasMany
    {
        return $this->hasMany(WorkoutTemplate::class);
    }

    public function exercises(): HasMany
    {
        return $this->hasMany(Exercise::class);
    }

    public function personalRecords(): HasMany
    {
        return $this->hasMany(PersonalRecord::class);
    }

    public function manualRecords(): HasMany
    {
        return $this->hasMany(ManualRecord::class);
    }
}
