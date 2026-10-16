import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coursesApi } from '../api.js';
import { assignmentsApi } from '../../assignments/api.js';
import { CourseCatalogPage } from './CourseCatalogPage.jsx';
import { CourseDetailPage } from './CourseDetailPage.jsx';
import { renderWithProviders, notFoundError } from '../../../test/renderWithProviders.jsx';
import { makeCourse, makeRoadmap, STUDENT } from '../test-fixtures.js';
// Loaded up front so the lazily loaded description renderer resolves at once.
import '../../../components/content/MarkdownView.jsx';

const routes = [
  { path: '/app/courses', element: <CourseCatalogPage /> },
  { path: '/app/courses/:courseId', element: <CourseDetailPage /> },
];

// The pages also list assignments; these tests don't look at them.
beforeEach(() => {
  vi.spyOn(assignmentsApi, 'list').mockResolvedValue({
    items: [],
    meta: { page: 1, limit: 100, total: 0, totalPages: 1 },
  });
});
// Unmount before the stubs go, so nothing that mounts late reaches the network.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CourseCatalogPage', () => {
  it('lists published courses with stats and enrollment state', async () => {
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      items: [
        makeCourse(),
        makeCourse({ id: 'c2', title: 'DSA with JavaScript', enrollment: { status: 'pending' } }),
      ],
      meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
    });
    renderWithProviders(routes, { path: '/app/courses', user: STUDENT });

    expect(screen.getByLabelText('Loading courses')).toBeInTheDocument();
    const mern = await screen.findByRole('link', { name: /full-stack mern development/i });
    expect(mern).toHaveAttribute('href', '/app/courses/c1');
    expect(within(mern).getByText('2 modules · 3 lessons · 2 h 30 min')).toBeInTheDocument();
    const dsa = screen.getByRole('link', { name: /dsa with javascript/i });
    expect(within(dsa).getByText('Request pending')).toBeInTheDocument();
  });

  it('shows an empty state when nothing is published', async () => {
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 1 },
    });
    renderWithProviders(routes, { path: '/app/courses', user: STUDENT });
    expect(await screen.findByText('No courses available yet')).toBeInTheDocument();
  });

  it('shows an error with a retry button', async () => {
    const list = vi
      .spyOn(coursesApi, 'list')
      .mockRejectedValueOnce(Object.assign(new Error('x'), { request: {} }))
      .mockResolvedValue({
        items: [makeCourse()],
        meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
      });
    renderWithProviders(routes, { path: '/app/courses', user: STUDENT });

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Full-Stack MERN Development')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('passes the level filter to the API', async () => {
    const list = vi.spyOn(coursesApi, 'list').mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 1 },
    });
    renderWithProviders(routes, { path: '/app/courses', user: STUDENT });
    await userEvent.selectOptions(screen.getByLabelText('Filter by level'), 'advanced');
    await screen.findByText('No courses match');
    expect(list).toHaveBeenLastCalledWith({ page: 1, limit: 12, level: 'advanced' });
  });
});

