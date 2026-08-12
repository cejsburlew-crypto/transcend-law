<?php

namespace App\Models;

use CodeIgniter\Model;

class LeadScoreModel extends Model
{
    protected $table         = 'lead_scores';
    protected $primaryKey    = 'id';
    protected $useTimestamps = true;
    protected $returnType    = 'array';

    protected $allowedFields = [
        'agency_id','score','confidence','opportunity_stage',
        'estimated_next_action','recommended_outreach_angle',
        'scoring_factors','manual_review_flag','approach_now','scored_at',
    ];

    public function getLeads(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $builder = $this->db->table('lead_scores ls')
            ->select('ls.*, a.name, a.agency_type, a.state, a.city, a.website,
                      MAX(bm.bond_amount) as bond_amount, MAX(bm.election_date) as latest_election')
            ->join('agencies a', 'a.id = ls.agency_id')
            ->join('bond_measures bm', 'bm.agency_id = a.id', 'left')
            ->groupBy('ls.id');

        if (!empty($filters['state']))             $builder->where('a.state', $filters['state']);
        if (!empty($filters['agency_type']))       $builder->where('a.agency_type', $filters['agency_type']);
        if (!empty($filters['opportunity_stage'])) $builder->where('ls.opportunity_stage', $filters['opportunity_stage']);
        if (!empty($filters['approach_now']))      $builder->where('ls.approach_now', 1);
        if (!empty($filters['min_score']))         $builder->where('ls.score >=', (int)$filters['min_score']);
        if (!empty($filters['search']))            $builder->like('a.name', $filters['search']);

        $sort = $filters['sort'] ?? 'score';
        $dir  = ($filters['direction'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
        $sortMap = ['score' => 'ls.score', 'bond_amount' => 'bond_amount', 'name' => 'a.name'];
        $builder->orderBy($sortMap[$sort] ?? 'ls.score', $dir);

        $total   = $builder->countAllResults(false);
        $results = $builder->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();

        foreach ($results as &$row) {
            $row['scoring_factors'] = json_decode($row['scoring_factors'] ?? '[]', true) ?: [];
        }

        return ['data' => $results, 'total' => $total];
    }

    public function getTopLeads(int $limit = 20): array
    {
        $results = $this->db->table('lead_scores ls')
            ->select('ls.*, a.name, a.agency_type, a.state, a.city,
                      MAX(bm.bond_amount) as bond_amount')
            ->join('agencies a', 'a.id = ls.agency_id')
            ->join('bond_measures bm', 'bm.agency_id = a.id', 'left')
            ->groupBy('ls.id')
            ->where('ls.score >=', 70)
            ->orWhere('ls.approach_now', 1)
            ->orderBy('ls.score', 'DESC')
            ->limit($limit)->get()->getResultArray();

        foreach ($results as &$row) {
            $row['scoring_factors'] = json_decode($row['scoring_factors'] ?? '[]', true) ?: [];
        }

        return $results;
    }

    public function upsertScore(int $agencyId, array $data): void
    {
        $existing = $this->where('agency_id', $agencyId)->first();
        $data['agency_id']  = $agencyId;
        $data['scored_at']  = date('Y-m-d H:i:s');
        $data['scoring_factors'] = json_encode($data['scoring_factors'] ?? []);

        if ($existing) {
            $this->update($existing['id'], $data);
        } else {
            $this->insert($data);
        }
    }
}
