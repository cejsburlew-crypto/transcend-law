<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\ScrapeRunModel;

class ScrapeRunController extends BaseController
{
    public function index()
    {
        return api_success((new ScrapeRunModel())->getRecent(50));
    }

    public function show(int $id)
    {
        $run = (new ScrapeRunModel())->find($id);
        if (!$run) return api_error('Scrape run not found', 404);
        $run['errors'] = json_decode($run['errors'] ?? '[]', true) ?: [];
        return api_success($run);
    }

    public function trigger()
    {
        $body = $this->jsonBody();
        $scraper = $body['scraper'] ?? '';
        $state   = $body['state'] ?? null;

        $valid = ['cdiac', 'tx_brb', 'ballotpedia', 'procurement'];
        if (!in_array($scraper, $valid)) {
            return api_error('Invalid scraper. Valid: ' . implode(', ', $valid), 400);
        }

        $model = new ScrapeRunModel();
        $id    = $model->insert([
            'scraper_name' => $scraper,
            'state'        => $state,
            'started_at'   => date('Y-m-d H:i:s'),
            'status'       => 'running',
        ]);

        return api_success([
            'id'           => $id,
            'scraper_name' => $scraper,
            'state'        => $state,
            'status'       => 'running',
            'started_at'   => date('Y-m-d H:i:s'),
            'instruction'  => 'Run: python scraper/main.py scrape --source ' . $scraper . ($state ? ' --state ' . $state : ''),
        ], 'Scrape run queued', 201);
    }
}
