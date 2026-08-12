<?php

declare(strict_types=1);

namespace Transcend\Ssp\Controllers;

use Transcend\Ssp\Database;
use Transcend\Ssp\Models\SiteSafetyPlan;
use Transcend\Ssp\Services\PdfExportService;
use Transcend\Ssp\Services\PackageExportService;

class SspController
{
    private SiteSafetyPlan $model;

    public function __construct()
    {
        $dbPath = $_ENV['DB_PATH'] ?? dirname(__DIR__, 2) . '/data/ssp.sqlite';
        $this->model = new SiteSafetyPlan(new Database($dbPath));
    }

    public function index(): void
    {
        echo json_encode(['data' => $this->model->all()]);
    }

    /** @param array{id: string} $params */
    public function show(array $params): void
    {
        $plan = $this->model->find((int) $params['id']);
        if ($plan === null) {
            http_response_code(404);
            echo json_encode(['error' => 'Site Safety Plan not found']);
            return;
        }

        echo json_encode(['data' => $plan]);
    }

    public function store(): void
    {
        $payload = $this->jsonBody();
        if (empty($payload['project_name'])) {
            $payload['project_name'] = $payload['site_name'] ?? 'Site Safety Plan';
        }

        $plan = $this->model->create($payload);
        http_response_code(201);
        echo json_encode(['data' => $plan]);
    }

    /** @param array{id: string} $params */
    public function update(array $params): void
    {
        $payload = $this->jsonBody();
        $plan = $this->model->update((int) $params['id'], $payload);
        if ($plan === null) {
            http_response_code(404);
            echo json_encode(['error' => 'Site Safety Plan not found']);
            return;
        }

        echo json_encode(['data' => $plan]);
    }

    /** @param array{id: string} $params */
    public function exportPdf(array $params): void
    {
        $plan = $this->model->find((int) $params['id']);
        if ($plan === null) {
            http_response_code(404);
            echo json_encode(['error' => 'Site Safety Plan not found']);
            return;
        }

        header_remove('Content-Type');
        (new PdfExportService())->exportToHttpResponse($plan);
    }

    /** @param array{id: string} $params */
    public function exportPackage(array $params): void
    {
        $planId = (int) $params['id'];
        $plan = $this->model->find($planId);
        if ($plan === null) {
            http_response_code(404);
            echo json_encode(['error' => 'Site Safety Plan not found']);
            return;
        }

        $dbPath = $_ENV['DB_PATH'] ?? dirname(__DIR__, 2) . '/data/ssp.sqlite';
        $zipPath = (new PackageExportService(new Database($dbPath)))->buildZip($plan, $planId);
        if ($zipPath === null || !is_file($zipPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Could not build submission package']);
            return;
        }

        $app = trim((string) ($plan['transcend_pm_project_id'] ?? 'ssp'));
        $fileName = $app . '_submission_package.zip';

        header_remove('Content-Type');
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Content-Length: ' . filesize($zipPath));
        readfile($zipPath);
        unlink($zipPath);
    }

    /** @param array{id: string} $params */
    public function destroy(array $params): void
    {
        if (!$this->model->delete((int) $params['id'])) {
            http_response_code(404);
            echo json_encode(['error' => 'Site Safety Plan not found']);
            return;
        }

        http_response_code(204);
    }

    /** @return array<string, mixed> */
    private function jsonBody(): array
    {
        $raw = file_get_contents('php://input') ?: '{}';
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}
