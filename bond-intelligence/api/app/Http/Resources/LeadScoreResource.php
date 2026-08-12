<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeadScoreResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                          => $this->id,
            'agency_id'                   => $this->agency_id,
            'agency'                      => $this->whenLoaded('agency', fn() => new AgencyResource($this->agency)),
            'score'                       => $this->score,
            'score_tier'                  => $this->getScoreTier(),
            'confidence'                  => $this->confidence,
            'opportunity_stage'           => $this->opportunity_stage,
            'opportunity_stage_label'     => $this->opportunity_stage_label,
            'estimated_next_action'       => $this->estimated_next_action,
            'recommended_outreach_angle'  => $this->recommended_outreach_angle,
            'scoring_factors'             => $this->scoring_factors,
            'manual_review_flag'          => $this->manual_review_flag,
            'approach_now'                => $this->approach_now,
            'scored_at'                   => $this->scored_at?->toISOString(),
            'scored_at_human'             => $this->scored_at?->diffForHumans(),
            'created_at'                  => $this->created_at?->toISOString(),
        ];
    }

    private function getScoreTier(): string
    {
        return match (true) {
            $this->score >= 80 => 'hot',
            $this->score >= 60 => 'warm',
            $this->score >= 40 => 'cool',
            default            => 'cold',
        };
    }
}
