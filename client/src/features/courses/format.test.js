import { describe, it, expect } from 'vitest';
import { formatMinutes, linesToList, moveId, plural } from './format.js';

describe('course formatting helpers', () => {
  it('moves ids up and down and ignores moves past the ends', () => {
    expect(moveId(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveId(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('formats durations', () => {
    expect(formatMinutes(0)).toBe('—');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(150)).toBe('2 h 30 min');
  });

  it('splits lines into lists and pluralizes', () => {
    expect(linesToList(' one \n\n two\n')).toEqual(['one', 'two']);
    expect(plural(1, 'module')).toBe('1 module');
    expect(plural(3, 'lesson')).toBe('3 lessons');
  });
});
