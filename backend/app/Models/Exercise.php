<?php

namespace App\Models;

use Database\Factories\ExerciseFactory;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exercise extends Model
{
    /** @use HasFactory<ExerciseFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'muscle_group_id',
        'equipment_id',
        'name',
        'description',
        'instructions',
        'exercise_type',
        'is_custom',
    ];

    protected function casts(): array
    {
        return [
            'is_custom' => 'boolean',
        ];
    }

    /**
     * Limit the query to global exercises and the given user's custom exercises.
     */
    #[Scope]
    protected function visibleTo(Builder $query, User $user): void
    {
        $query->where(function (Builder $query) use ($user) {
            $query->whereNull('user_id')->orWhere('user_id', $user->id);
        });
    }

    public function isVisibleTo(User $user): bool
    {
        return $this->user_id === null || $this->user_id === $user->id;
    }

    /**
     * The personal record types that are meaningful for this exercise's type.
     *
     * @return list<string>
     */
    public function personalRecordTypes(): array
    {
        return match ($this->exercise_type) {
            'weight_reps', 'weighted_bodyweight' => ['max_weight', 'max_reps', 'max_volume'],
            'bodyweight_reps', 'assisted_bodyweight' => ['max_reps'],
            'duration' => ['max_duration'],
            'distance_duration' => ['max_distance', 'max_duration'],
            'weight_distance' => ['max_weight', 'max_distance'],
            default => [],
        };
    }

    /**
     * Exercise types whose weight is assistance rather than load, so it adds no volume.
     */
    public const ASSISTED_TYPES = ['assisted_bodyweight'];

    public function countsTowardVolume(): bool
    {
        return ! in_array($this->exercise_type, self::ASSISTED_TYPES, true);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function muscleGroup(): BelongsTo
    {
        return $this->belongsTo(MuscleGroup::class);
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function workoutExercises(): HasMany
    {
        return $this->hasMany(WorkoutExercise::class);
    }

    public function templateExercises(): HasMany
    {
        return $this->hasMany(TemplateExercise::class);
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
