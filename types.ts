
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
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string; // ISO Date string
  // parentId?: string | null; // For future nesting, not used in V1
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
