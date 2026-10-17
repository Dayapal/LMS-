import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentsPage } from './StudentsPage.jsx';
import { StudentDetailPage } from './StudentDetailPage.jsx';
import { coursesApi } from '../../courses/api.js';
import { ADMIN, makeCourse } from '../../courses/test-fixtures.js';
import { trainerApi } from '../api.js';
import { makeStudentDetail, makeStudentReport, makeStudentRow, page } from '../test-fixtures.js';
import {
  apiError,
  notFoundError,
  renderWithProviders,
} from '../../../test/renderWithProviders.jsx';

const routes = [
  { path: '/admin/students', element: <StudentsPage /> },
  { path: '/admin/students/:studentId', element: <StudentDetailPage /> },
];
const open = (path) => renderWithProviders(routes, { path, user: ADMIN });

beforeEach(() => {
  vi.spyOn(coursesApi, 'list').mockResolvedValue(
    page([
      makeCourse(),
      makeCourse({ id: 'c2', title: 'Java' }),
      makeCourse({ id: 'c4', title: 'Cloud Basics', status: 'draft' }),
      makeCourse({ id: 'c5', title: 'Old Course', status: 'archived' }),
    ]),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StudentsPage', () => {
  it('lists students with their courses, progress and what needs attention', async () => {
    const students = vi.spyOn(trainerApi, 'students').mockResolvedValue(
      page([
        makeStudentRow(),
        makeStudentRow({
          id: 'st3',
          name: 'Zoe Lee',
          courses: [],
          awaitingReview: 0,
          overdue: 0,
          enrollments: { active: 0, pending: 0, removed: 0 },
        }),
      ]),
    );
    open('/admin/students');
    const list = await screen.findByRole('list', { name: 'Students' });
    expect(students.mock.calls[0][0]).toEqual({ page: 1, limit: 20, sort: 'name' });
    const [asha, zoe] = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.parentElement === list);
    expect(within(asha).getByRole('link', { name: 'Asha Rao' })).toHaveAttribute(
      'href',
      '/admin/students/st1',
    );
    expect(
      within(asha).getByRole('progressbar', { name: 'MERN Development progress' }),
    ).toHaveAttribute('aria-valuenow', '21');
    expect(within(asha).getByText('Request pending')).toBeInTheDocument();
    expect(within(asha).getByText('1 to review')).toBeInTheDocument();
    expect(within(asha).getByText('2 overdue')).toBeInTheDocument();
    expect(within(zoe).getByText('Not enrolled in any course.')).toBeInTheDocument();
  });

  it('sends the search and filters', async () => {
    const students = vi.spyOn(trainerApi, 'students').mockResolvedValue(page([makeStudentRow()]));
    open('/admin/students');
    const user = userEvent.setup();
    await screen.findByRole('list', { name: 'Students' });
    await user.selectOptions(await screen.findByLabelText('Course'), 'c2');
    await user.selectOptions(screen.getByLabelText('Enrollment'), 'none');
    expect(screen.getByRole('option', { name: 'Not in this course' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Learning'), 'overdue');
    await user.selectOptions(screen.getByLabelText('Order'), 'recent');
    await user.type(screen.getByLabelText('Search by name or email'), 'asha');
    await waitFor(() =>
      expect(students.mock.calls.at(-1)[0]).toEqual({
        page: 1,
        limit: 20,
        q: 'asha',
        course: 'c2',
        enrollment: 'none',
        learning: 'overdue',
        sort: 'recent',
      }),
    );
  });

  it('shows the empty states', async () => {
    vi.spyOn(trainerApi, 'students').mockResolvedValue(page([]));
    open('/admin/students');
    expect(await screen.findByText('No students yet')).toBeInTheDocument();
    cleanup();
    open('/admin/students?learning=overdue');
    expect(await screen.findByText('No students match')).toBeInTheDocument();
  });
});

describe('StudentDetailPage', () => {
  const openDetail = (detail = makeStudentDetail(), report = makeStudentReport()) => {
    vi.spyOn(trainerApi, 'student').mockResolvedValue(detail);
    vi.spyOn(trainerApi, 'studentReport').mockResolvedValue(report);
    return open('/admin/students/st1');
  };

  it('shows the profile, enrollments with history, progress, assignments, submissions and activity', async () => {
    openDetail();
    expect(await screen.findByRole('heading', { level: 1, name: 'Asha Rao' })).toBeInTheDocument();
    expect(screen.getByText(/asha@example.com · Joined/)).toBeInTheDocument();
    const stat = (label) => screen.getByText(label).nextElementSibling;
    expect(stat('Active courses')).toHaveTextContent('1');
    expect(stat('Lessons completed')).toHaveTextContent('8');
    expect(stat('Overdue assignments')).toHaveTextContent('2');

    const courses = screen.getByRole('region', { name: 'Courses' });
    expect(within(courses).getByRole('link', { name: 'MERN Development' })).toHaveAttribute(
      'href',
      '/admin/reports/courses/c1',
    );
    expect(within(courses).getByText('2 overdue')).toBeInTheDocument();
    // Removed from an archived course: still listed with its progress.
    expect(within(courses).getByText('Removed')).toBeInTheDocument();
    expect(within(courses).getByText('Course archived')).toBeInTheDocument();
    expect(within(courses).getByRole('progressbar', { name: 'DSA progress' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    );

    const modules = await screen.findByRole('region', { name: 'Progress by module' });
    expect(
      within(modules).getByRole('progressbar', { name: 'CSS Layout progress' }),
    ).toHaveAttribute('aria-valuenow', '25');
    const assignments = screen.getByRole('region', { name: 'Assignments' });
    expect(within(assignments).getByText('Overdue')).toBeInTheDocument();
    const submissions = screen.getByRole('region', { name: 'Submissions' });
    expect(
      within(submissions).getByText('Average of 1 reviewed: 72% of the marks.'),
    ).toBeInTheDocument();
    expect(within(submissions).getByRole('link', { name: 'Flexbox Gallery' })).toHaveAttribute(
      'href',
      '/admin/courses/c3/assignments/a2/submissions/sub9',
    );
    expect(within(submissions).getByText('72 / 100')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recent activity' })).toHaveTextContent(
      'Completed Flexbox Layouts in MERN Development',
    );
  });

  it('approves, declines, removes and re-enrolls through the enrollment endpoints', async () => {
    const update = vi.spyOn(coursesApi, 'updateEnrollment').mockResolvedValue({});
    openDetail();
    const user = userEvent.setup();
    const courses = await screen.findByRole('region', { name: 'Courses' });

    await user.click(within(courses).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('e2', 'active'));
    await user.click(within(courses).getByRole('button', { name: 'Re-enroll' }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('e3', 'active'));

    await user.click(within(courses).getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove from this course?' });
    expect(dialog).toHaveTextContent('Their progress and submissions are kept');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('e1', 'removed'));
  });

  it('enrolls the student in a course they are not in', async () => {
    const enroll = vi.spyOn(coursesApi, 'enrollStudent').mockResolvedValue({});
    openDetail();
    const user = userEvent.setup();
    const select = await screen.findByLabelText('Enroll in another course');
    // Not the courses they are in or asked for, and never archived ones.
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    expect(
      within(select).getByRole('option', { name: 'Cloud Basics (draft)' }),
    ).toBeInTheDocument();
    await user.selectOptions(select, 'c4');
    await user.click(screen.getByRole('button', { name: 'Enroll' }));
    await waitFor(() => expect(enroll).toHaveBeenCalled());
    expect(enroll.mock.calls[0][0]).toEqual({ courseId: 'c4', email: 'asha@example.com' });
    expect(await screen.findByText('Asha Rao is now enrolled.')).toBeInTheDocument();
  });

  it('shows a refused action and an unknown student', async () => {
    vi.spyOn(coursesApi, 'updateEnrollment').mockRejectedValue(apiError(409, 'Already enrolled'));
    openDetail();
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Already enrolled')).toBeInTheDocument();
    cleanup();

    vi.spyOn(trainerApi, 'student').mockRejectedValue(notFoundError());
    vi.spyOn(trainerApi, 'studentReport').mockRejectedValue(notFoundError());
    open('/admin/students/nope');
    expect(await screen.findByText('This student does not exist.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
