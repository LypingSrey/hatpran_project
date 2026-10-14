<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExerciseResource;
use App\Models\Exercise;
use App\Models\PersonalRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ExerciseController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $exercises = Exercise::query()
            ->with(['muscleGroup', 'equipment'])
            ->visibleTo($request->user())
            ->when($request->integer('muscle_group_id'), fn ($q, $id) => $q->where('muscle_group_id', $id))
            ->when($request->integer('equipment_id'), fn ($q, $id) => $q->where('equipment_id', $id))
            // Escape LIKE wildcards so searching for "%" or "_" finds those characters, not everything.
            ->when($request->string('search')->trim()->value(), fn ($q, $search) => $q->whereLike('name', '%'.addcslashes($search, '\\%_').'%'))
            ->when($request->boolean('custom_only'), fn ($q) => $q->where('is_custom', true))
            ->orderBy('name')
            ->paginate($this->perPage($request, 50));

        return ExerciseResource::collection($exercises);
    }

    public function store(Request $request): ExerciseResource
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'muscle_group_id' => 'nullable|integer|exists:muscle_groups,id',
            'equipment_id' => 'nullable|integer|exists:equipment,id',
            'description' => 'nullable|string',
            'instructions' => 'nullable|string',
            'exercise_type' => 'required|in:weight_reps,bodyweight_reps,weighted_bodyweight,assisted_bodyweight,duration,distance_duration,weight_distance',
        ]);

        $exercise = $request->user()->exercises()->create([
            ...$validated,
            'is_custom' => true,
        ]);

        return new ExerciseResource($exercise->load(['muscleGroup', 'equipment']));
    }

    public function show(Request $request, Exercise $exercise): ExerciseResource
    {
        if (! $exercise->isVisibleTo($request->user())) {
            abort(404);
        }

        return new ExerciseResource($exercise->load(['muscleGroup', 'equipment']));
    }

    public function update(Request $request, Exercise $exercise): ExerciseResource
    {
        if ($exercise->user_id !== $request->user()->id) {
            abort(403, 'You can only edit your own custom exercises.');
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'muscle_group_id' => 'nullable|integer|exists:muscle_groups,id',
            'equipment_id' => 'nullable|integer|exists:equipment,id',
            'description' => 'nullable|string',
            'instructions' => 'nullable|string',
            'exercise_type' => 'sometimes|in:weight_reps,bodyweight_reps,weighted_bodyweight,assisted_bodyweight,duration,distance_duration,weight_distance',
        ]);

        DB::transaction(function () use ($exercise, $validated) {
            $exercise->update($validated);

            // A new type tracks different records (e.g. duration instead of weight), so drop hand-entered
            // bests it no longer tracks and rebuild the records from history.
            if ($exercise->wasChanged('exercise_type')) {
                $exercise->manualRecords()->whereNotIn('record_type', $exercise->personalRecordTypes())->delete();

                PersonalRecord::recalculate($exercise->user_id, [$exercise->id]);
            }
        });

        return new ExerciseResource($exercise->load(['muscleGroup', 'equipment']));
    }

    public function destroy(Request $request, Exercise $exercise): Response
    {
        if ($exercise->user_id !== $request->user()->id) {
            abort(403, 'You can only delete your own custom exercises.');
        }

        $exercise->delete();

        return response()->noContent();
    }
}
