import { Component } from '@angular/core';
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  template: `
    <div class="spinner-wrap">
      <div class="spinner"></div>
    </div>
  `,
  styles: [`
    .spinner-wrap { display: flex; justify-content: center; align-items: center; padding: 48px; }
    .spinner {
      width: 40px; height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: var(--color-gold, #c9a84c);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class LoadingSpinnerComponent {}
