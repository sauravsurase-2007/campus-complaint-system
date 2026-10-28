window.Api = (() => {
  async function request(method, path, body) {
    const token = await Auth.token();
    const res = await fetch(window.APP_CONFIG.apiUrl + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) Auth.logout();
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }
  return {
    list: (status) => request('GET', '/complaints' + (status ? `?status=${encodeURIComponent(status)}` : '')).then((d) => d.items),
    get: (id) => request('GET', `/complaints/${id}`),
    create: (c) => request('POST', '/complaints', c),
    update: (id, patch) => request('PUT', `/complaints/${id}`, patch),
  };
})();
