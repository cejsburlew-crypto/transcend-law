import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScraperService } from '../../core/services/scraper.service';
import { ScrapeRun } from '../../core/models/agency.model';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

interface ScraperCard {
  key: string;
  label: string;
  description: string;
  state: string;
  icon: string;
}

interface StateSource {
  name: string;
  url: string;
  icon: string;
  description: string;
}

interface StateSourceEntry {
  state: string;
  stateName: string;
  sources: StateSource[];
}

@Component({
  selector: 'app-scraper-status',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent],
  templateUrl: './scraper-status.component.html',
  styleUrls: ['./scraper-status.component.scss']
})
export class ScraperStatusComponent implements OnInit, OnDestroy {
  private scraperService = inject(ScraperService);
  private refreshInterval: any;

  runs: ScrapeRun[] = [];
  loading = true;
  triggering: Record<string, boolean> = {};
  messages: Record<string, string> = {};
  selectedStates = new Set<string>();

  // Geographic grid layout — null = empty cell
  mapGrid: (string | null)[] = [
    null, null, null, null, null, null, null, null, null, 'ME',
    null, null, null, null, null, null, null, null, 'VT', 'NH',
    null, null, null, null, null, null, 'WI', null, 'NY', 'MA',
    null, 'WA', 'ID', 'MT', 'ND', 'MN', 'IL', 'MI', 'PA', 'RI',
    null, 'OR', 'NV', 'WY', 'SD', 'IA', 'IN', 'OH', 'NJ', 'CT',
    null, 'CA', 'UT', 'CO', 'NE', 'MO', 'KY', 'WV', 'VA', 'DE',
    null, null, 'AZ', 'NM', 'KS', 'AR', 'TN', 'NC', 'MD', null,
    null, null, null, null, 'OK', 'LA', 'MS', 'AL', 'GA', 'SC',
    null, null, null, 'AK', 'TX', null, null, null, 'FL', null,
    null, null, null, null, null, null, null, null, 'HI', null,
  ];

  scrapers: ScraperCard[] = [
    { key: 'cdiac',       label: 'CDIAC DebtWatch',         description: 'California K-14 bond elections & authorized unissued amounts', state: 'CA', icon: 'account_balance' },
    { key: 'tx_brb',      label: 'Texas Bond Review Board',  description: 'Texas local government bond election results & debt issuance', state: 'TX', icon: 'how_to_vote' },
    { key: 'ballotpedia', label: 'Ballotpedia',              description: 'School bond elections across all target states', state: 'ALL', icon: 'ballot' },
    { key: 'procurement', label: 'Procurement Portals',      description: 'RFQs/RFPs for PM, CM, inspection, testing from Cal eProcure & TX SmartBuy', state: 'ALL', icon: 'gavel' },
  ];

