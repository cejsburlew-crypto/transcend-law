export interface User {
  email: string;
  name?: string;
  phone?: string;
  role: string;
  authorized_at: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
  message: string;
}

export interface HealthCheck {
  status: string;
  domain: string;
  mode: string;
  user: string;
  timestamp: string;
}

export interface Professional {
  id: number;
  name: string;
  email: string;
  state: string;
  practice_areas: string[];
  experience_years: number;
  verification_status: string;
  rating: number;
}

export interface Referral {
  id: number;
  case_id: string;
  case_title: string;
  description: string;
  state: string;
  practice_area: string;
  status: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  amount: number;
  commission: number;
  status: string;
  date: string;
}
