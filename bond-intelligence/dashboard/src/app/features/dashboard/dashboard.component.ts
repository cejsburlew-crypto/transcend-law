import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DashboardService } from '../../core/services/dashboard.service';
import { DashboardSummary } from '../../core/models/agency.model';
import { CurrencyMillionsPipe } from '../../core/pipes/currency-millions.pipe';
import { StageLabelPipe } from '../../core/pipes/stage-label.pipe';
import { ScoreBadgeComponent } from '../../shared/components/score-badge/score-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, CurrencyMillionsPipe, StageLabelPipe, ScoreBadgeComponent, LoadingSpinnerComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private dashboardService = inject(DashboardService);

  loading = true;
  summary: DashboardSummary | null = null;
  error = '';

  ngOnInit(): void {
    this.dashboardService.getSummary().subscribe({
      next: res => { this.summary = res.data; this.loading = false; },
      error: err => { this.error = err.message; this.loading = false; }
    });
  }

  get pipelineStages(): Array<{ stage: string; count: number; pct: number }> {
    if (!this.summary?.pipeline_by_stage) return [];
    const total = Object.values(this.summary.pipeline_by_stage).reduce((a, b) => a + b, 0);
    return Object.entries(this.summary.pipeline_by_stage)
      .map(([stage, count]) => ({ stage, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);
  }

  get topStatesByValue(): Array<{ state: string; total_value: number; count: number }> {
    return (this.summary?.bonds_by_state || []).slice(0, 8).sort((a, b) => b.total_value - a.total_value);
  }

  get maxStateValue(): number {
    return Math.max(...(this.topStatesByValue.map(s => s.total_value) || [1]));
  }

  getStatusClass(status: string): string {
    return { completed: 'success', running: 'info', failed: 'danger', partial: 'warning' }[status] || 'info';
  }
}
