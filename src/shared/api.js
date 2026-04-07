const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('xrm_token');
  const headers = {
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res;
}

export async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (data?.accessToken) {
    localStorage.setItem('xrm_token', data.accessToken);
  }

  return data;
}

export async function register(email, password, name) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });

  if (data?.accessToken) {
    localStorage.setItem('xrm_token', data.accessToken);
  }

  return data;
}

export function logout() {
  localStorage.removeItem('xrm_token');
}

export async function getAccounts() {
  return apiFetch('/accounts');
}

export async function createAccount(payload) {
  return apiFetch('/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPropertyManagers() {
  return apiFetch('/property-managers');
}

export async function createPropertyManager(payload) {
  return apiFetch('/property-managers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProperties() {
  return apiFetch('/properties');
}

export async function createProperty(payload) {
  return apiFetch('/properties', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getDeals() {
  return apiFetch('/deals');
}

export async function createDeal(payload) {
  return apiFetch('/deals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDealStage(id, stage) {
  return apiFetch(`/deals/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  });
}

export async function getDeal(id) {
  return apiFetch(`/deals/${id}`);
}

export async function createBid(payload) {
  return apiFetch('/bids', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getBidPacket(id) {
  return apiFetch(`/bids/${id}/packet`);
}

export async function uploadBidPacket(id, file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetch(`/bids/${id}/packet/upload`, {
    method: 'POST',
    body: formData,
  });
}

export async function getLatestBidPacket(id) {
  return apiFetch(`/bids/${id}/packet/latest`);
}

export async function downloadLatestBidPacket(id) {
  const res = await apiFetch(`/bids/${id}/packet/latest/download`);
  return res.blob();
}

export async function searchAll(query) {
  return apiFetch(`/search?q=${encodeURIComponent(query)}`);
}
