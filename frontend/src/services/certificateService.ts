/// <reference types="vite/client" />
import { Certificate, CertificateStatus, Folder } from '../types';
import { EXPIRY_SOON_DAYS } from '../constants';
import { analyzeCertificateWithGemini, GeminiCertificateAnalysis } from './geminiService';
import { 
  getAllFolders, 
  getTempFolderId, 
  isTempFolder,
  getAccessibleFolders,
  getSystemFolders,
  getCustomFolders
} from './metadataService';
import { 
  getCurrentUser, 
  canUploadToFolder, 
  canDeleteCertificate, 
  canRenewCertificate,
  canManageFolders,
  canDeleteFolders
} from './authService';

const today = new Date();
const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getStatus = (validTo: string | Date): CertificateStatus => {
  const expiryDate = new Date(validTo);
  if (expiryDate < new Date()) {
    return CertificateStatus.EXPIRED;
  }
  const soonDate = addDays(new Date(), EXPIRY_SOON_DAYS);
  if (expiryDate < soonDate) {
    return CertificateStatus.EXPIRING_SOON;
  }
  return CertificateStatus.VALID;
};

let mockCertificates: Certificate[] = [
  {
    id: '1',
    commonName: 'prod.example.com',
    issuer: 'C=US, O=Let\'s Encrypt, CN=R3', 
    subject: 'CN=prod.example.com', 
    validFrom: addDays(today, -80).toISOString(),
    validTo: addDays(today, 15).toISOString(),
    algorithm: '1.2.840.113549.1.1.11', 
    serialNumber: '0A:1B:2C:3D:4E:5F',
    pem: `-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIUeN... (mock data for prod.example.com)\n-----END CERTIFICATE-----`,
    status: CertificateStatus.VALID,
    folderId: 'prod-servers',
    uploadedBy: 'admin-user',
    uploadedAt: addDays(today, -80).toISOString(),
    isTemp: false,
  },
  {
    id: '2',
    commonName: 'staging.example.com',
    issuer: 'C=US, O=DigiCert Inc, CN=DigiCert SHA2 Secure Server CA', 
    subject: 'CN=staging.example.com',
    validFrom: addDays(today, -150).toISOString(),
    validTo: addDays(today, 75).toISOString(),
    algorithm: '1.2.840.10045.4.3.2', 
    serialNumber: '1F:2E:3D:4C:5B:6A',
    pem: `-----BEGIN CERTIFICATE-----\nMIIDdDCCAlmgAwIBAgIUxM... (mock data for staging.example.com)\n-----END CERTIFICATE-----`,
    status: CertificateStatus.VALID,
    folderId: 'internal-tools',
    uploadedBy: 'manager-user',
    uploadedAt: addDays(today, -150).toISOString(),
    isTemp: false,
  },
  {
    id: '3',
    commonName: 'dev.example.com',
    issuer: 'C=US, ST=New Jersey, L=Jersey City, O=The USERTRUST Network, CN=USERTrust RSA Certification Authority', 
    subject: 'CN=dev.example.com', 
    validFrom: addDays(today, -400).toISOString(),
    validTo: addDays(today, -10).toISOString(),
    algorithm: '1.2.840.113549.1.1.11',
    serialNumber: 'AB:CD:EF:01:23:45',
    pem: `-----BEGIN CERTIFICATE-----\nMIIDfTCCAlygAwIBAgIUbB... (mock data for dev.example.com)\n-----END CERTIFICATE-----`,
    status: CertificateStatus.VALID,
    folderId: null,
    uploadedBy: 'viewer-user',
    uploadedAt: addDays(today, -400).toISOString(),
    isTemp: false,
  },
];

mockCertificates.forEach(cert => {
  cert.status = getStatus(cert.validTo);
});

export const getCertificates = async (): Promise<Certificate[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const currentUser = getCurrentUser();
  
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Get accessible folders for the current user
  const accessibleFolders = getAccessibleFolders(currentUser);
  const accessibleFolderIds = accessibleFolders.map((f: Folder) => f.id);

  // Filter certificates based on user's folder access
  const accessibleCertificates = mockCertificates.filter(cert => {
    // If certificate has no folder, check if user has access to "all-certificates"
    if (!cert.folderId) {
      return accessibleFolderIds.includes('all-certificates');
    }
    return accessibleFolderIds.includes(cert.folderId);
  });

  return accessibleCertificates.map(cert => ({ ...cert, status: getStatus(cert.validTo) }));
};

export const getCertificatesByFolder = async (folderId: string): Promise<Certificate[]> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Check if user has access to this folder
  const accessibleFolders = getAccessibleFolders(currentUser);
  const hasAccess = accessibleFolders.some((f: Folder) => f.id === folderId);
  
  if (!hasAccess) {
    throw new Error('Access denied to this folder');
  }

  const certificates = await getCertificates();
  
  if (folderId === 'all-certificates') {
    return certificates;
  }
  
  return certificates.filter(cert => cert.folderId === folderId);
};

