<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\BondMeasureModel;

class BondMeasureController extends BaseController
{
    public function index()
    {
        $model   = new BondMeasureModel();
        $filters = [
            'state'         => $this->request->getGet('state'),
            'result'        => $this->request->getGet('result'),
            'min_amount'    => $this->request->getGet('min_amount'),
            'election_year' => $this->request->getGet('election_year'),
            'agency_type'   => $this->request->getGet('agency_type'),
        ];
        $result  = $model->getFiltered($filters, $this->getPage(), $this->getPerPage());
        $pagination = [
            'current_page' => $this->getPage(),
            'per_page'     => $this->getPerPage(),
            'total'        => $result['total'],
            'last_page'    => (int) ceil($result['total'] / $this->getPerPage()),
        ];
        return api_success($result['data'], '', 200, $pagination);
    }

    public function show(int $id)
    {
        $model   = new BondMeasureModel();
        $measure = $model->find($id);
        if (!$measure) return api_error('Bond measure not found', 404);
        $measure['project_categories'] = json_decode($measure['project_categories'] ?? '[]', true) ?: [];
        return api_success($measure);
    }

    public function stats()
    {
        return api_success((new BondMeasureModel())->getStats());
    }
}