describe('CourseDetailPage', () => {
  it('renders the roadmap timeline and description', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(makeRoadmap());
    renderWithProviders(routes, { path: '/app/courses/c1', user: STUDENT });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Full-Stack MERN Development' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /module 1: html fundamentals/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lesson l1')).toBeInTheDocument();
    // The Markdown renderer loads lazily, then splits the paragraphs.
    expect(await screen.findByText('Second paragraph.')).toBeInTheDocument();
    // Not enrolled: the roadmap is an outline, without links to lesson content.
    expect(screen.queryByRole('link', { name: 'Lesson l1' })).not.toBeInTheDocument();
  });

  it('renders the course description as safe Markdown', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(
      makeRoadmap({ description: '## Who it is for\n\n**Beginners** <script>alert(1)</script>' }),
    );
    const { container } = renderWithProviders(routes, { path: '/app/courses/c1', user: STUDENT });
    expect(await screen.findByRole('heading', { name: 'Who it is for' })).toBeInTheDocument();
    expect(screen.getByText('Beginners').tagName).toBe('STRONG');
    expect(container.querySelector('script')).toBeNull();
  });

  it('links enrolled students to each lesson and the first lesson', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(
      makeRoadmap({ enrollment: { status: 'active', enrolledAt: '2026-10-01' } }),
    );
    renderWithProviders(routes, { path: '/app/courses/c1', user: STUDENT });
    expect(await screen.findByRole('link', { name: 'Lesson l1' })).toHaveAttribute(
      'href',
      '/app/courses/c1/lessons/l1',
    );
    expect(screen.getByRole('link', { name: /start with/i })).toHaveAttribute(
      'href',
      '/app/courses/c1/lessons/l1',
    );
  });

  it('requests enrollment and shows the pending state', async () => {
    const roadmap = vi
      .spyOn(coursesApi, 'roadmap')
      .mockResolvedValueOnce(makeRoadmap())
      .mockResolvedValue(makeRoadmap({ enrollment: { status: 'pending', enrolledAt: null } }));
    const request = vi
      .spyOn(coursesApi, 'requestEnrollment')
      .mockResolvedValue({ status: 'pending', enrolledAt: null });
    renderWithProviders(routes, { path: '/app/courses/c1', user: STUDENT });

    await userEvent.click(await screen.findByRole('button', { name: 'Request enrollment' }));

    expect(request).toHaveBeenCalledWith('c1');
    expect(await screen.findByText('Request sent.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Enrollment requested');
    expect(roadmap).toHaveBeenCalledTimes(2);
  });

  it('shows enrolled students their status instead of a button', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(
      makeRoadmap({ enrollment: { status: 'active', enrolledAt: '2026-10-01' } }),
    );
    renderWithProviders(routes, { path: '/app/courses/c1', user: STUDENT });
    expect(await screen.findByText(/you're enrolled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /request/i })).not.toBeInTheDocument();
  });

  it('lists the course’s assignments with the student’s status once enrolled', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(
      makeRoadmap({ enrollment: { status: 'active', enrolledAt: '2026-10-01' } }),
    );
    const list = vi.spyOn(assignmentsApi, 'list').mockResolvedValue({
      items: [
        {
          id: 'a1',
          title: 'Personal Profile Page',
          dueAt: '2030-01-15T18:29:00.000Z',
          maxMarks: 100,
          mySubmission: { status: 'resubmit_requested' },
        },
        {
          id: 'a2',
          title: 'Old portfolio',
          status: 'archived',
          dueAt: '2026-01-15T18:29:00.000Z',
          maxMarks: 50,
          mySubmission: { status: 'reviewed' },
        },
      ],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    renderWithProviders(routes, { path: '/app/courses/c1', user: STUDENT });
    const section = await screen.findByRole('region', { name: 'Assignments' });
    expect(
      await within(section).findByRole('link', { name: 'Personal Profile Page' }),
    ).toHaveAttribute('href', '/app/courses/c1/assignments/a1');
    expect(within(section).getByText('Resubmission requested')).toBeInTheDocument();
    const archived = within(section).getByRole('link', { name: 'Old portfolio' }).closest('li');
    expect(within(archived).getByText('Archived')).toBeInTheDocument();
    expect(within(archived).getByText('Reviewed')).toBeInTheDocument();
    expect(list.mock.calls[0][0]).toMatchObject({ course: 'c1' });
  });

  it('does not ask for assignments before the student is enrolled', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(makeRoadmap());
    renderWithProviders(routes, { path: '/app/courses/c1', user: STUDENT });
    expect(await screen.findByRole('heading', { name: 'Roadmap' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Assignments' })).not.toBeInTheDocument();
    expect(assignmentsApi.list).not.toHaveBeenCalled();
  });

  it('shows a friendly message for unavailable courses', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockRejectedValue(notFoundError());
    renderWithProviders(routes, { path: '/app/courses/c9', user: STUDENT });
    expect(await screen.findByText('This course is not available.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });
});
