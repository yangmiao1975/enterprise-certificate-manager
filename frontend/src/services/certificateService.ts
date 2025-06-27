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

  // Call the real API service instead of mock logic
  return await apiService.assignCertificateToFolder(certificateId, folderId);
};

export const createFolder = async (name: string, parentId?: string): Promise<Folder> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  console.log('[Frontend] createFolder called with:', { name, parentId });

  // Call the real API service instead of mock logic
  const folderData = {
    name: name.trim(),
    description: `Custom folder created by ${currentUser.username || currentUser.email || 'user'}`,
    permissions: ['read', 'write']
  };
  
  // Only add accessControl if we have valid user data
  if (currentUser.id && currentUser.role) {
    folderData.accessControl = {
      roles: [currentUser.role],
      users: [String(currentUser.id)]  // Ensure it's a string
    };
  }

  // Add parentId if provided (for creating subfolders)
  if (parentId) {
    folderData.parentId = parentId;
    console.log('[Frontend] Adding parentId to folderData:', parentId);
  }

  console.log('[Frontend] Final folderData being sent:', folderData);
  return await apiService.createFolder(folderData);
};

export const getFolders = async (): Promise<Folder[]> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Call the real API service instead of mock data
  return await apiService.getFolders();
};

export const updateFolder = async (folderId: string, name: string): Promise<Folder> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Call the real API service instead of mock logic
  const folderData = {
    name: name.trim(),
    permissions: ['read', 'write']
  };
  
  // Only add accessControl if we have valid user data
  if (currentUser.id && currentUser.role) {
    folderData.accessControl = {
      roles: [currentUser.role],
      users: [String(currentUser.id)]  // Ensure it's a string
    };
  }

  return await apiService.updateFolder(folderId, folderData);
};

export const deleteFolder = async (folderId: string): Promise<boolean> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  // Call the real API service instead of mock logic
  await apiService.deleteFolder(folderId);
  return true;
}; 