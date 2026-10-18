<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Database\Factories\WorkoutFactory;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Workout extends Model
{
    /** @use HasFactory<WorkoutFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'workout_template_id',
        'name',
        'notes',
        'started_at',
        'completed_at',
        'duration_seconds',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(WorkoutTemplate::class, 'workout_template_id');
    }

    public function workoutExercises(): HasMany
    {
        return $this->hasMany(WorkoutExercise::class)->orderBy('order');
    }

    /**
     * Give each exercise the ticked sets from the last finished workout before this one that had it,
     * so the log can show last time's numbers.
     */
    public function loadPreviousSets(): static
    {
        // ponytail: two queries per exercise; batch into one if workouts grow past a dozen or so exercises.
        foreach ($this->workoutExercises as $workoutExercise) {
            $workoutExercise->setRelation('previousSets', $this->previousSetsFor($workoutExercise->exercise_id));
        }

        return $this;
    }

    public function previousSetsFor(int $exerciseId): EloquentCollection
    {
        $completedSets = fn ($q) => $q->where('is_completed', true);

        return WorkoutExercise::query()
            ->where('exercise_id', $exerciseId)
            ->whereHas('workout', fn ($q) => $q
                ->where('user_id', $this->user_id)
                ->whereNotNull('completed_at')
                ->where('started_at', '<', $this->started_at))
            ->whereHas('sets', $completedSets)
            ->orderByDesc(Workout::select('started_at')->whereColumn('workouts.id', 'workout_exercises.workout_id'))
            ->with(['sets' => $completedSets])
            ->first()?->sets ?? new EloquentCollection;
    }

    public function markCompleted(?CarbonInterface $completedAt = null): void
    {
        $completedAt ??= now();

        $this->update([
            'completed_at' => $completedAt,
            'duration_seconds' => max(0, (int) $this->started_at->diffInSeconds($completedAt)),
        ]);
    }

    /**
     * Save any personal records this completed workout beats, returning the new records.
     *
     * @return Collection<int, PersonalRecord>
     */
    public function recordPersonalRecords(): Collection
    {
        $this->loadMissing(['workoutExercises.exercise', 'workoutExercises.sets']);

        return DB::transaction(function () {
            $achieved = new Collection;

            foreach ($this->workoutExercises->groupBy('exercise_id') as $workoutExercises) {
                $exercise = $workoutExercises->first()->exercise;
                $sets = $workoutExercises->flatMap(fn (WorkoutExercise $we) => $we->sets);

                foreach (PersonalRecord::bestSets($exercise, $sets) as $recordType => ['set' => $set, 'value' => $value]) {
                    $record = PersonalRecord::query()->lockForUpdate()->firstOrNew([
                        'user_id' => $this->user_id,
                        'exercise_id' => $exercise->id,
                        'record_type' => $recordType,
                    ]);

                    if ($record->exists && $value <= (float) $record->value) {
                        continue;
                    }

                    $record->fill([
                        'exercise_set_id' => $set->id,
                        'manual_record_id' => null,
                        'value' => $value,
                        'achieved_at' => $this->completed_at,
                    ])->save();

                    $achieved->push($record->setRelation('exercise', $exercise));
                }
            }

            return $achieved;
        });
    }

    /**
     * Rebuild the owner's records for every exercise in this workout.
     */
    public function recalculatePersonalRecords(): void
    {
        PersonalRecord::recalculate($this->user_id, $this->workoutExercises()->pluck('exercise_id'));
    }

    public function getTotalVolumeAttribute(): float
    {
        return $this->workoutExercises
            ->filter(fn ($we) => $we->exercise?->countsTowardVolume() ?? true)
            ->flatMap(fn ($we) => $we->sets)
            ->where('is_completed', true)
            ->sum(fn ($set) => ($set->weight_kg ?? 0) * ($set->reps ?? 0));
    }

    public function getTotalSetsAttribute(): int
    {
        return $this->workoutExercises
            ->flatMap(fn ($we) => $we->sets)
            ->where('is_completed', true)
            ->count();
    }
}
