import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-score-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="score-badge" [class]="'score-badge--' + size + ' tier-' + tier">
      <span class="score-badge__number">{{ score }}</span>
      <span class="score-badge__label">{{ tierLabel }}</span>
    </div>
  `,
  styles: [`
    .score-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: 700;
      border: 3px solid currentColor;
    }
    .score-badge--sm { width: 44px; height: 44px; }
    .score-badge--md { width: 60px; height: 60px; }
    .score-badge--lg { width: 80px; height: 80px; }
    .score-badge__number { line-height: 1; }
    .score-badge--sm .score-badge__number { font-size: 14px; }
    .score-badge--md .score-badge__number { font-size: 18px; }
    .score-badge--lg .score-badge__number { font-size: 24px; }
    .score-badge__label { font-size: 9px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .tier-hot  { color: #ef4444; background: #fef2f2; }
    .tier-warm { color: #f97316; background: #fff7ed; }
    .tier-cool { color: #3b82f6; background: #eff6ff; }
    .tier-cold { color: #6b7280; background: #f9fafb; }
  `]
})
export class ScoreBadgeComponent {
  @Input() score = 0;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get tier(): string {
    if (this.score >= 70) return 'hot';
    if (this.score >= 50) return 'warm';
    if (this.score >= 30) return 'cool';
    return 'cold';
  }

  get tierLabel(): string {
    return this.tier.toUpperCase();
  }
}
