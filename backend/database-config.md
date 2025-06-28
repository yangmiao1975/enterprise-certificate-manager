# Database Configuration Guide

This document explains how to configure different database backends for the Enterprise Certificate Manager.

## Supported Database Types

### 1. SQLite (Default - Development)
```env
DB_TYPE=sqlite
DATABASE_URL=./data/certificates.db
```

### 2. PostgreSQL (Production)
```env
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=certificate_manager
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_SSL=false
```

### 3. Google Cloud SQL - PostgreSQL
```env
DB_TYPE=cloud-sql-postgres
DB_INSTANCE_CONNECTION_NAME=project:region:instance
DB_NAME=certificate_manager
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

### 4. Google Cloud SQL - MySQL
```env
DB_TYPE=cloud-sql-mysql
DB_INSTANCE_CONNECTION_NAME=project:region:instance
DB_NAME=certificate_manager
DB_USERNAME=root
DB_PASSWORD=your_password
```

### 5. Google Cloud Spanner
```env
DB_TYPE=spanner
GOOGLE_CLOUD_PROJECT=your-project-id
SPANNER_INSTANCE=your-instance
DB_NAME=certificate-manager-db
```

### 6. MySQL (Standalone)
```env
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=certificate_manager
DB_USERNAME=root
DB_PASSWORD=your_password
DB_SSL=false
```

## Connection Pooling Configuration

```env
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE=10000
```

## Password Security Configuration

### Enable GCP Secret Manager for Passwords
```env
USE_SECRET_MANAGER_PASSWORDS=true
GOOGLE_CLOUD_PROJECT=your-project-id
```

### Disable (Use Traditional Hashing)
```env
USE_SECRET_MANAGER_PASSWORDS=false
```

## Environment-Specific Configurations

### Local Development
```env
# .env.local
DB_TYPE=sqlite
DATABASE_URL=./data/certificates.db
USE_SECRET_MANAGER_PASSWORDS=false
```

### GCP Cloud Run
```env
# Set via Cloud Run environment variables
DB_TYPE=cloud-sql-postgres
DB_INSTANCE_CONNECTION_NAME=enterprise-certificate-mgmt:us-central1:cert-manager-db
DB_NAME=certificate_manager
DB_USERNAME=postgres
# DB_PASSWORD set via Secret Manager
USE_SECRET_MANAGER_PASSWORDS=true
GOOGLE_CLOUD_PROJECT=enterprise-certificate-mgmt
```

### AWS/Azure (Future)
```env
# PostgreSQL on AWS RDS
DB_TYPE=postgresql
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=certificate_manager
DB_USERNAME=postgres
# Password via AWS Secrets Manager or Azure Key Vault
```

## Migration Guide

### 1. From SQLite to PostgreSQL

1. **Set up PostgreSQL database:**
```sql
CREATE DATABASE certificate_manager;
CREATE USER cert_manager WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE certificate_manager TO cert_manager;
```

2. **Update environment variables:**
```env
DB_TYPE=postgresql
DB_HOST=your-postgres-host
DB_PORT=5432
DB_NAME=certificate_manager
DB_USERNAME=cert_manager
DB_PASSWORD=secure_password
```

3. **Restart application** - tables will be created automatically

### 2. From Traditional Passwords to Secret Manager

1. **Enable Secret Manager:**
```env
USE_SECRET_MANAGER_PASSWORDS=true
GOOGLE_CLOUD_PROJECT=your-project-id
```

2. **Grant Secret Manager permissions:**
```bash
# For Cloud Run service account
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:your-service-account@your-project-id.iam.gserviceaccount.com" \
    --role="roles/secretmanager.admin"
```

3. **Restart application** - new passwords will use Secret Manager

## Database Schema

The application automatically creates the following tables:
- `users` - User accounts and authentication
- `roles` - User roles (admin, manager, viewer)
- `role_permissions` - Role-based permissions
- `certificates` - SSL/TLS certificate metadata
- `folders` - Certificate organization

## Required Dependencies

Install additional dependencies based on your database choice:

```bash
# PostgreSQL
npm install pg

# MySQL
npm install mysql2

# Google Cloud Spanner
npm install @google-cloud/spanner

# Google Cloud Secret Manager
npm install @google-cloud/secret-manager
```

## Security Best Practices

1. **Never commit database passwords** to version control
2. **Use Secret Manager** for production password storage
3. **Enable SSL/TLS** for database connections in production
4. **Use connection pooling** for better performance
5. **Regular password rotation** using the PasswordService
6. **Monitor Secret Manager access** logs

## Troubleshooting

### Connection Issues
- Verify firewall rules for database connections
- Check SSL/TLS certificate validity
- Ensure service account has proper IAM permissions

### Secret Manager Issues
- Verify `GOOGLE_CLOUD_PROJECT` is set correctly
- Check service account has `secretmanager.admin` role
- Ensure Secret Manager API is enabled

### Performance Issues
- Adjust connection pool settings
- Monitor database query performance
- Consider read replicas for high traffic