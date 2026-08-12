<?php

declare(strict_types=1);

namespace Transcend\Ssp\Services;

/**
 * Geocodes a California site address and looks up APN + nearby emergency services.
 */
class AddressLookupService
{
    private const USER_AGENT = 'TranscendSSP/1.0 (Site Safety Plan add-on)';
    private const EMERGENCY_DIAL = '911';

    /** @var array<string, array{police: string, fire: string}> */
    private const CITY_NON_EMERGENCY = [
        'arcadia' => ['police' => '(626) 574-5151', 'fire' => '(626) 574-5106'],
        'pasadena' => ['police' => '(626) 744-4241', 'fire' => '(626) 744-4655'],
        'monrovia' => ['police' => '(626) 256-8000', 'fire' => '(626) 256-8100'],
        'glendora' => ['police' => '(626) 914-8250', 'fire' => '(626) 914-8223'],
    ];

    /** @var array<string, string> */
    private const CITY_SCHOOL_DISTRICT = [
        'arcadia' => 'Arcadia Unified School District',
        'pasadena' => 'Pasadena Unified School District',
        'monrovia' => 'Monrovia Unified School District',
        'glendora' => 'Glendora Unified School District',
    ];

    /** @return array<string, mixed> */
    public function lookup(string $address): array
    {
        $address = trim($address);
        if ($address === '') {
            return ['error' => 'Address is required'];
        }

        $geo = $this->geocode($address);
        if ($geo === null) {
            return ['error' => 'Could not locate that address. Check spelling and try again.'];
        }

        $lat = $geo['lat'];
        $lng = $geo['lng'];
        $county = $geo['county'] ?? '';
        $city = $geo['city'] ?? '';

        $apn = $this->lookupApn($lat, $lng, $county);
        $hospital = $this->enrichPlace($this->nearestPlace($lat, $lng, 'hospital'), $city);
        $fire = $this->enrichPlace($this->nearestPlace($lat, $lng, 'fire_station'), $city);
        $police = $this->enrichPlace($this->nearestPolice($lat, $lng), $city);
        $postalCode = $geo['postal_code'] ?? '';
        $urgentCareRaw = $this->nearestUrgentCare($lat, $lng, $city, $postalCode);
        $urgentCare = $this->enrichPlace($urgentCareRaw, $city);
        $schoolSite = $this->nearestSchoolSite($lat, $lng);
        $siteName = $schoolSite['name'];
        $propertyOwner = $schoolSite['operator'] !== ''
            ? $schoolSite['operator']
            : $this->schoolDistrictForCity($city);

        if ($city !== '') {
            $cityFire = $this->searchMunicipalService($city, 'Fire Department', $lat, $lng);
            $cityPolice = $this->searchMunicipalService($city, 'Police Department', $lat, $lng);
            if ($cityFire['name'] !== '') {
                $fire = $cityFire;
            }
            if ($cityPolice['name'] !== '') {
                $police = $cityPolice;
            }
            $fire = $this->applyCityNonEmergencyFallback($fire, $city, 'fire');
            $police = $this->applyCityNonEmergencyFallback($police, $city, 'police');
        }

        return [
            'data' => [
                'project_address' => $geo['display_name'] ?? $address,
                'site_name' => $siteName,
                'apn' => $apn,
                'property_owner' => $propertyOwner,
                'owner_name' => $propertyOwner,
                'site_lat' => $lat,
                'site_lng' => $lng,
                'hospital_name' => $hospital['name'],
                'hospital_address' => $hospital['address'],
                'hospital_phone' => $hospital['phone'],
                'hospital_lat' => $hospital['lat'] ?? 0,
                'hospital_lng' => $hospital['lng'] ?? 0,
                'urgent_care_name' => $urgentCare['name'],
                'urgent_care_address' => $urgentCare['address'],
                'urgent_care_phone' => $urgentCare['phone'],
                'urgent_care_lat' => $urgentCareRaw['lat'] ?? 0,
                'urgent_care_lng' => $urgentCareRaw['lng'] ?? 0,
                'fire_department_name' => $fire['name'],
                'fire_department_address' => $fire['address'],
                'fire_department_phone_emergency' => self::EMERGENCY_DIAL,
                'fire_department_phone_non_emergency' => $fire['phone'],
                'fire_department_phone' => $fire['phone'],
                'fire_department_lat' => $fire['lat'] ?? 0,
                'fire_department_lng' => $fire['lng'] ?? 0,
                'police_department_name' => $police['name'],
                'police_department_address' => $police['address'],
                'police_department_phone_emergency' => self::EMERGENCY_DIAL,
                'police_department_phone_non_emergency' => $police['phone'],
                'police_department_phone' => $police['phone'],
                'police_department_lat' => $police['lat'] ?? 0,
                'police_department_lng' => $police['lng'] ?? 0,
            ],
            'meta' => [
                'lat' => $lat,
                'lng' => $lng,
                'county' => $county,
                'city' => $city,
                'apn_source' => $apn !== '' ? 'county_parcel_gis' : 'not_found',
            ],
        ];
    }

