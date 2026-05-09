import { describe, it, expect } from 'vitest';
import { isValidReportId } from './id';

describe('isValidReportId', () => {
  it('accepts standard nanoid-shaped ids', () => {
    expect(isValidReportId('V1StGXR8_Z5jdHi6B-myT')).toBe(true);
    expect(isValidReportId('abcdefgh')).toBe(true); // exactly 8 chars
    expect(isValidReportId('a'.repeat(64))).toBe(true); // exactly 64 chars
  });

  it('rejects path-traversal attempts', () => {
    expect(isValidReportId('../private')).toBe(false);
    expect(isValidReportId('../../etc')).toBe(false);
    expect(isValidReportId('reports/something')).toBe(false);
  });

  it('rejects URL/scheme injection', () => {
    expect(isValidReportId('https://evil.com/x')).toBe(false);
    expect(isValidReportId('javascript:alert(1)')).toBe(false);
  });

  it('rejects out-of-range lengths', () => {
    expect(isValidReportId('short')).toBe(false); // < 8
    expect(isValidReportId('a'.repeat(65))).toBe(false); // > 64
    expect(isValidReportId('')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(isValidReportId(null)).toBe(false);
    expect(isValidReportId(undefined)).toBe(false);
    expect(isValidReportId(12345678)).toBe(false);
    expect(isValidReportId({})).toBe(false);
  });

  it('rejects whitespace and special characters', () => {
    expect(isValidReportId('has space')).toBe(false);
    expect(isValidReportId('with.dot.id')).toBe(false);
    expect(isValidReportId('semi;colon;ok')).toBe(false);
  });
});
