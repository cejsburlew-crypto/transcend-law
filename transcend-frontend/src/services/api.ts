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
  },

  // Appointments API
  async getAppointmentsByCase(caseId: string, token: string, status?: string) {
    const url = new URL(`${API_BASE}/api/v1/appointments/case/${caseId}`);
    if (status) url.searchParams.append('status', status);
    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch appointments');
    return response.json().then(res => res.data || []);
  },

  async createAppointment(data: any, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create appointment');
    return response.json().then(res => res.data);
  },

  async updateAppointment(appointmentId: string, data: any, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/appointments/${appointmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update appointment');
    return response.json().then(res => res.data);
  },

  async deleteAppointment(appointmentId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/appointments/${appointmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete appointment');
  },

  // Workflow API
  async getWorkflowStates(token: string) {
    const response = await fetch(`${API_BASE}/api/v1/workflow/states`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch workflow states');
    return response.json().then(res => res.data || []);
  },

  async getCaseStatus(caseId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/workflow/cases/${caseId}/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch case status');
    return response.json().then(res => res.data);
  },

  async updateCaseStatus(caseId: string, status: string, reason?: string, token?: string) {
    const response = await fetch(`${API_BASE}/api/v1/workflow/cases/${caseId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status, reason })
    });
    if (!response.ok) throw new Error('Failed to update case status');
    return response.json().then(res => res.data);
  },

  async getCaseStatusHistory(caseId: string, token: string) {
    const response = await fetch(`${API_BASE}/api/v1/workflow/cases/${caseId}/history`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch status history');
    return response.json().then(res => res.data || []);
  }
};
