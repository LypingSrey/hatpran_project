<?php

namespace Database\Seeders;

use App\Models\Equipment;
use App\Models\Exercise;
use App\Models\MuscleGroup;
use Illuminate\Database\Seeder;

class ExerciseSeeder extends Seeder
{
    public function run(): void
    {
        $exercises = [
            // Chest
            ['name' => 'Bench Press', 'muscle_group' => 'chest', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['triceps']],
            ['name' => 'Incline Bench Press', 'muscle_group' => 'chest', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['shoulders', 'triceps']],
            ['name' => 'Decline Bench Press', 'muscle_group' => 'chest', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['triceps']],
            ['name' => 'Dumbbell Bench Press', 'muscle_group' => 'chest', 'equipment' => 'dumbbell', 'type' => 'weight_reps', 'secondary' => ['triceps']],
            ['name' => 'Dumbbell Fly', 'muscle_group' => 'chest', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Cable Crossover', 'muscle_group' => 'chest', 'equipment' => 'cable', 'type' => 'weight_reps'],
            ['name' => 'Push Up', 'muscle_group' => 'chest', 'equipment' => 'bodyweight', 'type' => 'bodyweight_reps', 'secondary' => ['triceps']],
            ['name' => 'Chest Dip', 'muscle_group' => 'chest', 'equipment' => 'bodyweight', 'type' => 'weighted_bodyweight', 'secondary' => ['triceps']],
            ['name' => 'Machine Chest Press', 'muscle_group' => 'chest', 'equipment' => 'machine', 'type' => 'weight_reps', 'secondary' => ['triceps']],
            ['name' => 'Pec Deck', 'muscle_group' => 'chest', 'equipment' => 'machine', 'type' => 'weight_reps'],

            // Back
            ['name' => 'Deadlift', 'muscle_group' => 'back', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['legs']],
            ['name' => 'Barbell Row', 'muscle_group' => 'back', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['biceps']],
            ['name' => 'Pull Up', 'muscle_group' => 'back', 'equipment' => 'pull-up-bar', 'type' => 'weighted_bodyweight', 'secondary' => ['biceps']],
            ['name' => 'Chin Up', 'muscle_group' => 'back', 'equipment' => 'pull-up-bar', 'type' => 'weighted_bodyweight', 'secondary' => ['biceps']],
            ['name' => 'Lat Pulldown', 'muscle_group' => 'back', 'equipment' => 'cable', 'type' => 'weight_reps', 'secondary' => ['biceps']],
            ['name' => 'Seated Cable Row', 'muscle_group' => 'back', 'equipment' => 'cable', 'type' => 'weight_reps', 'secondary' => ['biceps']],
            ['name' => 'T-Bar Row', 'muscle_group' => 'back', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['biceps']],
            ['name' => 'Dumbbell Row', 'muscle_group' => 'back', 'equipment' => 'dumbbell', 'type' => 'weight_reps', 'secondary' => ['biceps']],
            ['name' => 'Face Pull', 'muscle_group' => 'back', 'equipment' => 'cable', 'type' => 'weight_reps', 'secondary' => ['shoulders']],
            ['name' => 'Rack Pull', 'muscle_group' => 'back', 'equipment' => 'barbell', 'type' => 'weight_reps'],

            // Shoulders
            ['name' => 'Overhead Press', 'muscle_group' => 'shoulders', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['triceps']],
            ['name' => 'Dumbbell Shoulder Press', 'muscle_group' => 'shoulders', 'equipment' => 'dumbbell', 'type' => 'weight_reps', 'secondary' => ['triceps']],
            ['name' => 'Arnold Press', 'muscle_group' => 'shoulders', 'equipment' => 'dumbbell', 'type' => 'weight_reps', 'secondary' => ['triceps']],
            ['name' => 'Lateral Raise', 'muscle_group' => 'shoulders', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Front Raise', 'muscle_group' => 'shoulders', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Rear Delt Fly', 'muscle_group' => 'shoulders', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Upright Row', 'muscle_group' => 'shoulders', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['back']],
            ['name' => 'Shrug', 'muscle_group' => 'traps', 'equipment' => 'barbell', 'type' => 'weight_reps'],

            // Biceps
            ['name' => 'Barbell Curl', 'muscle_group' => 'biceps', 'equipment' => 'barbell', 'type' => 'weight_reps'],
            ['name' => 'Dumbbell Curl', 'muscle_group' => 'biceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Hammer Curl', 'muscle_group' => 'biceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Preacher Curl', 'muscle_group' => 'biceps', 'equipment' => 'ez-bar', 'type' => 'weight_reps'],
            ['name' => 'Concentration Curl', 'muscle_group' => 'biceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Cable Curl', 'muscle_group' => 'biceps', 'equipment' => 'cable', 'type' => 'weight_reps'],
            ['name' => 'Incline Dumbbell Curl', 'muscle_group' => 'biceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],

            // Triceps
            ['name' => 'Close Grip Bench Press', 'muscle_group' => 'triceps', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['chest']],
            ['name' => 'Tricep Pushdown', 'muscle_group' => 'triceps', 'equipment' => 'cable', 'type' => 'weight_reps'],
            ['name' => 'Overhead Tricep Extension', 'muscle_group' => 'triceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Skull Crusher', 'muscle_group' => 'triceps', 'equipment' => 'ez-bar', 'type' => 'weight_reps'],
            ['name' => 'Tricep Dip', 'muscle_group' => 'triceps', 'equipment' => 'bodyweight', 'type' => 'weighted_bodyweight', 'secondary' => ['chest']],
            ['name' => 'Diamond Push Up', 'muscle_group' => 'triceps', 'equipment' => 'bodyweight', 'type' => 'bodyweight_reps', 'secondary' => ['chest']],
            ['name' => 'Cable Overhead Tricep Extension', 'muscle_group' => 'triceps', 'equipment' => 'cable', 'type' => 'weight_reps'],

            // Legs - Quadriceps
            ['name' => 'Squat', 'muscle_group' => 'quadriceps', 'equipment' => 'barbell', 'type' => 'weight_reps'],
            ['name' => 'Front Squat', 'muscle_group' => 'quadriceps', 'equipment' => 'barbell', 'type' => 'weight_reps'],
            ['name' => 'Leg Press', 'muscle_group' => 'quadriceps', 'equipment' => 'machine', 'type' => 'weight_reps'],
            ['name' => 'Hack Squat', 'muscle_group' => 'quadriceps', 'equipment' => 'machine', 'type' => 'weight_reps'],
            ['name' => 'Leg Extension', 'muscle_group' => 'quadriceps', 'equipment' => 'machine', 'type' => 'weight_reps'],
            ['name' => 'Bulgarian Split Squat', 'muscle_group' => 'quadriceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Lunge', 'muscle_group' => 'quadriceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],
            ['name' => 'Goblet Squat', 'muscle_group' => 'quadriceps', 'equipment' => 'dumbbell', 'type' => 'weight_reps'],

            // Legs - Hamstrings
            ['name' => 'Romanian Deadlift', 'muscle_group' => 'hamstrings', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['back']],
            ['name' => 'Lying Leg Curl', 'muscle_group' => 'hamstrings', 'equipment' => 'machine', 'type' => 'weight_reps'],
            ['name' => 'Seated Leg Curl', 'muscle_group' => 'hamstrings', 'equipment' => 'machine', 'type' => 'weight_reps'],
            ['name' => 'Stiff Leg Deadlift', 'muscle_group' => 'hamstrings', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['back']],
            ['name' => 'Good Morning', 'muscle_group' => 'hamstrings', 'equipment' => 'barbell', 'type' => 'weight_reps', 'secondary' => ['back']],

            // Glutes
            ['name' => 'Hip Thrust', 'muscle_group' => 'glutes', 'equipment' => 'barbell', 'type' => 'weight_reps'],
            ['name' => 'Glute Bridge', 'muscle_group' => 'glutes', 'equipment' => 'bodyweight', 'type' => 'bodyweight_reps'],
            ['name' => 'Cable Kickback', 'muscle_group' => 'glutes', 'equipment' => 'cable', 'type' => 'weight_reps'],
            ['name' => 'Hip Abduction', 'muscle_group' => 'glutes', 'equipment' => 'machine', 'type' => 'weight_reps'],

            // Calves
            ['name' => 'Standing Calf Raise', 'muscle_group' => 'calves', 'equipment' => 'machine', 'type' => 'weight_reps'],
            ['name' => 'Seated Calf Raise', 'muscle_group' => 'calves', 'equipment' => 'machine', 'type' => 'weight_reps'],
            ['name' => 'Leg Press Calf Raise', 'muscle_group' => 'calves', 'equipment' => 'machine', 'type' => 'weight_reps'],

            // Abs
            ['name' => 'Crunch', 'muscle_group' => 'abs', 'equipment' => 'bodyweight', 'type' => 'bodyweight_reps'],
            ['name' => 'Leg Raise', 'muscle_group' => 'abs', 'equipment' => 'bodyweight', 'type' => 'bodyweight_reps'],
            ['name' => 'Plank', 'muscle_group' => 'abs', 'equipment' => 'bodyweight', 'type' => 'duration'],
            ['name' => 'Ab Wheel Rollout', 'muscle_group' => 'abs', 'equipment' => 'bodyweight', 'type' => 'bodyweight_reps'],
            ['name' => 'Cable Crunch', 'muscle_group' => 'abs', 'equipment' => 'cable', 'type' => 'weight_reps'],
            ['name' => 'Hanging Leg Raise', 'muscle_group' => 'abs', 'equipment' => 'pull-up-bar', 'type' => 'bodyweight_reps'],
            ['name' => 'Russian Twist', 'muscle_group' => 'obliques', 'equipment' => 'bodyweight', 'type' => 'bodyweight_reps'],
            ['name' => 'Side Plank', 'muscle_group' => 'obliques', 'equipment' => 'bodyweight', 'type' => 'duration'],

            // Cardio
            ['name' => 'Running (Treadmill)', 'muscle_group' => 'cardio', 'equipment' => 'treadmill', 'type' => 'distance_duration'],
            ['name' => 'Cycling', 'muscle_group' => 'cardio', 'equipment' => 'stationary-bike', 'type' => 'distance_duration'],
            ['name' => 'Rowing', 'muscle_group' => 'cardio', 'equipment' => 'rowing-machine', 'type' => 'distance_duration', 'secondary' => ['back']],
            ['name' => 'Jump Rope', 'muscle_group' => 'cardio', 'equipment' => 'bodyweight', 'type' => 'duration'],
        ];

        foreach ($exercises as $exerciseData) {
            $muscleGroup = MuscleGroup::where('slug', $exerciseData['muscle_group'])->first();
            $equipment = Equipment::where('slug', $exerciseData['equipment'])->first();

            // Built-ins only (user_id null), so a custom exercise with the same name is never touched.
            // Updating rather than skipping lets a re-run fill in categories on an existing database.
            Exercise::updateOrCreate(
                ['name' => $exerciseData['name'], 'user_id' => null],
                [
                    'muscle_group_id' => $muscleGroup?->id,
                    'equipment_id' => $equipment?->id,
                    'exercise_type' => $exerciseData['type'],
                    'is_custom' => false,
                    'secondary_categories' => $exerciseData['secondary'] ?? null,
                ]
            );
        }
    }
}
