<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BondMeasure extends Model
{
    protected $fillable = [
        'agency_id',
        'measure_name',
        'measure_number',
        'election_date',
        'result',
        'vote_pct',
        'bond_amount',
        'bond_purpose',
        'project_categories',
        'authorized_amount',
        'issued_amount',
        'unissued_amount',
        'source_url',
        'source_document_title',
        'source_date',
        'raw_data',
    ];

    protected $casts = [
        'project_categories' => 'array',
        'raw_data' => 'array',
        'election_date' => 'date',
        'source_date' => 'date',
        'bond_amount' => 'integer',
        'authorized_amount' => 'integer',
        'issued_amount' => 'integer',
        'unissued_amount' => 'integer',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function procurementEvents(): HasMany
    {
        return $this->hasMany(ProcurementEvent::class);
    }
}
