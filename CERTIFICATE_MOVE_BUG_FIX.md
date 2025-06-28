# Certificate Move Bug Fix - Missing Fields Issue

## Problem Description

When moving certificates between folders (e.g., from "Production Servers" to "HCM"), the certificates would appear in the "All Certificates" folder but critical fields like **Valid From**, **Valid To**, and **Common Name** would disappear/be blank.

## Root Cause Analysis

### Issue: Field Name Mapping Mismatch

The bug was caused by a **field name mapping mismatch** between the backend API response and frontend state management:

1. **Backend API** returns data with **snake_case** field names:
   ```json
   {
     "id": "cert-123",
     "common_name": "production.example.com",
     "valid_from": "2023-01-01T00:00:00Z",
     "valid_to": "2024-01-01T00:00:00Z",
     "issuer": "DigiCert Inc",
     "subject": "CN=production.example.com",
     "folder_id": "hcm-folder"
   }
   ```

2. **Frontend Certificate interface** expects **camelCase** field names:
   ```typescript
   interface Certificate {
     id: string;
     commonName: string;    // ← Expected camelCase
     validFrom: string;     // ← Expected camelCase
     validTo: string;       // ← Expected camelCase
     issuer: string;
     subject: string;
     folderId: string;
   }
   ```

### The Bug Location

In `frontend/src/App.tsx`, the `handleAssignCertificateToFolder` function was directly using the API response without field name conversion:

**Before (Buggy Code):**
```javascript
const handleAssignCertificateToFolder = async (certificateId: string, targetFolderId: string | null) => {
  const updatedCert = await apiAssignCertificateToFolder(certificateId, targetFolderId);
  if (updatedCert) {
    // BUG: updatedCert has snake_case fields, but frontend expects camelCase
    setAllCertificates(prevCerts =>
      prevCerts.map(c => (c.id === certificateId ? updatedCert : c))
    );
  }
};
```

### Why Fields Disappeared

When the frontend tried to display certificate data, it looked for:
- `certificate.commonName` → **undefined** (API returned `common_name`)
- `certificate.validFrom` → **undefined** (API returned `valid_from`)
- `certificate.validTo` → **undefined** (API returned `valid_to`)

Result: Empty/blank fields in the UI.

## Solution Applied

### Fix: Use Field Mapping Function

Updated the `handleAssignCertificateToFolder` function to use the existing `mapCertificateApiToFrontend` function:

**After (Fixed Code):**
```javascript
const handleAssignCertificateToFolder = async (certificateId: string, targetFolderId: string | null) => {
  const updatedCertApi = await apiAssignCertificateToFolder(certificateId, targetFolderId);
  if (updatedCertApi) {
    // FIX: Convert API response to frontend format
    const updatedCert = mapCertificateApiToFrontend(updatedCertApi);
    
    setAllCertificates(prevCerts =>
      prevCerts.map(c => (c.id === certificateId ? updatedCert : c))
    );
  }
};
```

### Mapping Function Details

The `mapCertificateApiToFrontend` function properly converts field names:

```javascript
function mapCertificateApiToFrontend(cert) {
  return {
    id: cert.id,
    commonName: cert.common_name,        // snake_case → camelCase
    issuer: cert.issuer,
    subject: cert.subject,
    validFrom: cert.valid_from,          // snake_case → camelCase
    validTo: cert.valid_to,              // snake_case → camelCase
    algorithm: cert.algorithm,
    serialNumber: cert.serial_number,     // snake_case → camelCase
    status: cert.status,
    pem: cert.pem_content,               // snake_case → camelCase
    folderId: cert.folder_id,            // snake_case → camelCase
    uploadedBy: cert.uploaded_by,        // snake_case → camelCase
    uploadedAt: cert.uploaded_at,        // snake_case → camelCase
    isTemp: cert.is_temp,                // snake_case → camelCase
  };
}
```

## Files Modified

### `/frontend/src/App.tsx`
- **Function**: `handleAssignCertificateToFolder`
- **Change**: Added `mapCertificateApiToFrontend()` call to convert API response
- **Lines**: ~456-470

## Testing

### Verification Process
1. Created test script simulating backend API response
2. Verified mapping function converts snake_case to camelCase correctly  
3. Confirmed all required fields are present after conversion

### Test Results
```
✅ SUCCESS: All required fields are present!
✅ Common Name: production.example.com
✅ Valid From: 2023-01-01T00:00:00Z
✅ Valid To: 2024-01-01T00:00:00Z
✅ Issuer: DigiCert Inc
✅ Subject: CN=production.example.com, O=Example Corp, C=US
```

## Expected Behavior After Fix

1. **Move certificate** from "Production Servers" to "HCM" folder
2. **Navigate to "All Certificates"** folder
3. **Verify all fields display correctly:**
   - ✅ Valid From: Shows actual date
   - ✅ Valid To: Shows actual date  
   - ✅ Common Name: Shows certificate name
   - ✅ Issuer: Shows certificate issuer
   - ✅ Subject: Shows certificate subject

## Impact

- **Fixed**: Missing certificate fields after folder moves
- **Maintained**: All existing functionality
- **Improved**: Data consistency between API and frontend
- **Enhanced**: User experience when managing certificates

## Related System Components

- **Backend API**: `/api/certificates/:id/folder` endpoint (PATCH)
- **Frontend State**: Certificate list management
- **Database**: SQLite/PostgreSQL certificate table
- **UI Components**: CertificateTable, CertificateRow

## Additional Notes

- This fix applies to **all certificate move operations**
- The mapping function is already used correctly in other parts of the application (upload, fetch)
- Similar pattern should be followed for any new API integrations
- The backend API structure remains unchanged (maintains compatibility)

---

**Status**: ✅ **RESOLVED** - Certificate fields now display correctly after folder moves

**Tested**: ✅ Verified with simulation script  
**Impact**: 🟢 **Low Risk** - Single function change with existing mapping logic