export const getTempCertificates = async (): Promise<Certificate[]> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Check if user has access to temp folder
  if (!canUploadToFolder(getTempFolderId())) {
    throw new Error('Access denied to temp folder');
  }

  const tempCertificates = mockCertificates.filter(cert => cert.isTemp === true);
  return tempCertificates.map(cert => ({ ...cert, status: getStatus(cert.validTo) }));
};

export const renewCertificate = async (id: string): Promise<Certificate | null> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canRenewCertificate()) {
    throw new Error('Permission denied: Cannot renew certificates');
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  const certIndex = mockCertificates.findIndex(c => c.id === id);
  if (certIndex > -1) {
    const newValidTo = addDays(new Date(), 90).toISOString();
    mockCertificates[certIndex] = {
      ...mockCertificates[certIndex],
      validFrom: new Date().toISOString(),
      validTo: newValidTo,
      status: getStatus(newValidTo),
      pem: `-----BEGIN CERTIFICATE-----\nRENEWED_MOCK_DATA_FOR_${mockCertificates[certIndex].commonName}_${new Date().getTime()}\n-----END CERTIFICATE-----`
    };
    return mockCertificates[certIndex];
  }
  return null;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const addCertificate = async (
  fileContentInput: ArrayBuffer | string, 
  fileName?: string,
  folderId?: string | null
): Promise<Certificate> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  // Simulate certificate parsing and creation
  const newCert: Certificate = {
    id: (mockCertificates.length + 1).toString(),
    commonName: fileName || 'Uploaded Certificate',
    issuer: 'Mock Issuer',
    subject: 'Mock Subject',
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    algorithm: '1.2.840.113549.1.1.11',
    serialNumber: Math.random().toString(36).substring(2, 10).toUpperCase(),
    pem: typeof fileContentInput === 'string' ? fileContentInput : arrayBufferToBase64(fileContentInput),
    status: CertificateStatus.VALID,
    folderId: folderId || null,
    uploadedBy: currentUser.id,
    uploadedAt: new Date().toISOString(),
    isTemp: false,
  };
  mockCertificates.push(newCert);
  return newCert;
};

export const assignCertificateToFolder = async (certificateId: string, folderId: string | null): Promise<Certificate | null> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canManageFolders()) {
    throw new Error('Permission denied: Cannot assign certificates to folders');
  }

  await new Promise(resolve => setTimeout(resolve, 300));
  
  const certIndex = mockCertificates.findIndex(c => c.id === certificateId);
  if (certIndex > -1) {
    // Check if user has access to the target folder
    if (folderId && !canUploadToFolder(folderId)) {
      throw new Error('Permission denied: Cannot assign to this folder');
    }
    
    mockCertificates[certIndex].folderId = folderId;
    mockCertificates[certIndex].isTemp = folderId ? isTempFolder(folderId) : false;
    return mockCertificates[certIndex];
  }
  return null;
};

export const createFolder = async (name: string): Promise<Folder> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canManageFolders()) {
    throw new Error('Permission denied: Cannot create folders');
  }

  await new Promise(resolve => setTimeout(resolve, 300));
  
  const allFolders = getAllFolders();
  if (allFolders.some(f => f.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`Folder with name "${name}" already exists.`);
  }

  const newFolder: Folder = {
    id: `folder-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    description: `Custom folder created by ${currentUser.username}`,
    type: 'custom',
    permissions: ['read', 'write'],
    createdAt: new Date().toISOString(),
    createdBy: currentUser.id,
    accessControl: {
      roles: [currentUser.role],
      users: [currentUser.id]
    }
  };

  // In a real implementation, this would be saved to the metadata system
  // For now, we'll just return the folder
  return newFolder;
};

export const deleteCertificate = async (id: string): Promise<boolean> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canDeleteCertificate()) {
    throw new Error('Permission denied: Cannot delete certificates');
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  const certIndex = mockCertificates.findIndex(c => c.id === id);
  if (certIndex > -1) {
    mockCertificates.splice(certIndex, 1);
    return true;
  }
  return false;
};

export const getFolders = async (): Promise<Folder[]> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const accessibleFolders = getAccessibleFolders(currentUser);
  return accessibleFolders;
};

export const updateFolder = async (folderId: string, name: string): Promise<Folder> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canManageFolders()) {
    throw new Error('Permission denied: Cannot update folders');
  }

  await new Promise(resolve => setTimeout(resolve, 300));
  
  const allFolders = getAllFolders();
  const folderIndex = allFolders.findIndex(f => f.id === folderId);
  if (folderIndex > -1) {
    const updatedFolder: Folder = {
      ...allFolders[folderIndex],
      name: name.trim(),
    };
    allFolders[folderIndex] = updatedFolder;
    return updatedFolder;
  }
  throw new Error(`Folder with id "${folderId}" not found.`);
};

export const deleteFolder = async (folderId: string): Promise<boolean> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canDeleteFolders()) {
    throw new Error('Permission denied: Cannot delete folders');
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  const allFolders = getAllFolders();
  const folderIndex = allFolders.findIndex(f => f.id === folderId);
  if (folderIndex > -1) {
    allFolders.splice(folderIndex, 1);
    return true;
  }
  return false;
}; 