<?php

namespace App\Services;

use App\Models\AgencyModel;
use App\Models\BondMeasureModel;
use App\Models\ConsultantModel;
use App\Models\ProcurementEventModel;
use App\Models\SourceDocumentModel;
use App\Models\LeadScoreModel;

class LeadScoringService
{
    public function scoreAgency(int $agencyId): ?array
    {
        $agency = (new AgencyModel())->find($agencyId);
        if (!$agency) return null;

        $bondMeasures = (new BondMeasureModel())->where('agency_id', $agencyId)->orderBy('election_date','DESC')->findAll();
        $consultants  = (new ConsultantModel())->where('agency_id', $agencyId)->findAll();
        $procurements = (new ProcurementEventModel())->where('agency_id', $agencyId)->findAll();
        $sourceDocs   = (new SourceDocumentModel())->where('agency_id', $agencyId)->findAll();

        $score   = 0;
        $factors = [];

        // Bond result
        $passedBond  = null;
        $pendingBond = null;
        $failedBond  = null;
        foreach ($bondMeasures as $bm) {
            if ($bm['result'] === 'passed'  && !$passedBond)  $passedBond  = $bm;
            if ($bm['result'] === 'pending' && !$pendingBond) $pendingBond = $bm;
            if ($bm['result'] === 'failed'  && !$failedBond)  $failedBond  = $bm;
        }

        if ($passedBond) {
            $daysAgo = $passedBond['election_date']
                ? (int)((time() - strtotime($passedBond['election_date'])) / 86400)
                : 999;
            if ($daysAgo <= 365)      { $score += 40; $factors[] = ['key' => 'bond_recent_12mo', 'points' => 40, 'reason' => 'Bond passed within 12 months']; }
            elseif ($daysAgo <= 730)  { $score += 25; $factors[] = ['key' => 'bond_passed_24mo', 'points' => 25, 'reason' => 'Bond passed within 24 months']; }
            else                      { $score += 15; $factors[] = ['key' => 'bond_passed_old',  'points' => 15, 'reason' => 'Bond passed (over 24 months ago)']; }
        } elseif ($pendingBond) {
            $score += 20; $factors[] = ['key' => 'bond_pending', 'points' => 20, 'reason' => 'Bond measure pending / on ballot'];
        } elseif ($failedBond && empty($procurements)) {
            $score -= 20; $factors[] = ['key' => 'bond_failed', 'points' => -20, 'reason' => 'Bond failed with no procurement signals'];
        }

        // Bond amount
        $maxAmount = 0;
        foreach ($bondMeasures as $bm) { $maxAmount = max($maxAmount, (float)($bm['bond_amount'] ?? 0)); }
        if ($maxAmount > 500_000_000)      { $score += 20; $factors[] = ['key' => 'amount_500m', 'points' => 20, 'reason' => 'Bond amount > $500M']; }
        elseif ($maxAmount > 100_000_000)  { $score += 15; $factors[] = ['key' => 'amount_100m', 'points' => 15, 'reason' => 'Bond amount > $100M']; }
        elseif ($maxAmount > 50_000_000)   { $score += 10; $factors[] = ['key' => 'amount_50m',  'points' => 10, 'reason' => 'Bond amount > $50M']; }
        elseif ($maxAmount > 25_000_000)   { $score += 5;  $factors[] = ['key' => 'amount_25m',  'points' => 5,  'reason' => 'Bond amount > $25M']; }

        // Unissued ratio
        foreach ($bondMeasures as $bm) {
            $auth    = (float)($bm['authorized_amount'] ?? 0);
            $issued  = (float)($bm['issued_amount'] ?? 0);
            $unissued = (float)($bm['unissued_amount'] ?? ($auth - $issued));
            if ($auth > 0 && $unissued / $auth > 0.5) {
                $score += 10; $factors[] = ['key' => 'unissued_50pct', 'points' => 10, 'reason' => 'Over 50% of authorized amount is unissued'];
                break;
            }
        }

        // Procurement signals
        $hasRfq = false;
        foreach ($procurements as $p) {
            if (in_array($p['event_type'], ['rfq_issued','rfp_issued'])) { $hasRfq = true; break; }
        }
        if ($hasRfq) { $score += 15; $factors[] = ['key' => 'rfq_active', 'points' => 15, 'reason' => 'Active RFQ or RFP procurement event found']; }

        foreach ($procurements as $p) {
            if ($p['event_type'] === 'board_approval') {
                $score += 5; $factors[] = ['key' => 'board_approval', 'points' => 5, 'reason' => 'Board approval of bond program found'];
                break;
            }
        }

        // Consultant gaps
        $awardedTypes = array_column($consultants, 'service_type');
        if (!in_array('program_manager', $awardedTypes))    { $score += 10; $factors[] = ['key' => 'no_pm',       'points' => 10, 'reason' => 'No program manager on record']; }
        if (!in_array('construction_manager', $awardedTypes)){ $score += 5;  $factors[] = ['key' => 'no_cm',       'points' => 5,  'reason' => 'No construction manager on record']; }
        if (!in_array('inspector', $awardedTypes))           { $score += 3;  $factors[] = ['key' => 'no_inspector','points' => 3,  'reason' => 'No inspector of record on record']; }

        // All key roles filled
        $keyTypes = ['program_manager','construction_manager','inspector'];
        if (count(array_intersect($keyTypes, $awardedTypes)) === 3) {
            $score -= 15; $factors[] = ['key' => 'all_roles_filled', 'points' => -15, 'reason' => 'All major consultant roles appear awarded'];
        }

        // Multi-scope
        $cats = [];
        foreach ($bondMeasures as $bm) {
            $c = json_decode($bm['project_categories'] ?? '[]', true) ?: [];
            $cats = array_merge($cats, $c);
        }
        if (count(array_unique($cats)) >= 3) { $score += 5; $factors[] = ['key' => 'multi_scope', 'points' => 5, 'reason' => 'Multi-scope program (3+ project categories)']; }

        // Staleness
        $stale = !empty($sourceDocs);
        foreach ($sourceDocs as $doc) {
            if ($doc['scraped_at'] && (time() - strtotime($doc['scraped_at'])) < (180 * 86400)) { $stale = false; break; }
        }
        if ($stale) { $score -= 10; $factors[] = ['key' => 'stale', 'points' => -10, 'reason' => 'All source documents older than 180 days']; }

        $score = max(0, min(100, $score));

        // Confidence
        $confidence = 50;
        $confidence += min(25, count($sourceDocs) * 5);
        if (!empty($sourceDocs)) {
            $ageHrs = (time() - strtotime($sourceDocs[0]['scraped_at'] ?? '2020-01-01')) / 3600;
            if ($ageHrs < 720) $confidence += 15;
            elseif ($ageHrs < 2160) $confidence += 10;
        }
        if (count($sourceDocs) < 2) $confidence -= 10;
        $confidence = max(0, min(100, $confidence));

        // Stage
        $stage = 'bond_passed';
        if ($hasRfq) $stage = 'rfq_active';
        elseif ($passedBond && !in_array('program_manager', $awardedTypes)) $stage = 'bond_passed';
        elseif ($passedBond && count(array_intersect($keyTypes, $awardedTypes)) >= 2) $stage = 'construction_active';
        elseif ($passedBond) $stage = 'consultant_awarded';
        elseif ($pendingBond) $stage = 'rfq_expected';
        elseif ($failedBond && !$passedBond && !$pendingBond) $stage = 'bond_failed_retry';

        $approachNow = $score >= 70 && in_array($stage, ['bond_passed','rfq_expected','rfq_active']);

        $outreach    = $this->buildOutreach($agency, $passedBond, $stage, $awardedTypes);
        $nextAction  = $this->buildNextAction($stage, $procurements);

        $result = [
            'score'                      => $score,
            'confidence'                 => $confidence,
            'opportunity_stage'          => $stage,
            'approach_now'               => $approachNow ? 1 : 0,
            'scoring_factors'            => $factors,
            'estimated_next_action'      => $nextAction,
            'recommended_outreach_angle' => $outreach,
        ];

        (new LeadScoreModel())->upsertScore($agencyId, $result);
        $result['scoring_factors'] = $factors;

        return $result;
    }

