<?php

namespace App\Models;

use CodeIgniter\Model;

class BondMeasureModel extends Model
{
    protected $table         = 'bond_measures';
    protected $primaryKey    = 'id';
    protected $useTimestamps = true;
    protected $returnType    = 'array';

    protected $allowedFields = [
        'agency_id','measure_name','measure_number','election_date','result',
        'vote_pct','bond_amount','bond_purpose','project_categories',
        'authorized_amount','issued_amount','unissued_amount',
        'source_url','source_document_title','source_date','raw_data',
    ];

    public function getFiltered(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $builder = $this->db->table('bond_measures bm')
            ->select('bm.*, a.name as agency_name, a.agency_type, a.state, a.city')
            ->join('agencies a', 'a.id = bm.agency_id', 'left');

        if (!empty($filters['state']))     $builder->where('a.state', $filters['state']);
        if (!empty($filters['result']))    $builder->where('bm.result', $filters['result']);
        if (!empty($filters['min_amount'])) $builder->where('bm.bond_amount >=', (float)$filters['min_amount']);
        if (!empty($filters['election_year'])) {
            $builder->like('bm.election_date', $filters['election_year']);
        }
        if (!empty($filters['agency_type'])) $builder->where('a.agency_type', $filters['agency_type']);

        $builder->orderBy('bm.election_date', 'DESC');
        $total   = $builder->countAllResults(false);
        $results = $builder->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();

        foreach ($results as &$row) {
            $row['project_categories'] = json_decode($row['project_categories'] ?? '[]', true) ?: [];
        }

        return ['data' => $results, 'total' => $total];
    }

    public function getStats(): array
    {
        $byState = $this->db->table('bond_measures bm')
            ->select('a.state, bm.result, COUNT(*) as count, SUM(bm.bond_amount) as total_amount')
            ->join('agencies a', 'a.id = bm.agency_id', 'left')
            ->groupBy('a.state, bm.result')
            ->get()->getResultArray();

        $byResult = $this->db->table('bond_measures')
            ->select('result, COUNT(*) as count, SUM(bond_amount) as total_amount')
            ->groupBy('result')->get()->getResultArray();

        $largest = $this->db->table('bond_measures bm')
            ->select('bm.*, a.name as agency_name, a.state')
            ->join('agencies a', 'a.id = bm.agency_id', 'left')
            ->where('bm.result', 'passed')
            ->orderBy('bm.bond_amount', 'DESC')
            ->limit(10)->get()->getResultArray();

        return ['by_state' => $byState, 'by_result' => $byResult, 'largest' => $largest];
    }
}
