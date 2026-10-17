import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { progressApi } from '../../progress/api.js';
import { MyAssignmentsPage } from './MyAssignmentsPage.jsx';
import { renderWithProviders } from '../../../test/renderWithProviders.jsx';
import { STUDENT } from '../../courses/test-fixtures.js';
import {
  COUNTS,
  makeMyAssignment,
  makeMyCourse,
  pendingCourse,
} from '../../progress/test-fixtures.js';

const routes = [{ path: '/app/assignments', element: <MyAssignmentsPage /> }];
const open = () => renderWithProviders(routes, { path: '/app/assignments', user: STUDENT });

const pageOf = (items, counts = COUNTS) => ({
  items,
  meta: { page: 1, limit: 20, total: items.length, totalPages: 1, counts },
});

const dsa = makeMyCourse({
  course: { ...makeMyCourse().course, id: 'c3', title: 'DSA with JavaScript', slug: 'dsa' },
});

beforeEach(() => {
  vi.spyOn(progressApi, 'myCourses').mockResolvedValue([makeMyCourse(), dsa, pendingCourse()]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MyAssignmentsPage', () => {
  it('lists every assignment with its state, place, due date and marks', async () => {
    vi.spyOn(progressApi, 'myAssignments').mockResolvedValue(
      pageOf([
        makeMyAssignment('a1', 'reviewed'),
        makeMyAssignment('a2', 'overdue', {
          lesson: { id: 'l1', title: 'Forms' },
          mySubmission: { ...makeMyAssignment('a2', 'overdue').mySubmission, canSubmit: true },
        }),
        makeMyAssignment('a3', 'pending', { status: 'archived' }),
      ]),
    );
    open();
    expect(screen.getByLabelText('Loading assignments')).toBeInTheDocument();

    const reviewed = (await screen.findByRole('link', { name: 'Assignment a1' })).closest('li');
    expect(screen.getByRole('link', { name: 'Assignment a1' })).toHaveAttribute(
      'href',
      '/app/courses/c1/assignments/a1',
    );
    expect(within(reviewed).getByText('Reviewed')).toBeInTheDocument();
    expect(within(reviewed).getByText('Marks: 86 / 100')).toBeInTheDocument();

    const overdue = screen.getByRole('link', { name: 'Assignment a2' }).closest('li');
    expect(within(overdue).getByText('Overdue')).toBeInTheDocument();
    expect(within(overdue).getByText('Late work is still accepted.')).toBeInTheDocument();
    expect(
      within(overdue).getByText('Full-Stack MERN Development · HTML Fundamentals · Forms'),
    ).toBeInTheDocument();
    expect(within(overdue).getByText(/^Due /)).toHaveTextContent(/GMT|UTC|[A-Z]{2,}/);

    const archived = screen.getByRole('link', { name: 'Assignment a3' }).closest('li');
    expect(within(archived).getByText('Archived')).toBeInTheDocument();
  });

  it('filters by state with counts, and by course', async () => {
    const list = vi
      .spyOn(progressApi, 'myAssignments')
      .mockResolvedValue(pageOf([makeMyAssignment('a1', 'pending')]));
    open();

    const filters = await screen.findByRole('group', { name: 'Filter by state' });
    expect(await within(filters).findByRole('button', { name: 'All 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(within(filters).getByRole('button', { name: 'Overdue 1' }));
    expect(list.mock.calls.at(-1)[0]).toEqual({ page: 1, limit: 20, status: 'overdue' });
    expect(within(filters).getByRole('button', { name: 'Overdue 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Only active courses can be chosen; the pending one has no assignments.
    const select = screen.getByRole('combobox', { name: 'Filter by course' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['All courses', 'Full-Stack MERN Development', 'DSA with JavaScript']);
    await userEvent.selectOptions(select, 'c3');
    expect(list.mock.calls.at(-1)[0]).toEqual({
      page: 1,
      limit: 20,
      status: 'overdue',
      course: 'c3',
    });
  });

  it('explains an empty list and an empty filter', async () => {
    vi.spyOn(progressApi, 'myAssignments').mockResolvedValue(
      pageOf([], { ...COUNTS, all: 0, overdue: 0 }),
    );
    open();
    expect(await screen.findByText('No assignments yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Overdue 0' }));
    expect(await screen.findByText('Nothing is overdue. Well done.')).toBeInTheDocument();
  });
});
