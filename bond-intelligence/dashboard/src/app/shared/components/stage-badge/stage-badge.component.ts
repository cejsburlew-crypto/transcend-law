import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StageLabelPipe } from '../.././../core/pipes/stage-label.pipe';
import { OpportunityStage } from '../../../core/models/agency.model';

const STAGE_COLORS: Record<string, string> = {
  bond_passed: '#22c55e',
  bond_failed_retry: '#eab308',
  bond_issued: '#06b6d4',
  master_plan_active: '#8b5cf6',
  rfq_expected: '#3b82f6',
  rfq_active: '#2563eb',
  consultant_awarded: '#f97316',
  construction_active: '#a855f7',
  closeout: '#6b7280',
};

@Component({
  selector: 'app-stage-badge',
  standalone: true,
  imports: [CommonModule, StageLabelPipe],
  template: `
    <span class="stage-badge" [style.background-color]="bgColor" [style.color]="textColor">
      {{ stage | stageLabel }}
    </span>
  `,
  styles: [`
    .stage-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
  `]
})
export class StageBadgeComponent {
  @Input() stage: OpportunityStage | string = '';

  get bgColor(): string {
    const hex = STAGE_COLORS[this.stage] || '#6b7280';
    return hex + '22';
  }
  get textColor(): string {
    return STAGE_COLORS[this.stage] || '#6b7280';
  }
}
