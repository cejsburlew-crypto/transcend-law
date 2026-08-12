import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'currencyMillions', standalone: true })
export class CurrencyMillionsPipe implements PipeTransform {
  transform(value: number | null | undefined, showCents = false): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    if (value >= 1_000_000_000) {
      return '$' + (value / 1_000_000_000).toFixed(showCents ? 2 : 1).replace(/\.0$/, '') + 'B';
    }
    if (value >= 1_000_000) {
      return '$' + (value / 1_000_000).toFixed(showCents ? 2 : 1).replace(/\.0$/, '') + 'M';
    }
    if (value >= 1_000) {
      return '$' + (value / 1_000).toFixed(0) + 'K';
    }
    return '$' + value.toFixed(0);
  }
}
