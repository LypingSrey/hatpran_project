<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EquipmentController;
use App\Http\Controllers\Api\ExerciseController;
use App\Http\Controllers\Api\ExerciseSetController;
use App\Http\Controllers\Api\ManualRecordController;
use App\Http\Controllers\Api\MuscleGroupController;
use App\Http\Controllers\Api\PersonalRecordController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\WorkoutController;
use App\Http\Controllers\Api\WorkoutExerciseController;
use App\Http\Controllers\Api\WorkoutTemplateController;
use Illuminate\Support\Facades\Route;

// Authentication routes (throttled against password guessing and sign-up spam)
Route::post('register', [AuthController::class, 'register'])->middleware('throttle:6,1');
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('user', [AuthController::class, 'user']);

    // Profile (password-checking routes are throttled against guessing)
    Route::put('user', [ProfileController::class, 'update'])->middleware('throttle:6,1');
    Route::delete('user', [ProfileController::class, 'destroy'])->middleware('throttle:6,1');
    Route::put('user/password', [ProfileController::class, 'updatePassword'])->middleware('throttle:6,1');
    Route::get('user/stats', [ProfileController::class, 'stats']);
    Route::post('user/avatar', [ProfileController::class, 'updateAvatar'])->middleware('throttle:10,1');
    Route::delete('user/avatar', [ProfileController::class, 'destroyAvatar']);

    // Muscle Groups (read-only)
    Route::get('muscle-groups', [MuscleGroupController::class, 'index']);
    Route::get('muscle-groups/{muscleGroup}', [MuscleGroupController::class, 'show']);

    // Equipment (read-only)
    Route::get('equipment', [EquipmentController::class, 'index']);
    Route::get('equipment/{equipment}', [EquipmentController::class, 'show']);

    // Exercises
    Route::apiResource('exercises', ExerciseController::class);

    // Workouts
    Route::post('workouts/{workout}/complete', [WorkoutController::class, 'complete']);
    Route::apiResource('workouts', WorkoutController::class);

    // Exercises inside a workout (add, change or remove mid-session)
    Route::post('workouts/{workout}/exercises', [WorkoutExerciseController::class, 'store']);
    Route::put('workout-exercises/{workoutExercise}', [WorkoutExerciseController::class, 'update']);
    Route::delete('workout-exercises/{workoutExercise}', [WorkoutExerciseController::class, 'destroy']);

    // Workout Templates
    Route::post('workout-templates/{workoutTemplate}/start', [WorkoutTemplateController::class, 'startWorkout']);
    Route::apiResource('workout-templates', WorkoutTemplateController::class);

    // Exercise Sets (nested under workout exercises)
    Route::get('workout-exercises/{workoutExercise}/sets', [ExerciseSetController::class, 'index']);
    Route::post('workout-exercises/{workoutExercise}/sets', [ExerciseSetController::class, 'store']);
    Route::get('sets/{exerciseSet}', [ExerciseSetController::class, 'show']);
    Route::put('sets/{exerciseSet}', [ExerciseSetController::class, 'update']);
    Route::delete('sets/{exerciseSet}', [ExerciseSetController::class, 'destroy']);
    Route::post('sets/{exerciseSet}/complete', [ExerciseSetController::class, 'complete']);

    // Personal Records
    Route::get('personal-records', [PersonalRecordController::class, 'index']);
    Route::get('personal-records/{personalRecord}', [PersonalRecordController::class, 'show']);
    Route::get('exercises/{exercise}/personal-records', [PersonalRecordController::class, 'forExercise']);

    // Records entered by hand; they count toward personal records
    Route::apiResource('manual-records', ManualRecordController::class);
});
