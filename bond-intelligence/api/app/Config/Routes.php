<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */

$routes->setDefaultNamespace('App\Controllers');
$routes->setDefaultController('Home');
$routes->setDefaultMethod('index');
$routes->setTranslateURIDashes(false);
$routes->set404Override();
$routes->setAutoRoute(false);

// OPTIONS preflight for CORS
$routes->options('api/v1/(:any)', static function () {
    return response()->setStatusCode(204);
});

$routes->group('api/v1', ['filter' => 'cors', 'namespace' => 'App\Controllers\Api'], static function ($routes) {

    // Dashboard
    $routes->get('dashboard/summary', 'DashboardController::summary');

    // Agencies
    $routes->get('agencies',        'AgencyController::index');
    $routes->get('agencies/map',    'AgencyController::mapData');
    $routes->get('agencies/stats',  'AgencyController::stats');
    $routes->get('agencies/(:num)', 'AgencyController::show/$1');
    $routes->get('agencies/(:num)/contacts',    'AgencyController::contacts/$1');
    $routes->get('agencies/(:num)/consultants', 'AgencyController::consultants/$1');
    $routes->get('agencies/(:num)/procurement', 'AgencyController::procurement/$1');
    $routes->get('agencies/(:num)/bond-measures', 'AgencyController::bondMeasures/$1');

    // Bond Measures
    $routes->get('bond-measures',        'BondMeasureController::index');
    $routes->get('bond-measures/stats',  'BondMeasureController::stats');
    $routes->get('bond-measures/(:num)', 'BondMeasureController::show/$1');

    // Leads / Scoring
    $routes->get('leads',                   'LeadController::index');
    $routes->get('leads/top',               'LeadController::topLeads');
    $routes->post('leads/(:num)/score',     'LeadController::score/$1');

    // Procurement
    $routes->get('procurement',        'ProcurementController::index');
    $routes->get('procurement/active', 'ProcurementController::active');
    $routes->get('procurement/(:num)', 'ProcurementController::show/$1');

    // Scrape Runs
    $routes->get('scrape-runs',        'ScrapeRunController::index');
    $routes->get('scrape-runs/(:num)', 'ScrapeRunController::show/$1');
    $routes->post('scrape-runs/trigger', 'ScrapeRunController::trigger');

    // Export
    $routes->get('export/csv', 'ExportController::csv');
    $routes->get('export/crm', 'ExportController::crm');
});
