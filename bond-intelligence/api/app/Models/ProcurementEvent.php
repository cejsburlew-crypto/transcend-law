<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcurementEvent extends Model
{
    protected $fillable = [
        'agency_id',
        'bond_measure_id',
        'event_type',
        'service_type',
        'title',
        'issue_date',
        'due_date',
        'award_date',
        'awarded_to',
        'estimated_value',
        'source_url',
        'source_document_title',
    ];

    protected $casts = [
        'issue_date'      => 'date',
        'due_date'        => 'date',
        'award_date'      => 'date',
        'estimated_value' => 'integer',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function bondMeasure(): BelongsTo
    {
        return $this->belongsTo(BondMeasure::class);
    }
}
