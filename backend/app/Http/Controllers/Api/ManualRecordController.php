<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ManualRecordResource;
use App\Http\Resources\PersonalRecordResource;
use App\Models\Exercise;
use App\Models\ManualRecord;
use App\Models\PersonalRecord;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ManualRecordController extends Controller
{
    private const RECORD_TYPES = ['max_weight', 'max_reps', 'max_volume', 'max_duration', 'max_distance'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $records = $request->user()
            ->manualRecords()
            ->with('exercise')
            // Only the record types the exercise tracks now; ones kept from an earlier type stay hidden.
            // ponytail: unfiltered without exercise_id (the app always sends it); filter by type per row if that changes.
            ->when($request->integer('exercise_id'), fn ($q, $id) => $q->where('exercise_id', $id)
                ->whereIn('record_type', Exercise::find($id)?->personalRecordTypes() ?? []))
            ->latest('achieved_at')
            ->latest('id')
            ->paginate($this->perPage($request, 50));

        return ManualRecordResource::collection($records);
    }

    public function store(Request $request): ManualRecordResource
    {
        $user = $request->user();

        $validated = $request->validate([
            'exercise_id' => [
                'required',
                'integer',
                Rule::exists('exercises', 'id')->where(
                    fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $user->id)
                ),
            ],
            'record_type' => [
                'required',
                Rule::in(self::RECORD_TYPES),
                Rule::unique('manual_records')
                    ->where('user_id', $user->id)
                    ->where('exercise_id', $request->integer('exercise_id')),
            ],
            'achieved_at' => 'required|date|before_or_equal:now',
        ], [
            'record_type.unique' => 'You already entered this record for this exercise. Edit it instead.',
        ]);

        $exercise = Exercise::findOrFail($validated['exercise_id']);

        if (! in_array($validated['record_type'], $exercise->personalRecordTypes(), true)) {
            throw ValidationException::withMessages([
                'record_type' => "{$exercise->name} doesn't track this kind of record.",
            ]);
        }

        $validated += $request->validate(['value' => $this->valueRules($validated['record_type'])]);

        $manualRecord = DB::transaction(function () use ($user, $validated) {
            $manualRecord = $user->manualRecords()->create($validated);

            PersonalRecord::recalculate($user->id, [$manualRecord->exercise_id]);

            return $manualRecord;
        });

        return $this->respond($manualRecord);
    }

    public function show(Request $request, ManualRecord $manualRecord): ManualRecordResource
    {
        if ($manualRecord->user_id !== $request->user()->id) {
            abort(403);
        }

        return $this->respond($manualRecord);
    }

    public function update(Request $request, ManualRecord $manualRecord): ManualRecordResource
    {
        if ($manualRecord->user_id !== $request->user()->id) {
            abort(403);
        }

        $validated = $request->validate([
            'value' => ['sometimes', ...$this->valueRules($manualRecord->record_type)],
            'achieved_at' => 'sometimes|required|date|before_or_equal:now',
        ]);

        DB::transaction(function () use ($manualRecord, $validated) {
            $manualRecord->update($validated);

            PersonalRecord::recalculate($manualRecord->user_id, [$manualRecord->exercise_id]);
        });

        return $this->respond($manualRecord);
    }

    public function destroy(Request $request, ManualRecord $manualRecord): Response
    {
        if ($manualRecord->user_id !== $request->user()->id) {
            abort(403);
        }

        DB::transaction(function () use ($manualRecord) {
            $manualRecord->delete();

            PersonalRecord::recalculate($manualRecord->user_id, [$manualRecord->exercise_id]);
        });

        return response()->noContent();
    }

    /**
     * Weights and volumes allow decimals; counts, seconds and meters are whole numbers.
     *
     * @return list<string>
     */
    private function valueRules(string $recordType): array
    {
        return match ($recordType) {
            'max_weight' => ['required', 'numeric', 'gt:0', 'max:999999.99'],
            'max_volume' => ['required', 'numeric', 'gt:0', 'max:9999999999.99'],
            default => ['required', 'integer', 'gt:0', 'max:2147483647'],
        };
    }

    /**
     * Include the resulting record, so the client can tell whether a logged set still beats this entry.
     */
    private function respond(ManualRecord $manualRecord): ManualRecordResource
    {
        $personalRecord = PersonalRecord::query()
            ->where('user_id', $manualRecord->user_id)
            ->where('exercise_id', $manualRecord->exercise_id)
            ->where('record_type', $manualRecord->record_type)
            ->first();

        return (new ManualRecordResource($manualRecord->load('exercise')))->additional([
            'personal_record' => $personalRecord ? new PersonalRecordResource($personalRecord) : null,
        ]);
    }
}
