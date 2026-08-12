<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\BondMeasure;
use App\Models\Consultant;
use App\Models\Contact;
use App\Models\LeadScore;
use App\Models\ProcurementEvent;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. Los Angeles Unified School District ────────────────────────────
        $lausd = Agency::create([
            'name'            => 'Los Angeles Unified School District',
            'normalized_name' => 'los-angeles-unified-school-district',
            'agency_type'     => 'k12_district',
            'state'           => 'CA',
            'county'          => 'Los Angeles',
            'city'            => 'Los Angeles',
            'website'         => 'https://www.lausd.net',
            'population'      => 4000000,
        ]);

        BondMeasure::create([
            'agency_id'          => $lausd->id,
            'measure_name'       => 'Measure RR',
            'measure_number'     => 'RR',
            'election_date'      => Carbon::parse('2020-11-03'),
            'result'             => 'passed',
            'vote_pct'           => 56.20,
            'bond_amount'        => 7000000000,
            'bond_purpose'       => 'Repair deteriorating classrooms, upgrade HVAC, remove hazardous materials, improve safety and security systems.',
            'project_categories' => ['HVAC', 'Roofing', 'Electrical', 'Safety & Security', 'Hazardous Materials', 'ADA Compliance'],
            'authorized_amount'  => 7000000000,
            'issued_amount'      => 3500000000,
            'unissued_amount'    => 3500000000,
            'source_url'         => 'https://www.lausd.net/bond-measure-rr',
            'source_document_title' => 'Measure RR Bond Program Summary',
            'source_date'        => Carbon::parse('2021-03-01'),
        ]);

        Contact::create([
            'agency_id'   => $lausd->id,
            'role'        => 'superintendent',
            'name'        => 'Alberto Carvalho',
            'email'       => 'acarvalho@lausd.net',
            'phone'       => '213-241-7000',
            'verified_at' => now(),
        ]);
        Contact::create([
            'agency_id' => $lausd->id,
            'role'      => 'facilities_director',
            'name'      => 'Mark Hovatter',
            'email'     => 'mhovatter@lausd.net',
            'phone'     => '213-241-8150',
        ]);

        Consultant::create([
            'agency_id'       => $lausd->id,
            'service_type'    => 'program_manager',
            'firm_name'       => 'AECOM',
            'contract_amount' => 120000000,
            'contract_date'   => Carbon::parse('2021-06-01'),
            'source_url'      => 'https://www.lausd.net/contracts/aecom',
        ]);
        Consultant::create([
            'agency_id'       => $lausd->id,
            'service_type'    => 'architect',
            'firm_name'       => 'LPA Architects',
            'contract_amount' => 45000000,
            'contract_date'   => Carbon::parse('2021-09-15'),
        ]);

        ProcurementEvent::create([
            'agency_id'    => $lausd->id,
            'event_type'   => 'award',
            'service_type' => 'program_manager',
            'title'        => 'Program Management Services — Measure RR',
            'issue_date'   => Carbon::parse('2021-04-01'),
            'award_date'   => Carbon::parse('2021-06-01'),
            'awarded_to'   => 'AECOM',
            'estimated_value' => 120000000,
            'source_url'   => 'https://www.lausd.net/board/2021-06-contract-award',
        ]);

        LeadScore::create([
            'agency_id'                  => $lausd->id,
            'score'                      => 85,
            'confidence'                 => 95,
            'opportunity_stage'          => 'bond_issued',
            'estimated_next_action'      => 'Identify active bid packages via AECOM project portal. Target materials testing or inspection scopes.',
            'recommended_outreach_angle' => 'LAUSD has $3.5B unissued from Measure RR. Reach out to AECOM PM team and Facilities Director about specialty inspection and testing subconsultant opportunities.',
            'scoring_factors'            => [
                ['factor' => 'bond_result_passed',    'points' => 40, 'reason' => 'Bond measure passed'],
                ['factor' => 'bond_amount_over_500m', 'points' => 20, 'reason' => 'Bond amount > $500M'],
                ['factor' => 'unissued_over_50pct',   'points' => 10, 'reason' => 'Unissued amount >50% of authorized'],
                ['factor' => 'many_project_categories','points' => 5, 'reason' => 'Bond covers 4+ project categories'],
                ['factor' => 'program_manager_exists','points' => -15, 'reason' => 'Program manager already awarded'],
            ],
            'approach_now'  => true,
            'scored_at'     => now(),
        ]);

        // ── 2. San Diego Community College District ───────────────────────────
        $sdccd = Agency::create([
            'name'            => 'San Diego Community College District',
            'normalized_name' => 'san-diego-community-college-district',
            'agency_type'     => 'community_college',
            'state'           => 'CA',
            'county'          => 'San Diego',
            'city'            => 'San Diego',
            'website'         => 'https://www.sdccd.edu',
            'population'      => 3300000,
        ]);

        BondMeasure::create([
            'agency_id'          => $sdccd->id,
            'measure_name'       => 'Proposition V',
            'measure_number'     => 'V',
            'election_date'      => Carbon::parse('2022-06-07'),
            'result'             => 'passed',
            'vote_pct'           => 67.43,
            'bond_amount'        => 3500000000,
            'bond_purpose'       => 'Modernize aging classrooms, labs, and career training facilities across three colleges and continuing education campuses.',
            'project_categories' => ['Classroom Modernization', 'Lab Upgrades', 'Career Technical Education', 'Energy Efficiency', 'ADA'],
            'authorized_amount'  => 3500000000,
            'issued_amount'      => 700000000,
            'unissued_amount'    => 2800000000,
            'source_url'         => 'https://www.sdccd.edu/bond-prop-v',
            'source_document_title' => 'Proposition V Facilities Master Plan',
            'source_date'        => Carbon::parse('2022-09-01'),
        ]);

        Contact::create([
            'agency_id'   => $sdccd->id,
            'role'        => 'ceo',
            'name'        => 'Carlos O. Turner Cortez',
            'email'       => 'ccortez@sdccd.edu',
            'phone'       => '619-388-6957',
            'verified_at' => now(),
        ]);
        Contact::create([
            'agency_id' => $sdccd->id,
            'role'      => 'facilities_director',
            'name'      => 'Bonnie Ann Dowd',
            'email'     => 'bdowd@sdccd.edu',
        ]);
        Contact::create([
            'agency_id' => $sdccd->id,
            'role'      => 'cbo',
            'name'      => 'Cynthia Olivo',
            'email'     => 'colivo@sdccd.edu',
        ]);

        Consultant::create([
            'agency_id'     => $sdccd->id,
            'service_type'  => 'architect',
            'firm_name'     => 'Gensler',
            'contract_amount' => 18000000,
            'contract_date' => Carbon::parse('2023-02-01'),
        ]);

        ProcurementEvent::create([
            'agency_id'    => $sdccd->id,
            'event_type'   => 'rfq_issued',
            'service_type' => 'program_manager',
            'title'        => 'RFQ – Program Management Services, Proposition V Bond Program',
            'issue_date'   => Carbon::parse('2023-07-15'),
            'due_date'     => Carbon::parse('2023-08-30'),
            'estimated_value' => 85000000,
            'source_url'   => 'https://www.sdccd.edu/purchasing/rfq-pm-prop-v',
        ]);

        LeadScore::create([
            'agency_id'                  => $sdccd->id,
            'score'                      => 82,
            'confidence'                 => 90,
            'opportunity_stage'          => 'rfq_active',
            'estimated_next_action'      => 'Obtain RFQ documents, confirm scope, and prepare response by due date.',
            'recommended_outreach_angle' => 'SDCCD has an active RFQ for Program Management on a $3.5B bond. Submit qualifications immediately and identify specialty inspection/testing scopes.',
            'scoring_factors'            => [
                ['factor' => 'bond_result_passed',    'points' => 40, 'reason' => 'Bond measure passed'],
                ['factor' => 'bond_amount_over_500m', 'points' => 20, 'reason' => 'Bond amount > $500M'],
                ['factor' => 'unissued_over_50pct',   'points' => 10, 'reason' => 'Unissued amount >50% of authorized'],
                ['factor' => 'rfq_active',            'points' => 15, 'reason' => 'Active RFQ/RFP procurement event found'],
                ['factor' => 'no_program_manager',    'points' => 10, 'reason' => 'No program manager consultant on record'],
                ['factor' => 'many_project_categories','points' => 5, 'reason' => 'Bond covers 4+ project categories'],
                ['factor' => 'recent_election_24mo',  'points' => 5,  'reason' => 'Bond election within last 24 months'],
            ],
            'approach_now' => true,
            'scored_at'    => now(),
        ]);

        // ── 3. City of Sacramento ─────────────────────────────────────────────
        $sacramento = Agency::create([
            'name'            => 'City of Sacramento',
            'normalized_name' => 'city-of-sacramento',
            'agency_type'     => 'city',
            'state'           => 'CA',
            'county'          => 'Sacramento',
            'city'            => 'Sacramento',
            'website'         => 'https://www.cityofsacramento.org',
            'population'      => 524943,
        ]);

        BondMeasure::create([
            'agency_id'          => $sacramento->id,
            'measure_name'       => 'Measure J',
            'measure_number'     => 'J',
            'election_date'      => Carbon::parse('2024-03-05'),
            'result'             => 'pending',
            'vote_pct'           => null,
            'bond_amount'        => 500000000,
            'bond_purpose'       => 'Infrastructure repairs, park improvements, public safety facility upgrades.',
            'project_categories' => ['Infrastructure', 'Parks', 'Public Safety', 'Roads'],
            'authorized_amount'  => null,
            'issued_amount'      => null,
            'unissued_amount'    => null,
            'source_url'         => 'https://www.cityofsacramento.org/measure-j',
            'source_document_title' => 'Measure J Ballot Summary',
            'source_date'        => Carbon::parse('2024-01-15'),
        ]);

        Contact::create([
            'agency_id' => $sacramento->id,
            'role'      => 'city_manager',
            'name'      => 'Howard Chan',
            'email'     => 'hchan@cityofsacramento.org',
            'phone'     => '916-808-5704',
        ]);
        Contact::create([
            'agency_id' => $sacramento->id,
            'role'      => 'purchasing_director',
            'name'      => 'Leyne Milstein',
            'email'     => 'lmilstein@cityofsacramento.org',
        ]);

        ProcurementEvent::create([
            'agency_id'    => $sacramento->id,
            'event_type'   => 'board_approval',
            'service_type' => 'infrastructure',
            'title'        => 'City Council Approval – Measure J Bond Resolution',
            'issue_date'   => Carbon::parse('2023-11-14'),
            'source_url'   => 'https://www.cityofsacramento.org/council/2023-11-14',
        ]);

        LeadScore::create([
            'agency_id'                  => $sacramento->id,
            'score'                      => 65,
            'confidence'                 => 60,
            'opportunity_stage'          => 'rfq_expected',
            'estimated_next_action'      => 'Monitor city website for RFQ posting post-election. Pre-qualify and build contact with Purchasing Director.',
            'recommended_outreach_angle' => 'Sacramento has a $500M bond on the March 2024 ballot. Position now for testing and inspection services if the measure passes.',
            'scoring_factors'            => [
                ['factor' => 'bond_result_pending',     'points' => 20, 'reason' => 'Bond measure pending election'],
                ['factor' => 'bond_amount_over_100m',   'points' => 15, 'reason' => 'Bond amount > $100M'],
                ['factor' => 'recent_board_approval',   'points' => 8,  'reason' => 'Board approval event in last 6 months'],
                ['factor' => 'no_program_manager',      'points' => 10, 'reason' => 'No program manager consultant on record'],
                ['factor' => 'many_project_categories', 'points' => 5,  'reason' => 'Bond covers 4+ project categories'],
                ['factor' => 'recent_election_12mo',    'points' => 10, 'reason' => 'Bond election within last 12 months'],
            ],
            'approach_now' => false,
            'scored_at'    => now(),
        ]);

        // ── 4. Santa Clara Valley Water District ─────────────────────────────
        $scvwd = Agency::create([
            'name'            => 'Santa Clara Valley Water District',
            'normalized_name' => 'santa-clara-valley-water-district',
            'agency_type'     => 'water_district',
            'state'           => 'CA',
            'county'          => 'Santa Clara',
            'city'            => 'San Jose',
            'website'         => 'https://www.valleywater.org',
            'population'      => 2000000,
        ]);

        BondMeasure::create([
            'agency_id'          => $scvwd->id,
            'measure_name'       => 'Measure S',
            'measure_number'     => 'S',
            'election_date'      => Carbon::parse('2021-11-02'),
            'result'             => 'passed',
            'vote_pct'           => 72.10,
            'bond_amount'        => 750000000,
            'bond_purpose'       => 'Expand water storage, reduce flood risk, and provide safe clean water for 2 million residents of Santa Clara County.',
            'project_categories' => ['Water Storage', 'Flood Control', 'Water Quality', 'Infrastructure Resilience'],
            'authorized_amount'  => 750000000,
            'issued_amount'      => 375000000,
            'unissued_amount'    => 375000000,
            'source_url'         => 'https://www.valleywater.org/measure-s',
            'source_document_title' => 'Measure S Expenditure Plan',
            'source_date'        => Carbon::parse('2022-01-10'),
        ]);

        Contact::create([
            'agency_id'   => $scvwd->id,
            'role'        => 'ceo',
            'name'        => 'Beau Goldie',
            'email'       => 'bgoldie@valleywater.org',
            'phone'       => '408-265-2607',
            'verified_at' => now(),
        ]);
        Contact::create([
            'agency_id' => $scvwd->id,
            'role'      => 'construction_director',
            'name'      => 'John Varela',
            'email'     => 'jvarela@valleywater.org',
        ]);

        Consultant::create([
            'agency_id'       => $scvwd->id,
            'service_type'    => 'geotechnical',
            'firm_name'       => 'Kleinfelder',
            'contract_amount' => 5500000,
            'contract_date'   => Carbon::parse('2022-06-01'),
        ]);

        ProcurementEvent::create([
            'agency_id'    => $scvwd->id,
            'event_type'   => 'rfp_issued',
            'service_type' => 'materials_testing',
            'title'        => 'RFP – Materials Testing and Inspection Services, Measure S Projects',
            'issue_date'   => Carbon::parse('2023-09-01'),
            'due_date'     => Carbon::parse('2023-10-15'),
            'estimated_value' => 12000000,
            'source_url'   => 'https://www.valleywater.org/procurement/rfp-mt-measure-s',
        ]);

        LeadScore::create([
            'agency_id'                  => $scvwd->id,
            'score'                      => 78,
            'confidence'                 => 85,
            'opportunity_stage'          => 'rfq_active',
            'estimated_next_action'      => 'Obtain RFP documents for materials testing and inspection. Prepare response and submit qualifications.',
            'recommended_outreach_angle' => 'Santa Clara Valley Water has an active RFP for materials testing on their $750M Measure S bond program. Strong opportunity for geotechnical and materials testing services.',
            'scoring_factors'            => [
                ['factor' => 'bond_result_passed',    'points' => 40, 'reason' => 'Bond measure passed'],
                ['factor' => 'bond_amount_over_100m', 'points' => 15, 'reason' => 'Bond amount > $100M'],
                ['factor' => 'unissued_over_50pct',   'points' => 10, 'reason' => 'Unissued amount >50% of authorized'],
                ['factor' => 'rfq_active',            'points' => 15, 'reason' => 'Active RFQ/RFP procurement event found'],
                ['factor' => 'no_program_manager',    'points' => 10, 'reason' => 'No program manager consultant on record'],
                ['factor' => 'many_project_categories','points' => 5, 'reason' => 'Bond covers 4+ project categories'],
            ],
            'approach_now' => true,
            'scored_at'    => now(),
        ]);

        // ── 5. Bay Area Rapid Transit ─────────────────────────────────────────
        $bart = Agency::create([
            'name'            => 'Bay Area Rapid Transit',
            'normalized_name' => 'bay-area-rapid-transit',
            'agency_type'     => 'transit',
            'state'           => 'CA',
            'county'          => 'Alameda',
            'city'            => 'Oakland',
            'website'         => 'https://www.bart.gov',
            'population'      => 4700000,
        ]);

        BondMeasure::create([
            'agency_id'          => $bart->id,
            'measure_name'       => 'Measure RR',
            'measure_number'     => 'RR',
            'election_date'      => Carbon::parse('2016-11-08'),
            'result'             => 'passed',
            'vote_pct'           => 70.10,
            'bond_amount'        => 3500000000,
            'bond_purpose'       => 'Replace aging rail cars, repair infrastructure, improve earthquake safety and seismic retrofits, upgrade stations.',
            'project_categories' => ['Rail Car Replacement', 'Seismic Safety', 'Station Modernization', 'Track & Systems', 'Safety'],
            'authorized_amount'  => 3500000000,
            'issued_amount'      => 2800000000,
            'unissued_amount'    => 700000000,
            'source_url'         => 'https://www.bart.gov/measure-rr',
            'source_document_title' => 'BART Measure RR Bond Expenditure Plan',
            'source_date'        => Carbon::parse('2023-07-01'),
        ]);
        BondMeasure::create([
            'agency_id'          => $bart->id,
            'measure_name'       => 'BART Safety, Reliability and Traffic Relief Program',
            'measure_number'     => null,
            'election_date'      => Carbon::parse('2020-03-03'),
            'result'             => 'failed',
            'vote_pct'           => 54.87,
            'bond_amount'        => 3500000000,
            'bond_purpose'       => 'Second measure to expand BART system into new areas and continue safety upgrades.',
            'project_categories' => ['Expansion', 'Safety', 'Reliability'],
            'authorized_amount'  => null,
            'issued_amount'      => null,
            'unissued_amount'    => null,
            'source_url'         => 'https://www.bart.gov/expansion-bond-2020',
            'source_document_title' => '2020 BART Expansion Bond — Election Results',
            'source_date'        => Carbon::parse('2020-03-15'),
        ]);

        Contact::create([
            'agency_id' => $bart->id,
            'role'      => 'ceo',
            'name'      => 'Bob Powers',
            'email'     => 'bpowers@bart.gov',
            'phone'     => '510-464-6000',
        ]);
        Contact::create([
            'agency_id' => $bart->id,
            'role'      => 'bond_program_manager',
            'name'      => 'Joshua Cohen',
            'email'     => 'jcohen@bart.gov',
        ]);

        Consultant::create([
            'agency_id'       => $bart->id,
            'service_type'    => 'program_manager',
            'firm_name'       => 'WSP USA',
            'contract_amount' => 95000000,
            'contract_date'   => Carbon::parse('2017-09-01'),
            'source_url'      => 'https://www.bart.gov/contracts/wsp',
        ]);
        Consultant::create([
            'agency_id'       => $bart->id,
            'service_type'    => 'construction_manager',
            'firm_name'       => 'Hill International',
            'contract_amount' => 42000000,
            'contract_date'   => Carbon::parse('2018-03-15'),
        ]);

        ProcurementEvent::create([
            'agency_id'    => $bart->id,
            'event_type'   => 'contract_executed',
            'service_type' => 'program_manager',
            'title'        => 'Program Management Contract — Measure RR Bond Program',
            'issue_date'   => Carbon::parse('2017-07-01'),
            'award_date'   => Carbon::parse('2017-09-01'),
            'awarded_to'   => 'WSP USA',
            'estimated_value' => 95000000,
            'source_url'   => 'https://www.bart.gov/board/2017-09-contract',
        ]);

        LeadScore::create([
            'agency_id'                  => $bart->id,
            'score'                      => 55,
            'confidence'                 => 80,
            'opportunity_stage'          => 'construction_active',
            'estimated_next_action'      => 'Identify active bid packages via WSP project portal. Target specialty inspection or materials testing scopes.',
            'recommended_outreach_angle' => 'BART has $700M unissued from Measure RR with active construction. Reach out to WSP PM team about sub-consultant opportunities in inspection and testing.',
            'scoring_factors'            => [
                ['factor' => 'bond_result_passed',      'points' => 40,  'reason' => 'Bond measure passed'],
                ['factor' => 'bond_amount_over_500m',   'points' => 20,  'reason' => 'Bond amount > $500M'],
                ['factor' => 'many_project_categories', 'points' => 5,   'reason' => 'Bond covers 4+ project categories'],
                ['factor' => 'program_manager_exists',  'points' => -15, 'reason' => 'Program manager already awarded'],
            ],
            'approach_now' => false,
            'scored_at'    => now(),
        ]);
    }
}
