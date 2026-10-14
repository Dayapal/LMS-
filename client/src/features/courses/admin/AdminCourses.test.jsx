import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { coursesApi } from '../api.js';
import { AdminCoursesPage } from './AdminCoursesPage.jsx';
import { CourseBuilderPage } from './CourseBuilderPage.jsx';
import { apiError, renderWithProviders } from '../../../test/renderWithProviders.jsx';
import { ADMIN, makeCourse, makeRoadmap } from '../test-fixtures.js';

const routes = [
  { path: '/admin/courses', element: <AdminCoursesPage /> },
  { path: '/admin/courses/:courseId', element: <CourseBuilderPage /> },
];

const renderBuilder = (roadmap = makeRoadmap()) => {
  vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(roadmap);
  return renderWithProviders(routes, { path: '/admin/courses/c1', user: ADMIN });
};

afterEach(() => vi.restoreAllMocks());

describe('AdminCoursesPage', () => {
  it('validates and creates a course, then opens its builder', async () => {
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      items: [makeCourse({ status: 'draft' })],
      meta: { page: 1, limit: 12, total: 1, totalPages: 1 },
    });
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(
      makeRoadmap({ id: 'new1', title: 'Node APIs' }),
    );
    const create = vi.spyOn(coursesApi, 'create').mockResolvedValue(makeCourse({ id: 'new1' }));
    const { router } = renderWithProviders(routes, { path: '/admin/courses', user: ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: 'New course' }));
    const dialog = screen.getByRole('dialog', { name: 'New course' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create course' }));
    expect(
      await within(dialog).findByText('Title must be at least 3 characters'),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await userEvent.type(within(dialog).getByLabelText(/title/i), 'Node APIs');
    await userEvent.type(within(dialog).getByLabelText(/tags/i), 'Node, API, node');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create course' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/courses/new1'));
    expect(create.mock.calls[0][0]).toMatchObject({
      title: 'Node APIs',
      tags: ['node', 'api'],
      level: 'beginner',
    });
  });

  it('filters by status tab', async () => {
    const list = vi.spyOn(coursesApi, 'list').mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 1 },
    });
    renderWithProviders(routes, { path: '/admin/courses', user: ADMIN });
    await userEvent.click(await screen.findByRole('tab', { name: 'Drafts' }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith({ page: 1, limit: 12, status: 'draft' }),
    );
  });
});

describe('CourseBuilderPage', () => {
  it('offers status actions that match the course status', async () => {
    const setStatus = vi
      .spyOn(coursesApi, 'setStatus')
      .mockResolvedValue(makeCourse({ status: 'published' }));
    renderBuilder(makeRoadmap({ status: 'draft' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    expect(setStatus).toHaveBeenCalledWith('c1', 'published');
    expect(await screen.findByText(/course published/i)).toBeInTheDocument();
  });

  it('hides delete for published courses', async () => {
    renderBuilder(makeRoadmap({ status: 'published' }));
    await screen.findByRole('button', { name: 'Unpublish' });
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('reorders modules with the move buttons', async () => {
    const reorder = vi.spyOn(coursesApi, 'reorderModules').mockResolvedValue([]);
    renderBuilder();

    const up = await screen.findByRole('button', { name: 'Move module HTML Fundamentals up' });
    expect(up).toBeDisabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Move module HTML Fundamentals down' }),
    );
    expect(reorder).toHaveBeenCalledWith('c1', ['m2', 'm1']);
  });

  it('reorders lessons within a module', async () => {
    const reorder = vi.spyOn(coursesApi, 'reorderLessons').mockResolvedValue([]);
    renderBuilder();
    await userEvent.click(await screen.findByRole('button', { name: 'Move lesson Lesson l2 up' }));
    expect(reorder).toHaveBeenCalledWith('m1', ['l2', 'l1']);
  });

  it('links each lesson to its materials editor', async () => {
    renderBuilder();
    expect(
      await screen.findByRole('link', { name: 'Materials for lesson Lesson l1' }),
    ).toHaveAttribute('href', '/admin/courses/c1/lessons/l1');
  });

  it('confirms before deleting and reports server refusals', async () => {
    const remove = vi
      .spyOn(coursesApi, 'removeLesson')
      .mockRejectedValue(apiError(409, 'Published lessons cannot be deleted.'));
    renderBuilder();

    await userEvent.click(await screen.findByRole('button', { name: 'Delete lesson Lesson l1' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete lesson?' });
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(remove).toHaveBeenCalledWith('l1');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Published lessons cannot be deleted.',
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('adds a lesson with objectives entered one per line', async () => {
    const create = vi.spyOn(coursesApi, 'createLesson').mockResolvedValue({});
    renderBuilder();

    await userEvent.click(await screen.findByRole('button', { name: 'Add lesson to CSS Layouts' }));
    const dialog = screen.getByRole('dialog', { name: 'Add lesson' });
    await userEvent.type(within(dialog).getByLabelText(/^title/i), 'Grid areas');
    await userEvent.type(
      within(dialog).getByLabelText(/learning objectives/i),
      'Name grid areas{enter}{enter}Place items',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add lesson' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        'm2',
        expect.objectContaining({
          title: 'Grid areas',
          objectives: ['Name grid areas', 'Place items'],
          status: 'draft',
        }),
      ),
    );
  });

  it('shows a not-found message for unknown courses', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockRejectedValue(apiError(404, 'Course not found'));
    renderWithProviders(routes, { path: '/admin/courses/zzz', user: ADMIN });
    expect(await screen.findByText('This course does not exist.')).toBeInTheDocument();
  });
});
