import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcurementService } from '../../core/services/procurement.service';
import { CurrencyMillionsPipe } from '../../core/pipes/currency-millions.pipe';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyMillionsPipe, LoadingSpinnerComponent, EmptyStateComponent],
  templateUrl: './procurement.component.html',
  styleUrls: ['./procurement.component.scss']
})
export class ProcurementComponent implements OnInit {
  private procurementService = inject(ProcurementService);

  events: any[] = [];
  loading = true;
  activeTab: 'active' | 'all' = 'active';

  filters: Record<string, string | boolean> = {};
  states = ['CA','TX','FL','AZ','OR','WA','CO','MI','NY'];
  serviceTypes = ['program_manager','construction_manager','inspector','materials_testing','geotechnical','safety_consultant','pmis_vendor','owner_rep','architect'];
  eventTypes = ['rfq_issued','rfp_issued','award','contract_executed','board_approval','notice_of_intent'];

  ngOnInit(): void { this.loadActive(); }

  loadActive(): void {
    this.loading = true;
    this.procurementService.getActive().subscribe({
      next: res => { this.events = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  loadAll(): void {
    this.loading = true;
    this.procurementService.getProcurement(this.filters as any).subscribe({
      next: res => { this.events = res.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  setTab(tab: 'active' | 'all'): void {
    this.activeTab = tab;
    tab === 'active' ? this.loadActive() : this.loadAll();
  }

  isUrgent(dueDate: string): boolean {
    if (!dueDate) return false;
    const diff = new Date(dueDate).getTime() - Date.now();
    return diff > 0 && diff < 14 * 86400000;
  }

  serviceLabel(s: string): string {
    const m: Record<string,string> = {
      program_manager:'Program Manager', construction_manager:'Construction Manager',
      inspector:'Inspector of Record', materials_testing:'Materials Testing',
      geotechnical:'Geotechnical', safety_consultant:'Safety Consultant',
      pmis_vendor:'PMIS Vendor', owner_rep:'Owner Rep', architect:'Architect'
    };
    return m[s] || s;
  }

  eventTypeLabel(t: string): string {
    return t.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  parseTrades(trades: string | string[] | null): string[] {
    if (!trades) return [];
    if (Array.isArray(trades)) return trades;
    try { return JSON.parse(trades); } catch { return [trades]; }
  }
}
