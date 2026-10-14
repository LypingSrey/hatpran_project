<?php

namespace Tests\Feature\Api;

use App\Models\Equipment;
use App\Models\Exercise;
use App\Models\ExerciseSet;
use App\Models\ManualRecord;
use App\Models\MuscleGroup;
use App\Models\PersonalRecord;
use App\Models\User;
use App\Models\Workout;
use App\Models\WorkoutExercise;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class ExerciseControllerTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_index_returns_401_without_token(): void
    {
        $this->getJson('/api/exercises')->assertUnauthorized();
    }

    public function test_index_lists_global_and_own_custom_exercises_but_not_other_users(): void
    {
        $user = User::factory()->create();
        $global = Exercise::factory()->create(['name' => 'Bench Press']);
        $mine = Exercise::factory()->custom()->for($user)->create(['name' => 'Deadlift']);
        Exercise::factory()->custom()->create(['name' => 'Squat']);

        Sanctum::actingAs($user);

        $this->getJson('/api/exercises')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $global->id)
            ->assertJsonPath('data.1.id', $mine->id);
    }

    public function test_index_search_is_case_insensitive(): void
    {
        Exercise::factory()->create(['name' => 'Bench Press']);
        Exercise::factory()->create(['name' => 'Squat']);

        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/exercises?search=bENCH')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Bench Press');
    }

    public function test_index_search_treats_percent_and_underscore_as_plain_characters(): void
    {
        Exercise::factory()->create(['name' => 'Bench Press']);
        Exercise::factory()->create(['name' => 'Squat 100%']);

        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/exercises?search=%25')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Squat 100%');

        $this->getJson('/api/exercises?search=_')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_index_search_does_not_leak_other_users_custom_exercises(): void
    {
        $user = User::factory()->create();
        Exercise::factory()->create(['name' => 'Bench Press']);
        Exercise::factory()->custom()->create(['name' => 'Deadlift']);

        Sanctum::actingAs($user);

        $this->getJson('/api/exercises?search=dead')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_index_filters_by_muscle_group_and_equipment(): void
    {
        $chest = MuscleGroup::factory()->create(['name' => 'Chest', 'slug' => 'chest']);
        $barbell = Equipment::factory()->create(['name' => 'Barbell', 'slug' => 'barbell']);
        $legs = MuscleGroup::factory()->create(['name' => 'Quadriceps', 'slug' => 'quadriceps']);
        $bodyweight = Equipment::factory()->create(['name' => 'Bodyweight', 'slug' => 'bodyweight']);
        $match = Exercise::factory()->for($chest)->for($barbell)->create(['name' => 'Bench Press']);
        Exercise::factory()->for($chest)->for($bodyweight)->create(['name' => 'Dip']);
        Exercise::factory()->for($legs)->for($barbell)->create(['name' => 'Squat']);

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/exercises?muscle_group_id={$chest->id}&equipment_id={$barbell->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $match->id);
    }

    public function test_index_custom_only_false_string_does_not_filter(): void
    {
        $user = User::factory()->create();
        Exercise::factory()->create(['name' => 'Bench Press']);
        Exercise::factory()->custom()->for($user)->create(['name' => 'Deadlift']);

        Sanctum::actingAs($user);

        $this->getJson('/api/exercises?custom_only=false')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/exercises?custom_only=true')->assertOk()->assertJsonCount(1, 'data');
    }

    #[TestWith(['abc', 50])]
    #[TestWith(['-5', 50])]
    #[TestWith(['0', 50])]
    #[TestWith(['2', 2])]
    #[TestWith(['100000', 100])]
    public function test_index_clamps_per_page(string $perPage, int $expected): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/exercises?per_page={$perPage}")
            ->assertOk()
            ->assertJsonPath('meta.per_page', $expected);
    }

    public function test_store_creates_custom_exercise_owned_by_user_and_returns_201(): void
    {
        $user = User::factory()->create();
        $muscleGroup = MuscleGroup::factory()->create();

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/exercises', [
            'name' => 'Zercher Squat',
            'muscle_group_id' => $muscleGroup->id,
            'exercise_type' => 'weight_reps',
            'is_custom' => false,
            'user_id' => 999,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Zercher Squat')
            ->assertJsonPath('data.is_custom', true)
            ->assertJsonPath('data.muscle_group.id', $muscleGroup->id);

        $this->assertDatabaseHas('exercises', [
            'name' => 'Zercher Squat',
            'user_id' => $user->id,
            'is_custom' => true,
        ]);
    }

    public function test_store_rejects_missing_fields_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/exercises', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'exercise_type']);
    }

    public function test_store_rejects_non_numeric_muscle_group_id_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/exercises', [
            'name' => 'Thing',
            'exercise_type' => 'weight_reps',
            'muscle_group_id' => 'abc',
        ])->assertUnprocessable()->assertJsonValidationErrors(['muscle_group_id']);
    }

    public function test_store_rejects_unknown_exercise_type_with_422(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/exercises', ['name' => 'Thing', 'exercise_type' => 'yoga'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['exercise_type']);
    }

    public function test_show_returns_global_exercise(): void
    {
        $exercise = Exercise::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/exercises/{$exercise->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $exercise->id);
    }

    public function test_show_returns_404_for_another_users_custom_exercise(): void
    {
        $exercise = Exercise::factory()->custom()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/exercises/{$exercise->id}")->assertNotFound();
    }

    public function test_show_returns_404_for_non_numeric_id(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/exercises/abc')->assertNotFound();
    }

    public function test_update_changes_own_custom_exercise(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->custom()->for($user)->create();

        Sanctum::actingAs($user);

        $this->putJson("/api/exercises/{$exercise->id}", ['name' => 'Renamed', 'description' => null])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed');

        $this->assertDatabaseHas('exercises', ['id' => $exercise->id, 'name' => 'Renamed', 'description' => null]);
    }

    public function test_update_changing_type_rebuilds_records_and_drops_manual_records_it_no_longer_tracks(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->custom()->for($user)->create(['exercise_type' => 'weight_reps']);
        $workoutExercise = WorkoutExercise::factory()->for(Workout::factory()->for($user))->for($exercise)->create();
        ExerciseSet::factory()->for($workoutExercise)->create(['weight_kg' => 100, 'reps' => 5, 'duration_seconds' => 90]);
        $weightEntry = ManualRecord::factory()->for($user)->for($exercise)->create(['record_type' => 'max_weight', 'value' => 120]);
        PersonalRecord::recalculate($user->id, [$exercise->id]);

        Sanctum::actingAs($user);

        $this->putJson("/api/exercises/{$exercise->id}", ['exercise_type' => 'duration'])->assertOk();

        $this->assertSame(
            ['max_duration'],
            PersonalRecord::query()->where('exercise_id', $exercise->id)->pluck('record_type')->all(),
        );
        $this->assertModelMissing($weightEntry);
    }

    public function test_update_without_type_change_keeps_records(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->custom()->for($user)->create(['exercise_type' => 'weight_reps']);
        $entry = ManualRecord::factory()->for($user)->for($exercise)->create(['record_type' => 'max_weight', 'value' => 120]);
        PersonalRecord::recalculate($user->id, [$exercise->id]);

        Sanctum::actingAs($user);

        $this->putJson("/api/exercises/{$exercise->id}", ['name' => 'Renamed', 'exercise_type' => 'weight_reps'])->assertOk();

        $this->assertModelExists($entry);
        $this->assertSame(1, PersonalRecord::query()->where('exercise_id', $exercise->id)->count());
    }

    public function test_update_forbids_editing_global_exercise_with_403(): void
    {
        $exercise = Exercise::factory()->create(['name' => 'Bench Press']);

        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/exercises/{$exercise->id}", ['name' => 'Hacked'])->assertForbidden();

        $this->assertDatabaseHas('exercises', ['id' => $exercise->id, 'name' => 'Bench Press']);
    }

    public function test_update_forbids_editing_another_users_exercise_with_403(): void
    {
        $exercise = Exercise::factory()->custom()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->putJson("/api/exercises/{$exercise->id}", ['name' => 'Hacked'])->assertForbidden();
    }

    public function test_destroy_deletes_own_custom_exercise_and_returns_204(): void
    {
        $user = User::factory()->create();
        $exercise = Exercise::factory()->custom()->for($user)->create();

        Sanctum::actingAs($user);

        $this->deleteJson("/api/exercises/{$exercise->id}")->assertNoContent();

        $this->assertModelMissing($exercise);
    }

    public function test_destroy_forbids_deleting_global_exercise_with_403(): void
    {
        $exercise = Exercise::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->deleteJson("/api/exercises/{$exercise->id}")->assertForbidden();

        $this->assertModelExists($exercise);
    }
}
