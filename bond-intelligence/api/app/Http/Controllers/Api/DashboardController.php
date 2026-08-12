<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\BondMeasure;
use App\Models\LeadScore;
use App\Models\ScrapeRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $stageLabels = [
            'bond_passed'        => 'Bond Passed',
            'bond_failed_retry'  => 'Bond Failed – Retry Expected',
            'bond_issued'        => 'Bond Issued',
            'master_plan_active' => 'Master Plan Active',
            'rfq_expected'       => 'RFQ Expected',
            'rfq_active'         => 'RFQ Active',
            'consultant_awarded' => 'Consultant Awarded',
            'construction_active'=> 'Construction Active',
            'closeout'           => 'Closeout',
        ];

        $totalAgencies    = Agency::count();
        $totalBondValue   = BondMeasure::where('result', 'passed')->sum('bond_amount');
        $agenciesWithBonds= BondMeasure::distinct('agency_id')->count('agency_id');
        $approachNowCount = LeadScore::where('approach_now', true)->count();

        $pipelineByStage = LeadScore::selectRaw(
            'opportunity_stage, COUNT(*) as count, SUM(bond_measures.bond_amount) as total_bond_value'
        )
            ->leftJoin('agencies', 'agencies.id', '=', 'lead_scores.agency_id')
            ->leftJoin('bond_measures', 'bond_measures.agency_id', '=', 'agencies.id')
            ->whereNotNull('opportunity_stage')
            ->groupBy('opportunity_stage')
            ->orderByDesc('count')
            ->get()
            ->map(fn($row) => [
                'stage'           => $row->opportunity_stage,
                'label'           => $stageLabels[$row->opportunity_stage] ?? $row->opportunity_stage,
                'count'           => (int) $row->count,
                'total_bond_value'=> (int) $row->total_bond_value,
            ]);

        $topOpportunities = Agency::select([
                'agencies.id',
                'agencies.name',
                'agencies.state',
            ])
            ->join('lead_scores', 'lead_scores.agency_id', '=', 'agencies.id')
            ->addSelect([
                'lead_scores.score',
                'lead_scores.approach_now',
                'lead_scores.opportunity_stage',
            ])
            ->withMax('bondMeasures', 'bond_amount')
            ->orderByDesc('lead_scores.score')
            ->limit(10)
            ->get()
            ->map(fn($a) => [
                'id'               => $a->id,
                'name'             => $a->name,
                'state'            => $a->state,
                'score'            => $a->score,
                'approach_now'     => (bool) $a->approach_now,
                'bond_amount'      => $a->bond_measures_max_bond_amount,
                'opportunity_stage'=> $a->opportunity_stage,
            ]);

        $recentScrapes = ScrapeRun::orderByDesc('created_at')->limit(5)->get();

        $bondValueByState = BondMeasure::selectRaw(
            'agencies.state, SUM(bond_measures.bond_amount) as total_bond_value, COUNT(bond_measures.id) as count'
        )
            ->join('agencies', 'agencies.id', '=', 'bond_measures.agency_id')
            ->groupBy('agencies.state')
            ->orderByDesc('total_bond_value')
            ->limit(10)
            ->get();

        $scoreDistribution = [
            ['range' => '0-25',   'count' => LeadScore::whereBetween('score', [0, 25])->count()],
            ['range' => '26-50',  'count' => LeadScore::whereBetween('score', [26, 50])->count()],
            ['range' => '51-75',  'count' => LeadScore::whereBetween('score', [51, 75])->count()],
            ['range' => '76-100', 'count' => LeadScore::whereBetween('score', [76, 100])->count()],
        ];

        return response()->json([
            'total_agencies'      => $totalAgencies,
            'total_bond_value'    => $totalBondValue,
            'agencies_with_bonds' => $agenciesWithBonds,
            'approach_now_count'  => $approachNowCount,
            'pipeline_by_stage'   => $pipelineByStage,
            'top_opportunities'   => $topOpportunities,
            'recent_scrapes'      => $recentScrapes,
            'bond_value_by_state' => $bondValueByState,
            'score_distribution'  => $scoreDistribution,
        ]);
    }
}
