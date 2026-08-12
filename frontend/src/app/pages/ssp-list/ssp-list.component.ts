import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { SspService } from '../../services/ssp.service';
import { SiteSafetyPlan } from '../../models/site-safety-plan.model';

@Component({
  selector: 'app-ssp-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <section class="card">
      <h1>Site Safety Plans</h1>
      @if (loading) {
        <p>Loading…</p>
      } @else if (error) {
        <p class="error">{{ error }}</p>
      } @else if (plans.length === 0) {
        <p>No plans yet. <a routerLink="/new">Create the first Site Safety Plan</a>.</p>
      } @else {
        <table>
          <thead>
            <tr>
              <th>DSA A#</th>
              <th>Project</th>
              <th>Site</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (plan of plans; track plan.id) {
              <tr>
                <td>{{ plan.transcend_pm_project_id || '—' }}</td>
                <td>{{ plan.project_name }}</td>
                <td>{{ plan.project_address || '—' }}</td>
                <td><span class="badge">{{ plan.status }}</span></td>
                <td>{{ plan.updated_at | date: 'mediumDate' }}</td>
                <td><a [routerLink]="['/', plan.id]">Edit</a></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: [`
    h1 { margin-top: 0; color: var(--tp-blue); }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 1px solid var(--tp-border); }
    th { font-size: 0.85rem; color: #666; }
    .badge {
      background: #e8f0fe;
      color: var(--tp-blue);
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      font-size: 0.8rem;
      text-transform: capitalize;
    }
    .error { color: #b00020; }
  `],
})
export class SspListComponent implements OnInit {
  plans: SiteSafetyPlan[] = [];
  loading = true;
  error = '';

  constructor(private ssp: SspService) {}

  ngOnInit(): void {
    this.ssp.list().subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not reach the API. Start the backend (see README).';
        this.loading = false;
      },
    });
  }
}
