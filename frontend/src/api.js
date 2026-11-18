export async function apiGet(path, credentials) {
  const response = await fetch(`/api/v1/${path}`, {
    headers: {
      'x-user-id': credentials.id,
      'x-user-token': credentials.token,
      'accept': 'application/json'
    },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Invalid user ID or access token.' : data.error || `API HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}
