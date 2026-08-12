import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LeadService } from '../../core/services/lead.service';
import { AgencyFilters, AgencyType, OpportunityStage } from '../../core/models/agency.model';
import { ScoreBadgeComponent } from '../../shared/components/score-badge/score-badge.component';
import { StageBadgeComponent } from '../../shared/components/stage-badge/stage-badge.component';
import { CurrencyMillionsPipe } from '../../core/pipes/currency-millions.pipe';
import { AgencyTypeLabelPipe } from '../../core/pipes/agency-type-label.pipe';
import { StageLabelPipe } from '../../core/pipes/stage-label.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ScoreBadgeComponent, StageBadgeComponent,
            CurrencyMillionsPipe, AgencyTypeLabelPipe, StageLabelPipe, LoadingSpinnerComponent, EmptyStateComponent],
  templateUrl: './leads.component.html',
  styleUrls: ['./leads.component.scss']
})
export class LeadsComponent implements OnInit {
  private leadService = inject(LeadService);

  leads: any[] = [];
  loading = true;
  total = 0;
  page = 1;

  filters: AgencyFilters = { per_page: 24, sort: 'score', direction: 'desc' };

  states = ['CA','TX','FL','AZ','OR','WA','CO','MI','NY'];
  agencyTypes: AgencyType[] = ['k12_district','community_college','university','city','county','water_district','hospital_district','transit','airport','port','special_district'];
  stages: OpportunityStage[] = ['bond_passed','bond_failed_retry','bond_issued','master_plan_active','rfq_expected','rfq_active','consultant_awarded','construction_active','closeout'];
  sortOptions = [
    { value: 'score', label: 'Score' },
    { value: 'bond_amount', label: 'Bond Amount' },
    { value: 'election_date', label: 'Election Date' },
    { value: 'updated_at', label: 'Recently Updated' },
  ];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.leadService.getLeads({ ...this.filters, page: this.page }).subscribe({
      next: res => {
        // API returns flat rows (lead_score fields merged with agency fields).
        // Reshape into the nested structure the template expects.
        this.leads = res.data.map((row: any) => ({
          id: row.agency_id,
          name: row.name,
          state: row.state,
          city: row.city,
          agency_type: row.agency_type,
          bond_measures: row.bond_amount ? [{ bond_amount: row.bond_amount, unissued_amount: row.unissued_amount }] : [],
          lead_score: {
            score: row.score,
            confidence: row.confidence,
            opportunity_stage: row.opportunity_stage,
            approach_now: !!row.approach_now,
            estimated_next_action: row.estimated_next_action,
            recommended_outreach_angle: row.recommended_outreach_angle,
            scoring_factors: row.scoring_factors || [],
          },
        }));
        this.total = res.meta?.pagination?.total || res.data.length;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  applyFilters(): void { this.page = 1; this.load(); }
  clearFilters(): void { this.filters = { per_page: 24, sort: 'score', direction: 'desc' }; this.page = 1; this.load(); }
  nextPage(): void { this.page++; this.load(); }
  prevPage(): void { if (this.page > 1) { this.page--; this.load(); } }

  get lastPage(): number { return Math.ceil(this.total / (this.filters.per_page || 24)); }

  topFactor(lead: any): string {
    const factors: any[] = lead.lead_score?.scoring_factors || [];
    const top = factors.filter(f => f.points > 0).sort((a, b) => b.points - a.points)[0];
    return top ? top.reason : '';
  }

  bondAmount(lead: any): number {
    return lead.bond_measures?.[0]?.bond_amount || 0;
  }

  remainingAmount(lead: any): number {
    return lead.bond_measures?.[0]?.unissued_amount || 0;
  }
}
