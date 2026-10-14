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

// Dashboards are filled with real data in Phases 5 and 6; for now they confirm role routing.
export function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <Welcome subtitle="Trainer workspace" />
      <EmptyPanel title="Course management is coming next">
        Courses, roadmaps and student activity will appear here. Meanwhile you can update your{' '}
        <Link to="/admin/profile" className="font-medium text-brand-700 hover:text-brand-800">
          profile
        </Link>
        .
      </EmptyPanel>
    </div>
  );
}

export function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <Welcome subtitle="Your learning dashboard" />
      <EmptyPanel title="No courses yet">
        Once your trainer enrolls you in a course, your roadmap and assignments will show up here.
        Meanwhile you can complete your{' '}
        <Link to="/app/profile" className="font-medium text-brand-700 hover:text-brand-800">
          profile
        </Link>
        .
      </EmptyPanel>
    </div>
  );
}
