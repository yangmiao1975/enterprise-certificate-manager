# Enterprise Certificate Manager

A comprehensive SSL/TLS certificate management system with AI-powered analysis, RBAC (Role-Based Access Control), and metadata-driven folder organization.

## Features

### 🔐 **RBAC (Role-Based Access Control)**
- **Admin**: Full system access including certificate management, folder operations, and system settings
- **Manager**: Can manage certificates and folders, view notifications
- **Viewer**: Read-only access to certificates and folders
- **Uploader**: Can upload certificates to temp folder

### 📁 **Metadata-Driven Folder Management**
- **System Folders**: "All Certificates" and "Temporary Uploads" (managed by system)
- **Custom Folders**: User-created folders with granular access control
- **Folder Permissions**: Role-based and user-specific access control
- **Temp Folder**: Dedicated space for uploaded certificates pending review

### 🤖 **AI-Powered Features**
- **Certificate Analysis**: Automatic parsing and validation using Google Gemini AI
- **AI Chat**: Contextual assistance for certificate management
- **Best Practices**: AI-generated insights and recommendations

### 📧 **Notification System**
- **Expiry Alerts**: Configurable email notifications for expiring certificates
- **Multiple Thresholds**: Set alerts for different time periods (5, 10, 30 days)
- **Simulated Email System**: Demonstrates notification functionality

### 🔄 **Certificate Operations**
- **Upload**: Drag-and-drop or file selection with AI validation
- **Renewal**: Simulated certificate renewal with extended validity
- **Download**: PEM format downloads
- **Organization**: Move certificates between folders
- **Deletion**: Safe deletion with confirmation dialogs

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Google Gemini API key (optional, for AI features)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   - Create `.env.local` file
   - Add your Gemini API key: `GEMINI_API_KEY=your_api_key_here`

3. **Run the application:**
   ```bash
   npm run dev
   ```

## Configuration

### Metadata System

The application uses `metadata.json` for system configuration:

```json
{
  "system": {
    "tempFolder": {
      "enabled": true,
      "path": "./temp_certs",
      "maxSize": "100MB",
      "retentionDays": 7
    },
    "rbac": {
      "enabled": true,
      "roles": [...],
      "users": [...]
    },
    "folders": {
      "systemFolders": [...],
      "customFolders": [...]
    }
  }
}
```

### Default Users

The system comes with pre-configured users for testing:

- **admin** (admin@example.com) - Full system access
- **manager** (manager@example.com) - Certificate and folder management
- **viewer** (viewer@example.com) - Read-only access

### Testing RBAC

1. Use the user switcher in the header to test different roles
2. Each role has different permissions and folder access
3. Try uploading certificates to different folders based on your role
4. Test folder creation and management with different users

## Folder Structure

```
├── components/          # React components
├── services/           # Business logic and API services
├── types.ts           # TypeScript type definitions
├── constants.tsx      # Application constants
├── metadata.json      # System configuration and RBAC
├── App.tsx           # Main application component
└── index.tsx         # Application entry point
```

## Key Services

- **metadataService.ts**: Manages system metadata and RBAC configuration
- **authService.ts**: Handles user authentication and permission checking
- **certificateService.ts**: Certificate CRUD operations with RBAC integration
- **geminiService.ts**: AI-powered certificate analysis and chat

## Security Features

- **Role-Based Access Control**: Granular permissions per role
- **Folder-Level Security**: Access control at folder level
- **User Authentication**: Session management with localStorage
- **Permission Validation**: All operations validate user permissions
- **Temp Folder Isolation**: Separate space for pending certificates

## Development

### Adding New Roles

1. Update `metadata.json` with new role definition
2. Add role permissions array
3. Create test users with the new role
4. Test functionality with the new role

### Adding New Folders

1. Update `metadata.json` with folder configuration
2. Set appropriate access control rules
3. Test folder access with different user roles

### Extending Permissions

1. Add new permission strings to role definitions
2. Update permission checking functions in `authService.ts`
3. Add UI controls based on permission checks

## License

This project is for demonstration purposes. All rights reserved.
