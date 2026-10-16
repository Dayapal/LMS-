import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { isPrivateHost, linkProblem } from '../src/validators/links.js';
import {
  closesAt,
  editCheck,
  finalMarksFor,
  lateAfterEdit,
  lateForNewAttempt,
  newAttemptCheck,
  studentStatus,
} from '../src/services/submissionRules.js';

const due = new Date('2026-11-01T18:30:00.000Z');
const lateUntil = new Date('2026-11-04T18:30:00.000Z');
const before = new Date('2026-11-01T18:29:59.000Z');
const after = new Date('2026-11-01T18:30:01.000Z');
const afterCutoff = new Date('2026-11-04T18:30:01.000Z');

const assignment = (overrides = {}) => ({
  dueAt: due,
  latePolicy: { allowLate: false, lateUntil: null, penaltyPercent: 0 },
  maxAttempts: null,
  ...overrides,
});
const lateAllowed = (penaltyPercent = 10, extra = {}) =>
  assignment({ latePolicy: { allowLate: true, lateUntil, penaltyPercent }, ...extra });

const attempt = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  attempt: 1,
  status: 'submitted',
  isLate: false,
  ...overrides,
});

describe('submission window and late flags', () => {
  it('closes at the due date, or at the late cutoff when late work is allowed', () => {
    expect(closesAt(assignment())).toEqual(due);
    expect(closesAt(lateAllowed())).toEqual(lateUntil);
  });

  it('accepts a first attempt up to and including the closing instant', () => {
    expect(newAttemptCheck(assignment(), null, due).allowed).toBe(true);
    expect(newAttemptCheck(assignment(), null, after)).toEqual({
      allowed: false,
      reason: 'The submission window has closed.',
    });
    expect(newAttemptCheck(lateAllowed(), null, after).allowed).toBe(true);
    expect(newAttemptCheck(lateAllowed(), null, afterCutoff).allowed).toBe(false);
  });

  it('flags a first attempt late only after the due date', () => {
    expect(lateForNewAttempt(lateAllowed(), null, before)).toBe(false);
    expect(lateForNewAttempt(lateAllowed(), null, due)).toBe(false);
    expect(lateForNewAttempt(lateAllowed(), null, after)).toBe(true);
  });

  it('keeps the late flag of the replaced attempt for a resubmission', () => {
    expect(lateForNewAttempt(lateAllowed(), attempt({ isLate: false }), afterCutoff)).toBe(false);
    expect(lateForNewAttempt(lateAllowed(), attempt({ isLate: true }), before)).toBe(true);
  });

  it('makes a first attempt late when it is edited after the due date', () => {
    expect(lateAfterEdit(lateAllowed(), attempt(), before)).toBe(false);
    expect(lateAfterEdit(lateAllowed(), attempt(), after)).toBe(true);
    // A resubmission keeps its flag.
    expect(lateAfterEdit(lateAllowed(), attempt({ attempt: 2 }), afterCutoff)).toBe(false);
  });
});

describe('attempts and editing', () => {
  it('allows a new attempt only after a resubmission request, within maxAttempts', () => {
    const limited = assignment({ maxAttempts: 2 });
    expect(newAttemptCheck(limited, attempt(), before).reason).toMatch(/already submitted/);
    expect(newAttemptCheck(limited, attempt({ status: 'reviewed' }), before).reason).toMatch(
      /reviewed/,
    );
    expect(newAttemptCheck(limited, attempt({ status: 'resubmit_requested' }), after).allowed).toBe(
      true,
    );
    expect(
      newAttemptCheck(limited, attempt({ attempt: 2, status: 'resubmit_requested' }), before),
    ).toEqual({ allowed: false, reason: 'You have used all 2 attempts for this assignment.' });
    expect(
      newAttemptCheck(assignment(), attempt({ attempt: 9, status: 'resubmit_requested' }), before)
        .allowed,
    ).toBe(true);
  });

  it('allows editing only the latest unreviewed attempt, and a first attempt only while open', () => {
    const latest = attempt();
    expect(editCheck(assignment(), latest, latest, due).allowed).toBe(true);
    expect(editCheck(assignment(), latest, latest, after).reason).toMatch(/window has closed/);
    expect(editCheck(lateAllowed(), latest, latest, after).allowed).toBe(true);
    expect(editCheck(assignment(), latest, attempt({ attempt: 2 }), before).reason).toMatch(
      /latest attempt/,
    );
    for (const status of ['reviewed', 'resubmit_requested']) {
      const reviewed = attempt({ status });
      expect(editCheck(assignment(), reviewed, reviewed, before).reason).toMatch(/reviewed/);
    }
    const resubmission = attempt({ attempt: 2 });
    expect(editCheck(assignment(), resubmission, resubmission, afterCutoff).allowed).toBe(true);
  });
});

