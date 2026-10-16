import { describe, it, expect } from 'vitest';
import {
  formatDateTime,
  formatMarks,
  fromLocalInput,
  latePolicyText,
  relativeTime,
  toLocalInput,
} from './format.js';
import { checkSubmissionPdf, codeSizeProblem, linkProblem } from './schemas.js';

describe('dates', () => {
  it('round-trips a UTC instant through a local datetime-local value', () => {
    const iso = '2030-01-15T18:29:00.000Z';
    const local = toLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fromLocalInput(local)).toBe(iso);
    expect(toLocalInput(null)).toBe('');
    expect(fromLocalInput('')).toBeNull();
  });

  it('shows the time zone with every date', () => {
    const text = formatDateTime('2030-01-15T18:29:00.000Z');
    expect(text).toMatch(/2030/);
    expect(text).toMatch(/(GMT|UTC|[A-Z]{2,5})/);
    expect(formatDateTime(null)).toBe('—');
  });

  it('describes relative times', () => {
    const now = new Date('2026-10-16T10:00:00.000Z');
    expect(relativeTime('2026-10-19T10:00:00.000Z', now)).toBe('in 3 days');
    expect(relativeTime('2026-10-16T08:00:00.000Z', now)).toBe('2 hours ago');
    expect(relativeTime('2026-10-16T10:00:20.000Z', now)).toBe('this minute');
  });
});

describe('labels', () => {
  it('describes the late policy and marks', () => {
    expect(latePolicyText({ allowLate: false })).toBe('Late work is not accepted.');
    expect(
      latePolicyText({ allowLate: true, lateUntil: '2030-01-20T00:00:00Z', penaltyPercent: 10 }),
    ).toMatch(/^Late work is accepted until .*2030.*, with a 10% penalty\.$/);
    expect(formatMarks(36.4, 50)).toBe('36.4 / 50');
    expect(formatMarks(null, 50)).toBe('—');
  });
});

describe('client-side submission checks', () => {
  it('mirrors the server link rules', () => {
    expect(linkProblem('github_url', 'https://github.com/asha/profile')).toBeNull();
    expect(linkProblem('github_url', 'https://github.com/asha')).toMatch(/repository/);
    expect(linkProblem('drive_url', 'https://docs.google.com/document/d/x')).toBeNull();
    expect(linkProblem('drive_url', 'https://dropbox.com/x')).toMatch(/Google Drive/);
    expect(linkProblem('project_url', 'https://asha.netlify.app')).toBeNull();
    expect(linkProblem('project_url', 'javascript:alert(1)')).toMatch(/https/);
    expect(linkProblem('project_url', 'http://asha.dev')).toMatch(/https/);
    expect(linkProblem('project_url', 'https://localhost:3000')).toMatch(/public/);
    expect(linkProblem('project_url', 'https://192.168.1.4')).toMatch(/public/);
  });

  it('checks PDFs and code size', () => {
    const file = (name, size) => ({ name, size });
    expect(checkSubmissionPdf(file('answers.pdf', 1000))).toBeNull();
    expect(checkSubmissionPdf(file('answers.docx', 1000))).toMatch(/Only PDF/);
    expect(checkSubmissionPdf(file('big.pdf', 11 * 1024 * 1024))).toMatch(/10 MB/);
    expect(codeSizeProblem('a'.repeat(100 * 1024))).toBeNull();
    expect(codeSizeProblem('é'.repeat(51 * 1024))).toMatch(/100 KB/);
  });
});
