import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { filesApi, lessonsApi } from './api.js';
import { assignmentsApi } from '../assignments/api.js';
import { LessonReaderPage } from './LessonReaderPage.jsx';
import { renderWithProviders, notFoundError } from '../../test/renderWithProviders.jsx';
import { ADMIN, STUDENT } from '../courses/test-fixtures.js';
import {
  codeMaterial,
  fileMaterial,
  linkMaterial,
  makeLessonDetail,
  makeNavigation,
  noteMaterial,
} from './test-fixtures.js';

const routes = [
  { path: '/app/courses/:courseId/lessons/:lessonId', element: <LessonReaderPage /> },
  {
    path: '/admin/courses/:courseId/lessons/:lessonId/preview',
    element: <LessonReaderPage mode="preview" />,
  },
];

function mockLesson({
  lesson = makeLessonDetail(),
  materials,
  navigation = makeNavigation(),
} = {}) {
  vi.spyOn(lessonsApi, 'get').mockResolvedValue(lesson);
  vi.spyOn(lessonsApi, 'materials').mockResolvedValue(
    materials ?? [
      noteMaterial(),
      codeMaterial(),
      fileMaterial(),
      linkMaterial('a'),
      linkMaterial('b'),
    ],
  );
  vi.spyOn(lessonsApi, 'navigation').mockResolvedValue(navigation);
}

const openReader = (path = '/app/courses/c1/lessons/l2', user = STUDENT) =>
  renderWithProviders(routes, { path, user });

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

