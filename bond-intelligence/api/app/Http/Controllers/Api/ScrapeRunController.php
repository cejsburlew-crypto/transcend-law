<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ScraperJob;
use App\Models\ScrapeRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScrapeRunController extends Controller
{
    public function index(): JsonResponse
    {
        $runs = ScrapeRun::orderByDesc('created_at')->paginate(25);

        return response()->json($runs);
    }

    public function show(int $id): JsonResponse
    {
        $run = ScrapeRun::findOrFail($id);

        return response()->json($run);
    }

    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scraper_name' => ['required', 'string', 'max:100'],
            'state'        => ['nullable', 'string', 'size:2'],
        ]);

        $run = ScrapeRun::create([
            'scraper_name' => $validated['scraper_name'],
            'state'        => isset($validated['state']) ? strtoupper($validated['state']) : null,
            'started_at'   => now(),
            'status'       => 'running',
        ]);

        ScraperJob::dispatch($run);

        return response()->json($run, 201);
    }
}
