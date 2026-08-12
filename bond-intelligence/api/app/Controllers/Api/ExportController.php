<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use League\Csv\Writer;

class ExportController extends BaseController
{
    private function getFilters(): array
    {
        return [
            'state'             => $this->request->getGet('state'),
            'opportunity_stage' => $this->request->getGet('opportunity_stage'),
            'approach_now'      => $this->request->getGet('approach_now'),
            'min_score'         => $this->request->getGet('min_score'),
        ];
    }

    private function fetchLeads(array $filters): array
    {
        $db = \Config\Database::connect();
        $builder = $db->table('agencies a')
            ->select('a.*, ls.score, ls.confidence, ls.opportunity_stage, ls.approach_now,
                      ls.estimated_next_action, ls.recommended_outreach_angle,
                      bm.measure_name, bm.election_date, bm.result as bond_result,
                      bm.vote_pct, bm.bond_amount, bm.bond_purpose, bm.authorized_amount,
                      bm.issued_amount, bm.unissued_amount, bm.source_url,
                      a.updated_at as last_updated')
            ->join('lead_scores ls', 'ls.agency_id = a.id', 'left')
            ->join('bond_measures bm', 'bm.agency_id = a.id', 'left')
            ->groupBy('a.id')
            ->orderBy('ls.score', 'DESC');

        if (!empty($filters['state']))             $builder->where('a.state', $filters['state']);
        if (!empty($filters['opportunity_stage'])) $builder->where('ls.opportunity_stage', $filters['opportunity_stage']);
        if (!empty($filters['approach_now']))      $builder->where('ls.approach_now', 1);
        if (!empty($filters['min_score']))         $builder->where('ls.score >=', (int)$filters['min_score']);

        return $builder->get()->getResultArray();
    }

    public function csv()
    {
        $leads = $this->fetchLeads($this->getFilters());

        $writer = Writer::createFromString();
        $writer->insertOne([
            'Agency Name','Agency Type','State','County','City','Website',
            'Bond Measure','Election Date','Result','Vote %','Bond Amount',
            'Bond Purpose','Authorized Amount','Issued Amount','Unissued Amount',
            'Lead Score','Confidence','Opportunity Stage','Approach Now',
            'Estimated Next Action','Recommended Outreach','Source URL','Last Updated',
        ]);

        foreach ($leads as $row) {
            $writer->insertOne([
                $row['name'] ?? '', $row['agency_type'] ?? '', $row['state'] ?? '',
                $row['county'] ?? '', $row['city'] ?? '', $row['website'] ?? '',
                $row['measure_name'] ?? '', $row['election_date'] ?? '',
                $row['bond_result'] ?? '', $row['vote_pct'] ?? '',
                $row['bond_amount'] ?? '', $row['bond_purpose'] ?? '',
                $row['authorized_amount'] ?? '', $row['issued_amount'] ?? '',
                $row['unissued_amount'] ?? '', $row['score'] ?? '',
                $row['confidence'] ?? '', $row['opportunity_stage'] ?? '',
                $row['approach_now'] ? 'Yes' : 'No',
                $row['estimated_next_action'] ?? '',
                $row['recommended_outreach_angle'] ?? '',
                $row['source_url'] ?? '', $row['last_updated'] ?? '',
            ]);
        }

        return $this->response
            ->setHeader('Content-Type', 'text/csv')
            ->setHeader('Content-Disposition', 'attachment; filename="bond-intelligence-leads.csv"')
            ->setBody($writer->toString());
    }

    public function crm()
    {
        $leads = $this->fetchLeads($this->getFilters());

        $writer = Writer::createFromString();
        $writer->insertOne([
            'Company Name','Website','Industry','State/Region','City',
            'Annual Revenue','Description','Lead Status',
            'Bond Measure Name','Election Date','Bond Result',
            'Lead Score','Opportunity Stage','Approach Now',
        ]);

        foreach ($leads as $row) {
            $industry = match($row['agency_type'] ?? '') {
                'k12_district','community_college','university' => 'Education',
                'city','county' => 'Government',
                'water_district' => 'Utilities',
                'hospital_district' => 'Healthcare',
                'transit' => 'Transportation',
                default => 'Government',
            };
            $score = (int)($row['score'] ?? 0);
            $status = $score >= 70 ? 'Hot' : ($score >= 50 ? 'Warm' : 'Cold');

            $writer->insertOne([
                $row['name'] ?? '', $row['website'] ?? '', $industry,
                $row['state'] ?? '', $row['city'] ?? '',
                $row['bond_amount'] ?? '',
                'Bond: ' . ($row['measure_name'] ?? '') . ' | Stage: ' . ($row['opportunity_stage'] ?? ''),
                $status,
                $row['measure_name'] ?? '', $row['election_date'] ?? '',
                $row['bond_result'] ?? '', $row['score'] ?? '',
                $row['opportunity_stage'] ?? '',
                $row['approach_now'] ? 'Yes' : 'No',
            ]);
        }

        return $this->response
            ->setHeader('Content-Type', 'text/csv')
            ->setHeader('Content-Disposition', 'attachment; filename="bond-intelligence-crm-hubspot.csv"')
            ->setBody($writer->toString());
    }
}
