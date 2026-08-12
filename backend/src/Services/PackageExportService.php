<?php

declare(strict_types=1);

namespace Transcend\Ssp\Services;

use Transcend\Ssp\Database;
use ZipArchive;

class PackageExportService
{
    public function __construct(private Database $db)
    {
    }

    /** @param array<string, mixed> $plan */
    public function buildZip(array $plan, int $planId): ?string
    {
        if (!class_exists(ZipArchive::class)) {
            return null;
        }

        $tmp = tempnam(sys_get_temp_dir(), 'ssp_pkg_');
        if ($tmp === false) {
            return null;
        }

        unlink($tmp);
        $zipPath = $tmp . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE) !== true) {
            return null;
        }

        $pdfService = new PdfExportService();
        $pdfName = $pdfService->fileName($plan);
        $zip->addFromString($pdfName, $pdfService->export($plan));

        $manifest = $this->buildManifest($plan, $pdfName, $planId);
        $zip->addFromString('README-package.txt', $manifest);

        $stmt = $this->db->pdo()->prepare(
            'SELECT original_name, stored_name FROM ssp_attachments WHERE ssp_id = :id ORDER BY created_at'
        );
        $stmt->execute(['id' => $planId]);
        $uploadDir = dirname(__DIR__, 2) . '/data/uploads/' . $planId;

        foreach ($stmt->fetchAll() as $row) {
            $path = $uploadDir . '/' . ($row['stored_name'] ?? '');
            if (is_file($path)) {
                $zip->addFile($path, 'LFA-approved/' . ($row['original_name'] ?? basename($path)));
            }
        }

        $zip->close();

        return $zipPath;
    }

    /** @param array<string, mixed> $plan */
    private function buildManifest(array $plan, string $pdfName, int $planId): string
    {
        $dsa = (string) ($plan['transcend_pm_project_id'] ?? '');
        $site = (string) ($plan['site_name'] ?? $plan['project_name'] ?? '');
        $date = (string) ($plan['submission_date'] ?? date('Y-m-d'));

        $stmt = $this->db->pdo()->prepare('SELECT COUNT(*) FROM ssp_attachments WHERE ssp_id = :id');
        $stmt->execute(['id' => $planId]);
        $attachmentCount = (int) $stmt->fetchColumn();

        return <<<TXT
Transcend SSP — DSA submission package
=====================================
DSA A#: {$dsa}
Site: {$site}
Generated: {$date}

Contents:
- {$pdfName} — Site plan sheet + CFC §3303.1.1 SSP components
- LFA-approved/ — {$attachmentCount} fire department approved sheet(s) uploaded in Step 5

Per BU 24-05, also attach contractor IIPP and any LFA-coordinated fire access drawings.
Reference example: docs/reference/03-125694 Longley Way Safety Plan.pdf
TXT;
    }
}
