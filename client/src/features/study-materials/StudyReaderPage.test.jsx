import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudyReaderPage } from './StudyReaderPage.jsx';
import { studyMaterialsApi } from './api.js';
import { STUDENT, ADMIN } from '../courses/test-fixtures.js';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockModuleContent = {
  book: {
    id: 'b1',
    slug: 'dsa-javascript',
    title: 'DSA with JavaScript',
    category: 'dsa',
  },
  module: {
    id: 'm1',
    slug: 'module-1-complexity-analysis-and-big-o',
    title: 'Module 1: Complexity Analysis & Big-O',
    phaseLabel: 'Module 1',
    originalFilename: 'Module-1-Complexity-Analysis-and-Big-O.html',
    estimatedMinutes: 25,
    linkedAssignment: {
      id: 'a1',
      title: 'Big-O Homework Problem Set',
      dueAt: '2026-11-01T00:00:00.000Z',
    },
  },
  navigation: {
    prev: null,
    next: {
      id: 'm2',
      slug: 'module-2-arrays',
      title: 'Module 2: Arrays & Memory',
      phaseLabel: 'Module 2',
    },
  },
  readingProgress: {
    isCompleted: false,
    totalReadingSeconds: 150,
  },
  content: '<!DOCTYPE html><html><head><title>Module 1</title></head><body><h1>Big-O Notation</h1><p>Algorithm analysis</p></body></html>',
};

const mockBookDetail = {
  id: 'b1',
  slug: 'dsa-javascript',
  title: 'DSA with JavaScript',
  category: 'dsa',
  releasedCount: 2,
  completedCount: 1,
  modules: [
    {
      id: 'm1',
      slug: 'module-1-complexity-analysis-and-big-o',
      title: 'Module 1: Complexity Analysis & Big-O',
      phaseLabel: 'Module 1',
      isReleased: true,
      readingProgress: {
        isCompleted: false,
        totalReadingSeconds: 150,
      },
    },
    {
      id: 'm2',
      slug: 'module-2-arrays',
      title: 'Module 2: Arrays & Memory',
      phaseLabel: 'Module 2',
      isReleased: true,
      readingProgress: {
        isCompleted: true,
        totalReadingSeconds: 300,
      },
    },
    {
      id: 'm3',
      slug: 'module-3-linked-lists',
      title: 'Module 3: Linked Lists',
      phaseLabel: 'Module 3',
      isReleased: false,
      readingProgress: null,
    },
  ],
};

function renderStudentReader(
  url = '/app/study-materials/dsa-javascript/modules/module-1-complexity-analysis-and-big-o',
) {
  const routes = [
    {
      path: '/app/study-materials/:bookSlug/modules/:moduleSlug',
      element: <StudyReaderPage mode="student" />,
    },
    {
      path: '/app/study-materials/:bookSlug',
      element: <div>Book Roadmap Page</div>,
    },
    {
      path: '/app/assignments',
      element: <div>Assignments Page</div>,
    },
  ];
  return renderWithProviders(routes, { path: url, user: STUDENT });
}

function renderAdminPreview(url = '/admin/study-materials/preview/m1') {
  const routes = [
    {
      path: '/admin/study-materials/preview/:moduleId',
      element: <StudyReaderPage mode="preview" />,
    },
    {
      path: '/admin/study-materials',
      element: <div>Admin Catalogue</div>,
    },
  ];
  return renderWithProviders(routes, { path: url, user: ADMIN });
}

