const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Common fetch helper for backend API calls
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    throw new Error(errorData.error || errorData.message || `API error (${response.status})`);
  }

  return response.json();
}

/**
 * Health check
 */
export function getHealth() {
  return apiFetch('/api/health');
}

/**
 * Fetch complete Kanban board for a project with optional priority filter
 * @param {number|string} projectId
 * @param {string} [priority] - 'low' | 'medium' | 'high'
 */
export function getBoard(projectId, priority = '') {
  const query = priority && priority !== 'all' ? `?priority=${encodeURIComponent(priority)}` : '';
  return apiFetch(`/api/projects/${projectId}/board${query}`);
}

/**
 * Create a new task
 * @param {number|string} projectId
 * @param {object} taskData
 */
export function createTask(projectId, taskData) {
  return apiFetch(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(taskData),
  });
}

/**
 * Update a task (e.g. status during drag-and-drop)
 * @param {number|string} taskId
 * @param {object} updates
 */
export function updateTask(taskId, updates) {
  return apiFetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a task
 * @param {number|string} taskId
 */
export function deleteTask(taskId) {
  return apiFetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

/**
 * List projects
 */
export function getProjects() {
  return apiFetch('/api/projects');
}

/**
 * Add a user to a project
 * @param {number|string} projectId
 * @param {object} payload - { userId, role }
 */
export function addProjectUser(projectId, payload) {
  return apiFetch(`/api/projects/${projectId}/users`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * List all users in system
 */
export function getAllUsers() {
  return apiFetch('/api/users');
}

