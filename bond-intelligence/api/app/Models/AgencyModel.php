<?php

namespace App\Models;

use CodeIgniter\Model;

class AgencyModel extends Model
{
    protected $table         = 'agencies';
    protected $primaryKey    = 'id';
    protected $useTimestamps = true;
    protected $returnType    = 'array';

    protected $allowedFields = [
        'name', 'normalized_name', 'agency_type', 'state',
        'county', 'city', 'website', 'population',
    ];

    protected $validationRules = [
        'name'            => 'required|max_length[255]',
        'normalized_name' => 'required|max_length[255]',
    ];

    public function getWithScore(array $filters = [], int $page = 1, int $perPage = 25): array
    {
        $builder = $this->db->table('agencies a')
            ->select('a.*, ls.score, ls.confidence, ls.opportunity_stage, ls.approach_now, ls.scored_at,
                      MAX(bm.bond_amount) as max_bond_amount,
                      MAX(bm.election_date) as latest_election_date')
            ->join('lead_scores ls', 'ls.agency_id = a.id', 'left')
            ->join('bond_measures bm', 'bm.agency_id = a.id', 'left')
            ->groupBy('a.id');

        if (!empty($filters['state']))            $builder->where('a.state', $filters['state']);
        if (!empty($filters['agency_type']))      $builder->where('a.agency_type', $filters['agency_type']);
        if (!empty($filters['opportunity_stage'])) $builder->where('ls.opportunity_stage', $filters['opportunity_stage']);
        if (!empty($filters['approach_now']))     $builder->where('ls.approach_now', 1);
        if (!empty($filters['min_score']))        $builder->where('ls.score >=', (int)$filters['min_score']);
        if (!empty($filters['max_score']))        $builder->where('ls.score <=', (int)$filters['max_score']);
        if (!empty($filters['min_bond_amount']))  $builder->where('bm.bond_amount >=', (float)$filters['min_bond_amount']);
        if (!empty($filters['search']))           $builder->like('a.name', $filters['search']);

        $sort = in_array($filters['sort'] ?? '', ['name','state','county','score','bond_amount','updated_at'])
            ? $filters['sort'] : 'score';
        $dir  = ($filters['direction'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';

        $sortMap = ['score' => 'ls.score', 'bond_amount' => 'max_bond_amount', 'name' => 'a.name', 'state' => 'a.state', 'county' => 'a.county', 'updated_at' => 'a.updated_at'];
        $builder->orderBy($sortMap[$sort] ?? 'ls.score', $dir);

        $total   = $builder->countAllResults(false);
        $results = $builder->limit($perPage, ($page - 1) * $perPage)->get()->getResultArray();

        return ['data' => $results, 'total' => $total];
    }

    public function getWithRelations(int $id): ?array
    {
        $agency = $this->find($id);
        if (!$agency) return null;

        $agency['bond_measures']      = model('BondMeasureModel')->where('agency_id', $id)->findAll();
        $agency['contacts']           = model('ContactModel')->where('agency_id', $id)->findAll();
        $agency['consultants']        = model('ConsultantModel')->where('agency_id', $id)->findAll();
        $agency['procurement_events'] = model('ProcurementEventModel')->where('agency_id', $id)->orderBy('issue_date','DESC')->findAll();
        $agency['lead_score']         = model('LeadScoreModel')->where('agency_id', $id)->first();
        $agency['source_documents']   = model('SourceDocumentModel')->where('agency_id', $id)->findAll();

        // Decode JSON fields and attach bond series to each measure
        foreach ($agency['bond_measures'] as &$bm) {
            $bm['project_categories'] = json_decode($bm['project_categories'] ?? '[]', true) ?: [];
            $bm['bond_series'] = $this->db->table('bond_series')
                ->where('bond_measure_id', $bm['id'])
                ->orderBy('sale_date', 'ASC')
                ->get()->getResultArray();
        }
        if ($agency['lead_score']) {
            $agency['lead_score']['scoring_factors'] = json_decode($agency['lead_score']['scoring_factors'] ?? '[]', true) ?: [];
        }

        return $agency;
    }

    public function getStats(): array
    {
        $byType  = $this->db->table('agencies')->select('agency_type, COUNT(*) as count')->groupBy('agency_type')->get()->getResultArray();
        $byState = $this->db->table('agencies')->select('state, COUNT(*) as count')->groupBy('state')->get()->getResultArray();
        return ['by_type' => $byType, 'by_state' => $byState];
    }

    public function getMapData(): array
    {
        return $this->db->table('agencies a')
            ->select('a.id, a.name, a.state, a.city, a.lat, a.lng, a.agency_type, ls.score, ls.opportunity_stage as stage, MAX(bm.bond_amount) as bond_amount')
            ->join('lead_scores ls', 'ls.agency_id = a.id', 'left')
            ->join('bond_measures bm', 'bm.agency_id = a.id', 'left')
            ->groupBy('a.id')
            ->get()->getResultArray();
    }

    public function normalizeAgencyName(string $name): string
    {
        $replacements = [
            'unified school district' => 'usd', 'union school district' => 'usd',
            'elementary school district' => 'esd', 'high school district' => 'hsd',
            'community college district' => 'ccd', 'community college' => 'cc',
            'school district' => 'sd', 'city of' => '', 'county of' => '',
            'metropolitan water district' => 'mwd', 'water district' => 'wd',
        ];
        $n = strtolower(trim($name));
        foreach ($replacements as $from => $to) {
            $n = str_replace($from, $to, $n);
        }
        return trim(preg_replace('/\s+/', ' ', preg_replace('/[^a-z0-9 ]/', '', $n)));
    }
}
