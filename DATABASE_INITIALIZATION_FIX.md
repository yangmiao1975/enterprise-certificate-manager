# Database Initialization Fix

## Problem
The Google OAuth callback was returning a 500 Internal Server Error with the message:
```
{"error":"Database not initialized. Call initializeDatabase() first."}
```

## Root Cause
The backend application had a mismatch between database initialization systems:

1. **Main server** (`backend/src/index.js`) was using the **new flexible database system**:
   ```javascript
   import { initializeDatabase } from './database/flexible-init.js';
   ```

2. **Auth routes** (`backend/src/routes/auth.js`) and other route files were using the **old database system**:
   ```javascript
   import { getDatabase } from '../database/init.js';
   ```

This meant that:
- The server would initialize the database using the flexible system
- But when OAuth callbacks tried to access the database, they were calling `getDatabase()` from the old system
- The old system hadn't been initialized, hence the error

## Solution Applied

### 1. Updated Auth Routes
**File: `backend/src/routes/auth.js`**
```javascript
// Before (old system)
import { getDatabase } from '../database/init.js';
// TODO: Update to use flexible database and password service
// import { getDatabase, getPasswordService } from '../database/flexible-init.js';

// After (new flexible system)
import { getDatabase, getPasswordService } from '../database/flexible-init.js';
```

### 2. Updated All Other Route Files
Updated the following files to use the flexible database system:
- `backend/src/services/geminiService.js`
- `backend/src/routes/metadata.js`
- `backend/src/routes/gemini.js`
- `backend/src/routes/certificates.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/folders.js`
- `backend/src/routes/users.js`

### 3. Updated Password Service Usage
In `auth.js`, replaced manual instantiation with the flexible system:
```javascript
// Before
const passwordService = new PasswordService();

// After
const passwordService = getPasswordService();
```

## Environment Variables Required

For the backend to start properly, the following environment variables should be set:

```bash
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8080/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
```

## Verification

1. **Backend starts successfully**: ✅
   ```bash
   cd backend
   npm install
   node src/index.js
   ```

2. **Health check works**: ✅
   ```bash
   curl http://localhost:8080/health
   # Returns: {"status":"healthy","timestamp":"...","version":"1.0.0"}
   ```

3. **Database initializes properly**: ✅
   - Uses SQLite by default in development
   - Creates all required tables (users, roles, folders, certificates, metadata)
   - Inserts default data (admin user, roles, folders)

## Impact
This fix resolves the Google OAuth callback error and ensures all routes use the same database initialization system. The OAuth flow should now work properly without the "Database not initialized" error.

## Related Files Modified
- `backend/src/routes/auth.js`
- `backend/src/services/geminiService.js` 
- `backend/src/routes/metadata.js`
- `backend/src/routes/gemini.js`
- `backend/src/routes/certificates.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/folders.js`
- `backend/src/routes/users.js`