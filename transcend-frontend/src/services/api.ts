const API_BASE = 'https://transcend-law.com';

export const api = {
  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
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
  }
};
