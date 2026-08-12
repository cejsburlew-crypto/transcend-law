<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\AgencyModel;

class AgencyController extends BaseController
{
    private AgencyModel $model;

    public function __construct()
    {
        $this->model = new AgencyModel();
    }

    public function index()
    {
        $filters = [
            'state'             => $this->request->getGet('state'),
            'agency_type'       => $this->request->getGet('agency_type'),
            'opportunity_stage' => $this->request->getGet('opportunity_stage'),
            'approach_now'      => $this->request->getGet('approach_now'),
            'min_score'         => $this->request->getGet('min_score'),
            'max_score'         => $this->request->getGet('max_score'),
            'min_bond_amount'   => $this->request->getGet('min_bond_amount'),
            'search'            => $this->request->getGet('search'),
            'sort'              => $this->request->getGet('sort'),
            'direction'         => $this->request->getGet('direction'),
        ];

        $page    = $this->getPage();
        $perPage = $this->getPerPage();
        $result  = $this->model->getWithScore($filters, $page, $perPage);

        $pagination = [
            'current_page' => $page,
            'per_page'     => $perPage,
            'total'        => $result['total'],
            'last_page'    => (int) ceil($result['total'] / $perPage),
        ];

        return api_success($result['data'], '', 200, $pagination);
    }

    public function show(int $id)
    {
        $agency = $this->model->getWithRelations($id);
        if (!$agency) {
            return api_error('Agency not found', 404);
        }
        return api_success($agency);
    }

    public function mapData()
    {
        return api_success($this->model->getMapData());
    }

    public function stats()
    {
        return api_success($this->model->getStats());
    }

    public function contacts(int $id)
    {
        $contacts = model('ContactModel')->where('agency_id', $id)->findAll();
        return api_success($contacts);
    }

    public function consultants(int $id)
    {
        $consultants = model('ConsultantModel')->where('agency_id', $id)->findAll();
        return api_success($consultants);
    }

    public function procurement(int $id)
    {
        $events = model('ProcurementEventModel')->where('agency_id', $id)->orderBy('issue_date','DESC')->findAll();
        return api_success($events);
    }

    public function bondMeasures(int $id)
    {
        $measures = model('BondMeasureModel')->where('agency_id', $id)->orderBy('election_date','DESC')->findAll();
        foreach ($measures as &$m) {
            $m['project_categories'] = json_decode($m['project_categories'] ?? '[]', true) ?: [];
        }
        return api_success($measures);
    }
}
