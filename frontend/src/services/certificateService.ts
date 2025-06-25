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
import { apiService } from './apiService';

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

// Certificate API (real backend)
export const getCertificates = apiService.getCertificates.bind(apiService);
export const getCertificate = apiService.getCertificate.bind(apiService);
export const addCertificate = apiService.uploadCertificate.bind(apiService);
export const deleteCertificate = apiService.deleteCertificate.bind(apiService);
export const renewCertificate = apiService.renewCertificate.bind(apiService);
export const downloadCertificate = apiService.downloadCertificate.bind(apiService);

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

  const certificates = await getCertificates();
  const tempCertificates = certificates.filter(cert => cert.isTemp === true);
  return tempCertificates.map(cert => ({ ...cert, status: getStatus(cert.validTo) }));
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

export const assignCertificateToFolder = async (certificateId: string, folderId: string | null): Promise<Certificate | null> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canManageFolders()) {
    throw new Error('Permission denied: Cannot assign certificates to folders');
  }

  await new Promise(resolve => setTimeout(resolve, 300));
  
  const certificates = await getCertificates();
  const certIndex = certificates.findIndex((c: Certificate) => c.id === certificateId);
  if (certIndex > -1) {
    // Check if user has access to the target folder
    if (folderId && !canUploadToFolder(folderId)) {
      throw new Error('Permission denied: Cannot assign to this folder');
    }
    
    return certificates[certIndex];
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