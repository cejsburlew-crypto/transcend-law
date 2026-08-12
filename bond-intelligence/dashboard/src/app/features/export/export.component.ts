import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportService } from '../../core/services/export.service';
import { AgencyType, OpportunityStage } from '../../core/models/agency.model';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export.component.html',
  styleUrls: ['./export.component.scss']
})
export class ExportComponent {
  private exportService = inject(ExportService);

  downloading: 'csv' | 'crm' | null = null;

  filters: Record<string, string | number | boolean | undefined> = {};
  states = ['CA','TX','FL','AZ','OR','WA','CO','MI','NY'];
  agencyTypes: AgencyType[] = ['k12_district','community_college','university','city','county','water_district','hospital_district','transit','airport','port','special_district'];
  stages: OpportunityStage[] = ['bond_passed','rfq_expected','rfq_active','consultant_awarded','construction_active'];

  csvColumns = [
    'Agency Name','Agency Type','State','County','City','Website',
    'Bond Measure','Election Date','Result','Vote %','Bond Amount',
    'Bond Purpose','Authorized Amount','Issued Amount','Unissued Amount',
    'Lead Score','Confidence','Opportunity Stage','Approach Now',
    'Estimated Next Action','Recommended Outreach','Source URL','Last Updated'
  ];

  crmColumns = [
    'Company Name','Website','Industry','State/Region','City',
    'Annual Revenue (Bond Amount)','Description','Lead Status',
    'Bond Measure Name','Election Date','Bond Result','Lead Score',
    'Opportunity Stage','Approach Now'
  ];

  exportCsv(): void {
    this.downloading = 'csv';
    this.exportService.exportCsv(this.filters).subscribe({
      next: () => { this.downloading = null; },
      error: () => { this.downloading = null; }
    });
  }

  exportCrm(): void {
    this.downloading = 'crm';
    this.exportService.exportCrm(this.filters).subscribe({
      next: () => { this.downloading = null; },
      error: () => { this.downloading = null; }
    });
  }
}
