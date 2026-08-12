<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AgencyResource;
use App\Models\Agency;
use App\Models\LeadScore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AgencyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Agency::query()->with('leadScore');

        if ($request->filled('state')) {
            $query->where('state', strtoupper($request->string('state')));
        }

        if ($request->filled('agency_type')) {
            $query->where('agency_type', $request->string('agency_type'));
        }

        if ($request->filled('min_score') || $request->filled('max_score') || $request->filled('opportunity_stage') || $request->filled('approach_now')) {
            $query->whereHas('leadScore', function ($q) use ($request) {
                if ($request->filled('min_score')) {
                    $q->where('score', '>=', (int) $request->input('min_score'));
                }
                if ($request->filled('max_score')) {
                    $q->where('score', '<=', (int) $request->input('max_score'));
                }
                if ($request->filled('opportunity_stage')) {
                    $q->where('opportunity_stage', $request->input('opportunity_stage'));
                }
                if ($request->boolean('approach_now')) {
                    $q->where('approach_now', true);
                }
            });
        }

        if ($request->filled('min_bond_amount')) {
            $query->whereHas('bondMeasures', function ($q) use ($request) {
                $q->where('bond_amount', '>=', (int) $request->input('min_bond_amount'));
            });
        }

        if ($request->filled('search')) {
            $search = '%' . $request->string('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', $search)
                  ->orWhere('city', 'LIKE', $search)
                  ->orWhere('county', 'LIKE', $search);
            });
        }

        $agencies = $query->paginate(25);

        return AgencyResource::collection($agencies);
    }

    public function show(int $id): AgencyResource
    {
        $agency = Agency::with([
            'bondMeasures',
            'contacts',
            'consultants',
            'procurementEvents',
            'leadScore',
            'outreachActions',
        ])->findOrFail($id);

        return new AgencyResource($agency);
    }

    public function stats(): JsonResponse
    {
        $byState = Agency::selectRaw('state, COUNT(*) as count')
            ->groupBy('state')
            ->orderByDesc('count')
            ->get();

        $byType = Agency::selectRaw('agency_type, COUNT(*) as count')
            ->groupBy('agency_type')
            ->orderByDesc('count')
            ->get();

        $byStage = LeadScore::selectRaw('opportunity_stage, COUNT(*) as count')
            ->whereNotNull('opportunity_stage')
            ->groupBy('opportunity_stage')
            ->orderByDesc('count')
            ->get();

        return response()->json([
            'by_state'            => $byState,
            'by_agency_type'      => $byType,
            'by_opportunity_stage'=> $byStage,
            'total_agencies'      => Agency::count(),
        ]);
    }

    public function mapData(): JsonResponse
    {
        $data = Agency::select([
                'agencies.id',
                'agencies.name',
                'agencies.city',
                'agencies.state',
                'agencies.agency_type',
            ])
            ->with('leadScore:id,agency_id,score,approach_now')
            ->withMax('bondMeasures', 'bond_amount')
            ->get()
            ->map(function ($agency) {
                return [
                    'id'          => $agency->id,
                    'name'        => $agency->name,
                    'city'        => $agency->city,
                    'state'       => $agency->state,
                    'agency_type' => $agency->agency_type,
                    'score'       => $agency->leadScore?->score ?? 0,
                    'approach_now'=> $agency->leadScore?->approach_now ?? false,
                    'bond_amount' => $agency->bond_measures_max_bond_amount,
                ];
            });

        return response()->json(['data' => $data]);
    }
}
