<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BondMeasureResource;
use App\Models\BondMeasure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class BondMeasureController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = BondMeasure::query()->with('agency');

        if ($request->filled('state')) {
            $query->whereHas('agency', function ($q) use ($request) {
                $q->where('state', strtoupper($request->string('state')));
            });
        }

        if ($request->filled('result')) {
            $query->where('result', $request->input('result'));
        }

        if ($request->filled('min_amount')) {
            $query->where('bond_amount', '>=', (int) $request->input('min_amount'));
        }

        if ($request->filled('max_amount')) {
            $query->where('bond_amount', '<=', (int) $request->input('max_amount'));
        }

        if ($request->filled('election_year')) {
            $query->whereYear('election_date', (int) $request->input('election_year'));
        }

        $measures = $query->latest()->paginate(25);

        return BondMeasureResource::collection($measures);
    }

    public function show(int $id): BondMeasureResource
    {
        $measure = BondMeasure::with(['agency', 'procurementEvents'])->findOrFail($id);

        return new BondMeasureResource($measure);
    }

    public function stats(): JsonResponse
    {
        $totalValue = BondMeasure::where('result', 'passed')->sum('bond_amount');

        $byResult = BondMeasure::selectRaw('result, COUNT(*) as count, SUM(bond_amount) as total_bond_value')
            ->groupBy('result')
            ->get();

        $byState = BondMeasure::selectRaw('agencies.state, COUNT(bond_measures.id) as count, SUM(bond_measures.bond_amount) as total_bond_value')
            ->join('agencies', 'agencies.id', '=', 'bond_measures.agency_id')
            ->groupBy('agencies.state')
            ->orderByDesc('total_bond_value')
            ->limit(20)
            ->get();

        $avgVotePct = BondMeasure::selectRaw('result, AVG(vote_pct) as avg_vote_pct')
            ->whereNotNull('vote_pct')
            ->groupBy('result')
            ->get();

        return response()->json([
            'total_bond_value' => $totalValue,
            'by_result'        => $byResult,
            'by_state'         => $byState,
            'avg_vote_pct'     => $avgVotePct,
        ]);
    }
}
