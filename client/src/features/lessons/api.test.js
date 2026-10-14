import { describe, it, expect, vi, afterEach } from 'vitest';
import { http } from '../../services/http.js';
import { filesApi } from './api.js';
import { getErrorMessage } from '../../utils/apiErrors.js';

afterEach(() => vi.restoreAllMocks());

describe('filesApi', () => {
  it('fetches files as blobs with the bearer client, never a public URL', async () => {
    const blob = new Blob(['%PDF']);
    const get = vi.spyOn(http, 'get').mockResolvedValue({ data: blob });

    expect(await filesApi.fetch('f1', { download: true })).toBe(blob);
    expect(get).toHaveBeenCalledWith('/files/f1', {
      responseType: 'blob',
      params: { download: 1 },
    });
  });

  it('turns blob error bodies back into API errors', async () => {
    const body = new Blob([
      JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } }),
    ]);
    vi.spyOn(http, 'get').mockRejectedValue(
      Object.assign(new Error('404'), { response: { status: 404, data: body } }),
    );

    const error = await filesApi.fetch('f1').catch((e) => e);
    expect(error.response.status).toBe(404);
    expect(getErrorMessage(error)).toBe('File not found');
  });

  it('uploads a material file as multipart form data with progress', async () => {
    const post = vi.spyOn(http, 'post').mockImplementation(async (_url, _body, config) => {
      config.onUploadProgress({ loaded: 50, total: 200 });
      return { data: { data: { id: 'file1' } } };
    });
    const onProgress = vi.fn();
    const file = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });

    expect(await filesApi.upload('c1', file, { onProgress })).toEqual({ id: 'file1' });
    const [url, form] = post.mock.calls[0];
    expect(url).toBe('/files');
    expect(form.get('purpose')).toBe('material');
    expect(form.get('courseId')).toBe('c1');
    expect(form.get('file').name).toBe('a.pdf');
    expect(onProgress).toHaveBeenCalledWith(25);
  });
});
