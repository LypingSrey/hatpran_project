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

class WorkoutExerciseControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_store_adds_exercise_to_end_of_workout_with_blank_sets_and_returns_201(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create();
        WorkoutExercise::factory()->for($workout)->create(['order' => 0]);
        WorkoutExercise::factory()->for($workout)->create(['order' => 3]);
        $exercise = Exercise::factory()->create(['user_id' => null]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/exercises", [
            'exercise_id' => $exercise->id,
            'sets' => [[], ['weight_kg' => 60, 'reps' => 8]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.order', 4)
            ->assertJsonPath('data.exercise.id', $exercise->id)
            ->assertJsonCount(2, 'data.sets')
            ->assertJsonPath('data.sets.0.set_number', 1)
            ->assertJsonPath('data.sets.1.set_number', 2)
            ->assertJsonPath('data.sets.1.weight_kg', 60)
            ->assertJsonPath('data.sets.1.is_completed', false);

        $this->assertSame(3, $workout->workoutExercises()->count());
    }

    public function test_store_on_empty_workout_starts_at_order_zero(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create();

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/exercises", ['exercise_id' => Exercise::factory()->create()->id])
            ->assertCreated()
            ->assertJsonPath('data.order', 0)
            ->assertJsonCount(0, 'data.sets');
    }

    public function test_store_forbids_another_users_workout_with_403(): void
    {
        $workout = Workout::factory()->for(User::factory())->inProgress()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/workouts/{$workout->id}/exercises", ['exercise_id' => Exercise::factory()->create()->id])
            ->assertForbidden();

        $this->assertSame(0, $workout->workoutExercises()->count());
    }

    public function test_store_rejects_another_users_custom_exercise_with_422(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create();
        $theirs = Exercise::factory()->create(['user_id' => User::factory()->create()->id, 'is_custom' => true]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/exercises", ['exercise_id' => $theirs->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['exercise_id']);
    }

    public function test_update_changes_order_and_notes(): void
    {
        $user = User::factory()->create();
        $workoutExercise = WorkoutExercise::factory()->for(Workout::factory()->for($user)->inProgress())->create(['order' => 0]);

        Sanctum::actingAs($user);

        $this->putJson("/api/workout-exercises/{$workoutExercise->id}", ['order' => 2, 'notes' => 'Slow negatives'])
            ->assertOk()
            ->assertJsonPath('data.order', 2)
            ->assertJsonPath('data.notes', 'Slow negatives');
    }

    public function test_update_forbids_another_users_workout_exercise_with_403(): void
    {
        $workoutExercise = WorkoutExercise::factory()->for(Workout::factory()->for(User::factory())->inProgress())->create();

        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/workout-exercises/{$workoutExercise->id}", ['notes' => 'x'])->assertForbidden();
    }

    public function test_destroy_removes_exercise_and_its_sets_and_returns_204(): void
    {
        $user = User::factory()->create();
        $workoutExercise = WorkoutExercise::factory()->for(Workout::factory()->for($user)->inProgress())->create();
        $set = ExerciseSet::factory()->for($workoutExercise)->create();

        Sanctum::actingAs($user);

        $this->deleteJson("/api/workout-exercises/{$workoutExercise->id}")->assertNoContent();

        $this->assertModelMissing($workoutExercise);
        $this->assertModelMissing($set);
    }

    public function test_destroy_on_finished_workout_rebuilds_records_from_what_is_left(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->create(['exercise_type' => 'weight_reps']);
        $older = Workout::factory()->for($user)->create(['started_at' => now()->subDays(3), 'completed_at' => now()->subDays(3)->addHour()]);
        $newer = Workout::factory()->for($user)->create(['started_at' => now()->subDay(), 'completed_at' => now()->subDay()->addHour()]);
        $keep = ExerciseSet::factory()->for(WorkoutExercise::factory()->for($older)->for($exercise))->create(['weight_kg' => 80, 'reps' => 5]);
        $removed = WorkoutExercise::factory()->for($newer)->for($exercise)->create();
        ExerciseSet::factory()->for($removed)->create(['weight_kg' => 100, 'reps' => 5]);
        PersonalRecord::recalculate($user->id, [$exercise->id]);

        Sanctum::actingAs($user);

        $this->deleteJson("/api/workout-exercises/{$removed->id}")->assertNoContent();

        $record = PersonalRecord::query()->where('user_id', $user->id)->where('record_type', 'max_weight')->sole();
        $this->assertSame($keep->id, $record->exercise_set_id);
        $this->assertEquals(80, $record->value);
    }

    public function test_destroy_forbids_another_users_workout_exercise_with_403(): void
    {
        $workoutExercise = WorkoutExercise::factory()->for(Workout::factory()->for(User::factory())->inProgress())->create();

        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/workout-exercises/{$workoutExercise->id}")->assertForbidden();

        $this->assertModelExists($workoutExercise);
    }
}
