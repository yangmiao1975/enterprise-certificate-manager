import { Certificate } from '../types';
import { getTempFolderConfig, getTempFolderId, isTempFolder } from './metadataService';
import { getCurrentUser } from './authService';

// In-memory storage for temp certificates (in a real app, this would be persistent)
let tempCertificates: Certificate[] = [];

export const getTempCertificates = async (): Promise<Certificate[]> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const config = getTempFolderConfig();
  if (!config.enabled) {
    throw new Error('Temp folder is disabled');
  }

  // Filter certificates that are marked as temp
  return tempCertificates.filter(cert => cert.isTemp === true);
};

export const addToTempFolder = async (certificate: Certificate): Promise<Certificate> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const config = getTempFolderConfig();
  if (!config.enabled) {
    throw new Error('Temp folder is disabled');
  }

  // Mark certificate as temp and set folder to temp folder
  const tempCertificate: Certificate = {
    ...certificate,
    folderId: getTempFolderId(),
    isTemp: true,
    uploadedBy: currentUser.id,
    uploadedAt: new Date().toISOString()
  };

  tempCertificates.push(tempCertificate);
  return tempCertificate;
};

export const moveFromTempToFolder = async (
  certificateId: string, 
  targetFolderId: string
): Promise<Certificate> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const certIndex = tempCertificates.findIndex(cert => cert.id === certificateId);
  if (certIndex === -1) {
    throw new Error('Certificate not found in temp folder');
  }

  // Move certificate from temp to target folder
  const updatedCertificate: Certificate = {
    ...tempCertificates[certIndex],
    folderId: targetFolderId,
    isTemp: false
  };

  tempCertificates[certIndex] = updatedCertificate;
  return updatedCertificate;
};

export const deleteFromTempFolder = async (certificateId: string): Promise<boolean> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const certIndex = tempCertificates.findIndex(cert => cert.id === certificateId);
  if (certIndex === -1) {
    return false;
  }

  // Remove certificate from temp folder
  tempCertificates.splice(certIndex, 1);
  return true;
};

export const cleanupTempFolder = async (): Promise<number> => {
  const config = getTempFolderConfig();
  if (!config.enabled) {
    return 0;
  }

  const now = new Date();
  const retentionDate = new Date(now.getTime() - (config.retentionDays * 24 * 60 * 60 * 1000));
  
  const initialCount = tempCertificates.length;
  
  // Remove certificates older than retention period
  tempCertificates = tempCertificates.filter(cert => {
    const uploadedDate = new Date(cert.uploadedAt || 0);
    return uploadedDate > retentionDate;
  });

  const removedCount = initialCount - tempCertificates.length;
  return removedCount;
};

export const getTempFolderStats = async (): Promise<{
  totalCertificates: number;
  oldestCertificate: Date | null;
  newestCertificate: Date | null;
  totalSize: number; // Approximate size in bytes
}> => {
  const config = getTempFolderConfig();
  if (!config.enabled) {
    return {
      totalCertificates: 0,
      oldestCertificate: null,
      newestCertificate: null,
      totalSize: 0
    };
  }

  if (tempCertificates.length === 0) {
    return {
      totalCertificates: 0,
      oldestCertificate: null,
      newestCertificate: null,
      totalSize: 0
    };
  }

  const dates = tempCertificates
    .map(cert => new Date(cert.uploadedAt || 0))
    .sort((a, b) => a.getTime() - b.getTime());

  const totalSize = tempCertificates.reduce((size, cert) => {
    return size + (cert.pem?.length || 0);
  }, 0);

  return {
    totalCertificates: tempCertificates.length,
    oldestCertificate: dates[0],
    newestCertificate: dates[dates.length - 1],
    totalSize
  };
};

export const isCertificateInTempFolder = (certificate: Certificate): boolean => {
  return isTempFolder(certificate.folderId || '') && certificate.isTemp === true;
};

// Auto-cleanup on app startup
export const initializeTempFolder = async (): Promise<void> => {
  try {
    const removedCount = await cleanupTempFolder();
    if (removedCount > 0) {
      console.log(`Cleaned up ${removedCount} expired certificates from temp folder`);
    }
  } catch (error) {
    console.error('Failed to initialize temp folder cleanup:', error);
  }
};

// Set up periodic cleanup
export const startTempFolderCleanup = (): number => {
  const config = getTempFolderConfig();
  if (!config.enabled) {
    return 0; // Return 0 for disabled
  }

  return setInterval(async () => {
    try {
      const removedCount = await cleanupTempFolder();
      if (removedCount > 0) {
        console.log(`Periodic cleanup: Removed ${removedCount} expired certificates from temp folder`);
      }
    } catch (error) {
      console.error('Periodic temp folder cleanup failed:', error);
    }
  }, config.cleanupInterval);
}; 