import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
// import { mockApiService } from './mockApiService';
import type { Certificate, Folder, User, Role } from '../types';

// Vite env types for import.meta.env
/// <reference types="vite/client" />

// Check if we're in preview mode (no backend)
const isPreviewMode = import.meta.env.VITE_PREVIEW_MODE === 'true' || !import.meta.env.VITE_API_URL;

// Create axios instance for real API
const createApiClient = (): AxiosInstance => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  
  const client = axios.create({
    baseURL: `${baseURL}/api`,
    timeout: 120000  // Increased to 2 minutes for certificate uploads
  });

  // Add auth token to requests
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Handle auth errors
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// Unified API service interface
export interface ApiService {
  // Authentication
  login(username: string, password: string): Promise<{ token: string; user: any }>;
  getCurrentUser(): Promise<any>;
  
  // Certificates
  getCertificates(params?: { folderId?: string; status?: string; search?: string }): Promise<Certificate[]>;
  getCertificate(id: string): Promise<Certificate>;
  uploadCertificate(file: File, folderId?: string): Promise<Certificate>;
  deleteCertificate(id: string): Promise<{ message: string }>;
  renewCertificate(id: string): Promise<{ message: string }>;
  downloadCertificate(id: string): Promise<string>;
  assignCertificateToFolder(certificateId: string, folderId: string | null): Promise<Certificate>;
  
  // Folders
  getFolders(params?: { type?: string }): Promise<Folder[]>;
  createFolder(data: any): Promise<Folder>;
  updateFolder(id: string, data: any): Promise<Folder>;
  deleteFolder(id: string): Promise<{ message: string }>;
  moveFolder(folderId: string, parentId: string | null): Promise<Folder>;
  
  // Users
  getUsers(): Promise<User[]>;
  getRoles(): Promise<Role[]>;
  
  // Metadata
  getMetadata(): Promise<any>;
  getStats(): Promise<any>;
}

// Real API service implementation
class RealApiService implements ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = createApiClient();
  }

  async login(username: string, password: string) {
    const response = await this.client.post('/auth/login', { username, password });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async getCertificates(params?: { folderId?: string; status?: string; search?: string }) {
    const response = await this.client.get('/certificates', { params });
    return response.data;
  }

  async getCertificate(id: string) {
    const response = await this.client.get(`/certificates/${id}`);
    return response.data;
  }

  async uploadCertificate(file: File, folderId?: string) {
    const formData = new FormData();
    formData.append('certificate', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const response = await this.client.post('/certificates', formData);
    return response.data;
  }

  async deleteCertificate(id: string) {
    const response = await this.client.delete(`/certificates/${id}`);
    return response.data;
  }

  async renewCertificate(id: string) {
    const response = await this.client.post(`/certificates/${id}/renew`);
    return response.data;
  }

  async downloadCertificate(id: string) {
    const response = await this.client.get(`/certificates/${id}/download`, {
      responseType: 'text',
    });
    return response.data;
  }

  async assignCertificateToFolder(certificateId: string, folderId: string | null) {
    const response = await this.client.patch(`/certificates/${certificateId}/folder`, { folderId });
    return response.data;
  }

  async getFolders(params?: { type?: string }) {
    const response = await this.client.get('/folders', { params });
    return response.data;
  }

  async createFolder(data: any) {
    const response = await this.client.post('/folders', data);
    return response.data;
  }

  async updateFolder(id: string, data: any) {
    const response = await this.client.put(`/folders/${id}`, data);
    return response.data;
  }

  async deleteFolder(id: string) {
    const response = await this.client.delete(`/folders/${id}`);
    return response.data;
  }

  async moveFolder(folderId: string, parentId: string | null) {
    const response = await this.client.patch(`/folders/${folderId}/move`, { parentId });
    return response.data;
  }

  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async getRoles() {
    const response = await this.client.get('/users/roles/list');
    return response.data;
  }

  async getMetadata() {
    const response = await this.client.get('/metadata');
    return response.data;
  }

  async getStats() {
    const response = await this.client.get('/metadata/stats');
    return response.data;
  }
}

// Export the real API service only
export const apiService: ApiService = new RealApiService();

// Export preview mode status
export const isPreviewModeEnabled = isPreviewMode; 