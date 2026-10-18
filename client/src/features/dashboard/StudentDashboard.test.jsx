import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { progressApi } from '../progress/api.js';
import { studyMaterialsApi } from '../study-materials/api.js';
import { StudentDashboardPage } from './StudentDashboardPage.jsx';
import { renderWithProviders, apiError } from '../../test/renderWithProviders.jsx';
import { STUDENT } from '../courses/test-fixtures.js';
import { makeDashboard, makeMyAssignment, makeMyCourse } from '../progress/test-fixtures.js';

const routes = [{ path: '/app', element: <StudentDashboardPage /> }];
const open = () => renderWithProviders(routes, { path: '/app', user: STUDENT });

beforeEach(() => {
  vi.spyOn(studyMaterialsApi, 'getStudentStudySummary').mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StudentDashboardPage', () => {
  it('shows stats, where to continue, courses with progress, work to do and feedback', async () => {
    vi.spyOn(progressApi, 'dashboard').mockResolvedValue(makeDashboard());
    open();
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument();

    const continueSection = await screen.findByRole('region', { name: 'Continue learning' });
    expect(
      within(continueSection).getByRole('link', { name: 'Continue: Flexbox Layouts' }),
    ).toHaveAttribute('href', '/app/courses/c1/lessons/l9');
    expect(
      within(continueSection).getByText('21% · 8 of 38 lessons completed'),
    ).toBeInTheDocument();

    const stat = (label) => screen.getByText(label).nextElementSibling;
    expect(stat('Active courses')).toHaveTextContent('1');
    expect(stat('Lessons completed')).toHaveTextContent('8');
    expect(stat('Overdue assignments')).toHaveTextContent('1');
    expect(stat('Awaiting review')).toHaveTextContent('1');

    const courses = screen.getByRole('region', { name: 'My courses' });
    expect(
      within(courses).getByRole('progressbar', { name: /mern development progress/i }),
    ).toHaveAttribute('aria-valuenow', '21');
    expect(within(courses).getByText('Request pending')).toBeInTheDocument();

    const todo = screen.getByRole('region', { name: 'To do' });
    expect(within(todo).getByRole('link', { name: 'Assignment a1' })).toHaveAttribute(
      'href',
      '/app/courses/c1/assignments/a1',
    );
    expect(within(todo).getByText('Resubmission requested')).toBeInTheDocument();
    expect(within(todo).getByText('Not submitted')).toBeInTheDocument();
    expect(within(todo).getByRole('link', { name: 'All assignments' })).toHaveAttribute(
      'href',
      '/app/assignments',
    );

    const feedback = screen.getByRole('region', { name: 'Recent feedback' });
    expect(within(feedback).getByText(/Marks: 86 \/ 100/)).toBeInTheDocument();
  });

  it('renders study bookshelf section when student has assigned books', async () => {
    vi.spyOn(progressApi, 'dashboard').mockResolvedValue(makeDashboard());
    vi.spyOn(studyMaterialsApi, 'getStudentStudySummary').mockResolvedValue({
      totalAssignedBooks: 1,
      totalReleasedModules: 5,
      totalCompletedModules: 2,
      totalReadingSeconds: 3600,
      overallPercent: 40,
      continueModule: {
        bookSlug: 'dsa-javascript',
        bookTitle: 'DSA in JavaScript',
        slug: 'module-2-dsa',
        title: 'Binary Search',
        phaseLabel: 'Module 2',
      },
      books: [
        {
          id: 'b1',
          slug: 'dsa-javascript',
          title: 'DSA in JavaScript',
          category: 'dsa',
          isAssigned: true,
          totalModules: 9,
          releasedModulesCount: 5,
          completedModulesCount: 2,
          overallProgressPercent: 40,
        },
      ],
    });

    open();
    const bookshelf = await screen.findByRole('region', { name: 'Study Books & Bookshelf' });
    expect(bookshelf).toBeInTheDocument();
    expect(within(bookshelf).getByText('DSA in JavaScript')).toBeInTheDocument();
    expect(within(bookshelf).getByText(/Binary Search/)).toBeInTheDocument();
    expect(within(bookshelf).getByRole('link', { name: /Resume Reading/i })).toHaveAttribute(
      'href',
      '/app/study-materials/dsa-javascript/modules/module-2-dsa',
    );
  });

  it('shows the catalogue invitation to a student without courses', async () => {
    vi.spyOn(progressApi, 'dashboard').mockResolvedValue(
      makeDashboard({
        summary: {
          activeCourses: 0,
          completedCourses: 0,
          pendingRequests: 0,
          lessonsCompleted: 0,
          assignments: {
            all: 0,
            pending: 0,
            overdue: 0,
            submitted: 0,
            reviewed: 0,
            resubmit_requested: 0,
          },
        },
        continueLearning: null,
        courses: [],
        upcoming: [],
        recentFeedback: [],
      }),
    );
    open();
    expect(await screen.findByText('Find your next course')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'course catalogue' })).toHaveAttribute(
      'href',
      '/app/courses',
    );
  });

  it('congratulates a student who finished every course and has nothing to do', async () => {
    const finished = makeMyCourse({
      progress: {
        completedLessons: 38,
        totalLessons: 38,
        percent: 100,
        completed: true,
        lastCompletedAt: '2026-10-15T09:00:00.000Z',
        nextLesson: null,
      },
    });
    vi.spyOn(progressApi, 'dashboard').mockResolvedValue(
      makeDashboard({
        summary: { ...makeDashboard().summary, completedCourses: 1, pendingRequests: 0 },
        continueLearning: null,
        courses: [finished],
        upcoming: [],
        recentFeedback: [],
      }),
    );
    open();
    expect(await screen.findByText(/completed every published lesson/)).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Nothing to hand in right now.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recent feedback' })).toBeNull();
  });

  it('says when an enrolled course has no published lessons yet', async () => {
    const empty = makeMyCourse({
      progress: {
        completedLessons: 0,
        totalLessons: 0,
        percent: 0,
        completed: false,
        lastCompletedAt: null,
        nextLesson: null,
      },
    });
    vi.spyOn(progressApi, 'dashboard').mockResolvedValue(
      makeDashboard({ continueLearning: null, courses: [empty] }),
    );
    open();
    const courses = await screen.findByRole('region', { name: 'My courses' });
    expect(
      within(courses).getByText('No lessons have been published in this course yet.'),
    ).toBeInTheDocument();
    expect(within(courses).queryByRole('progressbar')).toBeNull();
    // Not counted as finished either.
    expect(screen.queryByText(/completed every published lesson/)).toBeNull();
  });

  it('shows the state the server derived, without recomputing dates', async () => {
    // Due in the past by the browser clock, but the server says it isn't overdue.
    vi.spyOn(progressApi, 'dashboard').mockResolvedValue(
      makeDashboard({
        upcoming: [makeMyAssignment('a9', 'pending', { dueAt: '2020-01-01T00:00:00.000Z' })],
      }),
    );
    open();
    const todo = await screen.findByRole('region', { name: 'To do' });
    expect(within(todo).getByText('Not submitted')).toBeInTheDocument();
    expect(within(todo).queryByText('Overdue')).toBeNull();
  });

  it('shows an error with a retry button', async () => {
    const dashboard = vi
      .spyOn(progressApi, 'dashboard')
      .mockRejectedValueOnce(apiError(500, 'The server is down'))
      .mockResolvedValue(makeDashboard());
    open();
    expect(await screen.findByText('The server is down')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Continue learning' })).toBeInTheDocument();
    expect(dashboard).toHaveBeenCalledTimes(2);
  });
});
