<?php

declare(strict_types=1);

namespace Transcend\Ssp\Controllers;

use Transcend\Ssp\Services\AddressLookupService;
use Transcend\Ssp\Services\DsaProjectLookupService;
use Transcend\Ssp\Services\ParcelLookupService;

class LookupController
{
    public function address(): void
    {
        $raw = file_get_contents('php://input') ?: '{}';
        $payload = json_decode($raw, true);
        $address = is_array($payload) ? trim((string) ($payload['address'] ?? '')) : '';

        $service = new AddressLookupService();
        $result = $service->lookup($address);

        if (isset($result['error'])) {
            http_response_code(422);
            echo json_encode(['error' => $result['error']]);
            return;
        }

        echo json_encode($result);
    }

    public function parcel(): void
    {
        $raw = file_get_contents('php://input') ?: '{}';
        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            http_response_code(422);
            echo json_encode(['error' => 'Invalid request body']);
            return;
        }

        $lat = (float) ($payload['lat'] ?? 0);
        $lng = (float) ($payload['lng'] ?? 0);
        $apn = trim((string) ($payload['apn'] ?? ''));
        $county = trim((string) ($payload['county'] ?? ''));

        if ($lat === 0.0 && $lng === 0.0 && $apn === '') {
            http_response_code(422);
            echo json_encode(['error' => 'lat/lng or apn is required']);
            return;
        }

        $service = new ParcelLookupService();
        echo json_encode(['data' => $service->lookup($lat, $lng, $apn, $county)]);
    }

    public function dsaProject(): void
    {
        $raw = file_get_contents('php://input') ?: '{}';
        $payload = json_decode($raw, true);
        $dsaNumber = is_array($payload) ? trim((string) ($payload['dsa_application_number'] ?? '')) : '';

        $service = new DsaProjectLookupService();
        $result = $service->lookup($dsaNumber);

        if (isset($result['error']) && !isset($result['data'])) {
            http_response_code(422);
            echo json_encode(['error' => $result['error'], 'meta' => $result['meta'] ?? []]);
            return;
        }

        echo json_encode($result);
    }
}
