import { describe, expect, it } from 'vitest';

import { InrPipe, QuantityPipe } from './inr.pipe';

describe('InrPipe', () => {
  const pipe = new InrPipe();

  it('formats a plain amount', () => {
    expect(pipe.transform('70.00')).toBe('₹70.00');
  });

  it('always shows two decimal places', () => {
    expect(pipe.transform('70')).toBe('₹70.00');
    expect(pipe.transform('70.5')).toBe('₹70.50');
  });

  it('groups with Indian digit separators, not 3,3,3', () => {
    // 1,23,456.78 -- not 123,456.78
    expect(pipe.transform('123456.78')).toBe('₹1,23,456.78');
    expect(pipe.transform('1234567.00')).toBe('₹12,34,567.00');
  });

  it('leaves amounts under a thousand ungrouped', () => {
    expect(pipe.transform('450.00')).toBe('₹450.00');
  });

  it('groups at exactly four digits', () => {
    expect(pipe.transform('1000.00')).toBe('₹1,000.00');
  });

  it('handles a negative amount', () => {
    expect(pipe.transform('-140.00')).toBe('-₹140.00');
  });

  it('can omit the symbol', () => {
    expect(pipe.transform('70.00', false)).toBe('70.00');
  });

  it('treats null and empty as zero rather than printing NaN', () => {
    expect(pipe.transform(null)).toBe('₹0.00');
    expect(pipe.transform(undefined)).toBe('₹0.00');
    expect(pipe.transform('')).toBe('₹0.00');
  });

  it('does not lose precision on a value a float would mangle', () => {
    // 0.1 + 0.2 would not survive a round trip through Number.
    expect(pipe.transform('0.30')).toBe('₹0.30');
    expect(pipe.transform('12345678.99')).toBe('₹1,23,45,678.99');
  });
});

describe('QuantityPipe', () => {
  const pipe = new QuantityPipe();

  it('drops trailing zeros the API sends', () => {
    expect(pipe.transform('1.000')).toBe('1');
    expect(pipe.transform('2.500')).toBe('2.5');
  });

  it('leaves a whole number alone', () => {
    expect(pipe.transform('6')).toBe('6');
  });

  it('handles null', () => {
    expect(pipe.transform(null)).toBe('0');
  });
});
