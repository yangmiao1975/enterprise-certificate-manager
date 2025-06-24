/// <reference types="vite/client" />
import { User, Role, AuthContext } from '../types';
import { 
  getUserByUsername, 
  getUserById, 
  getRoleById, 
  hasPermission, 
  hasFolderAccess,
  loadMetadata,
  getRBACConfig
} from './metadataService';

let currentUser: User | null = null;
let currentUserRole: Role | null = null;

// Initialize with default admin user
export const initializeAuth = async (): Promise<void> => {
  try {
    await loadMetadata();
    // Set default admin user for demo purposes
    const adminUser = getUserByUsername('admin');
    if (adminUser) {
      await login(adminUser.username);
    }
  } catch (error) {
    console.error('Failed to initialize auth:', error);
  }
};

export const login = async (username: string): Promise<User | null> => {
  try {
    const user = getUserByUsername(username);
    if (!user || !user.active) {
      return null;
    }

    const role = getRoleById(user.role);
    if (!role) {
      return null;
    }

    currentUser = user;
    currentUserRole = role;
    
    // Store in localStorage for persistence
    localStorage.setItem('currentUser', JSON.stringify(user));
    
    return user;
  } catch (error) {
    console.error('Login failed:', error);
    return null;
  }
};

export const logout = (): void => {
  currentUser = null;
  currentUserRole = null;
  localStorage.removeItem('currentUser');
};

export const getCurrentUser = (): User | null => {
  if (!currentUser) {
    // Try to restore from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        const role = getRoleById(user.role);
        if (role) {
          currentUser = user;
          currentUserRole = role;
        }
      } catch (error) {
        console.error('Failed to restore user from localStorage:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }
  return currentUser;
};

export const getCurrentUserRole = (): Role | null => {
  if (!currentUserRole && getCurrentUser()) {
    const role = getRoleById(getCurrentUser()!.role);
    currentUserRole = role || null;
  }
  return currentUserRole;
};

export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};

export const checkPermission = (permission: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  return hasPermission(user, permission);
};

export const checkFolderAccess = (folderId: string, permission: string): boolean => {
  const user = getCurrentUser();
  if (!user) return false;
  return hasFolderAccess(user, folderId, permission);
};

export const getAuthContext = (): AuthContext => {
  const user = getCurrentUser();
  const role = getCurrentUserRole();
  
  return {
    currentUser: user,
    userRole: role,
    hasPermission: (permission: string) => checkPermission(permission),
    hasFolderAccess: (folderId: string, permission: string) => checkFolderAccess(folderId, permission)
  };
};

export const switchUser = async (username: string): Promise<boolean> => {
  const user = await login(username);
  return user !== null;
};

export const getAvailableUsers = (): User[] => {
  try {
    const rbacConfig = getRBACConfig();
    return rbacConfig.users.filter((user: User) => user.active);
  } catch (error) {
    console.error('Failed to get available users:', error);
    return [];
  }
};

export const canUploadToFolder = (folderId: string): boolean => {
  return checkPermission('certificates:write') && checkFolderAccess(folderId, 'write');
};

export const canDeleteCertificate = (): boolean => {
  return checkPermission('certificates:delete');
};

export const canRenewCertificate = (): boolean => {
  return checkPermission('certificates:renew');
};

export const canManageFolders = (): boolean => {
  return checkPermission('folders:write');
};

export const canDeleteFolders = (): boolean => {
  return checkPermission('folders:delete');
};

export const canManageNotifications = (): boolean => {
  return checkPermission('notifications:manage');
}; 