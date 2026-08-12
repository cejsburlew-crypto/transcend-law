<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\LeadScoreModel;
use App\Services\LeadScoringService;

class LeadController extends BaseController
{
    public function index()
    {
        $model   = new LeadScoreModel();
        $filters = [
            'state'             => $this->request->getGet('state'),
            'agency_type'       => $this->request->getGet('agency_type'),
            'opportunity_stage' => $this->request->getGet('opportunity_stage'),
            'approach_now'      => $this->request->getGet('approach_now'),
            'min_score'         => $this->request->getGet('min_score'),
            'search'            => $this->request->getGet('search'),
            'sort'              => $this->request->getGet('sort') ?? 'score',
            'direction'         => $this->request->getGet('direction') ?? 'desc',
        ];
        $result = $model->getLeads($filters, $this->getPage(), $this->getPerPage());
        $pagination = [
            'current_page' => $this->getPage(),
            'per_page'     => $this->getPerPage(),
            'total'        => $result['total'],
            'last_page'    => (int) ceil($result['total'] / $this->getPerPage()),
        ];
        return api_success($result['data'], '', 200, $pagination);
    }

    public function topLeads()
    {
        return api_success((new LeadScoreModel())->getTopLeads());
    }

    public function score(int $agencyId)
    {
        $scorer = new LeadScoringService();
        $result = $scorer->scoreAgency($agencyId);
        if ($result === null) return api_error('Agency not found', 404);
        return api_success($result, 'Agency scored successfully');
    }
}
