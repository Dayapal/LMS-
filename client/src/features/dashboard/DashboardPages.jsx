import { Link } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';
import { Card, CardBody } from '../../components/ui/Card.jsx';

function Welcome({ subtitle }) {
  const { user } = useAuth();
  const firstName = user.name.split(' ')[0];
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome, {firstName}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}

function EmptyPanel({ title, children }) {
  return (
    <Card>
      <CardBody className="py-10 text-center">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{children}</p>
      </CardBody>
    </Card>
  );
}

// Dashboards are filled with real data in Phases 5 and 6; for now they point to the course pages.
export function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <Welcome subtitle="Trainer workspace" />
      <EmptyPanel title="Manage your courses">
        Build roadmaps, publish modules and lessons, and approve enrollment requests from the{' '}
        <Link to="/admin/courses" className="font-medium text-brand-700 hover:text-brand-800">
          Courses
        </Link>{' '}
        page. Dashboard statistics arrive in a later phase.
      </EmptyPanel>
    </div>
  );
}

export function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <Welcome subtitle="Your learning dashboard" />
      <EmptyPanel title="Find your next course">
        Browse the{' '}
        <Link to="/app/courses" className="font-medium text-brand-700 hover:text-brand-800">
          course catalogue
        </Link>{' '}
        and request to join a course. Once your trainer approves it, your progress will show up
        here.
      </EmptyPanel>
    </div>
  );
}
