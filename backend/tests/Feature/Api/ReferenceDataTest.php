<?php

namespace Tests\Feature\Api;

use App\Models\Equipment;
use App\Models\Exercise;
use App\Models\MuscleGroup;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\EquipmentSeeder;
use Database\Seeders\ExerciseSeeder;
use Database\Seeders\MuscleGroupSeeder;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReferenceDataTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_muscle_groups_are_listed_alphabetically(): void
    {
        MuscleGroup::factory()->create(['name' => 'Triceps', 'slug' => 'triceps']);
        MuscleGroup::factory()->create(['name' => 'Back', 'slug' => 'back']);

        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/muscle-groups')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Back')
            ->assertJsonPath('data.1.name', 'Triceps');
    }

    public function test_equipment_is_listed_alphabetically(): void
    {
        Equipment::factory()->create(['name' => 'Kettlebell', 'slug' => 'kettlebell']);
        Equipment::factory()->create(['name' => 'Barbell', 'slug' => 'barbell']);

        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/equipment')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Barbell')
            ->assertJsonPath('data.1.name', 'Kettlebell');
    }

    public function test_show_returns_single_records_and_404_for_unknown_ids(): void
    {
        $muscleGroup = MuscleGroup::factory()->create();
        $equipment = Equipment::factory()->create();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/muscle-groups/{$muscleGroup->id}")->assertOk()->assertJsonPath('data.slug', $muscleGroup->slug);
        $this->getJson("/api/equipment/{$equipment->id}")->assertOk()->assertJsonPath('data.slug', $equipment->slug);
        $this->getJson('/api/muscle-groups/999999')->assertNotFound();
        $this->getJson('/api/equipment/abc')->assertNotFound();
    }

    public function test_reference_data_requires_authentication(): void
    {
        $this->getJson('/api/muscle-groups')->assertUnauthorized();
        $this->getJson('/api/equipment')->assertUnauthorized();
    }

    public function test_seeder_links_every_exercise_to_a_muscle_group_and_equipment_and_is_idempotent(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed([MuscleGroupSeeder::class, EquipmentSeeder::class, ExerciseSeeder::class]);

        $this->assertDatabaseMissing('exercises', ['muscle_group_id' => null]);
        $this->assertDatabaseMissing('exercises', ['equipment_id' => null]);
        $this->assertDatabaseCount('exercises', 74);
    }

    public function test_seeder_tags_secondary_categories_and_leaves_a_same_named_custom_exercise_alone(): void
    {
        $custom = Exercise::factory()->custom()->create(['name' => 'Pull Up', 'muscle_group_id' => null]);

        $this->seed(DatabaseSeeder::class);

        $pullUp = Exercise::query()->whereNull('user_id')->where('name', 'Pull Up')->sole();
        $this->assertSame(['back', 'biceps'], $pullUp->categories());
        $this->assertNull($custom->fresh()->secondary_categories);
        $this->assertNull($custom->fresh()->muscle_group_id);
    }
}
