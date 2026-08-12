import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AgencyService } from '../../../core/services/agency.service';
import { ExportService } from '../../../core/services/export.service';
import { Agency, AgencyFilters, AgencyType } from '../../../core/models/agency.model';
import { ScoreBadgeComponent } from '../../../shared/components/score-badge/score-badge.component';
import { StageBadgeComponent } from '../../../shared/components/stage-badge/stage-badge.component';
import { CurrencyMillionsPipe } from '../../../core/pipes/currency-millions.pipe';
import { AgencyTypeLabelPipe } from '../../../core/pipes/agency-type-label.pipe';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-agency-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ScoreBadgeComponent, StageBadgeComponent,
            CurrencyMillionsPipe, AgencyTypeLabelPipe, LoadingSpinnerComponent],
  templateUrl: './agency-list.component.html',
  styleUrls: ['./agency-list.component.scss']
})
export class AgencyListComponent implements OnInit {
  private agencyService = inject(AgencyService);
  private exportService = inject(ExportService);

  agencies: Agency[] = [];
  loading = true;
  total = 0;
  page = 1;
  filters: AgencyFilters = { per_page: 50, sort: 'score', direction: 'desc' };
  sortColumn = 'score';
  sortDir: 'asc' | 'desc' = 'desc';

  states: string[] = [];
  agencyTypes: AgencyType[] = ['k12_district','community_college','university','city','county','water_district','hospital_district','transit','airport','port','special_district'];

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.agencyService.getAgencies({ ...this.filters, page: this.page, per_page: 200 }).subscribe({
      next: res => {
        // List API returns flat fields; reshape into nested structure the template expects
        this.agencies = res.data.map((a: any) => ({
          ...a,
          lead_score: a.lead_score ?? (a.score != null ? {
            score: a.score,
            confidence: a.confidence,
            opportunity_stage: a.opportunity_stage,
            approach_now: !!a.approach_now,
            scored_at: a.scored_at,
          } : null),
          // Synthesize bond_measures[0] from flat max_bond_amount so bondAmount() works
          bond_measures: a.bond_measures ?? (a.max_bond_amount ? [{ bond_amount: a.max_bond_amount }] : []),
        }));
        this.total = res.meta?.pagination?.total || res.data.length;
        this.loading = false;
        if (this.states.length === 0) {
          const seen = new Set<string>();
          res.data.forEach((a: any) => { if (a.state) seen.add(a.state); });
          this.states = Array.from(seen).sort();
        }
      },
      error: () => { this.loading = false; }
    });
  }

  sort(col: string): void {
    if (this.sortColumn === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col; this.sortDir = 'desc';
    }
    this.filters.sort = col;
    this.filters.direction = this.sortDir;
    this.page = 1;
    this.load();
  }

  applyFilters(): void { this.page = 1; this.load(); }

  exportCsv(): void {
    this.exportService.exportCsv(this.filters as Record<string, string | number | boolean | undefined>).subscribe();
  }

  sortIcon(col: string): string {
    if (this.sortColumn !== col) return 'unfold_more';
    return this.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  bondAmount(a: Agency): number {
    return a.bond_measures?.[0]?.bond_amount || 0;
  }

  get lastPage(): number { return Math.ceil(this.total / (this.filters.per_page || 50)); }
}
