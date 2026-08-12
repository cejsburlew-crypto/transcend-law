<?php

namespace App\Models;

use CodeIgniter\Model;

class ScrapeRunModel extends Model
{
    protected $table         = 'scrape_runs';
    protected $primaryKey    = 'id';
    protected $useTimestamps = true;
    protected $returnType    = 'array';
    protected $allowedFields = [
        'scraper_name','state','started_at','completed_at','status',
        'records_found','records_created','records_updated','errors','log_file',
    ];

    public function getRecent(int $limit = 50): array
    {
        return $this->orderBy('started_at', 'DESC')->limit($limit)->findAll();
    }
}
