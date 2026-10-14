import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage.jsx';
import { RegisterPage } from './RegisterPage.jsx';
import { renderWithAuth, STUDENT } from '../../test/renderWithAuth.jsx';

const apiError = (status, error) =>
  Object.assign(new Error('fail'), { response: { status, data: { success: false, error } } });

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/app', element: <p>student home</p> },
  { path: '/app/profile', element: <p>student profile</p> },
];

describe('LoginPage', () => {
  it('validates before calling the API', async () => {
    const login = vi.fn();
    renderWithAuth(routes, { path: '/login', auth: { login } });

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in and goes to the role home', async () => {
    const login = vi.fn().mockResolvedValue(STUDENT);
    const { router } = renderWithAuth(routes, { path: '/login', auth: { login } });

    await userEvent.type(screen.getByLabelText(/email/i), 'asha@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Passw0rd!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(login).toHaveBeenCalledWith({ email: 'asha@example.com', password: 'Passw0rd!' });
  });

  it('shows the server message for bad credentials', async () => {
    const login = vi
      .fn()
      .mockRejectedValue(
        apiError(401, { code: 'UNAUTHENTICATED', message: 'Invalid email or password' }),
      );
    renderWithAuth(routes, { path: '/login', auth: { login } });

    await userEvent.type(screen.getByLabelText(/email/i), 'asha@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});

describe('RegisterPage', () => {
  const fill = async ({ name = 'Asha Student', email = 'asha@example.com', password, confirm }) => {
    await userEvent.type(screen.getByLabelText(/full name/i), name);
    await userEvent.type(screen.getByLabelText(/^email/i), email);
    await userEvent.type(screen.getByLabelText(/^password/i), password);
    await userEvent.type(screen.getByLabelText(/confirm password/i), confirm);
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
  };

  it('enforces the password rules and matching confirmation', async () => {
    const register = vi.fn();
    renderWithAuth(routes, { path: '/register', auth: { register } });

    await fill({ password: 'lettersonly', confirm: 'different1' });

    expect(
      await screen.findByText('Password must contain a letter and a number'),
    ).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('maps server field errors onto the form', async () => {
    const register = vi.fn().mockRejectedValue(
      apiError(400, {
        code: 'VALIDATION_ERROR',
        message: 'Some fields are invalid',
        details: [{ path: 'email', message: 'Enter a valid email address' }],
      }),
    );
    renderWithAuth(routes, { path: '/register', auth: { register } });

    await fill({ password: 'Passw0rd!', confirm: 'Passw0rd!' });

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
  });

  it('shows a conflict message for an existing email', async () => {
    const register = vi
      .fn()
      .mockRejectedValue(
        apiError(409, { code: 'CONFLICT', message: 'An account with this email already exists' }),
      );
    renderWithAuth(routes, { path: '/register', auth: { register } });

    await fill({ password: 'Passw0rd!', confirm: 'Passw0rd!' });

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });

  it('creates the account and lands on the student dashboard', async () => {
    const register = vi.fn().mockResolvedValue(STUDENT);
    const { router } = renderWithAuth(routes, { path: '/register', auth: { register } });

    await fill({ password: 'Passw0rd!', confirm: 'Passw0rd!' });

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'));
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Asha Student',
        email: 'asha@example.com',
        password: 'Passw0rd!',
      }),
    );
  });
});
