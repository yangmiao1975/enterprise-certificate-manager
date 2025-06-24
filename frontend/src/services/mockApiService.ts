/// <reference types="vite/client" />
import { Certificate, Folder, User, Role, CertificateStatus } from '../../../types';

// Mock data
const mockCertificates: Certificate[] = [
  {
    id: '1',
    commonName: 'prod.example.com',
    issuer: 'C=US, O=Let\'s Encrypt, CN=R3',
    subject: 'CN=prod.example.com',
    validFrom: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
    validTo: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    algorithm: '1.2.840.113549.1.1.11',
    serialNumber: '0A:1B:2C:3D:4E:5F',
    status: CertificateStatus.VALID,
    folderId: 'prod-servers',
    uploadedBy: 'admin-user',
    uploadedAt: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
    isTemp: false,
  },
  {
    id: '2',
    commonName: 'staging.example.com',
    issuer: 'C=US, O=DigiCert Inc, CN=DigiCert SHA2 Secure Server CA',
    subject: 'CN=staging.example.com',
    validFrom: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    validTo: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
    algorithm: '1.2.840.10045.4.3.2',
    serialNumber: '1F:2E:3D:4C:5B:6A',
    status: CertificateStatus.VALID,
    folderId: 'internal-tools',
    uploadedBy: 'manager-user',
    uploadedAt: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000).toISOString(),
    isTemp: false,
  },
  {
    id: '3',
    commonName: 'dev.example.com',
    issuer: 'C=US, ST=New Jersey, L=Jersey City, O=The USERTRUST Network, CN=USERTrust RSA Certification Authority',
    subject: 'CN=dev.example.com',
    validFrom: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    validTo: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    algorithm: '1.2.840.113549.1.1.11',
    serialNumber: 'AB:CD:EF:01:23:45',
    status: CertificateStatus.EXPIRED,
    folderId: null,
    uploadedBy: 'viewer-user',
    uploadedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    isTemp: false,
  },
];

