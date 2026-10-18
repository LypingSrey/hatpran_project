<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkoutExerciseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order' => $this->order,
            'notes' => $this->notes,
            'exercise' => new ExerciseResource($this->whenLoaded('exercise')),
            'sets' => ExerciseSetResource::collection($this->whenLoaded('sets')),
            'previous_sets' => ExerciseSetResource::collection($this->whenLoaded('previousSets')),
        ];
    }
}
