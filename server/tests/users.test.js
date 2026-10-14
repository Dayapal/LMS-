import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/index.js';
import { api, createUser, loginAs, ORIGIN, PASSWORD, refreshCookie } from './helpers.js';

let app;
let user;
let token;

beforeEach(async () => {
  app = createApp();
  user = await createUser();
  ({ token } = await loginAs(app, user));
});

const patchMe = (body, accessToken = token) =>
  api(app).patch('/api/v1/users/me').set('Authorization', `Bearer ${accessToken}`).send(body);

const changePassword = (body, accessToken = token) =>
  api(app)
    .patch('/api/v1/users/me/password')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);

describe('PATCH /users/me', () => {
  it('requires authentication', async () => {
    const res = await api(app).patch('/api/v1/users/me').send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('updates name, bio and avatar', async () => {
    const res = await patchMe({
      name: 'Ravi Kumar',
      bio: 'Learning MERN',
      avatarUrl: 'https://example.com/me.png',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      name: 'Ravi Kumar',
      bio: 'Learning MERN',
      avatarUrl: 'https://example.com/me.png',
    });
  });

  it('ignores role, email and isActive in the body', async () => {
    const res = await patchMe({
      name: 'Still Student',
      role: 'admin',
      email: 'hijack@example.com',
      isActive: false,
    });
    expect(res.status).toBe(200);
    const stored = await User.findById(user.id);
    expect(stored.role).toBe('student');
    expect(stored.email).toBe(user.email);
    expect(stored.isActive).toBe(true);
  });

  it('rejects non-https avatar URLs and empty updates', async () => {
    expect((await patchMe({ avatarUrl: 'javascript:alert(1)' })).status).toBe(400);
    expect((await patchMe({ avatarUrl: 'http://example.com/a.png' })).status).toBe(400);
    expect((await patchMe({})).status).toBe(400);
  });

  it('clears the avatar with an empty string', async () => {
    await patchMe({ avatarUrl: 'https://example.com/me.png' });
    const res = await patchMe({ avatarUrl: '' });
    expect(res.body.data.user.avatarUrl).toBeNull();
  });
});

describe('PATCH /users/me/password', () => {
  it('rejects a wrong current password', async () => {
    const res = await changePassword({
      currentPassword: 'Wrong-pass1',
      newPassword: 'NewPassw0rd',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('currentPassword');
  });

  it('rejects a weak or unchanged new password', async () => {
    expect((await changePassword({ currentPassword: PASSWORD, newPassword: 'weak' })).status).toBe(
      400,
    );
    expect(
      (await changePassword({ currentPassword: PASSWORD, newPassword: PASSWORD })).status,
    ).toBe(400);
  });

  it('changes the password, signs out other devices and keeps this one signed in', async () => {
    const otherDevice = await loginAs(app, user);

    const res = await changePassword({ currentPassword: PASSWORD, newPassword: 'NewPassw0rd' });
    expect(res.status).toBe(200);
    const newToken = res.body.data.accessToken;
    const newCookie = refreshCookie(res);
    expect(newCookie).toBeDefined();

    // Old access tokens stop working immediately (tokenVersion bump).
    const oldAccess = await api(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(oldAccess.status).toBe(401);

    // Other device's refresh token is revoked.
    const otherRefresh = await api(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', otherDevice.cookie);
    expect(otherRefresh.status).toBe(401);

    // This device keeps working with the re-issued tokens.
    const me = await api(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${newToken}`);
    expect(me.status).toBe(200);
    const ownRefresh = await api(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', newCookie);
    expect(ownRefresh.status).toBe(200);

    // And the new password is the one that logs in.
    const login = await api(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'NewPassw0rd' });
    expect(login.status).toBe(200);
  });
});