  stateSources: StateSourceEntry[] = [
    { state: 'CA', stateName: 'California', sources: [
      { name: 'CDIAC DebtWatch', url: 'https://www.cdiac.ca.gov/reports/debtdata.html', icon: 'account_balance', description: 'Authorized, issued & unissued K-14 bond debt by district' },
      { name: 'CA Secretary of State', url: 'https://www.sos.ca.gov/elections/ballot-measures', icon: 'how_to_vote', description: 'Official bond measure election results' },
      { name: 'Cal eProcure', url: 'https://caleprocure.ca.gov/pages/index.aspx', icon: 'gavel', description: 'State procurement portal — RFQs and contract awards' },
      { name: 'PlanetBids', url: 'https://www.planetbids.com', icon: 'gavel', description: 'K-12 & community college district bid portals' },
    ]},
    { state: 'TX', stateName: 'Texas', sources: [
      { name: 'TX Bond Review Board', url: 'https://www.brb.texas.gov/bond/election.aspx', icon: 'account_balance', description: 'Texas bond election results & authorized debt registry' },
      { name: 'TX Secretary of State', url: 'https://www.sos.state.tx.us/elections/index.shtml', icon: 'how_to_vote', description: 'Official election results including bond measures' },
      { name: 'TX SmartBuy', url: 'https://www.txsmartbuy.com', icon: 'gavel', description: 'Texas state procurement — professional services RFPs' },
      { name: 'TxEIS Procurement', url: 'https://www.esc1.net/page/TxEIS-Purchasing', icon: 'gavel', description: 'Region-based ISD procurement portal' },
    ]},
    { state: 'FL', stateName: 'Florida', sources: [
      { name: 'FL Division of Bond Finance', url: 'https://www.dms.myflorida.com/divisions/bond_finance', icon: 'account_balance', description: 'Florida local government bond election data' },
      { name: 'FL DOE', url: 'https://www.fldoe.org/finance/fl-edu-finance-program', icon: 'school', description: 'Capital outlay & facility funding data' },
      { name: 'MyFloridaMarketPlace', url: 'https://vendor.myfloridamarketplace.com', icon: 'gavel', description: 'Florida procurement — professional services solicitations' },
    ]},
    { state: 'NY', stateName: 'New York', sources: [
      { name: 'NYS Comptroller', url: 'https://www.osc.state.ny.us/local-government', icon: 'account_balance', description: 'Local government debt & bond issuance reports' },
      { name: 'NY SED', url: 'https://www.nysed.gov/facilities-planning', icon: 'school', description: 'School capital project approvals & bond data' },
      { name: 'NY Contract Reporter', url: 'https://www.nyscr.ny.gov', icon: 'gavel', description: 'New York public procurement opportunities' },
    ]},
    { state: 'WA', stateName: 'Washington', sources: [
      { name: 'OSPI', url: 'https://www.k12.wa.us/policy-funding/school-construction', icon: 'school', description: 'School construction & bond levy data' },
      { name: 'MRSC', url: 'https://mrsc.org/research-tools/washington-city-and-town-profiles', icon: 'account_balance', description: 'Municipal Research & Services Center — local bond data' },
      { name: 'WA WEBS', url: 'https://fortress.wa.gov/ga/webs', icon: 'gavel', description: 'Washington electronic bid system' },
    ]},
    { state: 'OR', stateName: 'Oregon', sources: [
      { name: 'OR Dept of Revenue', url: 'https://www.oregon.gov/dor/programs/property/pages/local-budget.aspx', icon: 'account_balance', description: 'Local government bond & levy data' },
      { name: 'OR Secretary of State', url: 'https://sos.oregon.gov/elections/Pages/electionhistory.aspx', icon: 'how_to_vote', description: 'Bond measure election results' },
      { name: 'OR ORPIN', url: 'https://orpin.oregon.gov', icon: 'gavel', description: 'Oregon procurement information network' },
    ]},
    { state: 'AZ', stateName: 'Arizona', sources: [
      { name: 'AZ Dept of Education', url: 'https://www.azed.gov/finance', icon: 'school', description: 'School district finance & bond program data' },
      { name: 'AZ Secretary of State', url: 'https://azsos.gov/elections/current-and-recent-election-information', icon: 'how_to_vote', description: 'Bond measure election results' },
      { name: 'AZ Procurement', url: 'https://spo.az.gov/procurement-resources/procurement-opportunities', icon: 'gavel', description: 'Arizona state procurement portal' },
    ]},
    { state: 'CO', stateName: 'Colorado', sources: [
      { name: 'CO Dept of Education', url: 'https://www.cde.state.co.us/cdefinance', icon: 'school', description: 'School district finance & bond election data' },
      { name: 'CO Secretary of State', url: 'https://www.sos.state.co.us/pubs/elections/main.html', icon: 'how_to_vote', description: 'Bond measure election results' },
      { name: 'CO BIDS', url: 'https://www.colorado.gov/pacific/oit/procurement', icon: 'gavel', description: 'Colorado bid information system' },
    ]},
    { state: 'MI', stateName: 'Michigan', sources: [
      { name: 'MI Dept of Education', url: 'https://www.michigan.gov/mde/services/school-support/school-finance', icon: 'school', description: 'School district bond & facility data' },
      { name: 'MI Treasury', url: 'https://www.michigan.gov/treasury/local-government/local-bonds-and-tax', icon: 'account_balance', description: 'Local government bond approval & issuance' },
      { name: 'MI SIGMA', url: 'https://www.michigan.gov/dtmb/procurement', icon: 'gavel', description: 'Michigan statewide integrated governmental management procurement' },
    ]},
    { state: 'GA', stateName: 'Georgia', sources: [
      { name: 'GA Dept of Education', url: 'https://www.gadoe.org/Finance-and-Business-Operations', icon: 'school', description: 'School capital programs & bond data' },
      { name: 'GA Dept of Community Affairs', url: 'https://www.dca.ga.gov/local-government-finance', icon: 'account_balance', description: 'Local government bond issuance data' },
      { name: 'GA DOAS', url: 'https://doas.ga.gov/state-purchasing/procurement-activities', icon: 'gavel', description: 'Georgia procurement portal' },
    ]},
    { state: 'NC', stateName: 'North Carolina', sources: [
      { name: 'NC DPI', url: 'https://www.dpi.nc.gov/districts-schools/district-operations/finance', icon: 'school', description: 'School district capital & bond data' },
      { name: 'NC LGC', url: 'https://www.nclgc.net', icon: 'account_balance', description: 'Local Government Commission — bond approval & registry' },
      { name: 'NC IPS', url: 'https://www.ips.state.nc.us', icon: 'gavel', description: 'North Carolina interactive procurement system' },
    ]},
    { state: 'NV', stateName: 'Nevada', sources: [
      { name: 'NV Dept of Education', url: 'https://doe.nv.gov/Finance_and_Operations', icon: 'school', description: 'School district bond & facilities data' },
      { name: 'NV Secretary of State', url: 'https://www.nvsos.gov/sos/elections', icon: 'how_to_vote', description: 'Bond measure election results' },
    ]},
    { state: 'IL', stateName: 'Illinois', sources: [
      { name: 'IL ISBE', url: 'https://www.isbe.net/Pages/School-Business-Services.aspx', icon: 'school', description: 'Illinois school district finance & bond data' },
      { name: 'IL Comptroller', url: 'https://illinoiscomptroller.gov/financial-data', icon: 'account_balance', description: 'Local government debt & bond issuance' },
    ]},
    { state: 'OH', stateName: 'Ohio', sources: [
      { name: 'Ohio Auditor', url: 'https://ohioauditor.gov/localgovernment/resources.html', icon: 'account_balance', description: 'Local government bond & debt data' },
      { name: 'OH ODE', url: 'https://education.ohio.gov/Topics/Finance-and-Funding', icon: 'school', description: 'School district capital & levy information' },
    ]},
  ];