describe('LessonReaderPage', () => {
  it('shows the lesson, its objectives and every material in order', async () => {
    mockLesson();
    openReader();

    expect(screen.getByLabelText('Loading lesson')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Flexbox Layouts' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lesson 2 of 5 · 1 h')).toBeInTheDocument();
    expect(screen.getByText('Build navigation bars')).toBeInTheDocument();
    expect(screen.getByText('Selectors', { selector: 'li' })).toBeInTheDocument();

    const headings = (await screen.findAllByRole('heading', { level: 2 })).map(
      (h) => h.textContent,
    );
    expect(headings).toEqual([
      'In this lesson you will',
      'Before you start',
      'Lesson notes',
      'Navbar layout',
      'Flexbox cheat sheet',
      'Further reading',
    ]);
    // The note's own `##` heading nests one level below the material title.
    expect(screen.getByRole('heading', { level: 3, name: 'One axis' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Code: Navbar layout' })).toHaveTextContent(
      'display: flex;',
    );
    expect(screen.getByText('Space between the logo and links')).toBeInTheDocument();

    const reading = screen.getByRole('region', { name: 'Further reading' });
    expect(within(reading).getAllByRole('link')).toHaveLength(2);
    expect(within(reading).getByRole('link', { name: /Guide a/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });

  it('links to the previous and next lessons', async () => {
    mockLesson();
    openReader();
    const nav = await screen.findByRole('navigation', { name: 'Lesson navigation' });
    expect(within(nav).getByRole('link', { name: /previous lesson.*selectors/i })).toHaveAttribute(
      'href',
      '/app/courses/c1/lessons/l1',
    );
    expect(within(nav).getByRole('link', { name: /next lesson.*css grid/i })).toHaveAttribute(
      'href',
      '/app/courses/c1/lessons/l3',
    );
  });

  it('moves to the next lesson and focuses its title', async () => {
    mockLesson();
    const { router } = openReader();
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Flexbox Layouts' });

    lessonsApi.get.mockResolvedValue(makeLessonDetail({ id: 'l3', title: 'CSS Grid' }));
    lessonsApi.navigation.mockResolvedValue(
      makeNavigation({
        previous: { id: 'l2', title: 'Flexbox Layouts', moduleTitle: 'CSS' },
        next: null,
      }),
    );
    await user.click(screen.getByRole('link', { name: /next lesson/i }));

    const title = await screen.findByRole('heading', { level: 1, name: 'CSS Grid' });
    expect(router.state.location.pathname).toBe('/app/courses/c1/lessons/l3');
    expect(lessonsApi.materials).toHaveBeenLastCalledWith('l3');
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('views a PDF inline from an authorized blob, and downloads it', async () => {
    mockLesson({ materials: [fileMaterial()] });
    // Whatever type the response claims, the viewer only renders it as a PDF.
    const blob = new Blob(['%PDF-1.4'], { type: 'text/html' });
    const fetchFile = vi.spyOn(filesApi, 'fetch').mockResolvedValue(blob);
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf-1');
    const user = userEvent.setup();
    openReader();

    await user.click(await screen.findByRole('button', { name: 'View PDF' }));
    expect(fetchFile.mock.calls[0][0]).toBe('file1');
    expect(await screen.findByTitle('PDF viewer: flexbox.pdf')).toHaveAttribute(
      'src',
      'blob:pdf-1',
    );
    expect(createUrl.mock.calls[0][0].type).toBe('application/pdf');

    await user.click(screen.getByRole('button', { name: 'Download' }));
    expect(fetchFile).toHaveBeenLastCalledWith('file1', { download: true });
  });

  it('hides the download button for view-only files', async () => {
    mockLesson({ materials: [fileMaterial({ downloadable: false })] });
    openReader();
    expect(await screen.findByRole('button', { name: 'View PDF' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument();
    expect(screen.getByText(/view only/)).toBeInTheDocument();
  });

  it('shows a file error from the server', async () => {
    mockLesson({ materials: [fileMaterial()] });
    vi.spyOn(filesApi, 'fetch').mockRejectedValue(notFoundError());
    openReader();
    await userEvent.click(await screen.findByRole('button', { name: 'View PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Course not found');
  });

  it('shows an empty state when there are no materials', async () => {
    mockLesson({ materials: [], navigation: makeNavigation({ previous: null, next: null }) });
    openReader();
    expect(await screen.findByText('No study materials yet')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Lesson navigation' })).not.toBeInTheDocument();
  });

  it('explains when a lesson is not available', async () => {
    vi.spyOn(lessonsApi, 'get').mockRejectedValue(notFoundError());
    vi.spyOn(lessonsApi, 'materials').mockRejectedValue(notFoundError());
    vi.spyOn(lessonsApi, 'navigation').mockRejectedValue(notFoundError());
    openReader();
    expect(await screen.findByRole('alert')).toHaveTextContent(/not available/);
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the course/i })).toHaveAttribute(
      'href',
      '/app/courses/c1',
    );
  });

  it('lists the lesson’s assignments under its materials', async () => {
    mockLesson();
    const list = vi.spyOn(assignmentsApi, 'list').mockResolvedValue({
      items: [
        {
          id: 'a7',
          title: 'Flexbox navbar',
          dueAt: '2030-01-15T18:29:00.000Z',
          maxMarks: 20,
          mySubmission: { status: 'pending' },
        },
      ],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });
    openReader();
    const section = await screen.findByRole('region', { name: 'Practice assignments' });
    expect(within(section).getByRole('link', { name: 'Flexbox navbar' })).toHaveAttribute(
      'href',
      '/app/courses/c1/assignments/a7',
    );
    expect(within(section).getByText('Not submitted')).toBeInTheDocument();
    expect(list.mock.calls[0][0]).toEqual({ lesson: 'l2' });
  });

  it('marks drafts in the trainer preview and links within the preview', async () => {
    mockLesson({
      lesson: makeLessonDetail({ status: 'draft' }),
      materials: [noteMaterial({ status: 'draft' }), codeMaterial()],
    });
    openReader('/admin/courses/c1/lessons/l2/preview', ADMIN);

    expect(await screen.findByText('Trainer preview')).toBeInTheDocument();
    const notes = await screen.findByRole('region', { name: /lesson notes/i });
    expect(within(notes).getByText('Draft')).toBeInTheDocument();
    expect(screen.getAllByText('Draft')).toHaveLength(2); // the lesson and the note
    expect(screen.getByRole('link', { name: /next lesson/i })).toHaveAttribute(
      'href',
      '/admin/courses/c1/lessons/l3/preview',
    );
    expect(screen.getByRole('link', { name: /back to the materials editor/i })).toHaveAttribute(
      'href',
      '/admin/courses/c1/lessons/l2',
    );
  });
});
