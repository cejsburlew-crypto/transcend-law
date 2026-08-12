<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Consultant extends Model
{
    protected $fillable = [
        'agency_id',
        'service_type',
        'firm_name',
        'contract_amount',
        'contract_date',
        'source_url',
    ];

    protected $casts = [
        'contract_date'   => 'date',
        'contract_amount' => 'integer',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
