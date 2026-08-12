<?php

namespace App\Models;

use CodeIgniter\Model;

class ProcurementEventModel extends Model
{
    protected $table         = 'procurement_events';
    protected $primaryKey    = 'id';
    protected $useTimestamps = true;
    protected $returnType    = 'array';
    protected $allowedFields = [
        'agency_id','bond_measure_id','event_type','service_type','title',
        'issue_date','due_date','award_date','awarded_to','estimated_value',
        'source_url','source_document_title',
    ];

    public function getActive(): array
    {
        return $this->db->table('procurement_events pe')
            ->select('pe.*, a.name as agency_name, a.state, a.agency_type')
            ->join('agencies a', 'a.id = pe.agency_id', 'left')
            ->whereIn('pe.event_type', ['rfq_issued','rfp_issued'])
            ->where('(pe.due_date IS NULL OR pe.due_date >= "' . date('Y-m-d') . '")')
            ->orderBy('pe.due_date', 'ASC')
            ->get()->getResultArray();
    }

    public function getFiltered(array $filters = []): array
    {
        $builder = $this->db->table('procurement_events pe')
            ->select('pe.*, a.name as agency_name, a.state, a.agency_type')
            ->join('agencies a', 'a.id = pe.agency_id', 'left');

        if (!empty($filters['state']))        $builder->where('a.state', $filters['state']);
        if (!empty($filters['service_type'])) $builder->where('pe.service_type', $filters['service_type']);
        if (!empty($filters['event_type']))   $builder->where('pe.event_type', $filters['event_type']);
        if (!empty($filters['due_soon']))     {
            $future = date('Y-m-d', strtotime('+30 days'));
            $builder->where('pe.due_date >=', date('Y-m-d'))->where('pe.due_date <=', $future);
        }

        return $builder->orderBy('pe.issue_date', 'DESC')->get()->getResultArray();
    }
}