    /** @return array{lat: float, lng: float, display_name: string, county: string, city: string, postal_code: string, property_owner_hint: string}|null */
    private function geocode(string $address): ?array
    {
        $query = http_build_query([
            'q' => $address . ', California, USA',
            'format' => 'json',
            'limit' => 1,
            'addressdetails' => 1,
        ]);

        $url = 'https://nominatim.openstreetmap.org/search?' . $query;
        $response = $this->httpGet($url, ['Accept-Language: en-US']);
        if ($response === null) {
            return null;
        }

        $results = json_decode($response, true);
        if (!is_array($results) || $results === []) {
            return null;
        }

        $hit = $results[0];
        $addr = $hit['address'] ?? [];
        $county = (string) ($addr['county'] ?? '');
        $city = (string) ($addr['city'] ?? $addr['town'] ?? $addr['village'] ?? '');

        $postalCode = (string) ($addr['postcode'] ?? '');

        return [
            'lat' => (float) $hit['lat'],
            'lng' => (float) $hit['lon'],
            'display_name' => (string) ($hit['display_name'] ?? $address),
            'county' => $county,
            'city' => $city,
            'postal_code' => $postalCode,
            'property_owner_hint' => '',
        ];
    }

    /** @return array{name: string, address: string, phone: string} */
    private function searchMunicipalService(string $city, string $service, float $lat, float $lng): array
    {
        $q = "$city $service, California, USA";
        $query = http_build_query([
            'q' => $q,
            'format' => 'json',
            'limit' => 5,
            'addressdetails' => 1,
            'extratags' => 1,
        ]);

        $url = 'https://nominatim.openstreetmap.org/search?' . $query;
        $response = $this->httpGet($url, ['Accept-Language: en-US']);
        if ($response === null) {
            return ['name' => '', 'address' => '', 'phone' => ''];
        }

        $results = json_decode($response, true);
        if (!is_array($results)) {
            return ['name' => '', 'address' => '', 'phone' => ''];
        }

        foreach ($results as $hit) {
            if (!is_array($hit)) {
                continue;
            }
            $name = (string) ($hit['display_name'] ?? '');
            if ($name === '' || stripos($name, $city) === false) {
                continue;
            }

            $extratags = is_array($hit['extratags'] ?? null) ? $hit['extratags'] : [];
            $place = [
                'name' => explode(',', $name)[0],
                'address' => $this->formatAddressFromNominatim($hit['address'] ?? [], $name),
                'phone' => $this->extractPhoneFromTags($extratags),
                'lat' => (float) ($hit['lat'] ?? $lat),
                'lng' => (float) ($hit['lon'] ?? $lng),
            ];

            return $this->enrichPlace($place, $city);
        }

        return ['name' => '', 'address' => '', 'phone' => ''];
    }

    /** @param array{name: string, address: string, phone: string} $place */
    private function applyCityNonEmergencyFallback(array $place, string $city, string $service): array
    {
        if ($place['phone'] !== '') {
            return $place;
        }

        $key = strtolower(trim($city));
        $numbers = self::CITY_NON_EMERGENCY[$key] ?? null;
        if ($numbers === null) {
            return $place;
        }

        $place['phone'] = $numbers[$service] ?? '';

        return $place;
    }

