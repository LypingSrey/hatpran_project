<?php

namespace App\Models;

use Database\Factories\PersonalRecordFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PersonalRecord extends Model
{
    /** @use HasFactory<PersonalRecordFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'exercise_id',
        'exercise_set_id',
        'manual_record_id',
        'record_type',
        'value',
        'achieved_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'achieved_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function exercise(): BelongsTo
    {
        return $this->belongsTo(Exercise::class);
    }

    public function exerciseSet(): BelongsTo
    {
        return $this->belongsTo(ExerciseSet::class);
    }

    public function manualRecord(): BelongsTo
    {
        return $this->belongsTo(ManualRecord::class);
    }

    /**
     * The value a set scores for the given record type.
     *
     * Volume is rounded to the 2 decimals personal_records.value stores; unrounded, 20.1 kg × 3 comes out
     * as 60.300000000000004 and would beat the saved 60.30 every time the same set is repeated.
     */
    public static function valueFromSet(string $recordType, ExerciseSet $set): float
    {
        return (float) match ($recordType) {
            'max_weight' => $set->weight_kg,
            'max_reps' => $set->reps,
            'max_volume' => round($set->volume, 2),
            'max_duration' => $set->duration_seconds,
            'max_distance' => $set->distance_meters,
            default => 0,
        };
    }

    /**
     * Pick the best completed working set for each record type the exercise tracks.
     *
     * Warmup and incomplete sets never count. On a tie the earliest set wins,
     * so sets must be passed in chronological order.
     *
     * @param  iterable<ExerciseSet>  $sets
     * @return array<string, array{set: ExerciseSet, value: float}>
     */
    public static function bestSets(Exercise $exercise, iterable $sets): array
    {
        $best = [];

        foreach ($sets as $set) {
            if (! $set->is_completed || $set->set_type === 'warmup') {
                continue;
            }

            foreach ($exercise->personalRecordTypes() as $recordType) {
                $value = self::valueFromSet($recordType, $set);

                if ($value > 0 && $value > ($best[$recordType]['value'] ?? 0)) {
                    $best[$recordType] = ['set' => $set, 'value' => $value];
                }
            }
        }

        return $best;
    }

    /**
     * Rebuild a user's records for the given exercises from their completed workout history
     * and the bests they entered by hand. The higher value wins; on a tie the earlier one does.
     *
     * @param  iterable<int>  $exerciseIds
     */
    public static function recalculate(int $userId, iterable $exerciseIds): void
    {
        $exercises = Exercise::query()->whereIn('id', Collection::make($exerciseIds)->unique()->values())->get();

        DB::transaction(function () use ($userId, $exercises) {
            foreach ($exercises as $exercise) {
                $sets = ExerciseSet::query()
                    ->select('exercise_sets.*', 'workouts.completed_at as workout_completed_at')
                    ->join('workout_exercises', 'workout_exercises.id', '=', 'exercise_sets.workout_exercise_id')
                    ->join('workouts', 'workouts.id', '=', 'workout_exercises.workout_id')
                    ->where('workouts.user_id', $userId)
                    ->where('workout_exercises.exercise_id', $exercise->id)
                    ->whereNotNull('workouts.completed_at')
                    ->orderBy('workouts.completed_at')
                    ->orderBy('workout_exercises.order')
                    ->orderBy('exercise_sets.set_number')
                    ->withCasts(['workout_completed_at' => 'datetime'])
                    ->get();

                $best = [];

                foreach (self::bestSets($exercise, $sets) as $recordType => ['set' => $set, 'value' => $value]) {
                    $best[$recordType] = [
                        'exercise_set_id' => $set->id,
                        'manual_record_id' => null,
                        'value' => $value,
                        'achieved_at' => $set->workout_completed_at,
                    ];
                }

                $manualRecords = ManualRecord::query()
                    ->where('user_id', $userId)
                    ->where('exercise_id', $exercise->id)
                    ->whereIn('record_type', $exercise->personalRecordTypes())
                    ->get();

                foreach ($manualRecords as $manualRecord) {
                    $current = $best[$manualRecord->record_type] ?? null;
                    $value = (float) $manualRecord->value;

                    if ($current === null
                        || $value > $current['value']
                        || ($value === $current['value'] && $manualRecord->achieved_at->lt($current['achieved_at']))) {
                        $best[$manualRecord->record_type] = [
                            'exercise_set_id' => null,
                            'manual_record_id' => $manualRecord->id,
                            'value' => $value,
                            'achieved_at' => $manualRecord->achieved_at,
                        ];
                    }
                }

                self::query()
                    ->where('user_id', $userId)
                    ->where('exercise_id', $exercise->id)
                    ->whereNotIn('record_type', array_keys($best))
                    ->delete();

                foreach ($best as $recordType => $attributes) {
                    self::query()->updateOrCreate(
                        ['user_id' => $userId, 'exercise_id' => $exercise->id, 'record_type' => $recordType],
                        $attributes,
                    );
                }
            }
        });
    }
}
