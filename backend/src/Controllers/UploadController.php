<?php

declare(strict_types=1);

namespace Transcend\Ssp\Controllers;

use Transcend\Ssp\Database;
use Transcend\Ssp\Models\SiteSafetyPlan;

class UploadController
{
    /** @param array{id: string} $params */
    public function store(array $params): void
    {
        $planId = (int) $params['id'];
        $dbPath = $_ENV['DB_PATH'] ?? dirname(__DIR__, 2) . '/data/ssp.sqlite';
        $db = new Database($dbPath);
        $model = new SiteSafetyPlan($db);

        if ($model->find($planId) === null) {
            http_response_code(404);
            echo json_encode(['error' => 'Site Safety Plan not found']);
            return;
        }

        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            http_response_code(422);
            echo json_encode(['error' => 'No file uploaded']);
            return;
        }

        $file = $_FILES['file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            http_response_code(422);
            echo json_encode(['error' => 'Upload failed']);
            return;
        }

        $originalName = basename((string) ($file['name'] ?? 'upload.pdf'));
        $category = trim((string) ($_POST['category'] ?? 'fire_dept_approved'));
        $uploadDir = dirname(__DIR__, 2) . '/data/uploads/' . $planId;
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
            http_response_code(500);
            echo json_encode(['error' => 'Could not create upload directory']);
            return;
        }

        $safeName = preg_replace('/[^a-zA-Z0-9._-]+/', '_', $originalName) ?: 'upload.pdf';
        $storedName = date('Ymd_His') . '_' . $safeName;
        $targetPath = $uploadDir . '/' . $storedName;

        if (!move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Could not save uploaded file']);
            return;
        }

        $stmt = $db->pdo()->prepare(
            'INSERT INTO ssp_attachments (ssp_id, category, original_name, stored_name, mime_type, size_bytes)
             VALUES (:ssp_id, :category, :original_name, :stored_name, :mime_type, :size_bytes)'
        );
        $stmt->execute([
            'ssp_id' => $planId,
            'category' => $category,
            'original_name' => $originalName,
            'stored_name' => $storedName,
            'mime_type' => (string) ($file['type'] ?? 'application/octet-stream'),
            'size_bytes' => (int) ($file['size'] ?? 0),
        ]);

        http_response_code(201);
        echo json_encode([
            'data' => [
                'id' => (int) $db->pdo()->lastInsertId(),
                'category' => $category,
                'original_name' => $originalName,
                'stored_name' => $storedName,
            ],
        ]);
    }

    /** @param array{id: string} $params */
    public function index(array $params): void
    {
        $planId = (int) $params['id'];
        $dbPath = $_ENV['DB_PATH'] ?? dirname(__DIR__, 2) . '/data/ssp.sqlite';
        $db = new Database($dbPath);

        $stmt = $db->pdo()->prepare(
            'SELECT id, category, original_name, stored_name, mime_type, size_bytes, created_at
             FROM ssp_attachments WHERE ssp_id = :ssp_id ORDER BY created_at DESC'
        );
        $stmt->execute(['ssp_id' => $planId]);
        echo json_encode(['data' => $stmt->fetchAll()]);
    }
}
