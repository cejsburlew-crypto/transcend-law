<?php

use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\BondMeasureController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\LeadScoreController;
use App\Http\Controllers\Api\ScrapeRunController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->middleware('api')->group(function () {

    // Dashboard
    Route::get('dashboard', [DashboardController::class, 'index']);

    // Agencies
    Route::get('agencies/stats',    [AgencyController::class, 'stats']);
    Route::get('agencies/map-data', [AgencyController::class, 'mapData']);
    Route::get('agencies',          [AgencyController::class, 'index']);
    Route::get('agencies/{id}',     [AgencyController::class, 'show']);

    // Bond Measures
    Route::get('bond-measures/stats', [BondMeasureController::class, 'stats']);
    Route::get('bond-measures',       [BondMeasureController::class, 'index']);
    Route::get('bond-measures/{id}',  [BondMeasureController::class, 'show']);

    // Lead Scores
    Route::get('lead-scores/top-leads',              [LeadScoreController::class, 'topLeads']);
    Route::get('lead-scores',                        [LeadScoreController::class, 'index']);
    Route::post('lead-scores/{agencyId}/recalculate',[LeadScoreController::class, 'recalculate']);

    // Export
    Route::get('export/csv', [ExportController::class, 'exportCsv']);
    Route::get('export/crm', [ExportController::class, 'exportCrm']);

    // Scrape Runs
    Route::post('scrape-runs/trigger', [ScrapeRunController::class, 'trigger']);
    Route::get('scrape-runs',          [ScrapeRunController::class, 'index']);
    Route::get('scrape-runs/{id}',     [ScrapeRunController::class, 'show']);
});