    /**
     * @param array{name: string, address: string, phone: string, lat?: float, lng?: float} $place
     * @return array{name: string, address: string, phone: string, lat: float, lng: float}
     */
    private function enrichPlace(array $place, string $city): array
    {
        $lat = (float) ($place['lat'] ?? 0);
        $lng = (float) ($place['lng'] ?? 0);

        if ($place['name'] === '') {
            return ['name' => '', 'address' => '', 'phone' => '', 'lat' => 0.0, 'lng' => 0.0];
        }

        if ($place['address'] === '' && $lat !== 0.0) {
            $place['address'] = $this->reverseGeocodeAddress($lat, $lng);
        }

        if ($place['phone'] === '') {
            $fallback = $this->nominatimSearchContact($place['name'], $city);
            if ($place['phone'] === '' && $fallback['phone'] !== '') {
                $place['phone'] = $fallback['phone'];
            }
            if ($place['address'] === '' && $fallback['address'] !== '') {
                $place['address'] = $fallback['address'];
            }
        }

        return [
            'name' => $place['name'],
            'address' => $place['address'],
            'phone' => $place['phone'],
            'lat' => $lat,
            'lng' => $lng,
        ];
    }

    /** @return array{phone: string, address: string} */
    private function nominatimSearchContact(string $name, string $city): array
    {
        $q = trim($name . ($city !== '' ? ', ' . $city : '') . ', California, USA');
        $query = http_build_query([
            'q' => $q,
            'format' => 'json',
            'limit' => 3,
            'addressdetails' => 1,
            'extratags' => 1,
        ]);

        $url = 'https://nominatim.openstreetmap.org/search?' . $query;
        $response = $this->httpGet($url, ['Accept-Language: en-US']);
        if ($response === null) {
            return ['phone' => '', 'address' => ''];
        }

        $results = json_decode($response, true);
        if (!is_array($results)) {
            return ['phone' => '', 'address' => ''];
        }

        foreach ($results as $hit) {
            if (!is_array($hit)) {
                continue;
            }
            $extratags = $hit['extratags'] ?? [];
            $phone = $this->extractPhoneFromTags(is_array($extratags) ? $extratags : []);
            $address = $this->formatDisplayAddress($hit['display_name'] ?? '');
            if ($phone !== '' || $address !== '') {
                return ['phone' => $phone, 'address' => $address];
            }
        }

        return ['phone' => '', 'address' => ''];
    }

    private function reverseGeocodeAddress(float $lat, float $lng): string
    {
        $query = http_build_query([
            'lat' => $lat,
            'lon' => $lng,
            'format' => 'json',
            'addressdetails' => 1,
        ]);

        $url = 'https://nominatim.openstreetmap.org/reverse?' . $query;
        $response = $this->httpGet($url, ['Accept-Language: en-US']);
        if ($response === null) {
            return '';
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            return '';
        }

        return $this->formatAddressFromNominatim($data['address'] ?? [], (string) ($data['display_name'] ?? ''));
    }

    /** @param array<string, mixed> $addr */
    private function formatAddressFromNominatim(array $addr, string $fallback): string
    {
        $line1 = trim(
            trim((string) ($addr['house_number'] ?? '')) . ' ' . trim((string) ($addr['road'] ?? ''))
        );
        $city = (string) ($addr['city'] ?? $addr['town'] ?? $addr['village'] ?? '');
        $state = (string) ($addr['state'] ?? 'CA');
        $zip = (string) ($addr['postcode'] ?? '');

        $parts = array_filter([$line1, $city !== '' ? "$city, $state $zip" : '']);

        if ($parts !== []) {
            return implode(', ', $parts);
        }

        return $this->formatDisplayAddress($fallback);
    }

    private function formatDisplayAddress(string $display): string
    {
        $parts = array_map('trim', explode(',', $display));
        if (count($parts) >= 3) {
            return implode(', ', array_slice($parts, 0, min(4, count($parts) - 1)));
        }

        return trim($display);
    }

    private function lookupApn(float $lat, float $lng, string $county): string
    {
        if (stripos($county, 'Los Angeles') !== false) {
            return $this->lookupLaCountyApn($lat, $lng);
        }
        if (stripos($county, 'Orange') !== false) {
            return $this->lookupOrangeCountyApn($lat, $lng);
        }
        if (stripos($county, 'San Diego') !== false) {
            return $this->lookupSanDiegoApn($lat, $lng);
        }

        return $this->lookupLaCountyApn($lat, $lng);
    }