describe('StudyReaderPage', () => {
  it('renders original HTML in an isolated iframe with strict sandbox="allow-scripts"', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentModuleContent').mockResolvedValue(mockModuleContent);
    vi.spyOn(studyMaterialsApi, 'getStudentBookDetail').mockResolvedValue(mockBookDetail);

    renderStudentReader();

    expect(await screen.findByText('Module 1: Complexity Analysis & Big-O')).toBeInTheDocument();
    expect(screen.getByText('DSA with JavaScript')).toBeInTheDocument();
    expect(screen.getByText('Module 1')).toBeInTheDocument();

    // Check reading timer badge
    expect(screen.getByText(/2m read/i)).toBeInTheDocument();

    // Verify sandboxed iframe
    const iframe = screen.getByTitle('Module 1: Complexity Analysis & Big-O');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
    expect(iframe).toHaveAttribute('srcdoc', mockModuleContent.content);
  });

  it('toggles syllabus drawer displaying released vs locked modules', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentModuleContent').mockResolvedValue(mockModuleContent);
    vi.spyOn(studyMaterialsApi, 'getStudentBookDetail').mockResolvedValue(mockBookDetail);
    const user = userEvent.setup();

    renderStudentReader();

    const syllabusBtn = await screen.findByRole('button', { name: /Toggle Syllabus Sidebar/i });
    expect(syllabusBtn).toBeInTheDocument();

    // Initially sidebar is closed
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    // Click to open syllabus
    await user.click(syllabusBtn);

    const aside = await screen.findByRole('complementary');
    expect(aside).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 completed/i)).toBeInTheDocument();

    // Locked module is shown with lock symbol
    expect(screen.getByText('Module 3: Linked Lists')).toBeInTheDocument();
    expect(screen.getByTitle('Locked by trainer')).toBeInTheDocument();

    // Close syllabus button
    const closeBtn = screen.getByRole('button', { name: /Close sidebar/i });
    await user.click(closeBtn);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('toggles module completion state', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentModuleContent').mockResolvedValue(mockModuleContent);
    vi.spyOn(studyMaterialsApi, 'getStudentBookDetail').mockResolvedValue(mockBookDetail);
    const completeSpy = vi.spyOn(studyMaterialsApi, 'markModuleComplete').mockResolvedValue({
      isCompleted: true,
    });
    const user = userEvent.setup();

    renderStudentReader();

    const markCompleteBtn = await screen.findByRole('button', { name: /Mark Complete/i });
    expect(markCompleteBtn).toBeInTheDocument();

    await user.click(markCompleteBtn);
    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith({
        bookSlug: 'dsa-javascript',
        moduleSlug: 'module-1-complexity-analysis-and-big-o',
      });
    });

    expect(screen.getByRole('button', { name: /Completed/i })).toBeInTheDocument();
  });

  it('navigates to next module when Next button is clicked', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentModuleContent').mockResolvedValue(mockModuleContent);
    vi.spyOn(studyMaterialsApi, 'getStudentBookDetail').mockResolvedValue(mockBookDetail);
    const user = userEvent.setup();

    const { router } = renderStudentReader();

    const nextBtn = await screen.findByRole('button', { name: /Next/i });
    expect(nextBtn).toBeEnabled();

    // Prev button is disabled because navigation.prev is null
    const prevBtn = screen.getByRole('button', { name: /Prev/i });
    expect(prevBtn).toBeDisabled();

    await user.click(nextBtn);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        '/app/study-materials/dsa-javascript/modules/module-2-arrays',
      );
    });
  });

  it('displays associated assignment quick-action banner when linked', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentModuleContent').mockResolvedValue(mockModuleContent);
    vi.spyOn(studyMaterialsApi, 'getStudentBookDetail').mockResolvedValue(mockBookDetail);

    renderStudentReader();

    expect(await screen.findByText('Associated Assignment')).toBeInTheDocument();
    expect(screen.getByText('Big-O Homework Problem Set')).toBeInTheDocument();
    const assignmentLink = screen.getByRole('link', { name: /Go to Assignment/i });
    expect(assignmentLink).toHaveAttribute('href', '/app/assignments');
  });

  it('renders in preview mode for trainers without reading telemetry or completion controls', async () => {
    const previewData = {
      ...mockModuleContent,
      readingProgress: null,
    };
    vi.spyOn(studyMaterialsApi, 'getAdminPreview').mockResolvedValue(previewData);

    renderAdminPreview();

    expect(await screen.findByText('Trainer Preview')).toBeInTheDocument();
    expect(screen.getByText('Module 1: Complexity Analysis & Big-O')).toBeInTheDocument();

    // In preview mode, student telemetry and completion button should not be present
    expect(screen.queryByRole('button', { name: /Mark Complete/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/read/i)).not.toBeInTheDocument();
  });
});

