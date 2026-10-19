<?php

namespace Tests\Feature\Api;

use App\Models\Exercise;
use App\Models\ExerciseSet;
use App\Models\ManualRecord;
use App\Models\PersonalRecord;
use App\Models\User;
use App\Models\Workout;
use App\Models\WorkoutExercise;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManualRecordControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    private function bench(): Exercise
    {
        return Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
    }

    /**
     * A finished workout with one ticked set, whose max_weight record already exists.
     */
    private function loggedSet(User $user, Exercise $exercise, float $weightKg, string $completedAt): ExerciseSet
    {
        $workout = Workout::factory()->for($user)->create([
            'started_at' => now()->parse($completedAt)->subHour(),
            'completed_at' => $completedAt,
            'duration_seconds' => 3600,
        ]);
        $workoutExercise = WorkoutExercise::factory()->for($workout)->for($exercise)->create(['order' => 0]);
        $set = ExerciseSet::factory()->for($workoutExercise)->create([
            'set_number' => 1,
            'weight_kg' => $weightKg,
            'reps' => 5,
        ]);

        PersonalRecord::recalculate($user->id, [$exercise->id]);

        return $set;
    }

    private function maxWeightRecord(User $user, Exercise $exercise): ?PersonalRecord
    {
        return PersonalRecord::query()
            ->where('user_id', $user->id)
            ->where('exercise_id', $exercise->id)
            ->where('record_type', 'max_weight')
            ->first();
    }

    public function test_index_returns_401_without_token(): void
    {
        $this->getJson('/api/manual-records')->assertUnauthorized();
    }

    public function test_index_lists_only_own_manual_records(): void
    {
        $user = User::factory()->create();
        $own = ManualRecord::factory()->for($user)->create();
        ManualRecord::factory()->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/manual-records')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $own->id)
            ->assertJsonPath('data.0.exercise.id', $own->exercise_id);
    }

    public function test_store_with_no_logged_sets_becomes_the_personal_record(): void
    {
        $user = User::factory()->create();
        $bench = $this->bench();

        Sanctum::actingAs($user);

        $this->postJson('/api/manual-records', [
            'exercise_id' => $bench->id,
            'record_type' => 'max_weight',
            'value' => 120.5,
            'achieved_at' => '2025-06-01T12:00:00Z',
        ])
            ->assertCreated()
            ->assertJsonPath('data.value', 120.5)
            ->assertJsonPath('personal_record.value', 120.5)
            ->assertJsonPath('personal_record.source', 'manual');

        $manual = ManualRecord::sole();
        $this->assertSame($user->id, $manual->user_id);
        $this->assertSame($manual->id, $this->maxWeightRecord($user, $bench)->manual_record_id);
    }

    public function test_store_below_a_logged_best_keeps_the_logged_record(): void
    {
        $user = User::factory()->create();
        $bench = $this->bench();
        $set = $this->loggedSet($user, $bench, 110, '2026-09-01 10:00:00');

        Sanctum::actingAs($user);

        $this->postJson('/api/manual-records', [
            'exercise_id' => $bench->id,
            'record_type' => 'max_weight',
            'value' => 100,
            'achieved_at' => '2025-06-01T12:00:00Z',
        ])
            ->assertCreated()
            ->assertJsonPath('personal_record.value', 110)
            ->assertJsonPath('personal_record.source', 'workout');

        $this->assertSame($set->id, $this->maxWeightRecord($user, $bench)->exercise_set_id);
    }

    public function test_store_equal_to_a_logged_best_wins_when_achieved_earlier(): void
    {
        $user = User::factory()->create();
        $bench = $this->bench();
        $this->loggedSet($user, $bench, 100, '2026-09-01 10:00:00');

        Sanctum::actingAs($user);

        $this->postJson('/api/manual-records', [
            'exercise_id' => $bench->id,
            'record_type' => 'max_weight',
            'value' => 100,
            'achieved_at' => '2025-06-01T12:00:00Z',
        ])->assertCreated()->assertJsonPath('personal_record.source', 'manual');
    }

    public function test_store_rejects_empty_payload_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/manual-records', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['exercise_id', 'record_type', 'achieved_at']);
    }

    public function test_store_rejects_record_type_the_exercise_does_not_track_with_422(): void
    {
        $pullUp = Exercise::factory()->create(['name' => 'Pull Up', 'exercise_type' => 'bodyweight_reps']);

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/manual-records', [
            'exercise_id' => $pullUp->id,
            'record_type' => 'max_weight',
            'value' => 20,
            'achieved_at' => '2025-06-01T12:00:00Z',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['record_type' => "Pull Up doesn't track this kind of record."]);

        $this->assertDatabaseCount('manual_records', 0);
    }

    public function test_store_rejects_a_second_entry_for_the_same_record_with_422(): void
    {
        $user = User::factory()->create();
        $existing = ManualRecord::factory()->for($user)->create();

        Sanctum::actingAs($user);

        $this->postJson('/api/manual-records', [
            'exercise_id' => $existing->exercise_id,
            'record_type' => 'max_weight',
            'value' => 150,
            'achieved_at' => '2025-06-01T12:00:00Z',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'record_type' => 'You already entered this record for this exercise. Edit it instead.',
            ]);
    }

    public function test_store_rejects_another_users_custom_exercise_with_422(): void
    {
        $theirs = Exercise::factory()->custom()->create(['exercise_type' => 'weight_reps']);

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/manual-records', [
            'exercise_id' => $theirs->id,
            'record_type' => 'max_weight',
            'value' => 100,
            'achieved_at' => '2025-06-01T12:00:00Z',
        ])->assertUnprocessable()->assertJsonValidationErrors(['exercise_id']);
    }

    public function test_store_rejects_a_future_date_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/manual-records', [
            'exercise_id' => $this->bench()->id,
            'record_type' => 'max_weight',
            'value' => 100,
            'achieved_at' => now()->addDay()->toIso8601String(),
        ])->assertUnprocessable()->assertJsonValidationErrors(['achieved_at']);
    }

    public function test_store_allows_a_phone_clock_a_little_ahead(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/manual-records', [
            'exercise_id' => $this->bench()->id,
            'record_type' => 'max_weight',
            'value' => 100,
            'achieved_at' => now()->addMinute()->toIso8601String(),
        ])->assertCreated();
    }

    public function test_store_rejects_fractional_reps_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/manual-records', [
            'exercise_id' => $this->bench()->id,
            'record_type' => 'max_reps',
            'value' => 10.5,
            'achieved_at' => '2025-06-01T12:00:00Z',
        ])->assertUnprocessable()->assertJsonValidationErrors(['value']);
    }

    public function test_show_returns_own_entry_with_the_current_record_and_forbids_others_with_403(): void
    {
        $owner = User::factory()->create();
        $manual = ManualRecord::factory()->for($owner)->create(['value' => 140]);
        PersonalRecord::recalculate($owner->id, [$manual->exercise_id]);

        Sanctum::actingAs($owner);
        $this->getJson("/api/manual-records/{$manual->id}")
            ->assertOk()
            ->assertJsonPath('data.value', 140)
            ->assertJsonPath('data.exercise.id', $manual->exercise_id)
            ->assertJsonPath('personal_record.manual_record_id', $manual->id);

        Sanctum::actingAs(User::factory()->create());
        $this->getJson("/api/manual-records/{$manual->id}")->assertForbidden();
    }

    public function test_update_below_a_logged_best_hands_the_record_back_to_the_set(): void
    {
        $user = User::factory()->create();
        $bench = $this->bench();
        $set = $this->loggedSet($user, $bench, 110, '2026-09-01 10:00:00');
        $manual = ManualRecord::factory()->for($user)->for($bench)->create(['value' => 130]);
        PersonalRecord::recalculate($user->id, [$bench->id]);

        Sanctum::actingAs($user);

        $this->putJson("/api/manual-records/{$manual->id}", ['value' => 105])
            ->assertOk()
            ->assertJsonPath('data.value', 105)
            ->assertJsonPath('personal_record.source', 'workout');

        $record = $this->maxWeightRecord($user, $bench);
        $this->assertSame($set->id, $record->exercise_set_id);
        $this->assertNull($record->manual_record_id);
    }

    public function test_update_forbids_another_users_manual_record_with_403(): void
    {
        $manual = ManualRecord::factory()->create(['value' => 100]);

        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/manual-records/{$manual->id}", ['value' => 200])->assertForbidden();

        $this->assertSame(100.0, (float) $manual->fresh()->value);
    }

    public function test_destroy_removes_the_entry_and_its_record_when_nothing_else_backs_it(): void
    {
        $user = User::factory()->create();
        $manual = ManualRecord::factory()->for($user)->create();
        PersonalRecord::recalculate($user->id, [$manual->exercise_id]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/manual-records/{$manual->id}")->assertNoContent();

        $this->assertModelMissing($manual);
        $this->assertDatabaseCount('personal_records', 0);
    }

    public function test_destroy_falls_back_to_the_logged_best(): void
    {
        $user = User::factory()->create();
        $bench = $this->bench();
        $set = $this->loggedSet($user, $bench, 110, '2026-09-01 10:00:00');
        $manual = ManualRecord::factory()->for($user)->for($bench)->create(['value' => 130]);
        PersonalRecord::recalculate($user->id, [$bench->id]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/manual-records/{$manual->id}")->assertNoContent();

        $this->assertSame($set->id, $this->maxWeightRecord($user, $bench)->exercise_set_id);
    }

    public function test_destroy_forbids_another_users_manual_record_with_403(): void
    {
        $manual = ManualRecord::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/manual-records/{$manual->id}")->assertForbidden();

        $this->assertModelExists($manual);
    }

    public function test_editing_a_logged_set_keeps_a_higher_manual_record(): void
    {
        $user = User::factory()->create();
        $bench = $this->bench();
        $set = $this->loggedSet($user, $bench, 110, '2026-09-01 10:00:00');
        $manual = ManualRecord::factory()->for($user)->for($bench)->create(['value' => 130]);
        PersonalRecord::recalculate($user->id, [$bench->id]);

        Sanctum::actingAs($user);

        $this->putJson("/api/sets/{$set->id}", ['weight_kg' => 90])->assertOk();

        $this->assertSame($manual->id, $this->maxWeightRecord($user, $bench)->manual_record_id);
    }

    public function test_completing_a_workout_that_beats_a_manual_record_takes_it_over(): void
    {
        $user = User::factory()->create();
        $bench = $this->bench();
        ManualRecord::factory()->for($user)->for($bench)->create(['value' => 100]);
        PersonalRecord::recalculate($user->id, [$bench->id]);
        $workout = Workout::factory()->for($user)->inProgress()->create();
        $workoutExercise = WorkoutExercise::factory()->for($workout)->for($bench)->create(['order' => 0]);
        $set = ExerciseSet::factory()->for($workoutExercise)->create(['set_number' => 1, 'weight_kg' => 105, 'reps' => 5]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertOk();

        $record = $this->maxWeightRecord($user, $bench);
        $this->assertSame($set->id, $record->exercise_set_id);
        $this->assertNull($record->manual_record_id);
    }
}
