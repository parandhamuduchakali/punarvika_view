import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a rupee amount for display.
 *
 * Takes the API string ("70.00") and formats it without ever converting to
 * `number` for arithmetic -- the value is only ever grouped and prefixed. The
 * Indian digit grouping is 2,2,3 from the right (1,23,456.78), not the 3,3,3 the
 * default `Intl` "en-US" locale would give.
 */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: string | number | null | undefined, showSymbol = true): string {
    if (value === null || value === undefined || value === '') {
      return showSymbol ? '₹0.00' : '0.00';
    }

    const text = String(value).trim();
    const negative = text.startsWith('-');
    const [wholePart, fractionPart = '00'] = text.replace('-', '').split('.');

    const grouped = groupIndian(wholePart);
    const fraction = fractionPart.padEnd(2, '0').slice(0, 2);
    const sign = negative ? '-' : '';

    return `${sign}${showSymbol ? '₹' : ''}${grouped}.${fraction}`;
  }
}

function groupIndian(whole: string): string {
  if (whole.length <= 3) {
    return whole;
  }
  // Last three digits, then pairs: 1234567 -> 12,34,567
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`;
}

/**
 * Renders a quantity the way a shopper writes it: 1 rather than 1.000, and 1.5
 * rather than 1.500.
 */
@Pipe({ name: 'qty' })
export class QuantityPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '0';
    }
    const text = String(value);
    if (!text.includes('.')) {
      return text;
    }
    return text.replace(/\.?0+$/, '') || '0';
  }
}
