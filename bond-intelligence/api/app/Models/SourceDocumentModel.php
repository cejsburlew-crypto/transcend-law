<?php

namespace App\Models;

use CodeIgniter\Model;

class SourceDocumentModel extends Model
{
    protected $table         = 'source_documents';
    protected $primaryKey    = 'id';
    protected $useTimestamps = true;
    protected $returnType    = 'array';
    protected $allowedFields = [
        'agency_id','url','url_hash','title','document_type',
        'source_name','published_date','scraped_at','content_hash','raw_text',
    ];
}
