<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkoutResource;
use App\Http\Resources\WorkoutTemplateResource;
use App\Models\User;
use App\Models\WorkoutTemplate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WorkoutTemplateController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $templates = $request->user()
            ->workoutTemplates()
            ->with(['exercises.exercise'])
            ->orderByRaw('last_used_at is null')
            ->latest('last_used_at')
            ->latest('id')
            ->paginate($this->perPage($request, 20));

        return WorkoutTemplateResource::collection($templates);
    }

    public function store(Request $request): WorkoutTemplateResource
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string|max:5000',
            'exercises' => 'required|array|min:1',
            ...$this->exerciseRules($request->user()),
        ]);

        $template = DB::transaction(function () use ($request, $validated) {
            $template = $request->user()->workoutTemplates()->create([
                'name' => $validated['name'],
                'notes' => $validated['notes'] ?? null,
            ]);

            $this->syncExercises($template, $validated['exercises']);

            return $template;
        });

        return new WorkoutTemplateResource($template->load(['exercises.exercise']));
    }

    public function show(Request $request, WorkoutTemplate $workoutTemplate): WorkoutTemplateResource
    {
        if ($workoutTemplate->user_id !== $request->user()->id) {
            abort(403);
        }

        return new WorkoutTemplateResource($workoutTemplate->load(['exercises.exercise']));
    }

    public function update(Request $request, WorkoutTemplate $workoutTemplate): WorkoutTemplateResource
    {
        if ($workoutTemplate->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'notes' => 'nullable|string|max:5000',
            'exercises' => 'sometimes|array|min:1',
            ...$this->exerciseRules($request->user()),
        ]);

        DB::transaction(function () use ($workoutTemplate, $validated) {
            $workoutTemplate->update(collect($validated)->only(['name', 'notes'])->all());

            if (isset($validated['exercises'])) {
                $workoutTemplate->exercises()->delete();
                $this->syncExercises($workoutTemplate, $validated['exercises']);
            }
        });

        return new WorkoutTemplateResource($workoutTemplate->load(['exercises.exercise']));
    }

    public function destroy(Request $request, WorkoutTemplate $workoutTemplate): Response
    {
        if ($workoutTemplate->user_id !== $request->user()->id) {
            abort(403);
        }

        $workoutTemplate->delete();

        return response()->noContent();
    }

    public function startWorkout(Request $request, WorkoutTemplate $workoutTemplate): WorkoutResource
    {
        if ($workoutTemplate->user_id !== $request->user()->id) {
            abort(403);
        }

        $workout = DB::transaction(function () use ($request, $workoutTemplate) {
            $request->user()->ensureNoWorkoutInProgress();

            $workout = $request->user()->workouts()->create([
                'name' => $workoutTemplate->name,
                'notes' => $workoutTemplate->notes,
                'workout_template_id' => $workoutTemplate->id,
                'started_at' => now(),
            ]);

            foreach ($workoutTemplate->exercises as $templateExercise) {
                $workoutExercise = $workout->workoutExercises()->create([
                    'exercise_id' => $templateExercise->exercise_id,
                    'order' => $templateExercise->order,
                    'notes' => $templateExercise->notes,
                ]);

                for ($i = 1; $i <= ($templateExercise->target_sets ?? 3); $i++) {
                    $workoutExercise->sets()->create([
                        'set_number' => $i,
                        'set_type' => 'normal',
                        'reps' => $templateExercise->target_reps,
                        'is_completed' => false,
                    ]);
                }
            }

            $workoutTemplate->incrementUsage();

            return $workout;
        });

        return new WorkoutResource(
            $workout->load(['workoutExercises.exercise', 'workoutExercises.sets', 'template'])
        );
    }

    /**
     * Validation rules for a template's exercise list.
     *
     * @return array<string, mixed>
     */
    private function exerciseRules(User $user): array
    {
        return [
            'exercises.*.exercise_id' => [
                'required',
                'integer',
                Rule::exists('exercises', 'id')->where(
                    fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $user->id)
                ),
            ],
            'exercises.*.order' => 'nullable|integer|min:0',
            'exercises.*.target_sets' => 'nullable|integer|min:1|max:100',
            'exercises.*.target_reps' => 'nullable|integer|min:1|max:10000',
            'exercises.*.notes' => 'nullable|string|max:5000',
        ];
    }

    /**
     * @param  array<int, array{exercise_id: int, order?: int|null, target_sets?: int|null, target_reps?: int|null, notes?: string|null}>  $exercises
     */
    private function syncExercises(WorkoutTemplate $template, array $exercises): void
    {
        foreach ($exercises as $index => $exerciseData) {
            $template->exercises()->create([
                'exercise_id' => $exerciseData['exercise_id'],
                'order' => $exerciseData['order'] ?? $index,
                'target_sets' => $exerciseData['target_sets'] ?? null,
                'target_reps' => $exerciseData['target_reps'] ?? null,
                'notes' => $exerciseData['notes'] ?? null,
            ]);
        }
    }
}
