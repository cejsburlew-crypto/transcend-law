<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadScore extends Model
{
    protected $fillable = [
        'agency_id',
        'score',
        'confidence',
        'opportunity_stage',
        'estimated_next_action',
        'recommended_outreach_angle',
        'scoring_factors',
        'manual_review_flag',
        'approach_now',
        'scored_at',
    ];

    protected $casts = [
        'scoring_factors' => 'array',
        'scored_at' => 'datetime',
        'manual_review_flag' => 'boolean',
        'approach_now' => 'boolean',
        'score' => 'integer',
        'confidence' => 'integer',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function getOpportunityStageLabelAttribute(): string
    {
        return match ($this->opportunity_stage) {
            'bond_passed'        => 'Bond Passed',
            'bond_failed_retry'  => 'Bond Failed – Retry Expected',
            'bond_issued'        => 'Bond Issued',
            'master_plan_active' => 'Master Plan Active',
            'rfq_expected'       => 'RFQ Expected',
            'rfq_active'         => 'RFQ Active',
            'consultant_awarded' => 'Consultant Awarded',
            'construction_active'=> 'Construction Active',
            'closeout'           => 'Closeout',
            default              => 'Unknown',
        };
    }
}
