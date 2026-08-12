<?php

namespace App\Controllers;

use CodeIgniter\Controller;
use CodeIgniter\HTTP\CLIRequest;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Psr\Log\LoggerInterface;

abstract class BaseController extends Controller
{
    protected $helpers = ['ApiResponse'];

    public function initController(RequestInterface $request, ResponseInterface $response, LoggerInterface $logger): void
    {
        parent::initController($request, $response, $logger);
    }

    protected function getPage(): int
    {
        return (int) ($this->request->getGet('page') ?? 1);
    }

    protected function getPerPage(): int
    {
        $pp = (int) ($this->request->getGet('per_page') ?? 25);
        return min(max($pp, 5), 100);
    }

    protected function jsonBody(): array
    {
        return (array) ($this->request->getJSON(true) ?? []);
    }
}
