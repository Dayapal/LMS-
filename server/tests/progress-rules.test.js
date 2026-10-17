import { describe, it, expect } from 'vitest';
import { courseProgress, nextLesson } from '../src/services/progressRules.js';

const lessons = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id.toUpperCase() }));
const day = (n) => new Date(Date.UTC(2026, 9, n));
const done = (...ids) => new Map(ids.map((id, i) => [id, day(i + 1)]));

describe('courseProgress', () => {
  it('counts completed countable lessons and rounds the percentage down', () => {
    const three = lessons.slice(0, 3);
    expect(courseProgress(three, done('a'))).toEqual({
      completedLessons: 1,
      totalLessons: 3,
      percent: 33,
      completed: false,
      lastCompletedAt: day(1),
    });
    // 2 of 3 is 66.67%: never rounded up.
    expect(courseProgress(three, done('a', 'b')).percent).toBe(66);
  });

  it('is only complete when every countable lesson is done', () => {
    expect(courseProgress(lessons, done('a', 'b', 'c', 'd'))).toMatchObject({
      percent: 100,
      completed: true,
      lastCompletedAt: day(4),
    });
    expect(courseProgress(lessons, done('a', 'b', 'c')).completed).toBe(false);
  });

  it('ignores completions of lessons that are not countable now', () => {
    // `x` was completed, then unpublished: it counts in neither number.
    const result = courseProgress(lessons, done('x', 'a'));
    expect(result).toMatchObject({ completedLessons: 1, totalLessons: 4, percent: 25 });
  });

  it('falls when lessons are added', () => {
    expect(courseProgress(lessons.slice(0, 2), done('a')).percent).toBe(50);
    expect(courseProgress(lessons, done('a')).percent).toBe(25);
  });

  it('handles a course without lessons', () => {
    expect(courseProgress([], done('a'))).toEqual({
      completedLessons: 0,
      totalLessons: 0,
      percent: 0,
      completed: false,
      lastCompletedAt: null,
    });
  });
});

describe('nextLesson', () => {
  const pick = (completed, last) => {
    const next = nextLesson(lessons, completed, last);
    return next && { id: next.lesson.id, kind: next.kind };
  };

  it('starts with the first lesson before anything happened', () => {
    expect(pick(done(), null)).toEqual({ id: 'a', kind: 'start' });
  });

  it('resumes the last lesson opened while it is not completed', () => {
    expect(pick(done('a'), 'c')).toEqual({ id: 'c', kind: 'resume' });
  });

  it('moves on to the first incomplete lesson after the last one', () => {
    expect(pick(done('a', 'b'), 'b')).toEqual({ id: 'c', kind: 'next' });
    expect(pick(done('b', 'c'), 'b')).toEqual({ id: 'd', kind: 'next' });
  });

  it('wraps around to an earlier lesson that was skipped', () => {
    expect(pick(done('c', 'd'), 'd')).toEqual({ id: 'a', kind: 'next' });
  });

  it('falls back to the first incomplete lesson when the last one is gone', () => {
    expect(pick(done('a'), 'deleted')).toEqual({ id: 'b', kind: 'next' });
    expect(pick(done(), 'deleted')).toEqual({ id: 'a', kind: 'start' });
  });

  it('returns null when everything is done or there are no lessons', () => {
    expect(pick(done('a', 'b', 'c', 'd'), 'd')).toBeNull();
    expect(nextLesson([], done(), null)).toBeNull();
  });
});
