<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExerciseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'instructions' => $this->instructions,
            'exercise_type' => $this->exercise_type,
            'is_custom' => $this->is_custom,
            'muscle_group' => new MuscleGroupResource($this->whenLoaded('muscleGroup')),
            // Only with the muscle group loaded, so a list of exercises never loads it one by one.
            'category' => $this->when($this->relationLoaded('muscleGroup'), fn () => $this->category()),
            'categories' => $this->when($this->relationLoaded('muscleGroup'), fn () => $this->categories()),
            'equipment' => new EquipmentResource($this->whenLoaded('equipment')),
            'created_at' => $this->created_at,
        ];
    }
}
