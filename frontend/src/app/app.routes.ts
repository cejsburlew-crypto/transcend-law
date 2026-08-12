import { Routes } from '@angular/router';
import { SspListComponent } from './pages/ssp-list/ssp-list.component';
import { SspFormComponent } from './pages/ssp-form/ssp-form.component';

export const routes: Routes = [
  { path: '', component: SspListComponent },
  { path: 'new', component: SspFormComponent },
  { path: ':id', component: SspFormComponent },
  { path: '**', redirectTo: '' },
];
