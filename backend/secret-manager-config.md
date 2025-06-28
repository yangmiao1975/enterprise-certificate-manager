# Secret Manager Configuration Guide

This document explains how to configure multi-cloud secret management for secure password storage.

## Current Status (v1.0)

### GCP Secret Manager (Enabled)
```env
USE_SECRET_MANAGER_PASSWORDS=true
SECRET_MANAGER_PROVIDER=gcp
GOOGLE_CLOUD_PROJECT=enterprise-certificate-mgmt
```

## Future Support (v2.0)

### AWS Secrets Manager
```env
USE_SECRET_MANAGER_PASSWORDS=true
SECRET_MANAGER_PROVIDER=aws
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Azure Key Vault
```env
USE_SECRET_MANAGER_PASSWORDS=true
SECRET_MANAGER_PROVIDER=azure
AZURE_KEYVAULT_NAME=your-keyvault-name
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

## How It Works

### Password Storage Process
1. User creates account or changes password
2. Password is hashed with bcrypt (salt rounds: 12)
3. Hash is stored in Secret Manager with metadata:
   - `type: user-password`
   - `userId: 123`
   - `createdAt: timestamp`
   - `description: Password for user 123`

### Password Verification Process
1. User attempts login
2. System reads password reference from database
3. If reference format is `{provider}-secret:{secretName}`:
   - Retrieves hash from Secret Manager
   - Compares using bcrypt
4. If reference is traditional hash:
   - Compares directly using bcrypt

### Database Storage
Users table stores password references instead of hashes:
- Traditional: `$2b$10$xyz...` (bcrypt hash)
- Secret Manager: `gcp-secret:user-password-123-1735344000000`

## Migration Strategies

### Gradual Migration (Recommended)
- Existing users: Continue with database hashes
- New passwords: Automatically use Secret Manager
- Password changes: Move to Secret Manager

### Full Migration (Advanced)
- Requires custom migration script
- Moves all existing password hashes to Secret Manager
- Updates database references

## Secret Naming Convention

### User Passwords
```
user-password-{userId}-{timestamp}
```
Example: `user-password-123-1735344000000`

### System Secrets
```
certificate-manager-{purpose}
```
Examples:
- `certificate-manager-jwt-secret`
- `certificate-manager-database-url`
- `certificate-manager-gemini-api-key`

## Viewing Passwords in Secret Manager

### GCP Console
1. Go to: https://console.cloud.google.com/security/secret-manager?project=enterprise-certificate-mgmt
2. Look for secrets starting with `user-password-`
3. Click secret name → version → "VIEW SECRET VALUE"
4. You'll see the bcrypt hash (not plain password)

### Command Line
```bash
# List all user passwords
gcloud secrets list --filter="labels.type=user-password"

# View specific user password hash
gcloud secrets versions access latest --secret="user-password-123-1735344000000"

# List passwords for specific user
gcloud secrets list --filter="labels.userId=123"
```

### AWS CLI (v2.0)
```bash
# List all user passwords
aws secretsmanager list-secrets --filters Key=tag-key,Values=type Key=tag-value,Values=user-password

# View specific password hash
aws secretsmanager get-secret-value --secret-id user-password-123-1735344000000
```

## Security Features

### Multi-Layer Security
1. **Passwords never stored in plain text**
2. **Bcrypt hashing with 12 salt rounds**
3. **Secret Manager encryption at rest**
4. **IAM-based access control**
5. **Audit logging for all access**

### Automatic Cleanup
- Old password secrets automatically cleaned up
- Configurable retention (default: keep 1 recent password)
- Prevents secret sprawl

### Access Control
- Service accounts need `secretmanager.admin` role
- Principle of least privilege
- Separate secrets per user

## Provider Switching

### From GCP to AWS (v2.0)
1. Update environment variables:
   ```env
   SECRET_MANAGER_PROVIDER=aws
   AWS_REGION=us-east-1
   ```
2. Restart application
3. New passwords automatically use AWS Secrets Manager
4. Optional: Migrate existing secrets

### From GCP to Azure (v2.0)
1. Update environment variables:
   ```env
   SECRET_MANAGER_PROVIDER=azure
   AZURE_KEYVAULT_NAME=your-vault
   ```
2. Restart application
3. New passwords automatically use Azure Key Vault

## Troubleshooting

### Common Issues

**Secret Manager not available**
- Check if optional dependencies are installed
- Verify service account permissions
- Ensure Secret Manager API is enabled

**Permission denied**
- Grant `secretmanager.admin` role to service account
- Check IAM policy bindings
- Verify service account is correctly configured

**Secrets not appearing**
- Check secret naming convention
- Verify labels are set correctly
- Ensure proper project/region configuration

### Health Check
```bash
# Test Secret Manager connectivity
curl http://your-backend/api/health/secret-manager
```

## Cost Considerations

### GCP Secret Manager
- $0.06 per 10,000 access operations
- $0.03 per active secret version per month
- Free tier: 6 active secret versions

### AWS Secrets Manager
- $0.40 per secret per month
- $0.05 per 10,000 API calls
- No free tier

### Azure Key Vault
- $0.03 per 10,000 operations
- No monthly secret fee
- Free tier: 10,000 operations

## Best Practices

1. **Use environment-specific projects/vaults**
2. **Regular secret rotation policies**
3. **Monitor secret access logs**
4. **Implement proper backup strategies**
5. **Use managed identities where possible**
6. **Audit secret usage regularly**