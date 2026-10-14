import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../hooks/useAuth.js';
import { authApi } from '../auth/api.js';
import { changePasswordSchema, profileSchema } from '../auth/schemas.js';
import { Button } from '../../components/ui/Button.jsx';
import { TextAreaField, TextField } from '../../components/ui/FormField.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { applyFieldErrors, getErrorMessage } from '../../utils/apiErrors.js';
import { ROLE_LABEL } from '../../layouts/navigation.js';

function ProfileForm() {
  const { user, updateUser } = useAuth();
  const [result, setResult] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, bio: user.bio ?? '', avatarUrl: user.avatarUrl ?? '' },
  });

  const onSubmit = async (values) => {
    setResult(null);
    try {
      const { user: updated } = await authApi.updateProfile(values);
      updateUser(updated);
      reset({ name: updated.name, bio: updated.bio ?? '', avatarUrl: updated.avatarUrl ?? '' });
      setResult({ tone: 'success', message: 'Profile updated.' });
    } catch (error) {
      if (!applyFieldErrors(error, setError)) {
        setResult({ tone: 'error', message: getErrorMessage(error) });
      }
    }
  };

  return (
    <Card>
      <CardHeader title="Profile" description="How you appear to your trainer and classmates." />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {result && <Alert tone={result.tone}>{result.message}</Alert>}
          <TextField
            label="Full name"
            required
            error={errors.name?.message}
            {...register('name')}
          />
          <TextField
            label="Email"
            value={user.email}
            disabled
            readOnly
            hint="Email can't be changed."
          />
          <TextField
            label="Avatar URL"
            type="url"
            placeholder="https://"
            hint="Optional. A link to a square image."
            error={errors.avatarUrl?.message}
            {...register('avatarUrl')}
          />
          <TextAreaField
            label="Bio"
            hint="Optional. Up to 500 characters."
            error={errors.bio?.message}
            {...register('bio')}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function PasswordForm() {
  const { signIn } = useAuth();
  const [result, setResult] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    setResult(null);
    try {
      signIn(await authApi.changePassword({ currentPassword, newPassword }));
      reset();
      setResult({
        tone: 'success',
        message: 'Password changed. You have been signed out on all other devices.',
      });
    } catch (error) {
      if (!applyFieldErrors(error, setError)) {
        setResult({ tone: 'error', message: getErrorMessage(error) });
      }
    }
  };

  return (
    <Card>
      <CardHeader
        title="Change password"
        description="Changing it signs you out everywhere else."
      />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {result && <Alert tone={result.tone}>{result.message}</Alert>}
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters, with a letter and a number."
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <div className="flex justify-end">
            <Button type="submit" loading={isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} src={user.avatarUrl} className="size-14 text-lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{user.name}</h1>
          <p className="text-sm text-slate-500">
            {ROLE_LABEL[user.role]} · {user.email}
          </p>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <ProfileForm />
        <PasswordForm />
      </div>
    </div>
  );
}
