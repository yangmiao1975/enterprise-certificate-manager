/// <reference types="vite/client" />
import { MetadataConfig, SystemMetadata, User, Role, Folder, RBACConfig, TempFolderConfig } from '../types';

let metadataConfig: MetadataConfig | null = null;

export const loadMetadata = async (): Promise<MetadataConfig> => {
  if (metadataConfig) {
    return metadataConfig;
  }

  try {
    const response = await fetch('/metadata.json');
    if (!response.ok) {
      throw new Error(`Failed to load metadata: ${response.statusText}`);
    }
    
    const loadedConfig: MetadataConfig = await response.json();
    metadataConfig = loadedConfig;
    return loadedConfig;
  } catch (error) {
    console.error('Error loading metadata:', error);
    // Return default metadata if loading fails
    const defaultConfig = getDefaultMetadata();
    metadataConfig = defaultConfig;
    return defaultConfig;
  }
};

export const getDefaultMetadata = (): MetadataConfig => {
  const now = new Date().toISOString();
  return {
    name: "Enterprise Certificate Manager",
    description: "A Venafi-like application to manage enterprise certificates",
    requestFramePermissions: [],
    prompt: "",
    system: {
      tempFolder: {
        enabled: true,
        path: "./temp_certs",
        maxSize: "100MB",
        cleanupInterval: 3600000,
        retentionDays: 7
      },
      folders: {
        defaultFolder: "all-certificates",
        systemFolders: [
          {
            id: "all-certificates",
            name: "All Certificates",
            description: "System folder containing all certificates",
            type: "system",
            permissions: ["read"],
            createdAt: now
          }
        ]
      },
      rbac: {
        enabled: true,
        roles: [
          {
            id: "admin",
            name: "Administrator",
            description: "Full system access",
            permissions: [
              "certificates:read",
              "certificates:write",
              "certificates:delete",
              "certificates:renew",
              "folders:read",
              "folders:write",
              "folders:delete",
              "system:settings",
              "notifications:manage"
            ]
          },
          {
            id: "manager",
            name: "Certificate Manager",
            description: "Can manage certificates and folders",
            permissions: [
              "certificates:read",
              "certificates:write",
              "certificates:renew",
              "folders:read",
              "folders:write",
              "notifications:view"
            ]
          },
          {
            id: "viewer",
            name: "Certificate Viewer",
            description: "Read-only access to certificates",
            permissions: [
              "certificates:read",
              "folders:read"
            ]
          }
        ],
        users: [
          {
            id: "admin-user",
            username: "admin",
            email: "admin@example.com",
            role: "admin",
            active: true,
            createdAt: now
          },
          {
            id: "manager-user",
            username: "manager",
            email: "manager@example.com",
            role: "manager",
            active: true,
            createdAt: now
          },
          {
            id: "viewer-user",
            username: "viewer",
            email: "viewer@example.com",
            role: "viewer",
            active: true,
            createdAt: now
          }
        ]
      },
      customFolders: [
        // Integration Team
        {
          id: "integration-team",
          name: "Integration Team",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "all-certificates",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        // ERP
        {
          id: "erp",
          name: "ERP",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "all-certificates",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        // HCM
        {
          id: "hcm",
          name: "HCM",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "all-certificates",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        // Subfolders for Integration Team
        {
          id: "integration-team-nonprod",
          name: "NON-PROD",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "integration-team",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        {
          id: "integration-team-prod",
          name: "PROD",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "integration-team",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        // Subfolders for ERP
        {
          id: "erp-nonprod",
          name: "NON-PROD",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "erp",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        {
          id: "erp-prod",
          name: "PROD",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "erp",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        // Subfolders for HCM
        {
          id: "hcm-nonprod",
          name: "NON-PROD",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "hcm",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        {
          id: "hcm-prod",
          name: "PROD",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: now,
          parentId: "hcm",
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        }
      ]
    }
  };
};

export const getSystemMetadata = (): SystemMetadata => {
  if (!metadataConfig) {
    throw new Error('Metadata not loaded. Call loadMetadata() first.');
  }
  return metadataConfig.system;
};

export const getTempFolderConfig = (): TempFolderConfig => {
  const systemMetadata = getSystemMetadata();
  return systemMetadata.tempFolder;
};

export const getRBACConfig = (): RBACConfig => {
  const systemMetadata = getSystemMetadata();
  return systemMetadata.rbac;
};

export const getAllFolders = (): Folder[] => {
  const systemMetadata = getSystemMetadata();
  return [
    ...systemMetadata.folders.systemFolders,
    ...systemMetadata.customFolders
  ];
};

export const getSystemFolders = (): Folder[] => {
  const systemMetadata = getSystemMetadata();
  return systemMetadata.folders.systemFolders;
};

export const getCustomFolders = (): Folder[] => {
  const systemMetadata = getSystemMetadata();
  return systemMetadata.customFolders;
};

export const getDefaultFolder = (): string => {
  const systemMetadata = getSystemMetadata();
  return systemMetadata.folders.defaultFolder;
};

export const getRoleById = (roleId: string): Role | undefined => {
  const rbac = getRBACConfig();
  return rbac.roles.find(role => role.id === roleId);
};

export const getUserById = (userId: string): User | undefined => {
  const rbac = getRBACConfig();
  return rbac.users.find(user => user.id === userId);
};

export const getUserByUsername = (username: string): User | undefined => {
  const rbac = getRBACConfig();
  return rbac.users.find(user => user.username === username);
};

export const hasPermission = (user: User, permission: string): boolean => {
  const role = getRoleById(user.role);
  return !!role && role.permissions.includes(permission);
};

export const hasFolderAccess = (user: User, folderId: string, permission: string): boolean => {
  const allFolders = getAllFolders();
  const folder = allFolders.find(f => f.id === folderId);
  if (!folder) return false;
  // Check if user has access via role or explicit user access
  const rbac = getRBACConfig();
  const userRole = getRoleById(user.role);
  const hasRoleAccess = folder.accessControl?.roles?.includes(user.role);
  const hasUserAccess = folder.accessControl?.users?.includes(user.id);
  const hasPerm = !!userRole && !!userRole.permissions && userRole.permissions.includes(permission);
  return (!!hasRoleAccess || !!hasUserAccess) && !!hasPerm;
};

export const getTempFolderId = (): string => {
  return 'temp-uploads';
};

export const isTempFolder = (folderId: string): boolean => {
  return folderId === 'temp-uploads';
};

export const getAccessibleFolders = (user: User): Folder[] => {
  // For now, return all folders (or implement your RBAC logic)
  return getAllFolders();
}; 