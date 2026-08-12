<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use App\Models\ProcurementEventModel;

class ProcurementController extends BaseController
{
    public function index()
    {
        $filters = [
            'state'        => $this->request->getGet('state'),
            'service_type' => $this->request->getGet('service_type'),
            'event_type'   => $this->request->getGet('event_type'),
            'due_soon'     => $this->request->getGet('due_soon'),
        ];
        return api_success((new ProcurementEventModel())->getFiltered($filters));
    }

    public function active()
    {
        return api_success((new ProcurementEventModel())->getActive());
    }

    public function show(int $id)
    {
        $event = (new ProcurementEventModel())->find($id);
        if (!$event) return api_error('Procurement event not found', 404);
        return api_success($event);
    }
}