    public function batchScore(): array
    {
        $agencies = (new AgencyModel())->findAll();
        $stats = ['scored' => 0, 'errors' => 0];
        foreach ($agencies as $agency) {
            try { $this->scoreAgency($agency['id']); $stats['scored']++; }
            catch (\Throwable $e) { $stats['errors']++; log_message('error', 'Score error ' . $agency['id'] . ': ' . $e->getMessage()); }
        }
        return $stats;
    }

    private function buildOutreach(array $agency, ?array $bond, string $stage, array $awardedTypes): string
    {
        $name   = $agency['name'];
        $amount = $bond && $bond['bond_amount'] ? '$' . number_format((float)$bond['bond_amount'] / 1e6, 0) . 'M' : '';
        $measure = $bond['measure_name'] ?? 'bond measure';

        return match($stage) {
            'bond_passed'   => "Congratulations to {$name} on {$measure} passing" . ($amount ? " ({$amount})" : "") . ". Transcend PM provides owner-side program governance, procurement strategy, and PMIS from day one — ensuring bond funds are spent with full accountability.",
            'rfq_active'    => "{$name} has an active procurement. Transcend PM is ready to respond with proven capital program experience in school modernization, occupied campus construction, and DSA closeout.",
            'rfq_expected'  => "With {$amount} authorized and procurement expected soon, now is the time to establish a relationship with the {$name} facilities and business team before the first RFQ drops.",
            'consultant_awarded' => "{$name} has a program manager in place, but gaps in PMIS, inspection, or testing may exist. Transcend PM offers specialized owner-side support to complement existing program managers.",
            'bond_failed_retry'  => "Bond measures often take multiple elections. Transcend PM can help {$name} build community confidence through transparent capital planning and facilities readiness for the next cycle.",
            default => "Transcend PM offers {$name} experienced owner-side capital program support including program governance, procurement management, construction oversight, and PMIS.",
        };
    }

    private function buildNextAction(string $stage, array $procurements): string
    {
        $nextDue = null;
        foreach ($procurements as $p) {
            if ($p['due_date'] && (!$nextDue || $p['due_date'] < $nextDue)) $nextDue = $p['due_date'];
        }
        return match($stage) {
            'bond_passed'        => 'Reach out to Facilities Director and CBO within 30 days. Introduce program governance services before first solicitation.',
            'rfq_active'         => $nextDue ? "Submit qualifications before {$nextDue}. Prepare SOQ highlighting occupied campus and DSA experience." : 'Submit qualifications immediately. Monitor portal for due date.',
            'rfq_expected'       => 'Schedule introductory meeting with procurement contact. Position before RFQ is released.',
            'consultant_awarded' => 'Monitor board agendas for PMIS, materials testing, and specialty service RFQs.',
            'bond_failed_retry'  => 'Follow next election cycle. Offer facilities assessment or pre-bond planning support.',
            'construction_active'=> 'Monitor for inspector, testing, or closeout support opportunities.',
            default              => 'Monitor agency website and board agendas for capital program activity.',
        };
    }
}