    private function lookupLaCountyApn(float $lat, float $lng): string
    {
        $delta = 0.01;
        $params = http_build_query([
            'geometry' => "$lng,$lat",
            'geometryType' => 'esriGeometryPoint',
            'sr' => '4326',
            'layers' => 'all',
            'tolerance' => '10',
            'mapExtent' => implode(',', [$lng - $delta, $lat - $delta, $lng + $delta, $lat + $delta]),
            'imageDisplay' => '600,550,96',
            'returnGeometry' => 'false',
            'f' => 'json',
        ]);

        $url = 'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/identify?' . $params;
        $response = $this->httpGet($url);
        if ($response === null) {
            return '';
        }

        $data = json_decode($response, true);
        $attrs = $data['results'][0]['attributes'] ?? null;
        if (!is_array($attrs)) {
            return '';
        }

        return (string) ($attrs['APN'] ?? $attrs['AIN'] ?? '');
    }

    private function lookupOrangeCountyApn(float $lat, float $lng): string
    {
        $params = http_build_query([
            'geometry' => "$lng,$lat",
            'geometryType' => 'esriGeometryPoint',
            'inSR' => '4326',
            'spatialRel' => 'esriSpatialRelIntersects',
            'outFields' => 'APN,APN_DASH',
            'returnGeometry' => 'false',
            'f' => 'json',
        ]);

        $url = 'https://services.arcgis.com/HRPe58bUyBqyyiCt/arcgis/rest/services/Parcels/FeatureServer/0/query?' . $params;
        $response = $this->httpGet($url);
        if ($response === null) {
            return '';
        }

        $data = json_decode($response, true);
        $attrs = $data['features'][0]['attributes'] ?? null;
        if (!is_array($attrs)) {
            return '';
        }

        return (string) ($attrs['APN_DASH'] ?? $attrs['APN'] ?? '');
    }

    private function lookupSanDiegoApn(float $lat, float $lng): string
    {
        $params = http_build_query([
            'geometry' => "$lng,$lat",
            'geometryType' => 'esriGeometryPoint',
            'inSR' => '4326',
            'spatialRel' => 'esriSpatialRelIntersects',
            'outFields' => 'APN',
            'returnGeometry' => 'false',
            'f' => 'json',
        ]);

        $url = 'https://services.sandag.org/arcgis/rest/services/Hosted/Parcels_North/FeatureServer/0/query?' . $params;
        $response = $this->httpGet($url);
        if ($response === null) {
            return '';
        }

        $data = json_decode($response, true);
        $attrs = $data['features'][0]['attributes'] ?? null;
        if (!is_array($attrs)) {
            return '';
        }

        return (string) ($attrs['APN'] ?? '');
    }

