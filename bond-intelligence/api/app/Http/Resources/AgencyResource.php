<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AgencyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'name'             => $this->name,
            'normalized_name'  => $this->normalized_name,
            'agency_type'      => $this->agency_type,
            'state'            => $this->state,
            'county'           => $this->county,
            'city'             => $this->city,
            'website'          => $this->website,
            'population'       => $this->population,
            'lead_score'       => $this->whenLoaded('leadScore', fn() => new LeadScoreResource($this->leadScore)),
            'bond_measures_count' => $this->whenLoaded('bondMeasures', fn() => $this->bondMeasures->count()),
            'contacts_count'   => $this->whenLoaded('contacts', fn() => $this->contacts->count()),
            'latest_bond'      => $this->whenLoaded('bondMeasures', fn() => $this->bondMeasures->sortByDesc('election_date')->first()
                ? new BondMeasureResource($this->bondMeasures->sortByDesc('election_date')->first())
                : null
            ),
            'created_at'       => $this->created_at?->toISOString(),
        ];
    }
}
