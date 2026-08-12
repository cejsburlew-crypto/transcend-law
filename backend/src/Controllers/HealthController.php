<?php

declare(strict_types=1);

namespace Transcend\Ssp\Controllers;

class HealthController
{
    public function index(): void
    {
        echo json_encode([
            'status' => 'ok',
            'service' => 'transcend-ssp-api',
            'time' => gmdate('c'),
        ]);
    }
}
