<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;

class DashboardController extends BaseController
{
    public function summary()
    {
        $db = \Config\Database::connect();

        $totalAgencies = $db->table('agencies')->countAllResults();

        $totalBondValue = (float) ($db->table('bond_measures')
            ->selectSum('bond_amount')->get()->getRow()->bond_amount ?? 0);

        $bondsPassedCount = $db->table('bond_measures')
            ->where('result', 'passed')->countAllResults();

        $approachNowCount = $db->table('lead_scores')
            ->where('approach_now', 1)->countAllResults();

        $topOpportunities = $db->table('lead_scores ls')
            ->select('ls.agency_id, a.name as agency_name, ls.score, ls.opportunity_stage as stage, MAX(bm.bond_amount) as bond_amount, a.state')
            ->join('agencies a', 'a.id = ls.agency_id')
            ->join('bond_measures bm', 'bm.agency_id = a.id', 'left')
            ->groupBy('ls.agency_id')
            ->orderBy('ls.score', 'DESC')
            ->limit(5)->get()->getResultArray();

        $pipelineByStage = $db->table('lead_scores')
            ->select('opportunity_stage, COUNT(*) as count')
            ->groupBy('opportunity_stage')
            ->get()->getResultArray();
        $pipelineMap = [];
        foreach ($pipelineByStage as $row) {
            $pipelineMap[$row['opportunity_stage'] ?? 'unknown'] = (int)$row['count'];
        }

        $bondsByState = $db->table('bond_measures bm')
            ->select('a.state, SUM(bm.bond_amount) as total_value, COUNT(DISTINCT a.id) as count')
            ->join('agencies a', 'a.id = bm.agency_id')
            ->groupBy('a.state')
            ->orderBy('total_value', 'DESC')
            ->get()->getResultArray();

        $recentRuns = $db->table('scrape_runs')
            ->orderBy('started_at', 'DESC')
            ->limit(5)->get()->getResultArray();

        return api_success([
            'total_agencies'            => $totalAgencies,
            'total_bond_value'          => $totalBondValue,
            'agencies_with_bonds_passed'=> $bondsPassedCount,
            'approach_now_count'        => $approachNowCount,
            'top_opportunities'         => $topOpportunities,
            'pipeline_by_stage'         => $pipelineMap,
            'bonds_by_state'            => $bondsByState,
            'recent_scrape_runs'        => $recentRuns,
        ]);
    }
}
