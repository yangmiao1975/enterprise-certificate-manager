export enum CertificateStatus {
  VALID = 'Valid',
  EXPIRING_SOON = 'Expiring Soon',
  EXPIRED = 'Expired',
  REVOKED = 'Revoked', // Added for completeness, though not heavily used in initial simulation
}

export interface Certificate {
  id: string;
  commonName: string;
  issuer: string;
  subject: string;
  validFrom: string; // ISO Date string
  validTo: string;   // ISO Date string
  algorithm: string;
  serialNumber: string;
  status: CertificateStatus; 
  pem?: string; // For download simulation
  folderId?: string | null; // New: ID of the folder this certificate belongs to
  uploadedBy?: string; // User who uploaded the certificate
  uploadedAt?: string; // ISO Date string - Certificate creation/upload time
  updatedAt?: string; // ISO Date string - Last renewal/update time
  renewalCount?: number; // Number of times certificate has been renewed
  isTemp?: boolean; // Indicates if certificate is in temp folder
}

export interface Folder {
  id: string;
  name: string;
  description?: string;
  type: 'system' | 'custom';
  permissions: string[];
  createdAt: string; // ISO Date string
  createdBy?: string; // User who created the folder
  accessControl?: {
    roles: string[];
    users: string[];
  };
  parentId?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar?: string; // Optional avatar URL from Google OAuth
  active: boolean;
  createdAt: string; // ISO Date string
}

export interface RBACConfig {
  enabled: boolean;
  roles: Role[];
  users: User[];
}

export interface TempFolderConfig {
  enabled: boolean;
  path: string;
  maxSize: string;
  cleanupInterval: number; // milliseconds
  retentionDays: number;
}

export interface SystemMetadata {
  tempFolder: TempFolderConfig;
  folders: {
    defaultFolder: string;
    systemFolders: Folder[];
  };
  rbac: RBACConfig;
  customFolders: Folder[];
}

export interface MetadataConfig {
  name: string;
  description: string;
  requestFramePermissions: string[];
  prompt: string;
  system: SystemMetadata;
}

export interface NotificationMessage {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: number;
}

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface NotificationSettings {
  recipientEmail: string;
  thresholds: number[]; // e.g., [5, 10, 30]
  notificationsEnabled: boolean;
}

export interface AuthContext {
  currentUser: User | null;
  userRole: Role | null;
  hasPermission: (permission: string) => boolean;
  hasFolderAccess: (folderId: string, permission: string) => boolean;
}
