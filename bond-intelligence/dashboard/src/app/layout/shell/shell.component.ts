import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { LeadService } from '../../core/services/lead.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss']
})
export class ShellComponent {
  sidebarOpen = signal(true);
  approachNowCount = signal(0);

  navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/leads',     label: 'Leads',     icon: 'bolt' },
    { path: '/map',       label: 'Map View',  icon: 'map' },
    { path: '/agencies',  label: 'Agencies',  icon: 'business' },
    { path: '/procurement', label: 'Procurement', icon: 'gavel' },
    { path: '/scraper',   label: 'Scraper',   icon: 'sync' },
    { path: '/export',    label: 'Export',    icon: 'download' },
  ];

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }
}