describe('finalMarksFor', () => {
  it('applies the penalty to late work only, rounded to two decimals', () => {
    expect(finalMarksFor(lateAllowed(10), { marks: 80, isLate: false })).toBe(80);
    expect(finalMarksFor(lateAllowed(10), { marks: 80, isLate: true })).toBe(72);
    expect(finalMarksFor(lateAllowed(15), { marks: 7.25, isLate: true })).toBe(6.16);
    expect(finalMarksFor(lateAllowed(100), { marks: 50, isLate: true })).toBe(0);
    expect(finalMarksFor(lateAllowed(0), { marks: 50, isLate: true })).toBe(50);
    expect(finalMarksFor(lateAllowed(10), { marks: null, isLate: true })).toBeNull();
  });
});

describe('studentStatus', () => {
  it('derives pending, overdue and the latest attempt status', () => {
    expect(studentStatus(assignment(), null, before)).toBe('pending');
    expect(studentStatus(lateAllowed(), null, after)).toBe('overdue');
    expect(studentStatus(assignment(), attempt(), after)).toBe('submitted');
    expect(studentStatus(assignment(), attempt({ status: 'reviewed' }), after)).toBe('reviewed');
  });
});

describe('link rules', () => {
  it.each([
    ['drive_url', 'https://drive.google.com/file/d/abc/view'],
    ['drive_url', 'https://docs.google.com/document/d/abc/edit'],
    ['github_url', 'https://github.com/asha/portfolio'],
    ['github_url', 'https://github.com/my-org/repo.js/tree/main/src'],
    ['github_url', 'https://www.github.com/asha/portfolio'],
    ['project_url', 'https://asha.vercel.app'],
    ['project_url', 'https://8.8.8.8/demo'],
  ])('accepts %s %s', (type, url) => {
    expect(linkProblem(type, url)).toBeNull();
  });

  it.each([
    ['drive_url', 'http://drive.google.com/file/d/abc', /https/],
    ['drive_url', 'https://drive.google.com.evil.example/x', /Google Drive/],
    ['drive_url', 'https://dropbox.com/s/abc', /Google Drive/],
    ['github_url', 'https://github.com/asha', /repository/],
    ['github_url', 'https://github.com/settings/profile', /repository/],
    ['github_url', 'https://github.com/-bad-/repo', /repository/],
    ['github_url', 'https://gitlab.com/asha/portfolio', /github\.com/],
    ['github_url', 'https://user:secret@github.com/asha/portfolio', /https/],
    ['project_url', 'javascript:alert(1)', /https/],
    ['project_url', 'data:text/html,<script>alert(1)</script>', /https/],
    ['project_url', 'ftp://example.com/site', /https/],
    ['project_url', 'not a url', /https/],
    ['project_url', 'https://localhost:3000', /public/],
    ['project_url', 'https://app.localhost', /public/],
    ['project_url', 'https://127.0.0.1', /public/],
    ['project_url', 'https://0x7f.1/', /public/],
    ['project_url', 'https://2130706433/', /public/],
    ['project_url', 'https://10.1.2.3', /public/],
    ['project_url', 'https://172.20.0.1', /public/],
    ['project_url', 'https://192.168.1.10:8080', /public/],
    ['project_url', 'https://169.254.169.254/latest', /public/],
    ['project_url', 'https://[::1]/', /public/],
    ['project_url', 'https://[fd00::1]/', /public/],
    ['project_url', 'https://[::ffff:127.0.0.1]/', /public/],
    ['project_url', 'https://intranet/', /public/],
    ['project_url', 'https://printer.local', /public/],
  ])('rejects %s %s', (type, url, message) => {
    expect(linkProblem(type, url)).toMatch(message);
  });

  it('treats public hosts as public', () => {
    expect(isPrivateHost('example.com')).toBe(false);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
    expect(isPrivateHost('100.128.0.1')).toBe(false);
  });
});
