import { useAuth } from '../../hooks/useAuth.js';

export function Welcome({ subtitle }) {
  const { user } = useAuth();
  const firstName = user.name.split(' ')[0];
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome, {firstName}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}
