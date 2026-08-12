import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'leads',
    loadComponent: () => import('./features/leads/leads.component').then(m => m.LeadsComponent)
  },
  {
    path: 'agencies',
    loadComponent: () => import('./features/agencies/agency-list/agency-list.component').then(m => m.AgencyListComponent)
  },
  {
    path: 'agencies/:id',
    loadComponent: () => import('./features/agencies/agency-detail/agency-detail.component').then(m => m.AgencyDetailComponent)
  },
  {
    path: 'map',
    loadComponent: () => import('./features/map/map.component').then(m => m.MapComponent)
  },
  {
    path: 'procurement',
    loadComponent: () => import('./features/procurement/procurement.component').then(m => m.ProcurementComponent)
  },
  {
    path: 'scraper',
    loadComponent: () => import('./features/scraper/scraper-status.component').then(m => m.ScraperStatusComponent)
  },
  {
    path: 'export',
    loadComponent: () => import('./features/export/export.component').then(m => m.ExportComponent)
  },
  { path: '**', redirectTo: '/dashboard' }
];
