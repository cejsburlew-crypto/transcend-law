<?php

namespace App\Models;

use CodeIgniter\Model;

class ConsultantModel extends Model
{
    protected $table         = 'consultants';
    protected $primaryKey    = 'id';
    protected $useTimestamps = true;
    protected $returnType    = 'array';
    protected $allowedFields = ['agency_id','service_type','firm_name','contract_amount','contract_date','source_url'];
}
