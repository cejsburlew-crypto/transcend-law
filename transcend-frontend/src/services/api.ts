const API_BASE = 'http://localhost:3000';

export const api = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  },

  async logout() {
    return Promise.resolve();
  },

  async getHealth(token: string) {
    const response = await fetch(`${API_BASE}/api/health`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch health');
    return response.json();
  },

  async getProfessionals(token: string) {
    const response = await fetch(`${API_BASE}/api/professionals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch professionals');
    return response.json();
  },

  async getReferrals(token: string) {
    const response = await fetch(`${API_BASE}/api/referrals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch referrals');
    return response.json();
  },

  async getTransactions(token: string) {
    const response = await fetch(`${API_BASE}/api/payments`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch transactions');
    return response.json();
  },

  // Tasks API
  async getTasksByCase(caseId: string, token: string, status?: string) {
    const url = new URL(`${API_BASE}/api/v1/tasks/case/${caseId}`);
    if (status) url.searchParams.append('status', status);
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch tasks');
    return response.json().then(res => res.data || []);
  },

  async createTask(data: any, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create task');
    return response.json().then(res => res.data);
  },

  async updateTask(taskId: string, data: any, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update task');
    return response.json().then(res => res.data);
  },

  async completeTask(taskId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to complete task');
    return response.json().then(res => res.data);
  },

  async deleteTask(taskId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete task');
  },

  // Notes API (using communications endpoints)
  async getNotesByCase(caseId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/communications/case/${caseId}?type=internal_note`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch notes');
    return response.json().then(res => res.data || []);
  },

  async createNote(caseId: string, body: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/communications/case/${caseId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ note: body })
    });
    if (!response.ok) throw new Error('Failed to create note');
    return response.json().then(res => res.data);
  },

  async updateNote(noteId: string, body: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/communications/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ body })
    });
    if (!response.ok) throw new Error('Failed to update note');
    return response.json().then(res => res.data);
  },

  async deleteNote(noteId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/communications/${noteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete note');
  }
};
