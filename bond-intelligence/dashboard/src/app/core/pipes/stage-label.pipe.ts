import { Pipe, PipeTransform } from '@angular/core';
import { OpportunityStage } from '../models/agency.model';

const LABELS: Record<OpportunityStage, string> = {
  bond_passed: 'Bond Passed',
  bond_failed_retry: 'Bond Failed — Likely Retry',
  bond_issued: 'Bond Issued',
  master_plan_active: 'Master Plan Active',
  rfq_expected: 'RFQ Expected',
  rfq_active: 'RFQ Active',
  consultant_awarded: 'Consultant Awarded',
  construction_active: 'Construction Active',
  closeout: 'Closeout / Warranty',
};

@Pipe({ name: 'stageLabel', standalone: true })
export class StageLabelPipe implements PipeTransform {
  transform(value: OpportunityStage | string | null | undefined): string {
    if (!value) return '—';
    return LABELS[value as OpportunityStage] || value;
  }
}
