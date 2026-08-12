<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use Transcend\Ssp\Database;
use Transcend\Ssp\Router;
use Transcend\Ssp\Controllers\HealthController;
use Transcend\Ssp\Controllers\LookupController;
use Transcend\Ssp\Controllers\SspController;
use Transcend\Ssp\Controllers\UploadController;

$envPath = dirname(__DIR__) . '/.env';
if (is_file($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($value);
    }
}

$corsOrigin = $_ENV['CORS_ORIGIN'] ?? 'http://localhost:4200';
header('Access-Control-Allow-Origin: ' . $corsOrigin);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dbPath = $_ENV['DB_PATH'] ?? dirname(__DIR__) . '/data/ssp.sqlite';
$db = new Database($dbPath);
$db->migrate();

$router = new Router();
$router->get('/api/health', [HealthController::class, 'index']);
$router->post('/api/lookup-address', [LookupController::class, 'address']);
$router->post('/api/lookup-parcel', [LookupController::class, 'parcel']);
$router->post('/api/lookup-dsa-project', [LookupController::class, 'dsaProject']);
$router->get('/api/ssp', [SspController::class, 'index']);
$router->get('/api/ssp/{id}', [SspController::class, 'show']);
$router->get('/api/ssp/{id}/export-pdf', [SspController::class, 'exportPdf']);
$router->get('/api/ssp/{id}/export-package', [SspController::class, 'exportPackage']);
$router->post('/api/ssp', [SspController::class, 'store']);
$router->put('/api/ssp/{id}', [SspController::class, 'update']);
$router->delete('/api/ssp/{id}', [SspController::class, 'destroy']);
$router->get('/api/ssp/{id}/attachments', [UploadController::class, 'index']);
$router->post('/api/ssp/{id}/attachments', [UploadController::class, 'store']);

$router->dispatch($_SERVER['REQUEST_METHOD'], parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
