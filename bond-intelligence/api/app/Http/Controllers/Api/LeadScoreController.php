<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LeadScoreResource;
use App\Models\Agency;
use App\Models\LeadScore;
use App\Services\LeadScoringService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LeadScoreController extends Controller
{
    public function __construct(private readonly LeadScoringService $scoringService) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = LeadScore::query()->with('agency')->orderByDesc('score');

        if ($request->filled('opportunity_stage')) {
            $query->where('opportunity_stage', $request->input('opportunity_stage'));
        }

        if ($request->boolean('approach_now')) {
            $query->where('approach_now', true);
        }

        if ($request->filled('min_score')) {
            $query->where('score', '>=', (int) $request->input('min_score'));
        }

        if ($request->filled('state')) {
            $query->whereHas('agency', function ($q) use ($request) {
                $q->where('state', strtoupper($request->string('state')));
            });
        }

        $scores = $query->paginate(25);

        return LeadScoreResource::collection($scores);
    }

    public function topLeads(): AnonymousResourceCollection
    {
        $scores = LeadScore::with('agency')
            ->where('approach_now', true)
            ->where('score', '>=', 70)
            ->orderByDesc('score')
            ->limit(50)
            ->get();

        return LeadScoreResource::collection($scores);
    }

    public function recalculate(Request $request, int $agencyId): LeadScoreResource
    {
        $agency = Agency::findOrFail($agencyId);
        $leadScore = $this->scoringService->scoreAgency($agency);

        return new LeadScoreResource($leadScore);
    }
}
