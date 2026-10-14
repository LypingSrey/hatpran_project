<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkoutExerciseResource;
use App\Models\ExerciseSet;
use App\Models\PersonalRecord;
use App\Models\Workout;
use App\Models\WorkoutExercise;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Adding, changing and removing exercises in a workout that already exists, so a lifter can
 * change the plan mid-session (and fix a finished workout afterwards).
 */
class WorkoutExerciseController extends Controller
{
    public function store(Request $request, Workout $workout): WorkoutExerciseResource
    {
        $user = $request->user();

        if ($workout->user_id !== $user->id) {
            abort(403);
        }

        $request->validate([
            'exercise_id' => [
                'required',
                'integer',
                Rule::exists('exercises', 'id')->where(
                    fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $user->id)
                ),
            ],
            'notes' => 'nullable|string',
            'sets' => 'nullable|array|max:100',
            'sets.*.set_type' => 'nullable|in:normal,warmup,drop,failure',
            ...ExerciseSet::measurementRules('sets.*.'),
        ]);

        // As in WorkoutController::store, empty set objects ([{}, {}] = "two blank sets") are read
        // from the validated input rather than validated(), which would drop them.
        $sets = $request->input('sets') ?? [];

        $workoutExercise = DB::transaction(function () use ($request, $workout, $sets) {
            // Lock the workout so two quick taps can't both take the same place at the end.
            Workout::query()->whereKey($workout->id)->lockForUpdate()->first();

            $workoutExercise = $workout->workoutExercises()->create([
                'exercise_id' => $request->integer('exercise_id'),
                'order' => ($workout->workoutExercises()->max('order') ?? -1) + 1,
                'notes' => $request->input('notes'),
            ]);

            foreach (array_values($sets) as $index => $setData) {
                $workoutExercise->sets()->create([
                    'set_number' => $index + 1,
                    'set_type' => $setData['set_type'] ?? 'normal',
                    'weight_kg' => $setData['weight_kg'] ?? null,
                    'reps' => $setData['reps'] ?? null,
                    'distance_meters' => $setData['distance_meters'] ?? null,
                    'duration_seconds' => $setData['duration_seconds'] ?? null,
                    'rpe' => $setData['rpe'] ?? null,
                    'is_completed' => false,
                ]);
            }

            return $workoutExercise;
        });

        return new WorkoutExerciseResource(
            $workoutExercise->load(['exercise.muscleGroup', 'exercise.equipment', 'sets'])
        );
    }

    public function update(Request $request, WorkoutExercise $workoutExercise): WorkoutExerciseResource
    {
        if ($workoutExercise->workout->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'order' => 'sometimes|integer|min:0',
            'notes' => 'nullable|string',
        ]);

        $workoutExercise->update($validated);

        return new WorkoutExerciseResource(
            $workoutExercise->load(['exercise.muscleGroup', 'exercise.equipment', 'sets'])
        );
    }

    public function destroy(Request $request, WorkoutExercise $workoutExercise): Response
    {
        $workout = $workoutExercise->workout;

        if ($workout->user_id !== $request->user()->id) {
            abort(403);
        }

        DB::transaction(function () use ($workout, $workoutExercise) {
            $workoutExercise->delete();

            // A finished workout's sets may hold records, so rebuild them without this exercise.
            if ($workout->completed_at) {
                PersonalRecord::recalculate($workout->user_id, [$workoutExercise->exercise_id]);
            }
        });

        return response()->noContent();
    }
}
