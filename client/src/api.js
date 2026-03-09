// ─── API Client ─────────────────────────────────────────────────────
// Handles all communication with the FabTrack backend

const API_BASE = "/api";

// Get stored auth token
function getToken() {
  return localStorage.getItem("fabtrack_token");
}

// Store auth data
export function setAuth(token, user) {
  localStorage.setItem("fabtrack_token", token);
  localStorage.setItem("fabtrack_user", JSON.stringify(user));
}

// Get stored user
export function getStoredUser() {
  try {
    const user = localStorage.getItem("fabtrack_user");
    const token = localStorage.getItem("fabtrack_token");
    if (user && token) return JSON.parse(user);
  } catch {}
  return null;
}

// Clear auth
export function clearAuth() {
  localStorage.removeItem("fabtrack_token");
  localStorage.removeItem("fabtrack_user");
}

// Base fetch wrapper with auth
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    ...options.headers,
  };

  // Don't set Content-Type for FormData (let browser set boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "Request failed");
  }

  return res.json();
}

// ── Auth ──
export async function fetchUsers() {
  return apiFetch("/auth/users");
}

export async function login(userId, pin) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId, pin }),
  });
  setAuth(data.token, data.user);
  return data;
}

export async function changePin(currentPin, newPin) {
  return apiFetch("/auth/change-pin", {
    method: "PUT",
    body: JSON.stringify({ currentPin, newPin }),
  });
}

// ── Projects ──
export async function fetchProjects(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== "All") {
      query.set(k, v);
    }
  }
  return apiFetch(`/projects?${query}`);
}

export async function fetchProjectStats() {
  return apiFetch("/projects/stats");
}

export async function fetchProject(id) {
  return apiFetch(`/projects/${id}`);
}

export async function createProject(data) {
  return apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProject(id, data) {
  return apiFetch(`/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function updateProjectStatus(id, status, note, checklist) {
  return apiFetch(`/projects/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, note, checklist }),
  });
}

export async function addNote(projectId, content) {
  return apiFetch(`/projects/${projectId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function deleteProject(id) {
  return apiFetch(`/projects/${id}`, { method: "DELETE" });
}

// ── Photos ──
export async function uploadPhotos(projectId, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("photos", file);
  }
  return apiFetch(`/photos/${projectId}`, {
    method: "POST",
    body: formData,
  });
}

export async function deletePhoto(photoId) {
  return apiFetch(`/photos/${photoId}`, { method: "DELETE" });
}
