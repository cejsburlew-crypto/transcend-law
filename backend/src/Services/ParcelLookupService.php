<?php

declare(strict_types=1);

namespace Transcend\Ssp\Services;

class ParcelLookupService
{
    private const USER_AGENT = 'TranscendSSP/1.0 (Site Safety Plan add-on)';

    /** @return array<string, mixed> */
    public function lookup(float $lat, float $lng, string $apn = '', string $county = ''): array
    {
        if ($apn !== '') {
            $byApn = $this->lookupByApn($apn, $county);
            if ($byApn !== null) {
                return $byApn;
            }
        }

        return $this->lookupByPoint($lat, $lng, $county);
    }

    /** @return array<string, mixed>|null */
    private function lookupByApn(string $apn, string $county): ?array
    {
        if (stripos($county, 'Los Angeles') !== false || $county === '') {
            return $this->lookupLaCountyByApn($apn);
        }

        return null;
    }

    /** @return array<string, mixed>|null */
    private function lookupLaCountyByApn(string $apn): ?array
    {
        $apn = str_replace("'", "''", trim($apn));
        $params = http_build_query([
            'where' => "APN='$apn'",
            'outFields' => 'APN,AIN,SitusFullAddress,UseDescription,AgencyName',
            'returnGeometry' => 'true',
            'outSR' => '4326',
            'f' => 'geojson',
        ]);

        $url = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query?' . $params;
        $response = $this->httpGet($url);
        if ($response === null) {
            return null;
        }

        $data = json_decode($response, true);
        $feature = $data['features'][0] ?? null;
        if (!is_array($feature)) {
            return null;
        }

        $props = $feature['properties'] ?? [];

        return [
            'apn' => (string) ($props['APN'] ?? $apn),
            'situs_address' => (string) ($props['SitusFullAddress'] ?? ''),
            'use_description' => (string) ($props['UseDescription'] ?? ''),
            'agency_name' => (string) ($props['AgencyName'] ?? ''),
            'geometry' => $feature['geometry'] ?? null,
        ];
    }

    /** @return array<string, mixed> */
    private function lookupByPoint(float $lat, float $lng, string $county): array
    {
        $delta = 0.002;
        $params = http_build_query([
            'geometry' => "$lng,$lat",
            'geometryType' => 'esriGeometryPoint',
            'sr' => '4326',
            'layers' => 'all',
            'tolerance' => '5',
            'mapExtent' => implode(',', [$lng - $delta, $lat - $delta, $lng + $delta, $lat + $delta]),
            'imageDisplay' => '600,550,96',
            'returnGeometry' => 'true',
            'f' => 'json',
        ]);

        $url = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/identify?' . $params;
        $response = $this->httpGet($url);
        if ($response === null) {
            return ['apn' => '', 'situs_address' => '', 'geometry' => null];
        }

        $data = json_decode($response, true);
        $results = $data['results'] ?? [];
        if (!is_array($results) || $results === []) {
            return ['apn' => '', 'situs_address' => '', 'geometry' => null];
        }

        $best = $results[0];
        $attrs = $best['attributes'] ?? [];
        $geometry = $this->esriGeometryToGeoJson($best['geometry'] ?? null);

        return [
            'apn' => (string) ($attrs['APN'] ?? ''),
            'situs_address' => (string) ($attrs['SitusFullAddress'] ?? ''),
            'use_description' => (string) ($attrs['UseDescription'] ?? ''),
            'agency_name' => (string) ($attrs['AgencyName'] ?? ''),
            'geometry' => $geometry,
        ];
    }

    /** @param array<string, mixed>|null $geometry */
    private function esriGeometryToGeoJson(?array $geometry): ?array
    {
        if ($geometry === null || !isset($geometry['rings'][0])) {
            return null;
        }

        return [
            'type' => 'Polygon',
            'coordinates' => $geometry['rings'],
        ];
    }

    private function httpGet(string $url): ?string
    {
        if (!function_exists('curl_init')) {
            return null;
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => ['User-Agent: ' . self::USER_AGENT],
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return ($body !== false && $code >= 200 && $code < 300) ? $body : null;
    }
}
