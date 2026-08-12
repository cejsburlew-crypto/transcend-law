<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScrapeRun extends Model
{
    protected $fillable = [
        'scraper_name',
        'state',
        'started_at',
        'completed_at',
        'status',
        'records_found',
        'records_created',
        'records_updated',
        'errors',
        'log_file',
    ];

    protected $casts = [
        'errors'          => 'array',
        'started_at'      => 'datetime',
        'completed_at'    => 'datetime',
        'records_found'   => 'integer',
        'records_created' => 'integer',
        'records_updated' => 'integer',
    ];
}
