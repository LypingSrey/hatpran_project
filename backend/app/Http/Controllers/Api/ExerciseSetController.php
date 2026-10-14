<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExerciseSetResource;
use App\Models\ExerciseSet;
use App\Models\PersonalRecord;
use App\Models\WorkoutExercise;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ExerciseSetController extends Controller
{
    public function index(Request $request, WorkoutExercise $workoutExercise): AnonymousResourceCollection
    {
        if ($workoutExercise->workout->user_id !== $request->user()->id) {
            abort(403);
        }

        return ExerciseSetResource::collection($workoutExercise->sets);
    }

    public function store(Request $request, WorkoutExercise $workoutExercise): ExerciseSetResource
    {
        if ($workoutExercise->workout->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'set_type' => 'nullable|in:normal,warmup,drop,failure',
            ...ExerciseSet::measurementRules(),
            'is_completed' => 'boolean',
        ]);

        $set = DB::transaction(function () use ($workoutExercise, $validated) {
            // Lock the exercise so two quick "Add set" taps can't both take the same set number.
            WorkoutExercise::query()->whereKey($workoutExercise->id)->lockForUpdate()->first();

            $lastSetNumber = $workoutExercise->sets()->max('set_number') ?? 0;

            return $workoutExercise->sets()->create([
                'set_number' => $lastSetNumber + 1,
                'set_type' => $validated['set_type'] ?? 'normal',
                'weight_kg' => $validated['weight_kg'] ?? null,
                'reps' => $validated['reps'] ?? null,
                'distance_meters' => $validated['distance_meters'] ?? null,
                'duration_seconds' => $validated['duration_seconds'] ?? null,
                'rpe' => $validated['rpe'] ?? null,
                'is_completed' => $validated['is_completed'] ?? false,
            ]);
        });

        $this->recalculateRecordsIfFinished($workoutExercise);

        return new ExerciseSetResource($set);
    }

    public function show(Request $request, ExerciseSet $exerciseSet): ExerciseSetResource
    {
        if ($exerciseSet->workoutExercise->workout->user_id !== $request->user()->id) {
            abort(403);
        }

        return new ExerciseSetResource($exerciseSet);
    }

    public function update(Request $request, ExerciseSet $exerciseSet): ExerciseSetResource
    {
        if ($exerciseSet->workoutExercise->workout->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'set_type' => 'sometimes|in:normal,warmup,drop,failure',
            ...ExerciseSet::measurementRules(),
            'is_completed' => 'boolean',
        ]);

        $exerciseSet->update($validated);

        $this->recalculateRecordsIfFinished($exerciseSet->workoutExercise);

        return new ExerciseSetResource($exerciseSet);
    }

    public function destroy(Request $request, ExerciseSet $exerciseSet): Response
    {
        if ($exerciseSet->workoutExercise->workout->user_id !== $request->user()->id) {
            abort(403);
        }

        $exerciseSet->delete();

        // Close the gap so the log reads 1, 2, 3 again; this also mends gaps left by older deletes.
        $exerciseSet->workoutExercise->sets()->get()
            ->each(fn (ExerciseSet $set, int $index) => $set->update(['set_number' => $index + 1]));

        $this->recalculateRecordsIfFinished($exerciseSet->workoutExercise);

        return response()->noContent();
    }

    public function complete(Request $request, ExerciseSet $exerciseSet): ExerciseSetResource
    {
        if ($exerciseSet->workoutExercise->workout->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate(ExerciseSet::measurementRules());

        $exerciseSet->update([
            ...$validated,
            'is_completed' => true,
        ]);

        $this->recalculateRecordsIfFinished($exerciseSet->workoutExercise);

        return new ExerciseSetResource($exerciseSet);
    }

    /**
     * Keep personal records in step when a set in an already finished workout changes.
     */
    private function recalculateRecordsIfFinished(WorkoutExercise $workoutExercise): void
    {
        if ($workoutExercise->workout->completed_at) {
            PersonalRecord::recalculate($workoutExercise->workout->user_id, [$workoutExercise->exercise_id]);
        }
    }
}
