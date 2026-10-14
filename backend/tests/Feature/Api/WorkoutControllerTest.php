<?php

namespace Tests\Feature\Api;

use App\Models\Exercise;
use App\Models\ExerciseSet;
use App\Models\PersonalRecord;
use App\Models\User;
use App\Models\Workout;
use App\Models\WorkoutExercise;
use App\Models\WorkoutTemplate;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkoutControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_index_returns_401_without_token(): void
    {
        $this->getJson('/api/workouts')->assertUnauthorized();
    }

    public function test_index_lists_only_own_workouts_newest_first(): void
    {
        $user = User::factory()->create();
        $older = Workout::factory()->for($user)->create(['started_at' => now()->subDays(2)]);
        $newer = Workout::factory()->for($user)->create(['started_at' => now()->subDay()]);
        Workout::factory()->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/workouts')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.1.id', $older->id);
    }

    public function test_index_filters_by_completion_state(): void
    {
        $user = User::factory()->create();
        $completed = Workout::factory()->for($user)->create();
        $inProgress = Workout::factory()->for($user)->inProgress()->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/workouts?completed=1')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $completed->id);
        $this->getJson('/api/workouts?in_progress=true')
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $inProgress->id);
        $this->getJson('/api/workouts?completed=false')->assertJsonCount(2, 'data');
    }

    public function test_store_creates_workout_with_exercises_and_sets_and_returns_201(): void
    {
        $this->freezeSecond();
        $user = User::factory()->create();
        $bench = Exercise::factory()->create(['name' => 'Bench Press']);
        $plank = Exercise::factory()->create(['name' => 'Squat', 'exercise_type' => 'duration']);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/workouts', [
            'name' => 'Push Day',
            'exercises' => [
                ['exercise_id' => $bench->id, 'sets' => [
                    ['weight_kg' => 60, 'reps' => 10, 'set_type' => 'warmup'],
                    ['weight_kg' => 100, 'reps' => 5],
                ]],
                ['exercise_id' => $plank->id, 'sets' => [['duration_seconds' => 90]]],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Push Day')
            ->assertJsonPath('data.is_completed', false)
            ->assertJsonPath('data.started_at', now()->toJSON())
            ->assertJsonPath('data.exercises.0.exercise.id', $bench->id)
            ->assertJsonPath('data.exercises.0.sets.0.set_number', 1)
            ->assertJsonPath('data.exercises.0.sets.0.set_type', 'warmup')
            ->assertJsonPath('data.exercises.0.sets.1.set_number', 2)
            ->assertJsonPath('data.exercises.1.sets.0.duration_seconds', 90);

        $workout = Workout::sole();
        $this->assertSame($user->id, $workout->user_id);
        $this->assertSame(3, ExerciseSet::count());
    }

    public function test_store_creates_blank_sets_from_empty_set_objects(): void
    {
        $exercise = Exercise::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/workouts', [
            'name' => 'Blank sets',
            'exercises' => [['exercise_id' => $exercise->id, 'sets' => [[], [], []]]],
        ])->assertCreated()
            ->assertJsonCount(3, 'data.exercises.0.sets')
            ->assertJsonPath('data.exercises.0.sets.2.set_number', 3)
            ->assertJsonPath('data.exercises.0.sets.0.set_type', 'normal');
    }

    public function test_store_ignores_unknown_set_keys(): void
    {
        $exercise = Exercise::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/workouts', [
            'name' => 'Sneaky',
            'exercises' => [['exercise_id' => $exercise->id, 'sets' => [['reps' => 5, 'is_completed' => true, 'workout_exercise_id' => 999]]]],
        ])->assertCreated()
            ->assertJsonPath('data.exercises.0.sets.0.is_completed', false);
    }

    public function test_store_with_own_template_links_it_and_increments_usage(): void
    {
        $this->freezeSecond();
        $user = User::factory()->create();
        $template = WorkoutTemplate::factory()->for($user)->create(['times_used' => 2, 'last_used_at' => null]);

        Sanctum::actingAs($user);

        $this->postJson('/api/workouts', ['name' => 'From template', 'workout_template_id' => $template->id])
            ->assertCreated()
            ->assertJsonPath('data.template.id', $template->id);

        $template->refresh();
        $this->assertSame(3, $template->times_used);
        $this->assertTrue($template->last_used_at->equalTo(now()));
    }

    public function test_store_rejects_another_users_template_with_422(): void
    {
        $template = WorkoutTemplate::factory()->create(['times_used' => 0]);

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/workouts', ['name' => 'Sneaky', 'workout_template_id' => $template->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['workout_template_id']);

        $this->assertSame(0, $template->fresh()->times_used);
        $this->assertDatabaseCount('workouts', 0);
    }

    public function test_store_rejects_another_users_custom_exercise_with_422(): void
    {
        $exercise = Exercise::factory()->custom()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/workouts', ['name' => 'Sneaky', 'exercises' => [['exercise_id' => $exercise->id]]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['exercises.0.exercise_id']);
    }

    public function test_store_accepts_own_custom_exercise(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->custom()->for($user)->create();

        Sanctum::actingAs($user);

        $this->postJson('/api/workouts', ['name' => 'Mine', 'exercises' => [['exercise_id' => $exercise->id]]])
            ->assertCreated();
    }

    public function test_store_rejects_non_numeric_exercise_id_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/workouts', ['name' => 'Bad', 'exercises' => [['exercise_id' => 'abc']]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['exercises.0.exercise_id']);
    }

    public function test_store_rejects_out_of_range_set_values_with_422(): void
    {
        $exercise = Exercise::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/workouts', [
            'name' => 'Huge',
            'exercises' => [['exercise_id' => $exercise->id, 'sets' => [
                ['weight_kg' => 1000000, 'reps' => 3000000000, 'rpe' => 11],
            ]]],
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'exercises.0.sets.0.weight_kg',
            'exercises.0.sets.0.reps',
            'exercises.0.sets.0.rpe',
        ]);

        $this->assertDatabaseCount('workouts', 0);
    }

    public function test_store_rejects_missing_name_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/workouts', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_show_returns_own_workout_with_totals_from_completed_sets(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->create();
        $workoutExercise = WorkoutExercise::factory()->for($workout)->create();
        ExerciseSet::factory()->for($workoutExercise)->create(['set_number' => 1, 'weight_kg' => 100, 'reps' => 5]);
        ExerciseSet::factory()->for($workoutExercise)->create(['set_number' => 2, 'weight_kg' => 80, 'reps' => 10]);
        ExerciseSet::factory()->for($workoutExercise)->incomplete()->create(['set_number' => 3, 'weight_kg' => 200, 'reps' => 10]);

        Sanctum::actingAs($user);

        $this->getJson("/api/workouts/{$workout->id}")
            ->assertOk()
            ->assertJsonPath('data.total_volume', 1300)
            ->assertJsonPath('data.total_sets', 2)
            ->assertJsonCount(3, 'data.exercises.0.sets');
    }

    public function test_show_leaves_assisted_weight_out_of_total_volume(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->create();

        $bench = Exercise::factory()->create(['exercise_type' => 'weight_reps']);
        ExerciseSet::factory()->for(WorkoutExercise::factory()->for($workout)->for($bench)->create(['order' => 0]))
            ->create(['weight_kg' => 100, 'reps' => 5]);

        // The weight on an assisted exercise is help, not load, so it adds no volume.
        $assistedPullUp = Exercise::factory()->create(['exercise_type' => 'assisted_bodyweight']);
        ExerciseSet::factory()->for(WorkoutExercise::factory()->for($workout)->for($assistedPullUp)->create(['order' => 1]))
            ->create(['weight_kg' => 40, 'reps' => 10]);

        Sanctum::actingAs($user);

        $this->getJson("/api/workouts/{$workout->id}")
            ->assertOk()
            ->assertJsonPath('data.total_volume', 500)
            ->assertJsonPath('data.total_sets', 2);
    }

    public function test_show_includes_each_exercises_muscle_group_and_equipment(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create();
        $exercise = Exercise::factory()->create();
        WorkoutExercise::factory()->for($workout)->for($exercise)->create();

        Sanctum::actingAs($user);

        $this->getJson("/api/workouts/{$workout->id}")
            ->assertOk()
            ->assertJsonPath('data.exercises.0.exercise.muscle_group.name', $exercise->muscleGroup->name)
            ->assertJsonPath('data.exercises.0.exercise.equipment.name', $exercise->equipment->name);
    }

    public function test_show_forbids_another_users_workout_with_403(): void
    {
        $workout = Workout::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/workouts/{$workout->id}")->assertForbidden();
    }

    public function test_show_returns_404_for_missing_or_non_numeric_id(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/workouts/999999')->assertNotFound();
        $this->getJson('/api/workouts/abc')->assertNotFound();
    }

    public function test_complete_sets_completion_time_and_positive_duration(): void
    {
        $this->freezeSecond();
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create(['started_at' => now()->subMinutes(45)]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")
            ->assertOk()
            ->assertJsonPath('data.is_completed', true)
            ->assertJsonPath('data.duration_seconds', 2700);

        $workout->refresh();
        $this->assertTrue($workout->completed_at->equalTo(now()));
        $this->assertSame(2700, $workout->duration_seconds);
    }

    public function test_complete_records_the_largest_allowed_set_without_overflowing(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->create(['exercise_type' => 'weight_reps']);
        $workout = Workout::factory()->for($user)->inProgress()->create();
        $workoutExercise = WorkoutExercise::factory()->for($workout)->for($exercise)->create();
        $set = ExerciseSet::factory()->for($workoutExercise)->incomplete()->create();

        Sanctum::actingAs($user);

        $this->putJson("/api/sets/{$set->id}", ['weight_kg' => 999999.99, 'reps' => 10000, 'is_completed' => true])
            ->assertOk();

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertOk();

        $this->assertEquals(
            9999999900,
            PersonalRecord::where('exercise_id', $exercise->id)->where('record_type', 'max_volume')->value('value'),
        );
    }

    public function test_complete_twice_keeps_original_completion(): void
    {
        $this->freezeSecond();
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create(['started_at' => now()->subHour()]);

        Sanctum::actingAs($user);

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertOk();
        $this->travel(2)->hours();
        $this->postJson("/api/workouts/{$workout->id}/complete")
            ->assertOk()
            ->assertJsonPath('data.duration_seconds', 3600);
    }

    public function test_complete_forbids_another_users_workout_with_403(): void
    {
        $workout = Workout::factory()->inProgress()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/workouts/{$workout->id}/complete")->assertForbidden();

        $this->assertNull($workout->fresh()->completed_at);
    }

    public function test_update_with_completed_at_computes_duration_from_that_time(): void
    {
        $this->freezeSecond();
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create(['started_at' => now()->subHours(3)]);

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['completed_at' => now()->subHours(2)->toIso8601String()])
            ->assertOk()
            ->assertJsonPath('data.is_completed', true)
            ->assertJsonPath('data.duration_seconds', 3600);
    }

    public function test_update_rejects_completed_at_before_start_with_422(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create();

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['completed_at' => now()->subDay()->toIso8601String()])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['completed_at']);
    }

    public function test_update_with_null_completed_at_reopens_workout(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->create();

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['completed_at' => null])
            ->assertOk()
            ->assertJsonPath('data.is_completed', false)
            ->assertJsonPath('data.duration_seconds', null);
    }

    public function test_update_renames_workout_without_touching_completion(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->create();
        $completedAt = $workout->completed_at;

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['name' => 'Renamed'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed');

        $this->assertTrue($workout->fresh()->completed_at->equalTo($completedAt));
    }

    public function test_update_moving_a_finished_workout_keeps_its_duration_and_moves_its_records(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->create(['exercise_type' => 'weight_reps']);
        $workout = Workout::factory()->for($user)->create([
            'started_at' => '2026-09-20 10:00:00',
            'completed_at' => '2026-09-20 11:15:00',
            'duration_seconds' => 4500,
        ]);
        ExerciseSet::factory()->for(WorkoutExercise::factory()->for($workout)->for($exercise))->create(['weight_kg' => 100, 'reps' => 5]);
        PersonalRecord::recalculate($user->id, [$exercise->id]);

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['started_at' => '2026-09-18T07:30:00Z'])
            ->assertOk()
            ->assertJsonPath('data.duration_seconds', 4500);

        $workout->refresh();
        $this->assertSame('2026-09-18 08:45:00', $workout->completed_at->toDateTimeString());
        $this->assertSame(
            '2026-09-18 08:45:00',
            PersonalRecord::where('record_type', 'max_weight')->sole()->achieved_at->toDateTimeString(),
        );
    }

    public function test_update_with_start_and_finish_sets_both_and_the_duration(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->create();

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", [
            'started_at' => '2026-09-18T07:00:00Z',
            'completed_at' => '2026-09-18T07:40:00Z',
        ])
            ->assertOk()
            ->assertJsonPath('data.duration_seconds', 2400);
    }

    public function test_update_rejects_finish_before_the_new_start_with_422(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->create(['started_at' => '2026-09-18 07:00:00']);

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", [
            'started_at' => '2026-09-18T09:00:00Z',
            'completed_at' => '2026-09-18T08:00:00Z',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['completed_at' => 'The finish time must be after the start time.']);

        $this->assertSame('2026-09-18 07:00:00', $workout->fresh()->started_at->toDateTimeString());
    }

    public function test_update_forbids_another_users_workout_with_403(): void
    {
        $workout = Workout::factory()->create(['name' => 'Original']);

        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/workouts/{$workout->id}", ['name' => 'Hacked'])->assertForbidden();

        $this->assertSame('Original', $workout->fresh()->name);
    }

    public function test_destroy_deletes_workout_with_its_exercises_and_sets(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->create();
        $set = ExerciseSet::factory()->for(WorkoutExercise::factory()->for($workout))->create();

        Sanctum::actingAs($user);

        $this->deleteJson("/api/workouts/{$workout->id}")->assertNoContent();

        $this->assertModelMissing($workout);
        $this->assertModelMissing($set);
    }

    public function test_destroy_forbids_another_users_workout_with_403(): void
    {
        $workout = Workout::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/workouts/{$workout->id}")->assertForbidden();

        $this->assertModelExists($workout);
    }

    public function test_update_rejects_start_and_finish_times_in_the_future_with_422(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create();

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", [
            'started_at' => now()->addDay()->toIso8601String(),
            'completed_at' => now()->addDay()->addHour()->toIso8601String(),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'started_at' => "The start time can't be in the future.",
                'completed_at' => "The finish time can't be in the future.",
            ]);

        $this->assertNull($workout->fresh()->completed_at);
    }

    public function test_update_allows_finish_time_a_moment_ahead_for_clock_drift(): void
    {
        $user = User::factory()->create();
        $workout = Workout::factory()->for($user)->inProgress()->create(['started_at' => now()->subHour()]);

        Sanctum::actingAs($user);

        $this->putJson("/api/workouts/{$workout->id}", ['completed_at' => now()->addMinute()->toIso8601String()])
            ->assertOk();
    }
}
