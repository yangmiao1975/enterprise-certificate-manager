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
  const accessibleFolderIds = accessibleFolders.map(f => f.id);

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
  const hasAccess = accessibleFolders.some(f => f.id === folderId);
  
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

  // If no folder specified, default to temp folder
  const targetFolderId = folderId || getTempFolderId();
  
  // Check if user can upload to the target folder
  if (!canUploadToFolder(targetFolderId)) {
    throw new Error('Permission denied: Cannot upload to this folder');
  }

  await new Promise(resolve => setTimeout(resolve, 300)); 

  let fileAsArrayBuffer: ArrayBuffer;
  if (typeof fileContentInput === 'string') {
    fileAsArrayBuffer = new TextEncoder().encode(fileContentInput).buffer;
  } else {
    fileAsArrayBuffer = fileContentInput;
  }
  
  try {
    const initialBytesSlice = fileAsArrayBuffer.slice(0, Math.min(fileAsArrayBuffer.byteLength, 1024));
    let textSample = '';
     try {
        textSample = new TextDecoder("utf-8", { fatal: false }).decode(initialBytesSlice);
      } catch (e) { /* Ignore */ }

    if (textSample) { 
        const trimmedSample = textSample.trim();
        if (trimmedSample.includes("Certificate:") && (trimmedSample.includes("Subject: CN=") || trimmedSample.includes("Issuer: CN="))) {
            throw new Error("Invalid file format: The file appears to be a text representation of a certificate, not an actual PEM or DER encoded certificate file.");
        }
        if (trimmedSample.includes("-----BEGIN CERTIFICATE REQUEST-----") || trimmedSample.includes("-----BEGIN NEW CERTIFICATE REQUEST-----")) {
            throw new Error("Invalid file format: The file appears to be a Certificate Signing Request (CSR). Please upload an X.509 certificate.");
        }
        if (trimmedSample.includes("-----BEGIN PRIVATE KEY-----") || trimmedSample.includes("-----BEGIN RSA PRIVATE KEY-----") || trimmedSample.includes("-----BEGIN EC PRIVATE KEY-----") || trimmedSample.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----")) {
            throw new Error("Invalid file format: The file appears to contain a private key. Please upload only the X.509 certificate.");
        }
        if (!trimmedSample.startsWith("-----BEGIN CERTIFICATE-----") && textSample.includes("-----BEGIN CERTIFICATE-----")) {
             throw new Error("Invalid file content: Contains certificate-like markers but is not a well-formed PEM certificate.");
        }
    }
  } catch(e: any) {
    console.error("Pre-flight check failed:", e.message);
    throw e;
  }

  const base64CertificateData = arrayBufferToBase64(fileAsArrayBuffer);

  try {
    const analysisResult: GeminiCertificateAnalysis = await analyzeCertificateWithGemini(base64CertificateData, fileName);

    if (!analysisResult.isCertificate) {
      throw new Error(analysisResult.errorReason || "Gemini analysis determined this is not a valid certificate.");
    }

    const { commonName, subject, issuer, serialNumber, validFrom, validTo, algorithm, pemRepresentation } = analysisResult;
    if (!commonName || !subject || !issuer || !serialNumber || !validFrom || !validTo || !algorithm || !pemRepresentation) {
      console.error("Gemini response missing essential fields:", analysisResult);
      throw new Error("AI analysis did not return all required certificate details.");
    }
    
    const parsedValidFrom = new Date(validFrom);
    const parsedValidTo = new Date(validTo);

    if (isNaN(parsedValidFrom.getTime()) || isNaN(parsedValidTo.getTime())) {
        throw new Error("AI analysis returned invalid date formats for validity period.");
    }
    if (parsedValidFrom.getFullYear() < 1970 || parsedValidTo.getFullYear() < 1970) {
        throw new Error("AI analysis returned certificate dates that appear invalid (e.g., year < 1970).");
    }

    const newCertificate: Certificate = {
      id: String(Date.now()) + serialNumber,
      commonName,
      issuer,
      subject,
      validFrom: parsedValidFrom.toISOString(),
      validTo: parsedValidTo.toISOString(),
      algorithm,
      serialNumber,
      status: getStatus(parsedValidTo.toISOString()),
      pem: pemRepresentation,
      folderId: targetFolderId,
      uploadedBy: currentUser.id,
      uploadedAt: new Date().toISOString(),
      isTemp: isTempFolder(targetFolderId),
    };

    mockCertificates.push(newCertificate);
    return newCertificate;

  } catch (e: any) {
    let debugInputInfo = '';
     if (typeof fileContentInput === 'string') {
        debugInputInfo = `Input type: string (PEM text), Length: ${fileContentInput.length}`;
    } else { 
        const firstBytes = Array.from(new Uint8Array(fileContentInput.slice(0, Math.min(fileContentInput.byteLength, 32))))
                            .map(b => b.toString(16).padStart(2, '0')).join(' ');
        debugInputInfo = `Input type: ArrayBuffer, Byte length: ${fileContentInput.byteLength}, First bytes (hex): ${firstBytes}`;
    }
    console.error("Failed to add certificate via Gemini:", e.message, "\nDebug Info:", debugInputInfo, e.stack);
    
    const specificUserErrors = [
        "Invalid file format", 
        "Gemini analysis determined this is not a valid certificate.",
        "AI analysis did not return all required certificate details.",
        "AI analysis returned invalid date formats for validity period.",
        "AI analysis returned certificate dates that appear invalid",
        "AI service is unavailable",
        "AI analysis returned an unexpected format",
        "AI analysis returned invalid JSON",
        "AI service request failed"
    ];

    if (e.message && specificUserErrors.some(errPrefix => e.message.startsWith(errPrefix))) {
        throw new Error(e.message);
    }
    
    throw new Error(`Failed to process certificate: ${e.message || 'An unexpected error occurred during AI analysis.'}`);
  }
};

