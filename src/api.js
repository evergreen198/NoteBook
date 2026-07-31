/** 统一的 API 请求封装 */

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok) {
    const err = new Error(data?.error || `请求失败 (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/api/auth/me'),
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),

  listNotes: () => request('/api/notes'),
  createNote: (payload) => request('/api/notes', { method: 'POST', body: payload }),
  updateNote: (id, payload) =>
    request(`/api/notes/${id}`, { method: 'PUT', body: payload }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: 'DELETE' }),
};