    /** @return array{name: string, operator: string, lat: float, lng: float} */
    private function nearestSchoolSite(float $lat, float $lng): array
    {
        $query = sprintf(
            '[out:json][timeout:25];(node["amenity"="school"](around:600,%1$f,%2$f);way["amenity"="school"](around:600,%1$f,%2$f););out center tags;',
            $lat,
            $lng
        );

        $response = $this->httpPost(
            'https://overpass-api.de/api/interpreter',
            $query,
            ['Content-Type: application/x-www-form-urlencoded']
        );
        if ($response === null) {
            return ['name' => '', 'operator' => '', 'lat' => 0.0, 'lng' => 0.0];
        }

        $data = json_decode($response, true);
        $elements = $data['elements'] ?? [];
        if (!is_array($elements) || $elements === []) {
            return ['name' => '', 'operator' => '', 'lat' => 0.0, 'lng' => 0.0];
        }

        $best = null;
        $bestDistance = PHP_FLOAT_MAX;
        foreach ($elements as $element) {
            if (!is_array($element)) {
                continue;
            }
            $tags = $element['tags'] ?? [];
            if (!is_array($tags)) {
                continue;
            }
            $name = trim((string) ($tags['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $elLat = $element['lat'] ?? ($element['center']['lat'] ?? null);
            $elLng = $element['lon'] ?? ($element['center']['lon'] ?? null);
            if ($elLat === null || $elLng === null) {
                continue;
            }
            $distance = $this->distanceKm($lat, $lng, (float) $elLat, (float) $elLng);
            if ($distance >= $bestDistance) {
                continue;
            }
            $bestDistance = $distance;
            $best = [
                'name' => $name,
                'operator' => trim((string) ($tags['operator'] ?? '')),
                'lat' => (float) $elLat,
                'lng' => (float) $elLng,
            ];
        }

        return $best ?? ['name' => '', 'operator' => '', 'lat' => 0.0, 'lng' => 0.0];
    }

    private function schoolDistrictForCity(string $city): string
    {
        $key = strtolower(trim($city));

        return self::CITY_SCHOOL_DISTRICT[$key] ?? '';
    }

    /** @return array{name: string, address: string, phone: string, lat: float, lng: float} */
    private function nearestPlace(float $lat, float $lng, string $amenity): array
    {
        $query = sprintf(
            '[out:json][timeout:25];(node["amenity"="%1$s"](around:40000,%2$f,%3$f);way["amenity"="%1$s"](around:40000,%2$f,%3$f););out center tags;',
            $amenity,
            $lat,
            $lng
        );

        return $this->overpassSearch($query, $lat, $lng)[0] ?? $this->emptyPlace();
    }

    /** @return array{name: string, address: string, phone: string, lat: float, lng: float} */
    private function nearestUrgentCare(float $lat, float $lng, string $city, string $postalCode): array
    {
        $candidates = array_merge(
            $this->overpassUrgentCareCandidates($lat, $lng),
            $this->nominatimUrgentCareCandidates($lat, $lng, $city),
            $this->npiUrgentCareCandidates($lat, $lng, $city, $postalCode)
        );

        $best = $this->pickBestUrgentCare($candidates, $lat, $lng);

        return $best ?? $this->emptyPlace();
    }

    /**
     * @return list<array{name: string, address: string, phone: string, lat: float, lng: float, distance_km: float, tier: int}>
     */
    private function overpassUrgentCareCandidates(float $lat, float $lng): array
    {
        $query = sprintf(
            '[out:json][timeout:25];(' .
            'node["healthcare"="urgent_care"](around:40000,%1$f,%2$f);' .
            'way["healthcare"="urgent_care"](around:40000,%1$f,%2$f);' .
            'node["amenity"="clinic"](around:40000,%1$f,%2$f);' .
            'way["amenity"="clinic"](around:40000,%1$f,%2$f);' .
            'node["name"~"urgent|immediate care",i](around:40000,%1$f,%2$f);' .
            'way["name"~"urgent|immediate care",i](around:40000,%1$f,%2$f);' .
            ');out center tags;',
            $lat,
            $lng
        );

        $results = [];
        foreach ($this->overpassSearch($query, $lat, $lng) as $place) {
            $name = $place['name'];
            if ($this->isExcludedUrgentCareName($name)) {
                continue;
            }

            $tier = 3;
            if ($this->nameLooksLikeUrgentCare($name)) {
                $tier = 2;
            }

            $place['tier'] = $tier;
            $results[] = $place;
        }

        return $results;
    }

    /**
     * @return list<array{name: string, address: string, phone: string, lat: float, lng: float, distance_km: float, tier: int}>
     */
    private function nominatimUrgentCareCandidates(float $lat, float $lng, string $city): array
    {
        $delta = 0.18;
        $query = http_build_query([
            'q' => 'urgent care',
            'format' => 'json',
            'limit' => 15,
            'viewbox' => sprintf('%f,%f,%f,%f', $lng - $delta, $lat - $delta, $lng + $delta, $lat + $delta),
            'bounded' => 1,
            'addressdetails' => 1,
            'extratags' => 1,
        ]);

        $url = 'https://nominatim.openstreetmap.org/search?' . $query;
        $response = $this->httpGet($url, ['Accept-Language: en-US']);
        if ($response === null) {
            return [];
        }

        $hits = json_decode($response, true);
        if (!is_array($hits)) {
            return [];
        }

        $results = [];
        foreach ($hits as $hit) {
            if (!is_array($hit)) {
                continue;
            }

            $name = explode(',', (string) ($hit['display_name'] ?? ''))[0];
            if ($name === '' || $this->isExcludedUrgentCareName($name)) {
                continue;
            }

            if (!$this->nameLooksLikeUrgentCare($name)) {
                continue;
            }

            if ($city !== '' && stripos((string) ($hit['display_name'] ?? ''), $city) === false) {
                continue;
            }

            $hitLat = (float) ($hit['lat'] ?? 0);
            $hitLng = (float) ($hit['lon'] ?? 0);
            if ($hitLat === 0.0 || $hitLng === 0.0) {
                continue;
            }

            $extratags = is_array($hit['extratags'] ?? null) ? $hit['extratags'] : [];
            $results[] = [
                'name' => $name,
                'address' => $this->formatAddressFromNominatim($hit['address'] ?? [], (string) ($hit['display_name'] ?? '')),
                'phone' => $this->extractPhoneFromTags($extratags),
                'lat' => $hitLat,
                'lng' => $hitLng,
                'distance_km' => $this->distanceKm($lat, $lng, $hitLat, $hitLng),
                'tier' => 2,
            ];
        }

        return $results;
    }

    /**
     * CMS NPI Registry — many urgent care centers (e.g. AP Urgent Care) are absent from OpenStreetMap.
     *
     * @return list<array{name: string, address: string, phone: string, lat: float, lng: float, distance_km: float, tier: int}>
     */
    private function npiUrgentCareCandidates(float $lat, float $lng, string $city, string $postalCode): array
    {
        $queries = [];
        if ($city !== '') {
            $queries[] = [
                'city' => $city,
                'state' => 'CA',
                'taxonomy_description' => 'Urgent Care',
                'limit' => 25,
            ];
        }

        $zip5 = substr(preg_replace('/\D+/', '', $postalCode) ?? '', 0, 5);
        if (strlen($zip5) === 5) {
            $queries[] = [
                'postal_code' => $zip5,
                'state' => 'CA',
                'taxonomy_description' => 'Urgent Care',
                'limit' => 25,
            ];
        }

        if ($queries === []) {
            return [];
        }

        $seen = [];
        $results = [];
        foreach ($queries as $params) {
            $params['version'] = '2.1';
            $url = 'https://npiregistry.cms.hhs.gov/api/?' . http_build_query($params);
            $response = $this->httpGet($url);
            if ($response === null) {
                continue;
            }

            $data = json_decode($response, true);
            $providers = $data['results'] ?? [];
            if (!is_array($providers)) {
                continue;
            }

            foreach ($providers as $provider) {
                if (!is_array($provider)) {
                    continue;
                }

                $number = (string) ($provider['number'] ?? '');
                if ($number === '' || isset($seen[$number])) {
                    continue;
                }
                $seen[$number] = true;

                $displayName = $this->pickNpiDisplayName($provider);
                if ($displayName === '' || $this->isExcludedUrgentCareName($displayName)) {
                    continue;
                }

                $locations = $provider['practiceLocations'] ?? [];
                if (!is_array($locations)) {
                    continue;
                }

                foreach ($locations as $location) {
                    if (!is_array($location)) {
                        continue;
                    }

                    if (!$this->npiLocationIsNearby($location, $city, $zip5)) {
                        continue;
                    }

                    $address = $this->formatNpiAddress($location);
                    if ($address === '') {
                        continue;
                    }

                    $geo = $this->geocode($this->simplifyAddressForGeocode($address));
                    if ($geo === null) {
                        continue;
                    }

                    $distance = $this->distanceKm($lat, $lng, $geo['lat'], $geo['lng']);
                    if ($distance > 40) {
                        continue;
                    }

                    $phone = $this->normalizePhone((string) ($location['telephone_number'] ?? ''));
                    $results[] = [
                        'name' => $this->formatUrgentCareName($displayName, (string) ($location['city'] ?? $city)),
                        'address' => $address,
                        'phone' => $phone,
                        'lat' => $geo['lat'],
                        'lng' => $geo['lng'],
                        'distance_km' => $distance,
                        'tier' => 1,
                    ];
                }
            }
        }

        return $results;
    }

    /** @param array<string, mixed> $provider */
    private function pickNpiDisplayName(array $provider): string
    {
        $dbas = [];
        $urgentDbas = [];
        foreach ($provider['other_names'] ?? [] as $alias) {
            if (!is_array($alias) || ($alias['type'] ?? '') !== 'Doing Business As') {
                continue;
            }
            $name = trim((string) ($alias['organization_name'] ?? ''));
            if ($name !== '') {
                $dbas[] = $name;
            }
        }

        foreach ($dbas as $dba) {
            if ($this->nameLooksLikeUrgentCare($dba)) {
                $urgentDbas[] = $dba;
            }
        }

        if ($urgentDbas !== []) {
            usort($urgentDbas, fn (string $a, string $b): int => strlen($a) <=> strlen($b));

            return $urgentDbas[0];
        }

        if ($dbas !== []) {
            return $dbas[0];
        }

        return trim((string) ($provider['basic']['organization_name'] ?? ''));
    }

    /** @param array<string, mixed> $location */
    private function formatNpiAddress(array $location): string
    {
        $line1 = $this->titleCaseAddressLine((string) ($location['address_1'] ?? ''));
        $line2 = $this->titleCaseAddressLine((string) ($location['address_2'] ?? ''));
        if ($line1 === '') {
            return '';
        }

        if ($line2 !== '') {
            $line1 = "$line1, $line2";
        }

        $city = $this->titleCaseAddressLine(trim((string) ($location['city'] ?? '')));
        $state = strtoupper(trim((string) ($location['state'] ?? 'CA')));
        $zip = substr(preg_replace('/\D+/', '', (string) ($location['postal_code'] ?? '')) ?? '', 0, 5);

        $cityStateZip = trim("$city, $state $zip", ', ');

        return $cityStateZip !== '' ? "$line1, $cityStateZip" : $line1;
    }

    private function titleCaseAddressLine(string $line): string
    {
        $line = trim($line);
        if ($line === '') {
            return '';
        }

        return (string) preg_replace_callback(
            '/\b[a-z]/i',
            static fn (array $match): string => strtoupper($match[0]),
            strtolower($line)
        );
    }

    /** @param array<string, mixed> $location */
    private function npiLocationIsNearby(array $location, string $city, string $siteZip5): bool
    {
        $locCity = strtolower(trim((string) ($location['city'] ?? '')));
        $siteCity = strtolower(trim($city));
        if ($siteCity !== '' && $locCity === $siteCity) {
            return true;
        }

        $locZip = substr(preg_replace('/\D+/', '', (string) ($location['postal_code'] ?? '')) ?? '', 0, 5);
        if (strlen($siteZip5) === 5 && $locZip === $siteZip5) {
            return true;
        }

        if (strlen($siteZip5) === 5 && strlen($locZip) === 5 && substr($locZip, 0, 3) === substr($siteZip5, 0, 3)) {
            return true;
        }

        return false;
    }

    private function simplifyAddressForGeocode(string $address): string
    {
        $parts = array_map('trim', explode(',', $address));
        if ($parts === []) {
            return $address;
        }

        $parts[0] = (string) preg_replace(
            '/\b(ste|suite|unit|#|fl|floor)\.?\s*[a-z0-9-]+\b/i',
            '',
            $parts[0]
        );
        $parts[0] = trim(preg_replace('/\s+/', ' ', $parts[0]) ?? '');

        return implode(', ', array_filter($parts, fn ($part) => $part !== ''));
    }

    private function formatUrgentCareName(string $name, string $city): string
    {
        $name = trim($name);
        $city = trim($city);
        if ($city === '' || stripos($name, $city) !== false) {
            return $name;
        }

        return "$name - $city";
    }

    private function nameLooksLikeUrgentCare(string $name): bool
    {
        return (bool) preg_match('/urgent\s*care|immediate\s*care|walk[- ]in\s*clinic/i', $name);
    }

    private function isExcludedUrgentCareName(string $name): bool
    {
        return (bool) preg_match('/veterinar|minute\s*clinic|planned\s*parenthood|dental|orthodont/i', $name);
    }

    /**
     * @param list<array{name: string, address: string, phone: string, lat: float, lng: float, distance_km: float, tier: int}> $candidates
     * @return array{name: string, address: string, phone: string, lat: float, lng: float}|null
     */
    private function pickBestUrgentCare(array $candidates, float $lat, float $lng): ?array
    {
        if ($candidates === []) {
            return null;
        }

        usort($candidates, function (array $a, array $b): int {
            $tierCmp = ($a['tier'] ?? 9) <=> ($b['tier'] ?? 9);
            if ($tierCmp !== 0) {
                return $tierCmp;
            }

            return ($a['distance_km'] ?? PHP_FLOAT_MAX) <=> ($b['distance_km'] ?? PHP_FLOAT_MAX);
        });

        $best = $candidates[0];

        return [
            'name' => $best['name'],
            'address' => $best['address'],
            'phone' => $best['phone'],
            'lat' => $best['lat'],
            'lng' => $best['lng'],
        ];
    }

    /** @return array{name: string, address: string, phone: string, lat: float, lng: float} */
    private function nearestPolice(float $lat, float $lng): array
    {
        $query = sprintf(
            '[out:json][timeout:25];(node["amenity"="police"](around:40000,%1$f,%2$f);way["amenity"="police"](around:40000,%1$f,%2$f);node["office"="police"](around:40000,%1$f,%2$f);way["office"="police"](around:40000,%1$f,%2$f););out center tags;',
            $lat,
            $lng
        );

        return $this->overpassSearch($query, $lat, $lng)[0] ?? $this->emptyPlace();
    }

    /** @return array{name: string, address: string, phone: string, lat: float, lng: float} */
    private function emptyPlace(): array
    {
        return ['name' => '', 'address' => '', 'phone' => '', 'lat' => 0.0, 'lng' => 0.0];
    }

    /**
     * @return list<array{name: string, address: string, phone: string, lat: float, lng: float, distance_km: float}>
     */
    private function overpassSearch(string $query, float $originLat, float $originLng): array
    {
        $response = $this->httpPost(
            'https://overpass-api.de/api/interpreter',
            $query,
            ['Content-Type: application/x-www-form-urlencoded']
        );
        if ($response === null) {
            return [];
        }

        $data = json_decode($response, true);
        $elements = $data['elements'] ?? [];
        if (!is_array($elements)) {
            return [];
        }

        $results = [];
        foreach ($elements as $element) {
            if (!is_array($element)) {
                continue;
            }

            $tags = $element['tags'] ?? [];
            if (!is_array($tags)) {
                continue;
            }

            $elLat = $element['lat'] ?? ($element['center']['lat'] ?? null);
            $elLng = $element['lon'] ?? ($element['center']['lon'] ?? null);
            if ($elLat === null || $elLng === null) {
                continue;
            }

            $name = (string) ($tags['name'] ?? $tags['operator'] ?? '');
            if ($name === '') {
                continue;
            }

            $results[] = [
                'name' => $name,
                'address' => $this->formatAddressFromOsmTags($tags),
                'phone' => $this->extractPhoneFromTags($tags),
                'lat' => (float) $elLat,
                'lng' => (float) $elLng,
                'distance_km' => $this->distanceKm($originLat, $originLng, (float) $elLat, (float) $elLng),
            ];
        }

        usort($results, fn ($a, $b) => $a['distance_km'] <=> $b['distance_km']);

        return $results;
    }

    /** @param array<string, string> $tags */
    private function formatAddressFromOsmTags(array $tags): string
    {
        $line1 = trim(
            trim($tags['addr:housenumber'] ?? '') . ' ' . trim($tags['addr:street'] ?? '')
        );
        $city = $tags['addr:city'] ?? $tags['addr:town'] ?? '';
        $state = $tags['addr:state'] ?? 'CA';
        $zip = $tags['addr:postcode'] ?? '';

        if ($line1 !== '' || $city !== '') {
            return trim("$line1, $city, $state $zip", ', ');
        }

        return '';
    }

    /** @param array<string, string> $tags */
    private function extractPhoneFromTags(array $tags): string
    {
        foreach ([
            'contact:phone',
            'phone',
            'phone:US',
            'contact:phone:US',
            'contact:mobile',
        ] as $key) {
            if (!empty($tags[$key])) {
                return $this->normalizePhone((string) $tags[$key]);
            }
        }

        return '';
    }

    private function normalizePhone(string $phone): string
    {
        $phone = trim($phone);
        if ($phone === '') {
            return '';
        }

        if (str_contains($phone, ';')) {
            $phone = trim(explode(';', $phone)[0]);
        }

        $digits = preg_replace('/\D+/', '', $phone);
        if ($digits === null || $digits === '') {
            return $phone;
        }

        if (strlen($digits) === 11 && str_starts_with($digits, '1')) {
            $digits = substr($digits, 1);
        }

        if (strlen($digits) === 10) {
            return sprintf('(%s) %s-%s', substr($digits, 0, 3), substr($digits, 3, 3), substr($digits, 6));
        }

        return $phone;
    }

    private function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earth = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /** @param list<string> $headers */
    private function httpGet(string $url, array $headers = []): ?string
    {
        $headers[] = 'User-Agent: ' . self::USER_AGENT;

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 20,
                CURLOPT_HTTPHEADER => $headers,
            ]);
            $body = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            return ($body !== false && $code >= 200 && $code < 300) ? $body : null;
        }

        return null;
    }

    /** @param list<string> $headers */
    private function httpPost(string $url, string $body, array $headers = []): ?string
    {
        $headers[] = 'User-Agent: ' . self::USER_AGENT;

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 25,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => $headers,
            ]);
            $response = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            return ($response !== false && $code >= 200 && $code < 300) ? $response : null;
        }

        return null;
    }
}
