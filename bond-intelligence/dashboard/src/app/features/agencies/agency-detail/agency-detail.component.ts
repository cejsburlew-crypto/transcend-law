import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { AgencyService } from '../../../core/services/agency.service';
import { LeadService } from '../../../core/services/lead.service';
import { Agency, ScoringFactor } from '../../../core/models/agency.model';
import { ScoreBadgeComponent } from '../../../shared/components/score-badge/score-badge.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge/stage-badge.component';
import { CurrencyMillionsPipe } from '../../../core/pipes/currency-millions.pipe';
import { AgencyTypeLabelPipe } from '../../../core/pipes/agency-type-label.pipe';
import { StageLabelPipe } from '../../../core/pipes/stage-label.pipe';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-agency-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ScoreBadgeComponent, StageBadgeComponent,
            CurrencyMillionsPipe, AgencyTypeLabelPipe, StageLabelPipe, LoadingSpinnerComponent],
  templateUrl: './agency-detail.component.html',
  styleUrls: ['./agency-detail.component.scss']
})
export class AgencyDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private agencyService = inject(AgencyService);
  private leadService = inject(LeadService);

  agency: Agency | null = null;
  loading = true;
  activeTab = 'overview';
  rescoring = false;
  tabs = ['overview', 'contacts', 'consultants', 'procurement', 'score', 'outreach', 'sources'];

  ALL_SERVICE_TYPES = ['program_manager','construction_manager','architect','geotechnical',
                       'materials_testing','inspector','safety_consultant','pmis_vendor','owner_rep'];

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.agencyService.getAgency(id).subscribe({
      next: res => { this.agency = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  setTab(tab: string): void { this.activeTab = tab; }

  rescore(): void {
    if (!this.agency) return;
    this.rescoring = true;
    this.leadService.scoreAgency(this.agency.id).subscribe({
      next: res => {
        if (this.agency) this.agency.lead_score = res.data;
        this.rescoring = false;
      },
      error: () => { this.rescoring = false; }
    });
  }

  /** Source documents relevant to bond issuance for a given measure. */
  issuanceDocsFor(measure: any): any[] {
    const issuanceTypes = new Set(['official_statement','cdiac','bond_release','bond_issuance','sale_notice']);
    return (this.agency?.source_documents || []).filter((s: any) =>
      issuanceTypes.has(s.doc_type) || (s.title || '').toLowerCase().includes('official statement')
    );
  }

  get missingServiceTypes(): string[] {
    const awarded = new Set((this.agency?.consultants || []).map(c => c.service_type));
    return this.ALL_SERVICE_TYPES.filter(t => !awarded.has(t as any));
  }

  get positivefactors(): ScoringFactor[] {
    return (this.agency?.lead_score?.scoring_factors || []).filter(f => f.points > 0).sort((a,b) => b.points - a.points);
  }

  get negativeFactors(): ScoringFactor[] {
    return (this.agency?.lead_score?.scoring_factors || []).filter(f => f.points < 0);
  }

  serviceTypeLabel(t: string): string {
    const map: Record<string,string> = {
      program_manager: 'Program Manager', construction_manager: 'Construction Manager',
      architect: 'Architect', geotechnical: 'Geotechnical Engineer',
      materials_testing: 'Materials Testing', inspector: 'Inspector of Record',
      safety_consultant: 'Safety Consultant', pmis_vendor: 'PMIS Vendor', owner_rep: 'Owner Representative'
    };
    return map[t] || t;
  }

  get execContacts() {
    const execRoles = new Set(['superintendent','ceo','city_manager','chancellor',
      'cbo','cfo','facilities_director','bond_program_manager',
      'purchasing_director','construction_director','owner_rep','other']);
    return (this.agency?.contacts || []).filter(c =>
      execRoles.has(c.role) && c.role !== 'board_president' && c.role !== 'board_member'
    );
  }

  get boardContacts() {
    return (this.agency?.contacts || []).filter(c =>
      c.role === 'board_member' || c.role === 'board_president' ||
      (c.contact_type && (c.contact_type === 'board_member' || c.contact_type === 'board_president'))
    );
  }

  roleLabel(role: string): string {
    const map: Record<string,string> = {
      superintendent: 'Superintendent', ceo: 'CEO', city_manager: 'City Manager',
      chancellor: 'Chancellor', facilities_director: 'Facilities Director',
      cbo: 'Chief Business Official', cfo: 'CFO',
      purchasing_director: 'Purchasing Director',
      bond_program_manager: 'Bond Program Manager',
      construction_director: 'Construction Director',
      board_president: 'Board President', board_member: 'Board Member', other: 'Other'
    };
    return map[role] || role;
  }

  get confidencePct(): number { return this.agency?.lead_score?.confidence || 0; }

  docTypeIcon(type: string): string {
    const m: Record<string,string> = {
      ballot_measure: 'how_to_vote', official_statement: 'description',
      voter_pamphlet: 'menu_book', bond_release: 'account_balance',
      advertisement: 'campaign', news_article: 'article',
      cdiac: 'account_balance', bond_issuance: 'payments',
      sale_notice: 'notifications', agenda: 'event_note', other: 'insert_drive_file',
    };
    return m[type] || 'insert_drive_file';
  }

  docTypeLabel(type: string): string {
    const m: Record<string,string> = {
      ballot_measure: 'Ballot Measure', official_statement: 'Official Statement',
      voter_pamphlet: 'Voter Pamphlet', bond_release: 'Bond Release',
      advertisement: 'Advertisement', news_article: 'News Article',
      cdiac: 'CDIAC Filing', bond_issuance: 'Bond Issuance',
      sale_notice: 'Sale Notice', agenda: 'Board Agenda', other: 'Document',
    };
    return m[type] || (type ? type.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Document');
  }

  docTypeClass(type: string): string {
    const m: Record<string,string> = {
      ballot_measure: 'vote', official_statement: 'doc',
      voter_pamphlet: 'book', bond_release: 'bank',
      advertisement: 'ad', news_article: 'news',
      cdiac: 'bank', bond_issuance: 'bank', sale_notice: 'alert', default: 'default',
    };
    return m[type] || 'default';
  }
}
