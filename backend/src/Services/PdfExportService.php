<?php

declare(strict_types=1);

namespace Transcend\Ssp\Services;

class PdfExportService
{
    /** @param array<string, mixed> $plan */
    public function export(array $plan): string
    {
        $html = $this->renderDocument($plan);

        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => false]);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('letter', 'portrait');
            $dompdf->render();

            return $dompdf->output();
        }

        return $html;
    }

    /** @param array<string, mixed> $plan */
    public function exportToHttpResponse(array $plan): void
    {
        $fileName = $this->fileName($plan);
        $output = $this->export($plan);

        if (class_exists(\Dompdf\Dompdf::class)) {
            header('Content-Type: application/pdf');
            header('Content-Disposition: attachment; filename="' . $fileName . '"');
            echo $output;
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        header('Content-Disposition: inline; filename="' . preg_replace('/\.pdf$/', '.html', $fileName) . '"');
        echo $output;
    }

    /** @param array<string, mixed> $plan */
    public function fileName(array $plan): string
    {
        $app = trim((string) ($plan['transcend_pm_project_id'] ?? 'xx-xxxxxx'));
        $date = trim((string) ($plan['submission_date'] ?? date('Y-m-d')));

        return $app . ' Site Safety Plan_' . $date . '.pdf';
    }

    /** @param array<string, mixed> $plan */
    private function renderDocument(array $plan): string
    {
        $esc = static fn (?string $value): string => htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
        $block = static fn (?string $value): string => nl2br($esc($value));

        $siteName = $esc((string) ($plan['site_name'] ?? $plan['project_name'] ?? ''));
        $projectName = $esc((string) ($plan['project_name'] ?? ''));
        $dsa = $esc((string) ($plan['transcend_pm_project_id'] ?? ''));
        $address = $esc((string) ($plan['project_address'] ?? ''));
        $apn = $esc((string) ($plan['apn'] ?? ''));
        $owner = $esc((string) ($plan['property_owner'] ?? $plan['owner_name'] ?? ''));
        $contractor = $esc((string) ($plan['general_contractor'] ?? ''));
        $architect = $esc((string) ($plan['architect_firm'] ?? ''));
        $fireDept = $esc((string) ($plan['fire_department_name'] ?? ''));
        $submissionDate = $esc((string) ($plan['submission_date'] ?? date('Y-m-d')));
        $preparedBy = $esc((string) ($plan['prepared_by'] ?? ''));
        $fireAccess = $block((string) ($plan['fire_access_routes'] ?? ''));
        $fireProtection = $block((string) ($plan['fire_protection_equipment'] ?? ''));
        $lfaSpecific = $block((string) ($plan['lfa_site_specific'] ?? ''));

        $mapImage = $this->mapImageTag($plan);
        $legendHtml = $this->renderLegend($plan, $esc);
        $keynotesHtml = $this->renderKeynotes($plan, $esc);

        $cfcPage = $this->renderCfcPage($plan, $esc, $block);

        return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{$dsa} Site Safety Plan</title>
<style>
  @page site-plan { size: letter landscape; margin: 0.35in 0.4in; }
  @page portrait-page { size: letter portrait; margin: 0.5in 0.55in; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #111; margin: 0; }
  .site-plan-page { page: site-plan; page-break-after: always; }
  .portrait-page { page: portrait-page; }
  .sheet { border: 2px solid #222; height: 7.35in; position: relative; box-sizing: border-box; }
  .sheet-header { display: table; width: 100%; border-bottom: 2px solid #222; }
  .sheet-header .left { display: table-cell; width: 68%; vertical-align: top; padding: 0; }
  .sheet-header .right { display: table-cell; width: 32%; vertical-align: top; border-left: 2px solid #222; padding: 8px; font-size: 7.5pt; }
  .map-frame { height: 4.55in; border-bottom: 1px solid #666; overflow: hidden; background: #eef2f6; text-align: center; }
  .map-frame img { max-width: 100%; max-height: 4.5in; object-fit: contain; }
  .map-placeholder { padding: 1.5in 1in; color: #666; font-size: 9pt; }
  .legend-box, .notes-box { border: 1px solid #666; padding: 6px 8px; margin-bottom: 8px; }
  .legend-box h4, .notes-box h4 { margin: 0 0 4px; font-size: 8pt; text-transform: uppercase; color: #0b3d6d; }
  .legend-box ul, .notes-box ul { margin: 0; padding-left: 14px; }
  .legend-box li, .notes-box li { margin-bottom: 2px; }
  .title-block { display: table; width: 100%; border-top: 2px solid #222; font-size: 7.5pt; }
  .title-block .cell { display: table-cell; border: 1px solid #666; padding: 5px 7px; vertical-align: top; }
  .project-banner { background: #0b3d6d; color: #fff; padding: 6px 10px; font-size: 11pt; font-weight: bold; }
  .project-sub { padding: 6px 10px; font-size: 9pt; font-weight: bold; border-bottom: 1px solid #ccc; }
  .north { position: absolute; top: 8px; right: 34%; font-weight: bold; font-size: 10pt; }
  .scale { position: absolute; bottom: 1.65in; left: 10px; font-size: 7pt; background: rgba(255,255,255,0.85); padding: 2px 6px; border: 1px solid #999; }
  h2 { font-size: 11pt; color: #0b3d6d; margin: 0 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
  table.cfc { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.cfc td { border: 1px solid #999; padding: 5px 7px; vertical-align: top; font-size: 8.5pt; }
  table.cfc .num { width: 22px; text-align: center; font-weight: bold; background: #eef2f6; }
  table.cfc .cfc-title { width: 32%; font-weight: bold; background: #f8fafc; }
  table.emergency td { border: 1px solid #999; padding: 4px 7px; font-size: 8.5pt; }
</style>
</head>
<body>
  <div class="site-plan-page">
    <div class="sheet">
      <div class="project-banner">{$siteName}</div>
      <div class="project-sub">{$projectName} · {$address}</div>
      <div class="sheet-header">
        <div class="left">
          <div class="north">N</div>
          <div class="scale">SITE PLAN — NOT TO SCALE (for fire access coordination)</div>
          <div class="map-frame">{$mapImage}</div>
        </div>
        <div class="right">
          <div class="legend-box">
            <h4>Legend</h4>
            <ul>{$legendHtml}</ul>
          </div>
          <div class="notes-box">
            <h4>Keynotes</h4>
            <ul>{$keynotesHtml}</ul>
          </div>
          <div class="notes-box">
            <h4>Fire department notes</h4>
            <div style="font-size:7.5pt;">{$fireAccess}</div>
          </div>
        </div>
      </div>
      <div class="title-block">
        <div class="cell" style="width:20%"><strong>Owner</strong><br>{$owner}</div>
        <div class="cell" style="width:20%"><strong>Architect</strong><br>{$architect}</div>
        <div class="cell" style="width:20%"><strong>Agency (LFA)</strong><br>{$fireDept}</div>
        <div class="cell" style="width:20%"><strong>DSA A#</strong><br>{$dsa}<br>APN: {$apn}</div>
        <div class="cell" style="width:20%"><strong>Date</strong><br>{$submissionDate}<br>GC: {$contractor}</div>
      </div>
      <div class="title-block">
        <div class="cell"><strong>Drawing title</strong><br>SITE PLAN — FIRE ACCESS / SSP</div>
        <div class="cell"><strong>Fire protection equipment</strong><br>{$fireProtection}</div>
        <div class="cell"><strong>Prepared by</strong><br>{$preparedBy}</div>
      </div>
    </div>
  </div>
  {$cfcPage}
</body>
</html>
HTML;
    }

    /** @param array<string, mixed> $plan */
    private function mapImageTag(array $plan): string
    {
        $snapshot = trim((string) ($plan['map_snapshot'] ?? ''));
        if ($snapshot !== '' && str_starts_with($snapshot, 'data:image/')) {
            return '<img src="' . $snapshot . '" alt="Site plot plan">';
        }

        return '<div class="map-placeholder">Plot plan snapshot not captured.<br>Complete Steps 2–4 in Transcend SSP and export again.</div>';
    }

    /** @param array<string, mixed> $plan */
    private function renderLegend(array $plan, callable $esc): string
    {
        $items = [
            '(E) Fire hydrant',
            '(E) FDC / standpipe connection',
            'Fire dept vehicular access lane (20\'-0" min.)',
            'Knox box — gates &amp; fire alarm panels',
        ];

        foreach ($this->labelsFromPlan($plan) as $label) {
            $type = strtoupper((string) ($label['type'] ?? ''));
            $text = (string) ($label['text'] ?? '');
            if ($text !== '') {
                $items[] = $esc($type . ': ' . $text);
            }
        }

        $html = '';
        foreach (array_unique($items) as $item) {
            $html .= '<li>' . $item . '</li>';
        }

        return $html;
    }

    /** @param array<string, mixed> $plan */
    private function renderKeynotes(array $plan, callable $esc): string
    {
        $notes = [
            'Fire apparatus access roads and water supply shall be installed and serviceable during construction (CFC §501.4).',
            'Knox box mounting height shall not exceed 6\'-0" AFF unless directed by fire inspector.',
        ];

        $access = trim((string) ($plan['fire_access_routes'] ?? ''));
        if ($access !== '') {
            $notes[] = $access;
        }

        $html = '';
        foreach ($notes as $i => $note) {
            $html .= '<li><strong>' . ($i + 1) . '.</strong> ' . nl2br($esc($note)) . '</li>';
        }

        return $html;
    }

    /** @param array<string, mixed> $plan */
    private function renderCfcPage(array $plan, callable $esc, callable $block): string
    {
        $hospital = $esc((string) ($plan['hospital_name'] ?? ''));
        $hospitalAddr = $esc((string) ($plan['hospital_address'] ?? ''));
        $hospitalPhone = $esc((string) ($plan['hospital_phone'] ?? ''));
        $urgentCare = $esc((string) ($plan['urgent_care_name'] ?? ''));
        $urgentAddr = $esc((string) ($plan['urgent_care_address'] ?? ''));
        $urgentPhone = $esc((string) ($plan['urgent_care_phone'] ?? ''));
        $fireDept = $esc((string) ($plan['fire_department_name'] ?? ''));
        $firePhone = $esc((string) ($plan['fire_department_phone_non_emergency'] ?? $plan['fire_department_phone'] ?? ''));
        $lfaSpecific = $block((string) ($plan['lfa_site_specific'] ?? ''));

        $cfcSections = [
            ['1', 'Site safety director', $this->directorBlock($plan, $esc)],
            ['2', 'Training — site safety director & fire watch', $block($this->combine(
                (string) ($plan['site_safety_director_training'] ?? ''),
                (string) ($plan['fire_watch_training'] ?? '')
            ))],
            ['3', 'Procedures for reporting emergencies', $block((string) ($plan['incident_reporting'] ?? ''))],
            ['4', 'Fire department vehicle access routes', $block((string) ($plan['fire_access_routes'] ?? ''))],
            ['5', 'Fire protection equipment locations', $block((string) ($plan['fire_protection_equipment'] ?? ''))],
            ['6', 'Smoking and cooking policies', $block((string) ($plan['smoking_cooking_policy'] ?? ''))],
            ['7', 'Temporary heating equipment', $block((string) ($plan['temporary_heating_plan'] ?? ''))],
            ['8', 'Hot work plan', $block((string) ($plan['hot_work_plan'] ?? ''))],
            ['9', 'Combustible waste control', $block((string) ($plan['combustible_waste_plan'] ?? ''))],
            ['10', 'Flammable / combustible liquids & hazardous materials', $block((string) ($plan['flammable_materials_storage'] ?? ''))],
            ['11', 'Site security', $block((string) ($plan['site_security_plan'] ?? ''))],
            ['12', 'Changes affecting this plan', $block((string) ($plan['plan_changes_procedure'] ?? ''))],
            ['13', 'LFA site-specific information', $lfaSpecific],
        ];

        $cfcHtml = '';
        foreach ($cfcSections as [$num, $title, $body]) {
            $cfcHtml .= "<tr><td class=\"num\">{$num}</td><td class=\"cfc-title\">{$title}</td><td class=\"cfc-body\">{$body}</td></tr>";
        }

        return <<<HTML
<div class="portrait-page">
  <h2>Emergency services</h2>
  <table class="emergency" style="width:100%; border-collapse:collapse;">
    <tr><td><strong>Hospital</strong></td><td>{$hospital}</td><td>{$hospitalAddr}</td><td>{$hospitalPhone}</td></tr>
    <tr><td><strong>Urgent care</strong></td><td>{$urgentCare}</td><td>{$urgentAddr}</td><td>{$urgentPhone}</td></tr>
    <tr><td><strong>Fire (911 / non-emergency)</strong></td><td>{$fireDept}</td><td colspan="2">911 · {$firePhone}</td></tr>
  </table>
  <h2 style="margin-top:14px;">Site Safety Plan — CFC §3303.1.1 (BU 24-05)</h2>
  <table class="cfc">{$cfcHtml}</table>
</div>
HTML;
    }

    /** @param array<string, mixed> $plan */
    private function directorBlock(array $plan, callable $esc): string
    {
        $name = $esc((string) ($plan['site_safety_director_name'] ?? ''));
        $phone = $esc((string) ($plan['site_safety_director_phone'] ?? ''));
        $email = $esc((string) ($plan['site_safety_director_email'] ?? ''));

        return "<strong>{$name}</strong><br>Phone: {$phone}<br>Email: {$email}";
    }

    /** @return list<array<string, mixed>> */
    private function labelsFromPlan(array $plan): array
    {
        $raw = (string) ($plan['map_layers'] ?? '');
        if ($raw === '') {
            return [];
        }

        $layers = json_decode($raw, true);
        if (!is_array($layers)) {
            return [];
        }

        $labels = $layers['customLabels'] ?? [];

        return is_array($labels) ? $labels : [];
    }

    private function combine(string $a, string $b): string
    {
        $parts = array_filter([trim($a), trim($b)]);

        return implode("\n\n", $parts);
    }
}
