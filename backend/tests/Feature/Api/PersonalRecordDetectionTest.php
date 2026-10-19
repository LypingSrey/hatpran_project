<?php

namespace Tests\Feature\Api;

use App\Models\Exercise;
use App\Models\ExerciseSet;
use App\Models\PersonalRecord;
use App\Models\User;
use App\Models\Workout;
use App\Models\WorkoutExercise;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PersonalRecordDetectionTest extends TestCase
{
    use LazilyRefreshDatabase;

    /**
     * @param  list<array<string, mixed>>  $sets
     */
    private function workoutWithSets(User $user, Exercise $exercise, array $sets, bool $completed = false): Workout
    {
        $factory = Workout::factory()->for($user);
        $workout = ($completed ? $factory : $factory->inProgress())->create();
        $workoutExercise = WorkoutExercise::factory()->for($workout)->for($exercise)->create(['order' => 0]);

        foreach ($sets as $index => $attributes) {
            ExerciseSet::factory()->for($workoutExercise)->create([
                'set_number' => $index + 1,
                'rpe' => null,
                ...$attributes,
            ]);
        }

        return $workout;
    }

    /**
     * @return array<string, float>
     */
    private function recordValues(User $user, Exercise $exercise): array
    {
        return PersonalRecord::query()
            ->where('user_id', $user->id)
            ->where('exercise_id', $exercise->id)
            ->pluck('value', 'record_type')
            ->map(fn ($value) => (float) $value)
            ->sortKeys()
            ->all();
    }

    public function test_completing_first_workout_records_weight_reps_and_volume_prs(): void
    {
        $this->freezeSecond();
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $bench, [
            ['weight_kg' => 100, 'reps' => 5],
            ['weight_kg' => 80, 'reps' => 10],
        ]);
        $heaviestSet = $workout->workoutExercises->first()->sets->firstWhere('set_number', 1);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")
            ->assertOk()
            ->assertJsonCount(3, 'personal_records')
            ->assertJsonPath('personal_records.0.exercise.id', $bench->id);

        $this->assertSame(
            ['max_reps' => 10.0, 'max_volume' => 800.0, 'max_weight' => 100.0],
            $this->recordValues($user, $bench),
        );
        $this->assertDatabaseHas('personal_records', [
            'record_type' => 'max_weight',
            'exercise_set_id' => $heaviestSet->id,
            'achieved_at' => now(),
        ]);
    }

    public function test_warmup_and_incomplete_sets_never_count(): void
    {
        $user = User::factory()->create();
        $squat = Exercise::factory()->create(['name' => 'Squat', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $squat, [
            ['weight_kg' => 200, 'reps' => 20, 'set_type' => 'warmup'],
            ['weight_kg' => 300, 'reps' => 30, 'is_completed' => false],
            ['weight_kg' => 120, 'reps' => 3],
        ]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertOk();

        $this->assertSame(
            ['max_reps' => 3.0, 'max_volume' => 360.0, 'max_weight' => 120.0],
            $this->recordValues($user, $squat),
        );
    }

    public function test_only_improvements_are_reported_and_saved(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]], completed: true)
            ->recordPersonalRecords();
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 90, 'reps' => 8]]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")
            ->assertOk()
            ->assertJsonCount(2, 'personal_records')
            ->assertJsonPath('personal_records.0.record_type', 'max_reps')
            ->assertJsonPath('personal_records.0.value', 8)
            ->assertJsonPath('personal_records.1.record_type', 'max_volume')
            ->assertJsonPath('personal_records.1.value', 720);

        $this->assertSame(
            ['max_reps' => 8.0, 'max_volume' => 720.0, 'max_weight' => 100.0],
            $this->recordValues($user, $bench),
        );
    }

    public function test_matching_an_existing_record_is_not_a_new_pr(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]], completed: true)
            ->recordPersonalRecords();
        $original = PersonalRecord::where('record_type', 'max_weight')->sole();
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")
            ->assertOk()
            ->assertJsonCount(0, 'personal_records');

        $this->assertSame($original->exercise_set_id, $original->fresh()->exercise_set_id);
    }

    public function test_duration_exercise_tracks_only_max_duration(): void
    {
        $user = User::factory()->create();
        $plank = Exercise::factory()->create(['name' => 'Squat', 'exercise_type' => 'duration']);
        $workout = $this->workoutWithSets($user, $plank, [
            ['weight_kg' => null, 'reps' => null, 'duration_seconds' => 90],
            ['weight_kg' => null, 'reps' => null, 'duration_seconds' => 120],
        ]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertOk();

        $this->assertSame(['max_duration' => 120.0], $this->recordValues($user, $plank));
    }

    public function test_bodyweight_exercise_tracks_only_max_reps(): void
    {
        $user = User::factory()->create();
        $pushUp = Exercise::factory()->create(['name' => 'Dip', 'exercise_type' => 'bodyweight_reps']);
        $workout = $this->workoutWithSets($user, $pushUp, [['weight_kg' => null, 'reps' => 25]]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertOk();

        $this->assertSame(['max_reps' => 25.0], $this->recordValues($user, $pushUp));
    }

    public function test_records_are_kept_separate_per_user(): void
    {
        $user = User::factory()->create();
        $rival = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $this->workoutWithSets($rival, $bench, [['weight_kg' => 200, 'reps' => 1]], completed: true)
            ->recordPersonalRecords();
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 60, 'reps' => 5]]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")
            ->assertOk()
            ->assertJsonCount(3, 'personal_records');

        $this->assertSame(200.0, $this->recordValues($rival, $bench)['max_weight']);
    }

    public function test_completing_again_reports_no_new_records(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertJsonCount(3, 'personal_records');
        $this->postJson("/api/workouts/{$workout->id}/complete")->assertJsonCount(0, 'personal_records');

        $this->assertDatabaseCount('personal_records', 3);
    }

    public function test_completing_through_update_also_records_prs(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]]);

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['completed_at' => now()->toIso8601String()])
            ->assertOk()
            ->assertJsonCount(3, 'personal_records');
    }

    public function test_deleting_a_workout_restores_the_previous_best(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]], completed: true)
            ->recordPersonalRecords();
        $best = $this->workoutWithSets($user, $bench, [['weight_kg' => 120, 'reps' => 5]], completed: true);
        $best->recordPersonalRecords();

        Sanctum::actingAs($user);

        $this->deleteJson("/api/workouts/{$best->id}")->assertNoContent();

        $this->assertSame(
            ['max_reps' => 5.0, 'max_volume' => 500.0, 'max_weight' => 100.0],
            $this->recordValues($user, $bench),
        );
    }

    public function test_deleting_the_only_workout_removes_its_records(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]], completed: true);
        $workout->recordPersonalRecords();

        Sanctum::actingAs($user);

        $this->deleteJson("/api/workouts/{$workout->id}")->assertNoContent();

        $this->assertDatabaseCount('personal_records', 0);
    }

    public function test_reopening_a_workout_withdraws_its_records(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]], completed: true);
        $workout->recordPersonalRecords();

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['completed_at' => null])->assertOk();

        $this->assertDatabaseCount('personal_records', 0);
    }

    public function test_editing_a_set_in_a_finished_workout_recalculates_records(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]], completed: true);
        $workout->recordPersonalRecords();
        $set = $workout->workoutExercises->first()->sets->first();

        Sanctum::actingAs($user);

        $this->putJson("/api/sets/{$set->id}", ['weight_kg' => 95])->assertOk();
        $this->assertSame(95.0, $this->recordValues($user, $bench)['max_weight']);

        $this->deleteJson("/api/sets/{$set->id}")->assertNoContent();
        $this->assertSame([], $this->recordValues($user, $bench));
    }

    public function test_repeating_a_fractional_weight_set_is_not_a_new_volume_record(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $first = $this->workoutWithSets($user, $bench, [['weight_kg' => 20.1, 'reps' => 3]], completed: true);
        $first->recordPersonalRecords();
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 20.1, 'reps' => 3]]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")
            ->assertOk()
            ->assertJsonCount(0, 'personal_records');

        $this->assertDatabaseHas('personal_records', [
            'record_type' => 'max_volume',
            'exercise_set_id' => $first->workoutExercises->first()->sets->first()->id,
        ]);
    }

    public function test_editing_a_set_in_an_unfinished_workout_does_not_touch_records(): void
    {
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press', 'exercise_type' => 'weight_reps']);
        $workout = $this->workoutWithSets($user, $bench, [['weight_kg' => 100, 'reps' => 5]]);
        $set = $workout->workoutExercises->first()->sets->first();

        Sanctum::actingAs($user);

        $this->postJson("/api/sets/{$set->id}/complete", ['weight_kg' => 150, 'reps' => 5])->assertOk();

        $this->assertDatabaseCount('personal_records', 0);
    }
}
