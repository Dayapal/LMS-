import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { coursesApi, useCourseMutation, useRoadmap } from '../api.js';
import { LEVEL_LABEL, formatMinutes, plural } from '../format.js';
import { CourseFormModal } from './CourseFormModal.jsx';
import { RoadmapEditor } from './RoadmapEditor.jsx';
import { EnrollmentsPanel } from './EnrollmentsPanel.jsx';
import { CourseAssignmentsPanel } from '../../assignments/admin/CourseAssignmentsPanel.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { TabPanel, Tabs } from '../../../components/ui/Tabs.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { ErrorState, PageHeader, Skeleton } from '../../../components/ui/Feedback.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

/** Status transitions offered for each course status. */
const STATUS_ACTIONS = {
  draft: [
    { to: 'published', label: 'Publish', variant: 'primary' },
    { to: 'archived', label: 'Archive' },
  ],
  published: [
    { to: 'draft', label: 'Unpublish' },
    { to: 'archived', label: 'Archive' },
  ],
  archived: [{ to: 'draft', label: 'Restore as draft' }],
};

const STATUS_MESSAGE = {
  published: 'Course published. Students can now find it in the catalogue.',
  draft: 'Course moved to draft. Students can no longer see it.',
  archived: 'Course archived. It is hidden from students.',
};

const TABS = [
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'students', label: 'Students' },
];

export function CourseBuilderPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  // Pages that link back to a tab pass it in the location state.
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab ?? 'roadmap');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data, isPending, isError, error, refetch } = useRoadmap(courseId);

  const update = useCourseMutation((values) => coursesApi.update(courseId, values));
  const setStatus = useCourseMutation((status) => coursesApi.setStatus(courseId, status));
  // Leave the page before the cache refresh so the deleted course isn't refetched.
  const remove = useCourseMutation(() => coursesApi.remove(courseId), {
    onSuccess: () => {
      toast.success('Course deleted.');
      navigate('/admin/courses', { replace: true });
    },
  });

  if (isPending) {
    return (
      <div className="space-y-6" aria-label="Loading course">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        message={
          error.response?.status === 404 ? 'This course does not exist.' : getErrorMessage(error)
        }
        onRetry={error.response?.status === 404 ? undefined : refetch}
      />
    );
  }

  const { course, modules } = data;

  const changeStatus = async (status) => {
    try {
      await setStatus.mutateAsync(status);
      toast.success(STATUS_MESSAGE[status]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={course.summary}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit details
            </Button>
            {STATUS_ACTIONS[course.status].map((action) => (
              <Button
                key={action.to}
                variant={action.variant ?? 'secondary'}
                loading={setStatus.isPending && setStatus.variables === action.to}
                disabled={setStatus.isPending}
                onClick={() => changeStatus(action.to)}
              >
                {action.label}
              </Button>
            ))}
            {course.status !== 'published' && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      >
        <Link
          to="/admin/courses"
          className="mb-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← All courses
        </Link>
      </PageHeader>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Status</dt>
          <dd>
            <StatusBadge status={course.status} />
          </dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Level: </dt>
          <dd className="inline">{LEVEL_LABEL[course.level]}</dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Content: </dt>
          <dd className="inline">
            {plural(course.stats.moduleCount, 'module')},{' '}
            {plural(course.stats.lessonCount, 'lesson')} ({formatMinutes(course.stats.totalMinutes)}
            )
          </dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Estimated: </dt>
          <dd className="inline">{course.estimatedHours} hours</dd>
        </div>
      </dl>

      <Tabs label="Course sections" tabs={TABS} value={tab} onChange={setTab} idPrefix="course" />

      <TabPanel idPrefix="course" tab={tab}>
        {tab === 'roadmap' && <RoadmapEditor courseId={course.id} modules={modules} />}
        {tab === 'assignments' && <CourseAssignmentsPanel courseId={course.id} modules={modules} />}
        {tab === 'students' && <EnrollmentsPanel courseId={course.id} />}
      </TabPanel>

      <CourseFormModal
        open={editing}
        course={course}
        onClose={() => setEditing(false)}
        onSubmit={async (values) => {
          await update.mutateAsync(values);
          toast.success('Course details saved.');
          setEditing(false);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this course?"
        message={`“${course.title}” and all of its modules and lessons will be permanently deleted. Courses with enrolled students must be archived instead.`}
        confirmLabel="Delete course"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