const mockFolders: Folder[] = [
  {
    id: 'all-certificates',
    name: 'All Certificates',
    description: 'System folder containing all certificates',
    type: 'system',
    permissions: ['read'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'temp-uploads',
    name: 'Temporary Uploads',
    description: 'Temporary storage for uploaded certificates pending review',
    type: 'system',
    permissions: ['read', 'write', 'delete'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'prod-servers',
    name: 'Production Servers',
    description: 'Certificates for production servers',
    type: 'custom',
    permissions: ['read', 'write'],
    createdBy: 'admin-user',
    createdAt: new Date().toISOString(),
    accessControl: {
      roles: ['admin', 'manager'],
      users: ['admin-user', 'manager-user'],
    },
  },
  {
    id: 'internal-tools',
    name: 'Internal Tools',
    description: 'Certificates for internal development tools',
    type: 'custom',
    permissions: ['read', 'write'],
    createdBy: 'admin-user',
    createdAt: new Date().toISOString(),
    accessControl: {
      roles: ['admin', 'manager', 'viewer'],
      users: ['admin-user', 'manager-user', 'viewer-user'],
    },
  },
];

const mockUsers: User[] = [
  {
    id: 'admin-user',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'manager-user',
    username: 'manager',
    email: 'manager@example.com',
    role: 'manager',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'viewer-user',
    username: 'viewer',
    email: 'viewer@example.com',
    role: 'viewer',
    active: true,
    createdAt: new Date().toISOString(),
  },
];

const mockRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    permissions: [
      'certificates:read',
      'certificates:write',
      'certificates:delete',
      'certificates:renew',
      'folders:read',
      'folders:write',
      'folders:delete',
      'system:settings',
      'notifications:manage',
    ],
  },
  {
    id: 'manager',
    name: 'Certificate Manager',
    description: 'Can manage certificates and folders',
    permissions: [
      'certificates:read',
      'certificates:write',
      'certificates:renew',
      'folders:read',
      'folders:write',
      'notifications:view',
    ],
  },
  {
    id: 'viewer',
    name: 'Certificate Viewer',
    description: 'Read-only access to certificates',
    permissions: ['certificates:read', 'folders:read'],
  },
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock API service
export class MockApiService {
  private certificates = [...mockCertificates];
  private folders = [...mockFolders];
  private users = [...mockUsers];
  private roles = [...mockRoles];

  // Authentication
  async login(username: string, password: string) {
    await delay(500);
    const user = this.users.find(u => u.username === username);
    if (user && password === 'admin123') {
      const role = this.roles.find(r => r.id === user.role);
      return {
        token: 'mock-jwt-token',
        user: {
          ...user,
          permissions: role?.permissions || [],
        },
      };
    }
    throw new Error('Invalid credentials');
  }

  async getCurrentUser() {
    await delay(200);
    const user = this.users[0]; // Return admin user
    const role = this.roles.find(r => r.id === user.role);
    return {
      ...user,
      permissions: role?.permissions || [],
    };
  }

  // Certificates
  async getCertificates(params?: { folderId?: string; status?: string; search?: string }) {
    await delay(300);
    let filtered = [...this.certificates];

    if (params?.folderId && params.folderId !== 'all-certificates') {
      filtered = filtered.filter(c => c.folderId === params.folderId);
    }

    if (params?.status) {
      filtered = filtered.filter(c => c.status === params.status);
    }

    if (params?.search) {
      const search = params.search.toLowerCase();
      filtered = filtered.filter(c => 
        c.commonName.toLowerCase().includes(search) ||
        c.issuer.toLowerCase().includes(search) ||
        c.subject.toLowerCase().includes(search)
      );
    }

    return filtered.map(cert => ({
      ...cert,
      folder_name: this.folders.find(f => f.id === cert.folderId)?.name,
      uploaded_by_username: this.users.find(u => u.id === cert.uploadedBy)?.username,
    }));
  }

  async getCertificate(id: string) {
    await delay(200);
    const cert = this.certificates.find(c => c.id === id);
    if (!cert) throw new Error('Certificate not found');
    
    return {
      ...cert,
      folder_name: this.folders.find(f => f.id === cert.folderId)?.name,
      uploaded_by_username: this.users.find(u => u.id === cert.uploadedBy)?.username,
    };
  }

  async uploadCertificate(file: File, folderId?: string) {
    await delay(1000);
    const newCert: Certificate = {
      id: `cert-${Date.now()}`,
      commonName: file.name.replace('.pem', '').replace('.crt', ''),
      issuer: 'Mock CA',
      subject: `CN=${file.name.replace('.pem', '').replace('.crt', '')}`,
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      algorithm: '1.2.840.113549.1.1.11',
      serialNumber: 'MOCK:SERIAL:NUMBER',
      status: CertificateStatus.VALID,
      folderId: folderId || null,
      uploadedBy: 'admin-user',
      uploadedAt: new Date().toISOString(),
      isTemp: false,
    };

    this.certificates.push(newCert);
    return {
      ...newCert,
      folder_name: this.folders.find(f => f.id === newCert.folderId)?.name,
      uploaded_by_username: this.users.find(u => u.id === newCert.uploadedBy)?.username,
    };
  }

  async deleteCertificate(id: string) {
    await delay(500);
    const index = this.certificates.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Certificate not found');
    this.certificates.splice(index, 1);
    return { message: 'Certificate deleted successfully' };
  }

  async renewCertificate(id: string) {
    await delay(1000);
    const cert = this.certificates.find(c => c.id === id);
    if (!cert) throw new Error('Certificate not found');
    
    cert.validFrom = new Date().toISOString();
    cert.validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    cert.status = CertificateStatus.VALID;
    
    return { message: 'Certificate renewal initiated' };
  }

  async downloadCertificate(id: string) {
    await delay(300);
    const cert = this.certificates.find(c => c.id === id);
    if (!cert) throw new Error('Certificate not found');
    
    return `-----BEGIN CERTIFICATE-----\nMOCK_CERTIFICATE_DATA_FOR_${cert.commonName}\n-----END CERTIFICATE-----`;
  }

  // Folders
  async getFolders(params?: { type?: string }) {
    await delay(200);
    let filtered = [...this.folders];

    if (params?.type) {
      filtered = filtered.filter(f => f.type === params.type);
    }

    return filtered.map(folder => ({
      ...folder,
      certificate_count: this.certificates.filter(c => c.folderId === folder.id).length,
      created_by_username: this.users.find(u => u.id === folder.createdBy)?.username,
    }));
  }

  async createFolder(data: { name: string; description?: string; permissions?: string[]; accessControl?: any }) {
    await delay(500);
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name: data.name,
      description: data.description,
      type: 'custom',
      permissions: data.permissions || ['read'],
      createdBy: 'admin-user',
      createdAt: new Date().toISOString(),
      accessControl: data.accessControl,
    };

    this.folders.push(newFolder);
    return {
      ...newFolder,
      certificate_count: 0,
      created_by_username: this.users.find(u => u.id === newFolder.createdBy)?.username,
    };
  }

  async updateFolder(id: string, data: { name: string; description?: string; permissions?: string[]; accessControl?: any }) {
    await delay(300);
    const folder = this.folders.find(f => f.id === id);
    if (!folder) throw new Error('Folder not found');

    Object.assign(folder, data);
    return {
      ...folder,
      certificate_count: this.certificates.filter(c => c.folderId === folder.id).length,
      created_by_username: this.users.find(u => u.id === folder.createdBy)?.username,
    };
  }

  async deleteFolder(id: string) {
    await delay(300);
    const index = this.folders.findIndex(f => f.id === id);
    if (index === -1) throw new Error('Folder not found');
    
    const folder = this.folders[index];
    if (folder.type === 'system') {
      throw new Error('Cannot delete system folders');
    }

    const certCount = this.certificates.filter(c => c.folderId === id).length;
    if (certCount > 0) {
      throw new Error(`Cannot delete folder with certificates (${certCount} certificates)`);
    }

    this.folders.splice(index, 1);
    return { message: 'Folder deleted successfully' };
  }

  // Users
  async getUsers() {
    await delay(300);
    return this.users.map(user => ({
      ...user,
      role_name: this.roles.find(r => r.id === user.role)?.name,
      role_description: this.roles.find(r => r.id === user.role)?.description,
    }));
  }

  async getRoles() {
    await delay(200);
    return this.roles;
  }

  // Metadata
  async getMetadata() {
    await delay(200);
    return {
      tempFolder: {
        enabled: true,
        path: './temp_certs',
        maxSize: '100MB',
        cleanupInterval: 3600000,
        retentionDays: 7,
      },
      system: {
        name: 'Enterprise Certificate Manager',
        description: 'A Venafi-like application to manage enterprise certificates',
      },
      stats: {
        total_certificates: this.certificates.length,
        expired_certificates: this.certificates.filter(c => c.status === CertificateStatus.EXPIRED).length,
        expiring_soon_certificates: this.certificates.filter(c => c.status === CertificateStatus.EXPIRING_SOON).length,
        total_folders: this.folders.length,
        total_users: this.users.length,
      },
    };
  }

  async getStats() {
    await delay(300);
    return {
      total_certificates: this.certificates.length,
      valid_certificates: this.certificates.filter(c => c.status === CertificateStatus.VALID).length,
      expired_certificates: this.certificates.filter(c => c.status === CertificateStatus.EXPIRED).length,
      expiring_soon_certificates: this.certificates.filter(c => c.status === CertificateStatus.EXPIRING_SOON).length,
      custom_folders: this.folders.filter(f => f.type === 'custom').length,
      system_folders: this.folders.filter(f => f.type === 'system').length,
      active_users: this.users.filter(u => u.active).length,
      inactive_users: this.users.filter(u => !u.active).length,
      statusBreakdown: [
        { status: CertificateStatus.VALID, count: this.certificates.filter(c => c.status === CertificateStatus.VALID).length },
        { status: CertificateStatus.EXPIRED, count: this.certificates.filter(c => c.status === CertificateStatus.EXPIRED).length },
        { status: CertificateStatus.EXPIRING_SOON, count: this.certificates.filter(c => c.status === CertificateStatus.EXPIRING_SOON).length },
      ],
    };
  }
}

export const mockApiService = new MockApiService(); 