export const deleteCertificate = async (id: string): Promise<boolean> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canDeleteCertificate()) {
    throw new Error('Permission denied: Cannot delete certificates');
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  const initialLength = mockCertificates.length;
  mockCertificates = mockCertificates.filter(cert => cert.id !== id);
  return mockCertificates.length < initialLength;
};

export const downloadCertificatePem = async (id: string): Promise<string | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  const cert = mockCertificates.find(c => c.id === id);
  return cert?.pem || null;
};

// Folder Management - Updated to use metadata system
export const getFolders = async (): Promise<Folder[]> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Get accessible folders for the current user
  const accessibleFolders = getAccessibleFolders(currentUser);
  return accessibleFolders.sort((a, b) => a.name.localeCompare(b.name));
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

export const updateFolder = async (id: string, newName: string): Promise<Folder | null> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canManageFolders()) {
    throw new Error('Permission denied: Cannot update folders');
  }

  await new Promise(resolve => setTimeout(resolve, 300));
  
  const allFolders = getAllFolders();
  const trimmedNewName = newName.trim();
  
  if (allFolders.some(f => f.id !== id && f.name.toLowerCase() === trimmedNewName.toLowerCase())) {
    throw new Error(`Another folder with name "${trimmedNewName}" already exists.`);
  }
  
  const folder = allFolders.find(f => f.id === id);
  if (folder) {
    // Check if user has access to this folder
    if (!canManageFolders()) {
      throw new Error('Permission denied: Cannot update this folder');
    }
    
    // In a real implementation, this would update the metadata
    return {
      ...folder,
      name: trimmedNewName
    };
  }
  return null;
};

export const deleteFolder = async (id: string): Promise<boolean> => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  if (!canDeleteFolders()) {
    throw new Error('Permission denied: Cannot delete folders');
  }

  await new Promise(resolve => setTimeout(resolve, 500));
  
  const allFolders = getAllFolders();
  const folder = allFolders.find(f => f.id === id);
  
  if (!folder) {
    return false;
  }

  // Check if it's a system folder
  if (folder.type === 'system') {
    throw new Error('Cannot delete system folders');
  }

  // Check if user has access to this folder
  if (!canDeleteFolders()) {
    throw new Error('Permission denied: Cannot delete this folder');
  }

  // In a real implementation, this would remove from metadata
  // For now, just unassign certificates from the deleted folder
  mockCertificates = mockCertificates.map(cert => {
    if (cert.folderId === id) {
      return { ...cert, folderId: null };
    }
    return cert;
  });
  
  return true;
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
