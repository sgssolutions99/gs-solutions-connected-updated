// SGS SOLUTION — Render backend connection
const API_BASE = 'https://gs-solutions-connected-updated.onrender.com';

async function api(url, options = {}) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  const token = localStorage.getItem('sgs_token');
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }

  const requestUrl = /^https?:\/\//i.test(url)
    ? url
    : API_BASE + (url.startsWith('/') ? url : '/' + url);

  let response;

  try {
    response = await fetch(requestUrl, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error(
      'Backend connection failed. Check Render status and CORS settings.'
    );
  }

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const responseText = await response.text();

    if (/<!doctype html|<html/i.test(responseText)) {
      throw new Error(
        `Backend returned HTML instead of JSON (HTTP ${response.status}). Check the API route.`
      );
    }

    throw new Error(
      `Unexpected backend response (HTTP ${response.status}).`
    );
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid JSON received from the backend.');
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('sgs_token');
    }

    throw new Error(
      data.error || data.message || `Request failed: ${response.status}`
    );
  }

  return data;
}