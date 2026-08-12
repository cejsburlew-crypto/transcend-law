<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use Illuminate\Http\Request;
use League\Csv\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function exportCsv(Request $request): StreamedResponse
    {
        $agencies = $this->buildAgencyQuery($request)->get();

        $filename = 'bond-intelligence-export-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($agencies) {
            $csv = Writer::createFromFileObject(new \SplTempFileObject());
            $csv->setOutputBOM(Writer::BOM_UTF8);

            $csv->insertOne([
                'Agency Name',
                'State',
                'County',
                'City',
                'Agency Type',
                'Website',
                'Population',
                'Bond Measure',
                'Election Date',
                'Bond Amount',
                'Result',
                'Vote Pct',
                'Authorized Amount',
                'Issued Amount',
                'Unissued Amount',
                'Lead Score',
                'Opportunity Stage',
                'Approach Now',
                'Recommended Outreach Angle',
                'Key Contacts',
            ]);

            foreach ($agencies as $agency) {
                $bond = $agency->bondMeasures->sortByDesc('bond_amount')->first();
                $ls   = $agency->leadScore;
                $contacts = $agency->contacts->map(fn($c) => "{$c->name} ({$c->role})")->implode('; ');

                $csv->insertOne([
                    $agency->name,
                    $agency->state,
                    $agency->county,
                    $agency->city,
                    $agency->agency_type,
                    $agency->website,
                    $agency->population,
                    $bond?->measure_name,
                    $bond?->election_date?->format('Y-m-d'),
                    $bond?->bond_amount,
                    $bond?->result,
                    $bond?->vote_pct,
                    $bond?->authorized_amount,
                    $bond?->issued_amount,
                    $bond?->unissued_amount,
                    $ls?->score ?? 0,
                    $ls?->opportunity_stage_label ?? '',
                    $ls?->approach_now ? 'Yes' : 'No',
                    $ls?->recommended_outreach_angle,
                    $contacts,
                ]);
            }

            echo $csv->toString();
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function exportCrm(Request $request): StreamedResponse
    {
        $agencies = $this->buildAgencyQuery($request)->get();

        $filename = 'bond-intelligence-crm-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($agencies) {
            $csv = Writer::createFromFileObject(new \SplTempFileObject());
            $csv->setOutputBOM(Writer::BOM_UTF8);

            $csv->insertOne([
                'Company',
                'State',
                'Industry',
                'Website',
                'Lead Score',
                'Lead Source',
                'Opportunity Stage',
                'Bond Amount',
                'Next Action',
                'Notes',
                'Primary Contact Name',
                'Primary Contact Title',
                'Primary Contact Email',
            ]);

            foreach ($agencies as $agency) {
                $bond    = $agency->bondMeasures->sortByDesc('bond_amount')->first();
                $ls      = $agency->leadScore;
                $contact = $agency->contacts->first();

                $csv->insertOne([
                    $agency->name,
                    $agency->state,
                    $this->mapAgencyTypeToIndustry($agency->agency_type),
                    $agency->website,
                    $ls?->score ?? 0,
                    'Bond Intelligence Scraper',
                    $ls?->opportunity_stage_label ?? '',
                    $bond?->bond_amount,
                    $ls?->estimated_next_action,
                    $ls?->recommended_outreach_angle,
                    $contact?->name,
                    $contact?->role,
                    $contact?->email,
                ]);
            }

            echo $csv->toString();
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function buildAgencyQuery(Request $request)
    {
        $query = Agency::with(['bondMeasures', 'contacts', 'leadScore']);

        if ($request->filled('state')) {
            $query->where('state', strtoupper($request->string('state')));
        }
        if ($request->filled('agency_type')) {
            $query->where('agency_type', $request->input('agency_type'));
        }
        if ($request->filled('min_score')) {
            $query->whereHas('leadScore', fn($q) => $q->where('score', '>=', (int) $request->input('min_score')));
        }
        if ($request->boolean('approach_now')) {
            $query->whereHas('leadScore', fn($q) => $q->where('approach_now', true));
        }

        return $query->orderBy('name');
    }

    private function mapAgencyTypeToIndustry(string $type): string
    {
        return match ($type) {
            'k12_district'     => 'K-12 Education',
            'community_college'=> 'Higher Education',
            'university'       => 'Higher Education',
            'city'             => 'Municipal Government',
            'county'           => 'County Government',
            'water_district'   => 'Water/Utilities',
            'hospital_district'=> 'Healthcare',
            'transit'          => 'Transportation',
            'airport'          => 'Transportation',
            'port'             => 'Transportation',
            'special_district' => 'Special District',
            default            => 'Government',
        };
    }
}
