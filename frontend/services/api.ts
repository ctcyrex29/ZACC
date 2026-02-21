import { User, UserRole } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private get token(): string | null {
    return localStorage.getItem('nexus_token');
  }

  private set token(value: string | null) {
    if (value) {
      localStorage.setItem('nexus_token', value);
    } else {
      localStorage.removeItem('nexus_token');
    }
  }

  private async request(endpoint: string, method: string = 'GET', body: any = null) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      method,
      headers,
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.token = null;
          localStorage.removeItem('nexus_user');
          window.location.reload();
        }
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
      }

      return await response.json();
    } catch (error: any) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async login(email: string, password: string) {
    const data = await this.request('/auth/login', 'POST', { email, password });
    this.token = data.token;
    
    // Map backend user to frontend User interface
    const user: User = {
      id: data.user.id.toString(),
      nexusKey: data.user.email,
      role: data.user.role as UserRole,
      isStealth: false
    };
    
    return { user, token: data.token };
  }

  async register(name: string, email: string, password: string, password_confirmation: string) {
    const data = await this.request('/auth/register', 'POST', { 
      name, 
      email, 
      password, 
      password_confirmation 
    });
    this.token = data.token;
    
    const user: User = {
      id: data.user.id.toString(),
      nexusKey: data.user.email,
      role: data.user.role as UserRole,
      isStealth: false
    };
    
    return { user, token: data.token };
  }

  async getUser(): Promise<User> {
    const data = await this.request('/auth/user');
    return {
      id: data.id.toString(),
      nexusKey: data.email,
      role: data.role as UserRole,
      isStealth: false
    };
  }

  async getReports() {
    return this.request('/reports');
  }

  async createReport(data: any) {
    return this.request('/reports', 'POST', data);
  }

  async getCases() {
    return this.request('/cases');
  }

  async getUsers() {
    return this.request('/users');
  }

  async createUser(data: any) {
    return this.request('/users', 'POST', data);
  }

  async updateUser(id: string, data: any) {
    return this.request(`/users/${id}`, 'PUT', data);
  }

  async deleteUser(id: string) {
    return this.request(`/users/${id}`, 'DELETE');
  }

  async disputeReport(caseId: string, reason: string) {
    return this.request(`/reports/${caseId}/dispute`, 'POST', { reason });
  }

  async verifyReport(reportId: string) {
    return this.request(`/reports/${reportId}/verify`, 'GET');
  }

  async logout() {
    await this.request('/auth/logout', 'POST');
    this.token = null;
  }

  async get(endpoint: string) {
    return this.request(endpoint);
  }

  async post(endpoint: string, data: any) {
    return this.request(endpoint, 'POST', data);
  }

  async put(endpoint: string, data: any) {
    return this.request(endpoint, 'PUT', data);
  }

  async delete(endpoint: string) {
    return this.request(endpoint, 'DELETE');
  }
}

export const apiClient = new ApiClient();
