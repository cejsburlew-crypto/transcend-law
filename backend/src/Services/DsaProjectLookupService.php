<?php

declare(strict_types=1);

namespace Transcend\Ssp\Services;

class DsaProjectLookupService
{
    /** @var array<string, array<string, mixed>>|null */
    private ?array $catalog = null;

    /** @return array<string, mixed> */
    public function lookup(string $dsaApplicationNumber): array
    {
        $dsaApplicationNumber = trim($dsaApplicationNumber);
        if ($dsaApplicationNumber === '') {
            return ['error' => 'DSA A# is required'];
        }

        if (!preg_match('/^\d{2}-\d{6}$/', $dsaApplicationNumber)) {
            return ['error' => 'DSA A# must match format xx-xxxxxx'];
        }

        $catalog = $this->loadCatalog();
        $project = $catalog[$dsaApplicationNumber] ?? null;
        if ($project === null) {
            return [
                'error' => 'No project found for that DSA A#. Enter project details manually or connect Transcend PM.',
                'meta' => ['source' => 'not_found'],
            ];
        }

        return [
            'data' => [
                'transcend_pm_project_id' => $dsaApplicationNumber,
                'transcend_pm_org_id' => (string) ($project['transcend_pm_org_id'] ?? ''),
                'project_name' => (string) ($project['project_name'] ?? ''),
                'site_name' => (string) ($project['site_name'] ?? ''),
                'scope_of_work' => (string) ($project['scope_of_work'] ?? ''),
                'property_owner' => (string) ($project['property_owner'] ?? ''),
                'owner_name' => (string) ($project['owner_name'] ?? ''),
                'architect_firm' => (string) ($project['architect_firm'] ?? ''),
                'project_address' => (string) ($project['project_address'] ?? ''),
            ],
            'contractors' => $project['contractors'] ?? [],
            'meta' => ['source' => 'local_catalog'],
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function loadCatalog(): array
    {
        if ($this->catalog !== null) {
            return $this->catalog;
        }

        $path = dirname(__DIR__, 2) . '/data/dsa-projects.json';
        if (!is_file($path)) {
            $this->catalog = [];
            return $this->catalog;
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        $this->catalog = is_array($decoded) ? $decoded : [];

        return $this->catalog;
    }
}
