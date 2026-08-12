import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="header">
      <div class="brand">
        <span class="logo">TRANSCEND</span>
        <span class="logo-accent">SSP</span>
      </div>
      <p class="tagline">Site Safety Plan — standalone add-on for Transcend PM</p>
      <nav>
        <a routerLink="/">All Plans</a>
        <a routerLink="/new" class="btn btn-primary nav-btn">New Plan</a>
      </nav>
    </header>
    <main class="main">
      <router-outlet />
    </main>
  `,
  styles: [`
    .header {
      background: #fff;
      border-bottom: 1px solid var(--tp-border);
      padding: 1rem 1.5rem 1.25rem;
    }
    .brand { display: flex; align-items: baseline; gap: 0.35rem; }
    .logo { font-weight: 800; color: var(--tp-blue); letter-spacing: 0.02em; }
    .logo-accent { font-weight: 700; color: var(--tp-green); }
    .tagline { margin: 0.25rem 0 0.75rem; color: #555; font-size: 0.9rem; }
    nav { display: flex; gap: 1rem; align-items: center; }
    nav a { text-decoration: none; font-weight: 600; }
    .nav-btn { text-decoration: none; display: inline-block; }
    .main { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
  `],
})
export class AppComponent {}
