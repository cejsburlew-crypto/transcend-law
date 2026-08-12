<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BondMeasureResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'agency_id'             => $this->agency_id,
            'agency'                => $this->whenLoaded('agency', fn() => new AgencyResource($this->agency)),
            'measure_name'          => $this->measure_name,
            'measure_number'        => $this->measure_number,
            'election_date'         => $this->election_date?->toDateString(),
            'result'                => $this->result,
            'vote_pct'              => $this->vote_pct,
            'bond_amount'           => $this->bond_amount,
            'bond_amount_formatted' => $this->bond_amount ? '$' . number_format($this->bond_amount) : null,
            'bond_purpose'          => $this->bond_purpose,
            'project_categories'    => $this->project_categories,
            'authorized_amount'     => $this->authorized_amount,
            'authorized_amount_formatted' => $this->authorized_amount ? '$' . number_format($this->authorized_amount) : null,
            'issued_amount'         => $this->issued_amount,
            'issued_amount_formatted'     => $this->issued_amount ? '$' . number_format($this->issued_amount) : null,
            'unissued_amount'        => $this->unissued_amount,
            'unissued_amount_formatted'   => $this->unissued_amount ? '$' . number_format($this->unissued_amount) : null,
            'source_url'            => $this->source_url,
            'source_document_title' => $this->source_document_title,
            'source_date'           => $this->source_date?->toDateString(),
            'procurement_events'    => $this->whenLoaded('procurementEvents', fn() => $this->procurementEvents),
            'created_at'            => $this->created_at?->toISOString(),
        ];
    }
}
