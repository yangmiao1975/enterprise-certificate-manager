/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CertificateTable from './components/CertificateTable';
import AIPoweredInsights from './components/AIPoweredInsights';
import NotificationArea from './components/NotificationArea';
import Modal from './components/Modal';
import UploadCertificateForm from './components/UploadCertificateForm';
import ViewCertificateDataModal from './components/ViewCertificateDataModal';
import NotificationSettingsModal from './components/NotificationSettingsModal';
import FolderPanel from './components/FolderPanel';
import CreateEditFolderModal from './components/modals/CreateEditFolderModal';
import AssignCertificateFolderModal from './components/modals/AssignCertificateFolderModal';
import ConfirmFolderDeleteModal from './components/modals/ConfirmFolderDeleteModal';
import Login from './components/Login';
import OAuthSuccess from './components/OAuthSuccess';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

import { Certificate, NotificationMessage, CertificateStatus, NotificationSettings, Folder } from './types';
import { 
  getCertificates, 
  renewCertificate as apiRenewCertificate, 
  addCertificate as apiAddCertificate, 
  deleteCertificate as apiDeleteCertificate,
  getFolders,
  createFolder as apiCreateFolder,
  updateFolder as apiUpdateFolder,
  deleteFolder as apiDeleteFolder,
  assignCertificateToFolder as apiAssignCertificateToFolder
} from './services/certificateService';
import { apiService } from './services/apiService';
import { loadNotificationSettings, saveNotificationSettings } from './services/notificationSettingsService';
import { initializeAuth, getCurrentUser } from './services/authService';
import { loadMetadata, getDefaultFolder } from './services/metadataService';
import { ICONS, DEFAULT_NOTIFICATION_SETTINGS, ALL_CERTIFICATES_FOLDER_ID } from './constants';

const isAuthenticated = () => !!localStorage.getItem('authToken');