  ngOnInit(): void {
    this.loadRuns();
    this.refreshInterval = setInterval(() => this.loadRuns(), 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  loadRuns(): void {
    this.scraperService.getRuns().subscribe({
      next: res => { this.runs = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  hasSource(state: string | null): boolean {
    if (!state) return false;
    return this.stateSources.some(e => e.state === state);
  }

  toggleState(state: string | null): void {
    if (!state) return;
    if (this.selectedStates.has(state)) {
      this.selectedStates.delete(state);
    } else {
      this.selectedStates.add(state);
    }
    this.selectedStates = new Set(this.selectedStates);
  }

  clearSelection(): void { this.selectedStates = new Set(); }

  get selectedStatesList(): string[] {
    return Array.from(this.selectedStates).sort();
  }

  sourcesForState(state: string): StateSource[] {
    return this.stateSources.find(e => e.state === state)?.sources || [];
  }

  stateLabel(state: string): string {
    return this.stateSources.find(e => e.state === state)?.stateName || state;
  }

  get anyTriggering(): boolean {
    return Object.values(this.triggering).some(v => v);
  }

  trigger(scraper: ScraperCard): void {
    this.triggering[scraper.key] = true;
    this.messages[scraper.key] = '';
    this.scraperService.trigger(scraper.key, scraper.state === 'ALL' ? undefined : scraper.state).subscribe({
      next: res => {
        this.triggering[scraper.key] = false;
        this.messages[scraper.key] = `Run #${res.data?.id} queued. Python scraper must be running separately.`;
        this.loadRuns();
      },
      error: err => {
        this.triggering[scraper.key] = false;
        this.messages[scraper.key] = 'Error: ' + err.message;
      }
    });
  }

  runSelected(): void {
    const states = Array.from(this.selectedStates);
    states.forEach(state => {
      const scraper = this.scrapers.find(s => s.state === state) ||
                      { key: 'ballotpedia', label: 'Ballotpedia', description: '', state, icon: 'ballot' };
      this.trigger({ ...scraper, state });
    });
  }

  runAll(): void {
    this.scrapers.forEach(s => this.trigger(s));
  }

  lastRun(scraperKey: string): ScrapeRun | undefined {
    return this.runs.find(r => r.scraper_name === scraperKey);
  }

  statusClass(status: string): string {
    return ({ completed: 'success', running: 'info', failed: 'danger', partial: 'warning' } as Record<string,string>)[status] || 'info';
  }

  formatDuration(run: ScrapeRun): string {
    if (!run.completed_at || !run.started_at) return '—';
    const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.round(s/60)}m ${s%60}s`;
  }
}
