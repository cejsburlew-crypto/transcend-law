<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contact extends Model
{
    protected $fillable = [
        'agency_id',
        'role',
        'name',
        'email',
        'phone',
        'linkedin_url',
        'verified_at',
        'source_url',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }
}