const MainApp: React.FC = () => {
  // All hooks must be called unconditionally at the top
  const [loggedIn, setLoggedIn] = useState(isAuthenticated());
  const [allCertificates, setAllCertificates] = useState<Certificate[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<Certificate[]>([]);
  const [isLoadingCerts, setIsLoadingCerts] = useState<boolean>(true);
  const [errorCerts, setErrorCerts] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState<boolean>(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(ALL_CERTIFICATES_FOLDER_ID);
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [viewModalMode, setViewModalMode] = useState<'view' | 'download'>('view');
  const [renewingCertId, setRenewingCertId] = useState<string | null>(null);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState<boolean>(false);
  const [certToDelete, setCertToDelete] = useState<Certificate | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isNotificationSettingsModalOpen, setIsNotificationSettingsModalOpen] = useState<boolean>(false);
  const [notifiedForExpiry, setNotifiedForExpiry] = useState<Record<string, boolean>>({});
  const notifiedForExpiryRef = React.useRef(notifiedForExpiry);
  const [isCreateEditFolderModalOpen, setIsCreateEditFolderModalOpen] = useState<boolean>(false);
  const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
  const [parentFolderForCreation, setParentFolderForCreation] = useState<string | null>(null);
  const [isFolderActionLoading, setIsFolderActionLoading] = useState<boolean>(false);
  const [isAssignFolderModalOpen, setIsAssignFolderModalOpen] = useState<boolean>(false);
  const [certToAssignFolder, setCertToAssignFolder] = useState<Certificate | null>(null);
  const [isConfirmDeleteFolderModalOpen, setIsConfirmDeleteFolderModalOpen] = useState<boolean>(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const addNotification = useCallback((message: string, type: NotificationMessage['type']) => {
    const newNotification: NotificationMessage = {
      id: String(Date.now()),
      message,
      type,
      timestamp: Date.now(),
    };
    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]);
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const sendSimulatedEmail = useCallback((recipient: string, subject: string, body: string) => {
    console.groupCollapsed(`%cSimulating Email to: ${recipient}`, 'color: #0ea5e9; font-weight: bold;');
    console.log(`To: ${recipient}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.groupEnd();
    addNotification(`Simulated Email: "${subject}" to ${recipient}`, 'info');
  }, [addNotification]);

  useEffect(() => {
    notifiedForExpiryRef.current = notifiedForExpiry;
  }, [notifiedForExpiry]);

  const checkAndSendExpiryNotifications = useCallback((certs: Certificate[], settings: NotificationSettings) => {
    if (!settings.notificationsEnabled || !settings.recipientEmail) return;
    const now = new Date();
    let updatedNotifiedForExpiry = { ...(notifiedForExpiryRef.current ?? {}) };
    let emailSentThisCycle = false;

    certs.forEach(cert => {
      const validToDate = new Date(cert.validTo);
      if (cert.status === CertificateStatus.EXPIRED) return; 

      settings.thresholds.forEach(threshold => {
        const notificationKey = `${cert.id}_${threshold}`;
        const thresholdDate = new Date(validToDate);
        thresholdDate.setDate(validToDate.getDate() - threshold);

        if (now >= thresholdDate && now < validToDate && !updatedNotifiedForExpiry[notificationKey]) {
          const daysRemaining = Math.ceil((validToDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const subject = `Certificate Expiry Warning: ${cert.commonName} (~${daysRemaining} days remaining)`;
          const body = 
`Dear Admin,
This is a notification that the certificate for ${cert.commonName} is due to expire soon.
Common Name: ${cert.commonName}
Serial Number: ${cert.serialNumber}
Expires On: ${validToDate.toUTCString()}
Days Remaining: Approximately ${daysRemaining}
This notification was triggered because it is within the ${threshold}-day warning period.
Please take action to renew this certificate.
Regards,
Enterprise Certificate Manager (Simulated Email System)`;
          sendSimulatedEmail(settings.recipientEmail, subject, body);
          updatedNotifiedForExpiry[notificationKey] = true;
          emailSentThisCycle = true;
        }
      });
    });

    if (emailSentThisCycle) {
      setNotifiedForExpiry(updatedNotifiedForExpiry);
      localStorage.setItem('notifiedForExpiry', JSON.stringify(updatedNotifiedForExpiry));
    }
  }, [sendSimulatedEmail]);

  // Initialize system metadata and authentication (no user fetch here)
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        // Load metadata first
        await loadMetadata();
        // Initialize authentication
        await initializeAuth();
        setIsSystemInitialized(true);
        addNotification('System initialized successfully with RBAC and metadata', 'success');
      } catch (error) {
        console.error('Failed to initialize system:', error);
        addNotification('Failed to initialize system metadata', 'error');
      }
    };
    initializeSystem();
  }, [addNotification]);

  // Always fetch user info on mount and when authToken changes
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('authToken');
      console.log('fetchUser called, token:', token);
      if (token) {
        const user = await getCurrentUser();
        console.log('Fetched user:', user);
        setCurrentUser(user);
        setLoggedIn(!!user);
      } else {
        setCurrentUser(null);
        setLoggedIn(false);
      }
    };
    fetchUser();
    window.addEventListener('authTokenSet', fetchUser);
    return () => {
      window.removeEventListener('authTokenSet', fetchUser);
    };
  }, []);

  function mapCertificateApiToFrontend(cert: any): Certificate {
    return {
      id: cert.id,
      commonName: cert.common_name,
      issuer: cert.issuer,
      subject: cert.subject,
      validFrom: cert.valid_from,
      validTo: cert.valid_to,
      algorithm: cert.algorithm,
      serialNumber: cert.serial_number,
      status: cert.status,
      pem: cert.pem_content,
      folderId: cert.folder_id,
      uploadedBy: cert.uploaded_by,
      uploadedAt: cert.uploaded_at,
      isTemp: cert.is_temp,
      // Add any other fields as needed
    };
  }

  const fetchAllData = useCallback(async (currentSettings: NotificationSettings) => {
    if (!isSystemInitialized) return;

    setIsLoadingCerts(true);
    setIsLoadingFolders(true);
    setErrorCerts(null);
    try {
      const [certsDataRaw, foldersData] = await Promise.all([getCertificates(), getFolders()]);
      const certsData = certsDataRaw.map(mapCertificateApiToFrontend);
      setAllCertificates(certsData);
      setFolders(foldersData);
      checkAndSendExpiryNotifications(certsData, currentSettings);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to load initial data.';
      setErrorCerts(errorMsg);
      addNotification(errorMsg, 'error');
      console.error(err);
    } finally {
      setIsLoadingCerts(false);
      setIsLoadingFolders(false);
    }
  }, [addNotification, checkAndSendExpiryNotifications, isSystemInitialized]);

  useEffect(() => {
    if (!isSystemInitialized) return;

    const settings = loadNotificationSettings();
    setNotificationSettings(settings);
    const storedNotified = localStorage.getItem('notifiedForExpiry');
    if (storedNotified) {
      try { setNotifiedForExpiry(JSON.parse(storedNotified)); } 
      catch(e) { console.error("Error parsing stored notifiedForExpiry", e); setNotifiedForExpiry({});}
    }
    fetchAllData(settings);
  }, [fetchAllData, isSystemInitialized]);

  // Filter certificates based on selectedFolderId
  useEffect(() => {
    if (selectedFolderId === ALL_CERTIFICATES_FOLDER_ID) {
      setFilteredCertificates(allCertificates);
    } else {
      setFilteredCertificates(allCertificates.filter(cert => cert.folderId === selectedFolderId));
    }
  }, [allCertificates, selectedFolderId]);

  const handleUserChange = useCallback(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    
    // Refresh data when user changes
    if (isSystemInitialized) {
      const settings = loadNotificationSettings();
      fetchAllData(settings);
    }
  }, [fetchAllData, isSystemInitialized]);

  const handleRenewCertificate = async (id: string) => {
    setRenewingCertId(id);
    try {
      await apiRenewCertificate(id); // Only show notification, do not update state with response
      addNotification(`Certificate renewal initiated.`, 'success');
      // Optionally, refetch certificates here to update status
      // const certsData = await getCertificates();
      // setAllCertificates(certsData);
    } catch (err) {
      addNotification('An error occurred while renewing certificate.', 'error');
    } finally {
      setRenewingCertId(null);
    }
  };

  const handleDownloadCertificate = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setViewModalMode('download');
    setIsViewModalOpen(true);
  };
  
  const handleViewDetails = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setViewModalMode('view');
    setIsViewModalOpen(true);
  };

  const handleUploadCertificateFile = async (file: File, folderId: string | null): Promise<void> => {
    if (!file) {
        addNotification('No file selected for upload.', 'error');
        throw new Error('No file selected.');
            }
            try {
      console.log('file:', file, 'isFile:', file instanceof File);
      const newCertificateApi = await apiAddCertificate(file, folderId || undefined); // Pass File directly
      const newCertificate = mapCertificateApiToFrontend(newCertificateApi);
                setAllCertificates(prevCerts => 
                  [newCertificate, ...prevCerts].sort((a,b) => new Date(b.validTo).getTime() - new Date(a.validTo).getTime())
                );
                addNotification(`Certificate ${newCertificate.commonName} (from ${file.name}) added successfully.`, 'success');
                setIsUploadModalOpen(false);
      checkAndSendExpiryNotifications([newCertificate, ...allCertificates], notificationSettings);
            } catch (err: any) {
                addNotification(err.message || `Failed to add certificate from ${file.name}.`, 'error');
      throw err;
    }
  };

  const handleRequestDeleteCertificate = (certificate: Certificate) => {
    setCertToDelete(certificate);
    setIsDeleteConfirmModalOpen(true);
  };

  const handleConfirmDeleteCertificate = async () => {
    if (!certToDelete) return;
    try {
      await apiDeleteCertificate(certToDelete.id);
        const certIdToDelete = certToDelete.id;
        setAllCertificates(prevCerts => prevCerts.filter(c => c.id !== certIdToDelete));
        addNotification(`Certificate ${certToDelete.commonName} deleted.`, 'success');
        checkAndSendExpiryNotifications(allCertificates.filter(c => c.id !== certIdToDelete), notificationSettings);
    } catch (err) {
      addNotification(`Error deleting cert ${certToDelete.commonName}.`, 'error');
    } finally {
      setIsDeleteConfirmModalOpen(false);
      setCertToDelete(null);
    }
  };

  const handleSaveNotificationSettings = (newSettings: NotificationSettings) => {
    saveNotificationSettings(newSettings);
    setNotificationSettings(newSettings);
    addNotification('Notification settings saved.', 'success');
    setIsNotificationSettingsModalOpen(false);
    checkAndSendExpiryNotifications(allCertificates, newSettings);
  };

  // Folder Handlers
  const handleCreateFolder = () => {
    setFolderToEdit(null);
    setParentFolderForCreation(null);
    setIsCreateEditFolderModalOpen(true);
  };

  const handleCreateSubfolder = (parentId: string) => {
    setFolderToEdit(null);
    setParentFolderForCreation(parentId);
    setIsCreateEditFolderModalOpen(true);
  };

  const handleEditFolder = (folder: Folder) => {
    setFolderToEdit(folder);
    setParentFolderForCreation(null);
    setIsCreateEditFolderModalOpen(true);
  };

  const handleSaveFolders = async (name: string, folderIdToUpdate?: string) => {
    setIsFolderActionLoading(true);
    try {
      if (folderIdToUpdate) {
        const updatedFolder = await apiUpdateFolder(folderIdToUpdate, name);
        if (updatedFolder) {
          setFolders(prevFolders => prevFolders.map(f => f.id === folderIdToUpdate ? updatedFolder : f).sort((a,b) => a.name.localeCompare(b.name)));
          addNotification(`Folder "${updatedFolder.name}" updated.`, 'success');
        }
      } else {
        const newFolder = await apiCreateFolder(name, parentFolderForCreation);
        setFolders(prevFolders => [...prevFolders, newFolder].sort((a,b) => a.name.localeCompare(b.name)));
        addNotification(`Folder "${newFolder.name}" created.`, 'success');
      }
      setIsCreateEditFolderModalOpen(false);
      setFolderToEdit(null);
      setParentFolderForCreation(null);
    } catch (err: any) {
      addNotification(err.message || 'Failed to save folder.', 'error');
      throw err; // Re-throw to keep modal open with error
    } finally {
      setIsFolderActionLoading(false);
    }
  };
  
  const handleRequestDeleteFolder = (folder: Folder) => {
    setFolderToDelete(folder);
    setIsConfirmDeleteFolderModalOpen(true);
  };

  const handleConfirmDeleteFolder = async () => {
    if(!folderToDelete) return;
    setIsFolderActionLoading(true);
    try {
        const deletedFolderId = folderToDelete.id;
        await apiDeleteFolder(deletedFolderId);
        setFolders(prevFolders => prevFolders.filter(f => f.id !== deletedFolderId));
        setAllCertificates(prevCerts => 
          prevCerts.map(c => (c.folderId === deletedFolderId ? { ...c, folderId: null } : c))
        );
        addNotification(`Folder "${folderToDelete.name}" deleted. Associated certificates unassigned.`, 'success');
        if (selectedFolderId === deletedFolderId) {
          setSelectedFolderId(ALL_CERTIFICATES_FOLDER_ID); 
        }
        setIsConfirmDeleteFolderModalOpen(false);
        setFolderToDelete(null);
    } catch (err: any) {
        addNotification(err.message || `Failed to delete folder "${folderToDelete.name}".`, 'error');
    } finally {
        setIsFolderActionLoading(false);
    }
  };

  const handleOpenAssignFolderModal = (certificate: Certificate) => {
    setCertToAssignFolder(certificate);
    setIsAssignFolderModalOpen(true);
  };
  
  const handleAssignCertificateToFolder = async (certificateId: string, targetFolderId: string | null) => {
    setIsFolderActionLoading(true);
    try {
        const updatedCert = await apiAssignCertificateToFolder(certificateId, targetFolderId);
        if (updatedCert) {
            setAllCertificates(prevCerts =>
                prevCerts.map(c => (c.id === certificateId ? updatedCert : c))
            );
            const targetFolderName = targetFolderId ? folders.find(f=>f.id === targetFolderId)?.name : 'Unassigned';
            addNotification(`Certificate ${updatedCert.commonName} moved to ${targetFolderName || 'Unassigned'}.`, 'success');
            setIsAssignFolderModalOpen(false);
            setCertToAssignFolder(null);
        } else {
             addNotification(`Failed to move certificate: Certificate not found or error in service.`, 'error');
        }
    } catch (err: any) {
        addNotification(err.message || 'Failed to move certificate.', 'error');
        throw err; 
    } finally {
        setIsFolderActionLoading(false);
    }
  };

  // Helper to check if a folder is a descendant of another
  function isDescendant(folders: Folder[], folderId: string, possibleAncestorId: string): boolean {
    let current: Folder | undefined = folders.find(f => f.id === folderId);
    while (current && current.parentId) {
      if (current.parentId === possibleAncestorId) return true;
      const next: Folder | undefined = folders.find(f => f.id === current?.parentId);
      if (!next) break;
      current = next;
    }
    return false;
  }

  const handleMoveFolder = async (folderId: string, newParentId: string | null) => {
    // Prevent moving a folder into itself or its descendants
    if (folderId === newParentId) return;
    if (newParentId && isDescendant(folders, newParentId, folderId)) return;
    
    try {
      // Call backend API to persist the move
      await apiService.moveFolder(folderId, newParentId);
      
      // Update frontend state
      setFolders(prevFolders =>
        prevFolders.map(folder =>
          folder.id === folderId ? { ...folder, parentId: newParentId } : folder
        )
      );
      
      addNotification('Folder moved successfully', 'success');
    } catch (error: any) {
      console.error('Failed to move folder:', error);
      addNotification(error.message || 'Failed to move folder', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-50">
      <Header 
        onUploadClick={() => setIsUploadModalOpen(true)} 
        onSettingsClick={() => setIsNotificationSettingsModalOpen(true)} 
        onUserChange={handleUserChange}
      />
      <NotificationArea notifications={notifications} onDismissNotification={dismissNotification} />
      
      <main className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <div className="md:w-1/4 lg:w-1/5 flex-shrink-0">
            <FolderPanel 
              folders={folders}
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCreateFolder={handleCreateFolder}
              onCreateSubfolder={handleCreateSubfolder}
              onEditFolder={handleEditFolder}
              onDeleteFolder={handleRequestDeleteFolder}
              isLoading={isLoadingFolders}
              onMoveFolder={handleMoveFolder}
            />
          </div>
          <div className="md:w-3/4 lg:w-4/5 flex-grow min-w-0"> {/* min-w-0 for flex child to allow shrinking */}
            {(isLoadingCerts && filteredCertificates.length === 0) && (
              <div className="flex items-center justify-center h-64">
                <svg className="animate-spin h-10 w-10 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="ml-3 text-lg text-slate-600 dark:text-slate-400">Loading certificates...</p>
              </div>
            )}
            {errorCerts && <p className="text-center text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200 p-4 rounded-md">{errorCerts}</p>}
            {!(isLoadingCerts && filteredCertificates.length === 0) && !errorCerts && (
              <CertificateTable
                certificates={filteredCertificates}
                onRenew={handleRenewCertificate}
                onDownload={handleDownloadCertificate}
                onViewDetails={handleViewDetails}
                onDelete={handleRequestDeleteCertificate}
                onMoveToFolder={handleOpenAssignFolderModal}
                renewingCertId={renewingCertId}
              />
            )}
            <AIPoweredInsights 
                selectedCertificateCN={selectedCertificate?.commonName} 
                certificates={allCertificates} 
            />
          </div>
        </div>
      </main>

      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Certificate File" size="lg">
        <UploadCertificateForm
          onSubmit={handleUploadCertificateFile}
          onCancel={() => setIsUploadModalOpen(false)}
          folders={folders}
        />
      </Modal>

      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={viewModalMode === 'download' ? `Certificate PEM: ${selectedCertificate?.commonName}` : `Certificate Details: ${selectedCertificate?.commonName}`} size="xl">
        <ViewCertificateDataModal
            certificate={selectedCertificate}
            onClose={() => setIsViewModalOpen(false)}
            mode={viewModalMode}
        />
      </Modal>

      <Modal 
        isOpen={isNotificationSettingsModalOpen} 
        onClose={() => setIsNotificationSettingsModalOpen(false)} 
        title="Notification Settings" 
        size="lg"
      >
        <NotificationSettingsModal 
          currentSettings={notificationSettings}
          onSave={handleSaveNotificationSettings}
          onClose={() => setIsNotificationSettingsModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={isDeleteConfirmModalOpen} onClose={() => { setIsDeleteConfirmModalOpen(false); setCertToDelete(null); }} title="Confirm Deletion" size="md">
        {certToDelete && (
          <div className="text-slate-700 dark:text-slate-200">
            <p className="mb-6">Are you sure you want to delete the certificate for <strong className="font-semibold">{certToDelete.commonName}</strong>?</p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-1">This action cannot be undone.</p>
            <div className="flex justify-end space-x-3 pt-4">
              <button onClick={() => { setIsDeleteConfirmModalOpen(false); setCertToDelete(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition">
                Cancel
              </button>
              <button onClick={handleConfirmDeleteCertificate}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition flex items-center space-x-2">
                {ICONS.trash} <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Folder Modals */}
      <Modal isOpen={isCreateEditFolderModalOpen} onClose={() => setIsCreateEditFolderModalOpen(false)} title={folderToEdit ? 'Edit Folder' : 'Create New Folder'} size="md">
        <CreateEditFolderModal 
            isOpen={isCreateEditFolderModalOpen}
            onClose={() => setIsCreateEditFolderModalOpen(false)}
            onSave={handleSaveFolders}
            existingFolder={folderToEdit}
            isLoading={isFolderActionLoading}
        />
      </Modal>

      <Modal isOpen={isAssignFolderModalOpen} onClose={() => setIsAssignFolderModalOpen(false)} title="Move Certificate to Folder" size="md">
        <AssignCertificateFolderModal
            isOpen={isAssignFolderModalOpen}
            onClose={() => setIsAssignFolderModalOpen(false)}
            onAssign={handleAssignCertificateToFolder}
            certificate={certToAssignFolder}
            folders={folders}
            isLoading={isFolderActionLoading}
        />
      </Modal>
      
      <Modal isOpen={isConfirmDeleteFolderModalOpen} onClose={() => setIsConfirmDeleteFolderModalOpen(false)} title="Confirm Folder Deletion" size="md">
        <ConfirmFolderDeleteModal
            isOpen={isConfirmDeleteFolderModalOpen}
            onClose={() => setIsConfirmDeleteFolderModalOpen(false)}
            onConfirm={handleConfirmDeleteFolder}
            folder={folderToDelete}
            isLoading={isFolderActionLoading}
        />
      </Modal>

      <footer className="text-center py-6 text-sm text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 mt-12">
        © {new Date().getFullYear()} Enterprise Certificate Manager. All rights reserved. (Simulated Application)
      </footer>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login onLogin={() => {}} />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainApp />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
