import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state">
      <span class="material-icons empty-state__icon">{{ icon }}</span>
      <p class="empty-state__message">{{ message }}</p>
      <button *ngIf="actionLabel" class="empty-state__action" (click)="action.emit()">{{ actionLabel }}</button>
    </div>
  `,
  styles: [`
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px; gap: 12px; }
    .empty-state__icon { font-size: 48px; color: #94a3b8; }
    .empty-state__message { color: #64748b; font-size: 14px; margin: 0; }
    .empty-state__action {
      padding: 8px 20px; border-radius: 6px; border: none;
      background: var(--color-gold, #c9a84c); color: white;
      cursor: pointer; font-weight: 600;
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() message = 'No data found.';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
