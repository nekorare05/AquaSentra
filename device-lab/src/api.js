export async function apiGet(path, credentials) {
  const headers = { 'accept': 'application/json' };
  if (credentials?.id && credentials?.token) {
    headers['x-user-id'] = credentials.id;
    headers['x-user-token'] = credentials.token;
  }
  const response = await fetch(`/api/v1/${path}`, { headers, cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Unauthorized. Check user ID and token.' : data.error || `API HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function apiPost(path, credentials, body) {
  const headers = {
    'content-type': 'application/json',
    'accept': 'application/json'
  };
  if (credentials?.id && credentials?.token) {
    headers['x-user-id'] = credentials.id;
    headers['x-user-token'] = credentials.token;
  }
  const res = await fetch(`/api/v1/${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
