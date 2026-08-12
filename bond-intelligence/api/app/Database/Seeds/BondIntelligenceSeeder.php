<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class BondIntelligenceSeeder extends Seeder
{
    public function run()
    {
        $db = \Config\Database::connect();

        // ----------------------------------------------------------------
        // Agencies
        // ----------------------------------------------------------------
        $agencies = [
            // CA K-12
            ['id'=>1,'name'=>'Los Angeles Unified School District','normalized_name'=>'los angeles usd','agency_type'=>'k12_district','state'=>'CA','county'=>'Los Angeles','city'=>'Los Angeles','website'=>'https://www.lausd.net','enrollment'=>600000,'num_schools'=>1000,'cdiac_id'=>'LA-USD-001','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            ['id'=>2,'name'=>'San Diego Unified School District','normalized_name'=>'san diego usd','agency_type'=>'k12_district','state'=>'CA','county'=>'San Diego','city'=>'San Diego','website'=>'https://www.sandi.net','enrollment'=>120000,'num_schools'=>225,'cdiac_id'=>'SD-USD-001','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            ['id'=>3,'name'=>'Fresno Unified School District','normalized_name'=>'fresno usd','agency_type'=>'k12_district','state'=>'CA','county'=>'Fresno','city'=>'Fresno','website'=>'https://www.fresnounified.org','enrollment'=>73000,'num_schools'=>109,'cdiac_id'=>'FR-USD-001','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            ['id'=>4,'name'=>'Sacramento City Unified School District','normalized_name'=>'sacramento city usd','agency_type'=>'k12_district','state'=>'CA','county'=>'Sacramento','city'=>'Sacramento','website'=>'https://www.scusd.edu','enrollment'=>42000,'num_schools'=>80,'cdiac_id'=>'SAC-USD-001','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            ['id'=>5,'name'=>'Oakland Unified School District','normalized_name'=>'oakland usd','agency_type'=>'k12_district','state'=>'CA','county'=>'Alameda','city'=>'Oakland','website'=>'https://www.ousd.org','enrollment'=>50000,'num_schools'=>95,'cdiac_id'=>'OAK-USD-001','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            // CA Community College
            ['id'=>6,'name'=>'Los Angeles Community College District','normalized_name'=>'los angeles ccd','agency_type'=>'community_college','state'=>'CA','county'=>'Los Angeles','city'=>'Los Angeles','website'=>'https://www.laccd.edu','enrollment'=>250000,'num_schools'=>9,'cdiac_id'=>'LACCD-001','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            ['id'=>7,'name'=>'San Diego Community College District','normalized_name'=>'san diego ccd','agency_type'=>'community_college','state'=>'CA','county'=>'San Diego','city'=>'San Diego','website'=>'https://www.sdccd.edu','enrollment'=>100000,'num_schools'=>3,'cdiac_id'=>'SDCCD-001','created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            // TX K-12
            ['id'=>8,'name'=>'Houston Independent School District','normalized_name'=>'houston isd','agency_type'=>'k12_district','state'=>'TX','county'=>'Harris','city'=>'Houston','website'=>'https://www.houstonisd.org','enrollment'=>194000,'num_schools'=>274,'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            ['id'=>9,'name'=>'Dallas Independent School District','normalized_name'=>'dallas isd','agency_type'=>'k12_district','state'=>'TX','county'=>'Dallas','city'=>'Dallas','website'=>'https://www.dallasisd.org','enrollment'=>145000,'num_schools'=>230,'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            ['id'=>10,'name'=>'Austin Independent School District','normalized_name'=>'austin isd','agency_type'=>'k12_district','state'=>'TX','county'=>'Travis','city'=>'Austin','website'=>'https://www.austinisd.org','enrollment'=>73000,'num_schools'=>130,'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
            // AZ
            ['id'=>11,'name'=>'Mesa Unified School District','normalized_name'=>'mesa usd','agency_type'=>'k12_district','state'=>'AZ','county'=>'Maricopa','city'=>'Mesa','website'=>'https://www.mpsaz.org','enrollment'=>64000,'num_schools'=>70,'created_at'=>date('Y-m-d H:i:s'),'updated_at'=>date('Y-m-d H:i:s')],
        ];

        foreach ($agencies as $a) {
            if (!$db->table('agencies')->where('id', $a['id'])->get()->getRow()) {
                $db->table('agencies')->insert($a);
            }
        }

        // ----------------------------------------------------------------
        // Bond Measures
        // ----------------------------------------------------------------
        $now   = date('Y-m-d H:i:s');
        $bonds = [
            // LAUSD — Measure RR (2020, passed)
            ['agency_id'=>1,'measure_name'=>'Measure RR','measure_letter'=>'RR','election_date'=>'2020-11-03','election_type'=>'general','bond_amount'=>7000000000,'authorized_amount'=>7000000000,'issued_amount'=>2100000000,'unissued_amount'=>4900000000,'result'=>'passed','vote_pct'=>56.8,'required_threshold'=>55.0,'bond_purpose'=>'Renovate aging schools, upgrade technology, replace portable classrooms','project_categories'=>'["modernization","technology","safety_security"]','state'=>'CA','source_url'=>'https://ballotpedia.org/Los_Angeles_Unified_School_District,_California,_Measure_RR_(November_2020)','created_at'=>$now,'updated_at'=>$now],
            // SDUSD — Proposition Z (2022, passed)
            ['agency_id'=>2,'measure_name'=>'Proposition Z','measure_letter'=>'Z','election_date'=>'2022-11-08','election_type'=>'general','bond_amount'=>3200000000,'authorized_amount'=>3200000000,'issued_amount'=>900000000,'unissued_amount'=>2300000000,'result'=>'passed','vote_pct'=>61.2,'required_threshold'=>55.0,'bond_purpose'=>'New schools, modernize facilities, STEM labs, safety improvements','project_categories'=>'["new_construction","stem_facilities","safety_security","modernization"]','state'=>'CA','source_url'=>'https://ballotpedia.org/San_Diego_Unified_School_District,_California,_Measure_Z_(November_2022)','created_at'=>$now,'updated_at'=>$now],
            // Fresno USD — Measure X (2024, passed)
            ['agency_id'=>3,'measure_name'=>'Measure X','measure_letter'=>'X','election_date'=>'2024-03-05','election_type'=>'primary','bond_amount'=>485000000,'authorized_amount'=>485000000,'issued_amount'=>0,'unissued_amount'=>485000000,'result'=>'passed','vote_pct'=>60.4,'required_threshold'=>55.0,'bond_purpose'=>'New elementary school, athletic facilities, CTE labs, deferred maintenance','project_categories'=>'["new_construction","athletics","stem_facilities","deferred_maintenance"]','state'=>'CA','source_url'=>'https://ballotpedia.org/Fresno_Unified_School_District,_California,_Measure_X_(March_2024)','created_at'=>$now,'updated_at'=>$now],
            // Sacramento City USD — Measure A (2023, passed)
            ['agency_id'=>4,'measure_name'=>'Measure A','measure_letter'=>'A','election_date'=>'2023-11-07','election_type'=>'general','bond_amount'=>750000000,'authorized_amount'=>750000000,'issued_amount'=>150000000,'unissued_amount'=>600000000,'result'=>'passed','vote_pct'=>66.1,'required_threshold'=>55.0,'bond_purpose'=>'Modernize aging classrooms, new STEM labs, safety upgrades, technology','project_categories'=>'["modernization","stem_facilities","safety_security","technology"]','state'=>'CA','source_url'=>'https://ballotpedia.org/Sacramento_City_Unified_School_District,_California,_Measure_A_(November_2023)','created_at'=>$now,'updated_at'=>$now],
            // Oakland USD — Measure G (2022, passed)
            ['agency_id'=>5,'measure_name'=>'Measure G','measure_letter'=>'G','election_date'=>'2022-06-07','election_type'=>'primary','bond_amount'=>735000000,'authorized_amount'=>735000000,'issued_amount'=>220000000,'unissued_amount'=>515000000,'result'=>'passed','vote_pct'=>72.3,'required_threshold'=>55.0,'bond_purpose'=>'School modernization, seismic safety, clean water, energy efficiency','project_categories'=>'["modernization","seismic_retrofit","energy_efficiency","water_infrastructure"]','state'=>'CA','source_url'=>'https://ballotpedia.org/Oakland_Unified_School_District,_California,_Measure_G_(June_2022)','created_at'=>$now,'updated_at'=>$now],
            // LACCD — Measure LA (2023, passed)
            ['agency_id'=>6,'measure_name'=>'Measure LA','measure_letter'=>'LA','election_date'=>'2023-11-07','election_type'=>'general','bond_amount'=>5500000000,'authorized_amount'=>5500000000,'issued_amount'=>1100000000,'unissued_amount'=>4400000000,'result'=>'passed','vote_pct'=>58.9,'required_threshold'=>55.0,'bond_purpose'=>'Modernize campuses, workforce training facilities, emergency preparedness, technology','project_categories'=>'["modernization","technology","safety_security","stem_facilities"]','state'=>'CA','source_url'=>'https://ballotpedia.org/Los_Angeles_Community_College_District,_California,_Measure_LA_(November_2023)','created_at'=>$now,'updated_at'=>$now],
            // San Diego CCD — Measure J (2022, passed)
            ['agency_id'=>7,'measure_name'=>'Measure J','measure_letter'=>'J','election_date'=>'2022-11-08','election_type'=>'general','bond_amount'=>3500000000,'authorized_amount'=>3500000000,'issued_amount'=>700000000,'unissued_amount'=>2800000000,'result'=>'passed','vote_pct'=>64.7,'required_threshold'=>55.0,'bond_purpose'=>'New student services buildings, modernize classrooms, CTE expansion','project_categories'=>'["new_construction","modernization","stem_facilities"]','state'=>'CA','source_url'=>'https://ballotpedia.org/San_Diego_Community_College_District,_California,_Measure_J_(November_2022)','created_at'=>$now,'updated_at'=>$now],
            // HISD — 2023 bond (TX)
            ['agency_id'=>8,'measure_name'=>'2023 Bond Proposition A','measure_letter'=>'A','election_date'=>'2023-11-07','election_type'=>'general','bond_amount'=>4400000000,'authorized_amount'=>4400000000,'issued_amount'=>0,'unissued_amount'=>4400000000,'result'=>'passed','vote_pct'=>63.5,'required_threshold'=>50.0,'bond_purpose'=>'New schools, modernize campuses, safety, technology, athletics','project_categories'=>'["new_construction","modernization","safety_security","technology","athletics"]','state'=>'TX','source_url'=>'https://www.houstonisd.org/bondprogram','created_at'=>$now,'updated_at'=>$now],
            // Dallas ISD — 2024 bond
            ['agency_id'=>9,'measure_name'=>'2024 Bond Proposition A','measure_letter'=>'A','election_date'=>'2024-05-04','election_type'=>'special','bond_amount'=>3700000000,'authorized_amount'=>3700000000,'issued_amount'=>0,'unissued_amount'=>3700000000,'result'=>'passed','vote_pct'=>68.2,'required_threshold'=>50.0,'bond_purpose'=>'New campuses, CTE centers, athletics, security upgrades','project_categories'=>'["new_construction","stem_facilities","athletics","safety_security"]','state'=>'TX','source_url'=>'https://www.dallasisd.org/bondprogram','created_at'=>$now,'updated_at'=>$now],
            // Austin ISD — 2022 bond
            ['agency_id'=>10,'measure_name'=>'Proposition A','measure_letter'=>'A','election_date'=>'2022-11-08','election_type'=>'general','bond_amount'=>2442000000,'authorized_amount'=>2442000000,'issued_amount'=>610000000,'unissued_amount'=>1832000000,'result'=>'passed','vote_pct'=>71.0,'required_threshold'=>50.0,'bond_purpose'=>'New elementary schools, modernize high schools, STEM, transportation','project_categories'=>'["new_construction","modernization","stem_facilities","transportation"]','state'=>'TX','source_url'=>'https://www.austinisd.org/bond','created_at'=>$now,'updated_at'=>$now],
            // Mesa USD — 2023 bond (AZ)
            ['agency_id'=>11,'measure_name'=>'Proposition 201','measure_letter'=>'201','election_date'=>'2023-11-07','election_type'=>'general','bond_amount'=>450000000,'authorized_amount'=>450000000,'issued_amount'=>0,'unissued_amount'=>450000000,'result'=>'passed','vote_pct'=>57.1,'required_threshold'=>50.0,'bond_purpose'=>'School safety, technology, deferred maintenance, CTE','project_categories'=>'["safety_security","technology","deferred_maintenance","stem_facilities"]','state'=>'AZ','source_url'=>'https://www.mpsaz.org/bond','created_at'=>$now,'updated_at'=>$now],
        ];

        foreach ($bonds as $b) {
            if (!$db->table('bond_measures')->where('agency_id', $b['agency_id'])->where('measure_name', $b['measure_name'])->get()->getRow()) {
                $db->table('bond_measures')->insert($b);
            }
        }

        // ----------------------------------------------------------------
        // Procurement Events
        // ----------------------------------------------------------------
        $procurements = [
            ['agency_id'=>3,'title'=>'RFQ: Program Management Services — Measure X Bond Program','event_type'=>'rfq_issued','service_type'=>'program_manager','issue_date'=>'2026-06-17','due_date'=>'2026-07-17','estimated_value'=>8500000,'status'=>'active','description'=>'Fresno USD seeks a qualified program management firm for the Measure X $485M bond program.','state'=>'CA','portal_name'=>'PlanetBids','source_url'=>'https://www.planetbids.com/portal/portal.cfm?CompanyID=35798','created_at'=>$now,'updated_at'=>$now],
            ['agency_id'=>4,'title'=>'RFQ: Construction Management Services — Measure A','event_type'=>'rfq_issued','service_type'=>'construction_manager','issue_date'=>'2026-06-22','due_date'=>'2026-07-22','estimated_value'=>12000000,'status'=>'active','description'=>'Sacramento City USD Measure A seeks CM at-risk services for multiple school modernization projects.','state'=>'CA','portal_name'=>'PlanetBids','source_url'=>'https://www.planetbids.com/portal/portal.cfm?CompanyID=27735','created_at'=>$now,'updated_at'=>$now],
            ['agency_id'=>8,'title'=>'RFP: Program Management Oversight — HISD 2023 Bond','event_type'=>'rfp_issued','service_type'=>'program_manager','issue_date'=>'2026-06-12','due_date'=>'2026-07-07','estimated_value'=>45000000,'status'=>'active','description'=>'Houston ISD seeks experienced owner-representative and program oversight services for $4.4B bond.','state'=>'TX','portal_name'=>'ESBD','source_url'=>'https://esbd.hhs.texas.gov/','created_at'=>$now,'updated_at'=>$now],
            ['agency_id'=>1,'title'=>'RFQ: Materials Testing and Special Inspection — LAUSD Measure RR','event_type'=>'rfq_issued','service_type'=>'testing','issue_date'=>'2026-06-24','due_date'=>'2026-07-27','estimated_value'=>5000000,'status'=>'active','description'=>'LAUSD Measure RR program seeks DSA-certified materials testing and special inspection services.','state'=>'CA','portal_name'=>'PlanetBids','source_url'=>'https://www.planetbids.com/portal/portal.cfm?CompanyID=15505','created_at'=>$now,'updated_at'=>$now],
        ];

        foreach ($procurements as $p) {
            if (!$db->table('procurement_events')->where('agency_id', $p['agency_id'])->where('title', $p['title'])->get()->getRow()) {
                $db->table('procurement_events')->insert($p);
            }
        }

        // ----------------------------------------------------------------
        // Contacts
        // ----------------------------------------------------------------
        $contacts = [
            ['agency_id'=>3,'name'=>'Dr. Bob Nelson','title'=>'Superintendent','email'=>'bnelson@fresnounified.org','contact_type'=>'superintendent','source_url'=>'https://www.fresnounified.org','created_at'=>$now,'updated_at'=>$now],
            ['agency_id'=>3,'name'=>'Karin Temple','title'=>'Chief Business Officer','email'=>'ktemple@fresnounified.org','contact_type'=>'cbo','source_url'=>'https://www.fresnounified.org','created_at'=>$now,'updated_at'=>$now],
            ['agency_id'=>4,'name'=>'Jorge Aguilar','title'=>'Superintendent','email'=>'jaguilar@scusd.edu','contact_type'=>'superintendent','source_url'=>'https://www.scusd.edu','created_at'=>$now,'updated_at'=>$now],
            ['agency_id'=>8,'name'=>'Mike Miles','title'=>'Superintendent','email'=>'mmiles@houstonisd.org','contact_type'=>'superintendent','source_url'=>'https://www.houstonisd.org','created_at'=>$now,'updated_at'=>$now],
        ];

        foreach ($contacts as $c) {
            if (!$db->table('contacts')->where('agency_id', $c['agency_id'])->where('name', $c['name'])->get()->getRow()) {
                $db->table('contacts')->insert($c);
            }
        }

        // ----------------------------------------------------------------
        // Source Documents
        // ----------------------------------------------------------------
        $sources = [
            ['agency_id'=>1,'url'=>'https://ballotpedia.org/Los_Angeles_Unified_School_District,_California,_Measure_RR_(November_2020)','url_hash'=>hash('sha256','https://ballotpedia.org/Los_Angeles_Unified_School_District,_California,_Measure_RR_(November_2020)'),'doc_type'=>'election_result','title'=>'LAUSD Measure RR Election Result','scraped_at'=>date('Y-m-d H:i:s'),'state'=>'CA','created_at'=>$now,'updated_at'=>$now],
            ['agency_id'=>2,'url'=>'https://ballotpedia.org/San_Diego_Unified_School_District,_California,_Measure_Z_(November_2022)','url_hash'=>hash('sha256','https://ballotpedia.org/San_Diego_Unified_School_District,_California,_Measure_Z_(November_2022)'),'doc_type'=>'election_result','title'=>'SDUSD Proposition Z Election Result','scraped_at'=>date('Y-m-d H:i:s'),'state'=>'CA','created_at'=>$now,'updated_at'=>$now],
        ];

        foreach ($sources as $s) {
            if (!$db->table('source_documents')->where('url_hash', $s['url_hash'])->get()->getRow()) {
                $db->table('source_documents')->insert($s);
            }
        }

        // ----------------------------------------------------------------
        // Scrape Runs (sample history) — only seed if table is empty
        // ----------------------------------------------------------------
        if ($db->table('scrape_runs')->countAll() === 0) {
            $runs = [
                ['scraper_name'=>'cdiac','state'=>'CA','started_at'=>date('Y-m-d H:i:s', strtotime('-7 days')),'completed_at'=>date('Y-m-d H:i:s', strtotime('-7 days +4 minutes')),'status'=>'complete','records_found'=>1240,'records_added'=>87,'records_updated'=>312,'errors'=>'[]','notes'=>'Full CDIAC DebtWatch K-14 + authorized/unissued scrape'],
                ['scraper_name'=>'tx_brb','state'=>'TX','started_at'=>date('Y-m-d H:i:s', strtotime('-7 days +1 hour')),'completed_at'=>date('Y-m-d H:i:s', strtotime('-7 days +1 hour +3 minutes')),'status'=>'complete','records_found'=>890,'records_added'=>62,'records_updated'=>201,'errors'=>'[]','notes'=>'TX BRB elections + issuances'],
                ['scraper_name'=>'ballotpedia','state'=>null,'started_at'=>date('Y-m-d H:i:s', strtotime('-7 days +2 hours')),'completed_at'=>date('Y-m-d H:i:s', strtotime('-7 days +2 hours +8 minutes')),'status'=>'complete','records_found'=>550,'records_added'=>44,'records_updated'=>98,'errors'=>'[]','notes'=>'All target states'],
                ['scraper_name'=>'procurement','state'=>null,'started_at'=>date('Y-m-d H:i:s', strtotime('-1 day')),'completed_at'=>date('Y-m-d H:i:s', strtotime('-1 day +2 minutes')),'status'=>'complete','records_found'=>78,'records_added'=>12,'records_updated'=>34,'errors'=>'[]','notes'=>'PlanetBids + BidNet daily run'],
            ];
            foreach ($runs as $r) {
                $db->table('scrape_runs')->insert($r);
            }
        }

        echo "BondIntelligenceSeeder: Seed data inserted successfully.\n";
    }
}
