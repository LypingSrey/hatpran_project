<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PersonalRecordResource;
use App\Http\Resources\WorkoutResource;
use App\Models\ExerciseSet;
use App\Models\PersonalRecord;
use App\Models\Workout;
use App\Models\WorkoutTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkoutController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $workouts = $request->user()
            ->workouts()
            ->with(['workoutExercises.exercise', 'workoutExercises.sets', 'template'])
            ->when($request->boolean('completed'), fn ($q) => $q->whereNotNull('completed_at'))
            ->when($request->boolean('in_progress'), fn ($q) => $q->whereNull('completed_at'))
            ->latest('started_at')
            ->latest('id')
            ->paginate($this->perPage($request, 20));

        return WorkoutResource::collection($workouts);
    }

    public function store(Request $request): WorkoutResource
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string',
            'workout_template_id' => [
                'nullable',
                'integer',
                Rule::exists('workout_templates', 'id')->where('user_id', $user->id),
            ],
            'exercises' => 'nullable|array',
            'exercises.*.exercise_id' => [
                'required',
                'integer',
                Rule::exists('exercises', 'id')->where(
                    fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $user->id)
                ),
            ],
            'exercises.*.order' => 'nullable|integer|min:0',
            'exercises.*.notes' => 'nullable|string',
            'exercises.*.sets' => 'nullable|array',
            'exercises.*.sets.*.set_type' => 'nullable|in:normal,warmup,drop,failure',
            ...ExerciseSet::measurementRules('exercises.*.sets.*.'),
        ]);

        // validated() drops empty set objects (e.g. [{}, {}] meaning "two blank sets"), so the
        // lists are read from the already-validated input and only known keys are used below.
        $exercises = $request->input('exercises') ?? [];

        $workout = DB::transaction(function () use ($user, $validated, $exercises) {
            $workout = $user->workouts()->create([
                'name' => $validated['name'],
                'notes' => $validated['notes'] ?? null,
                'workout_template_id' => $validated['workout_template_id'] ?? null,
                'started_at' => now(),
            ]);

            foreach (array_values($exercises) as $index => $exerciseData) {
                $workoutExercise = $workout->workoutExercises()->create([
                    'exercise_id' => $exerciseData['exercise_id'],
                    'order' => $exerciseData['order'] ?? $index,
                    'notes' => $exerciseData['notes'] ?? null,
                ]);

                foreach (array_values($exerciseData['sets'] ?? []) as $setIndex => $setData) {
                    $workoutExercise->sets()->create([
                        'set_number' => $setIndex + 1,
                        'set_type' => $setData['set_type'] ?? 'normal',
                        'weight_kg' => $setData['weight_kg'] ?? null,
                        'reps' => $setData['reps'] ?? null,
                        'distance_meters' => $setData['distance_meters'] ?? null,
                        'duration_seconds' => $setData['duration_seconds'] ?? null,
                        'rpe' => $setData['rpe'] ?? null,
                        'is_completed' => false,
                    ]);
                }
            }

            if ($workout->workout_template_id) {
                WorkoutTemplate::find($workout->workout_template_id)?->incrementUsage();
            }

            return $workout;
        });

        return new WorkoutResource(
            $workout->load(['workoutExercises.exercise', 'workoutExercises.sets', 'template'])
        );
    }

    public function show(Request $request, Workout $workout): WorkoutResource
    {
        if ($workout->user_id !== $request->user()->id) {
            abort(403);
        }

        return new WorkoutResource(
            $workout->load(['workoutExercises.exercise.muscleGroup', 'workoutExercises.exercise.equipment', 'workoutExercises.sets', 'template'])
        );
    }

    public function update(Request $request, Workout $workout): WorkoutResource
    {
        if ($workout->user_id !== $request->user()->id) {
            abort(403);
        }

        // Times can't be in the future; a few minutes' slack covers a phone clock that runs slightly fast.
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'notes' => 'nullable|string',
            'started_at' => 'sometimes|required|date|before_or_equal:+5 minutes',
            'completed_at' => 'nullable|date|before_or_equal:+5 minutes',
        ], [
            'started_at.before_or_equal' => "The start time can't be in the future.",
            'completed_at.before_or_equal' => "The finish time can't be in the future.",
        ]);

        $startedAt = isset($validated['started_at']) ? Carbon::parse($validated['started_at']) : $workout->started_at;

        if (isset($validated['completed_at']) && Carbon::parse($validated['completed_at'])->lt($startedAt)) {
            throw ValidationException::withMessages([
                'completed_at' => 'The finish time must be after the start time.',
            ]);
        }

        $personalRecords = DB::transaction(function () use ($workout, $validated) {
            $wasCompleted = $workout->completed_at !== null;

            $workout->update(collect($validated)->except('completed_at')->all());

            if (array_key_exists('completed_at', $validated)) {
                if ($validated['completed_at'] === null) {
                    $workout->update(['completed_at' => null, 'duration_seconds' => null]);
                } else {
                    $workout->markCompleted(Carbon::parse($validated['completed_at']));
                }
            } elseif ($wasCompleted && isset($validated['started_at'])) {
                // Moving a finished workout to another time keeps its duration.
                $workout->markCompleted($workout->started_at->copy()->addSeconds($workout->duration_seconds ?? 0));
            } else {
                return new Collection;
            }

            if (! $wasCompleted && $workout->completed_at) {
                return $workout->recordPersonalRecords();
            }

            if ($wasCompleted) {
                $workout->recalculatePersonalRecords();
            }

            return new Collection;
        });

        return (new WorkoutResource(
            $workout->load(['workoutExercises.exercise', 'workoutExercises.sets', 'template'])
        ))->additional(['personal_records' => PersonalRecordResource::collection($personalRecords)]);
    }

    public function destroy(Request $request, Workout $workout): Response
    {
        if ($workout->user_id !== $request->user()->id) {
            abort(403);
        }

        DB::transaction(function () use ($workout) {
            $exerciseIds = $workout->completed_at
                ? $workout->workoutExercises()->pluck('exercise_id')
                : new Collection;

            $workout->delete();

            if ($exerciseIds->isNotEmpty()) {
                PersonalRecord::recalculate($workout->user_id, $exerciseIds);
            }
        });

        return response()->noContent();
    }

    public function complete(Request $request, Workout $workout): WorkoutResource
    {
        if ($workout->user_id !== $request->user()->id) {
            abort(403);
        }

        $personalRecords = new Collection;

        if (! $workout->completed_at) {
            $personalRecords = DB::transaction(function () use ($workout) {
                $workout->markCompleted();

                return $workout->recordPersonalRecords();
            });
        }

        return (new WorkoutResource(
            $workout->load(['workoutExercises.exercise', 'workoutExercises.sets', 'template'])
        ))->additional(['personal_records' => PersonalRecordResource::collection($personalRecords)]);
    }
}
