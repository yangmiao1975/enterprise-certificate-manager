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
            createdAt: new Date().toISOString()
          },
          {
            id: "temp-uploads",
            name: "Temporary Uploads",
            description: "Temporary storage for uploaded certificates pending review",
            type: "system",
            permissions: ["read", "write", "delete"],
            createdAt: new Date().toISOString()
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
            createdAt: new Date().toISOString()
          },
          {
            id: "manager-user",
            username: "manager",
            email: "manager@example.com",
            role: "manager",
            active: true,
            createdAt: new Date().toISOString()
          },
          {
            id: "viewer-user",
            username: "viewer",
            email: "viewer@example.com",
            role: "viewer",
            active: true,
            createdAt: new Date().toISOString()
          }
        ]
      },
      customFolders: [
        {
          id: "prod-servers",
          name: "Production Servers",
          description: "Certificates for production servers",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: new Date().toISOString(),
          accessControl: {
            roles: ["admin", "manager"],
            users: ["admin-user", "manager-user"]
          }
        },
        {
          id: "internal-tools",
          name: "Internal Tools",
          description: "Certificates for internal development tools",
          type: "custom",
          permissions: ["read", "write"],
          createdBy: "admin-user",
          createdAt: new Date().toISOString(),
          accessControl: {
            roles: ["admin", "manager", "viewer"],
            users: ["admin-user", "manager-user", "viewer-user"]
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
  const rbacConfig = getRBACConfig();
  return rbacConfig.roles.find(role => role.id === roleId);
};

export const getUserById = (userId: string): User | undefined => {
  const rbacConfig = getRBACConfig();
  return rbacConfig.users.find(user => user.id === userId);
};

export const getUserByUsername = (username: string): User | undefined => {
  const rbacConfig = getRBACConfig();
  return rbacConfig.users.find(user => user.username === username);
};

export const hasPermission = (user: User, permission: string): boolean => {
  const role = getRoleById(user.role);
  if (!role) return false;
  return role.permissions.includes(permission);
};

export const hasFolderAccess = (user: User, folderId: string, permission: string): boolean => {
  const allFolders = getAllFolders();
  const folder = allFolders.find(f => f.id === folderId);
  
  if (!folder) return false;
  
  // Check if user has the required permission
  if (!hasPermission(user, permission)) return false;
  
  // Check folder-specific access control
  if (folder.accessControl) {
    const hasRoleAccess = folder.accessControl.roles.includes(user.role);
    const hasUserAccess = folder.accessControl.users.includes(user.id);
    
    if (!hasRoleAccess && !hasUserAccess) return false;
  }
  
  return true;
};

export const getTempFolderId = (): string => {
  return 'temp-uploads';
};

export const isTempFolder = (folderId: string): boolean => {
  return folderId === getTempFolderId();
};

export const getAccessibleFolders = (user: User): Folder[] => {
  const allFolders = getAllFolders();
  return allFolders.filter(folder => 
    hasFolderAccess(user, folder.id, 'read')
  );
};

export const canManageFolder = (user: User, folderId: string): boolean => {
  return hasFolderAccess(user, folderId, 'write');
};

export const canDeleteFolder = (user: User, folderId: string): boolean => {
  return hasPermission(user, 'folders:delete') && 
         hasFolderAccess(user, folderId, 'delete');
};

export const canUploadToFolder = (user: User, folderId: string): boolean => {
  return hasPermission(user, 'certificates:write') && 
         hasFolderAccess(user, folderId, 'write');
};

export const canDeleteCertificate = (user: User): boolean => {
  return hasPermission(user, 'certificates:delete');
};

export const canRenewCertificate = (user: User): boolean => {
  return hasPermission(user, 'certificates:renew');
};

export const canManageNotifications = (user: User): boolean => {
  return hasPermission(user, 'notifications:manage');
}; 