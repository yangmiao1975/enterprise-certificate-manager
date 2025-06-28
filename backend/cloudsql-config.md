# Cloud SQL PostgreSQL Configuration Guide

This document explains how to configure Cloud SQL PostgreSQL for enterprise certificate management with high availability.

## Cloud SQL Instance Setup

### 1. Create Cloud SQL Instance

```bash
# Create highly available Cloud SQL PostgreSQL instance
gcloud sql instances create certificate-manager-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-8192 \
  --region=us-central1 \
  --availability-type=ZONAL \
  --storage-type=SSD \
  --storage-size=100GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --maintenance-release-channel=production \
  --deletion-protection

# For High Availability (Enterprise Production)
gcloud sql instances create certificate-manager-db-ha \
  --database-version=POSTGRES_15 \
  --tier=db-custom-4-16384 \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --storage-type=SSD \
  --storage-size=200GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --maintenance-release-channel=production \
  --deletion-protection
```

### 2. Create Database and User

```bash
# Create database
gcloud sql databases create certificate_manager \
  --instance=certificate-manager-db

# Create application user
gcloud sql users create cert_manager_app \
  --instance=certificate-manager-db \
  --password=YOUR_SECURE_PASSWORD
```

### 3. Configure Connection Security

```bash
# Get connection name
gcloud sql instances describe certificate-manager-db \
  --format="value(connectionName)"

# Enable private IP (recommended for production)
gcloud sql instances patch certificate-manager-db \
  --network=projects/YOUR_PROJECT/global/networks/default \
  --no-assign-ip

# Or configure authorized networks for public IP
gcloud sql instances patch certificate-manager-db \
  --authorized-networks=0.0.0.0/0
```

## Environment Configuration

### Development Environment (.env.development)

```env
# Database Configuration
DATABASE_PROVIDER=sqlite
SQLITE_DATABASE=./data/certificates.db

# Cloud SQL connection (for testing)
CLOUDSQL_CONNECTION_NAME=enterprise-certificate-mgmt:us-central1:certificate-manager-db
CLOUDSQL_HOST=/cloudsql/enterprise-certificate-mgmt:us-central1:certificate-manager-db
CLOUDSQL_PORT=5432
CLOUDSQL_USERNAME=cert_manager_app
CLOUDSQL_PASSWORD=your_secure_password
CLOUDSQL_DATABASE=certificate_manager

# Connection Pooling
DB_CONNECTION_POOL_MAX=10
DB_CONNECTION_POOL_MIN=2
DB_CONNECTION_IDLE_TIMEOUT=10000
DB_CONNECTION_ACQUIRE_TIMEOUT=60000
DB_CONNECTION_EVICT_TIMEOUT=1000
```

### Production Environment (Cloud Run)

```env
# Database Configuration
DATABASE_PROVIDER=gcp-cloudsql
NODE_ENV=production

# Cloud SQL Configuration
CLOUDSQL_CONNECTION_NAME=enterprise-certificate-mgmt:us-central1:certificate-manager-db
CLOUDSQL_HOST=/cloudsql/enterprise-certificate-mgmt:us-central1:certificate-manager-db
CLOUDSQL_PORT=5432
CLOUDSQL_USERNAME=cert_manager_app
CLOUDSQL_DATABASE=certificate_manager

# Connection Pooling for Enterprise Scale
DB_CONNECTION_POOL_MAX=20
DB_CONNECTION_POOL_MIN=5
DB_CONNECTION_IDLE_TIMEOUT=10000
DB_CONNECTION_ACQUIRE_TIMEOUT=60000
DB_CONNECTION_EVICT_TIMEOUT=1000

# High Availability (if using read replicas)
CLOUDSQL_READ_REPLICAS=replica1-host,replica2-host

# Security
GOOGLE_CLOUD_PROJECT=enterprise-certificate-mgmt
```

### Version 2.0 - AWS RDS Configuration

```env
# Database Configuration
DATABASE_PROVIDER=aws-rds
NODE_ENV=production

# AWS RDS Configuration
RDS_ENDPOINT=certificate-manager.cluster-xyz.us-east-1.rds.amazonaws.com
RDS_PORT=5432
RDS_USERNAME=cert_manager_app
RDS_DATABASE=certificate_manager

# AWS RDS Connection Pooling
AWS_RDS_CONNECTION_POOL_MAX=20
AWS_RDS_CONNECTION_POOL_MIN=5
AWS_RDS_CONNECTION_IDLE_TIMEOUT=10000
AWS_RDS_CONNECTION_ACQUIRE_TIMEOUT=60000

# High Availability
AWS_RDS_READ_REPLICAS=replica1.us-east-1.rds.amazonaws.com,replica2.us-east-1.rds.amazonaws.com

# Security
AWS_REGION=us-east-1
AWS_RDS_CA_CERT=/path/to/rds-ca-2019-root.pem
```

## Secret Manager Configuration

### Store Database Credentials in Secret Manager

```bash
# Create database password secret
echo -n "your_secure_password" | gcloud secrets create certificate-manager-db-password --data-file=-

# Create database URL secret (for quick switching)
echo -n "postgresql://cert_manager_app:password@/cloudsql/enterprise-certificate-mgmt:us-central1:certificate-manager-db:5432/certificate_manager" | \
  gcloud secrets create certificate-manager-database-url --data-file=-

# For Cloud Run, you can reference secrets directly
CLOUDSQL_PASSWORD="$(gcloud secrets versions access latest --secret=certificate-manager-db-password)"
```

## Cloud Run Configuration Updates

### Update cloudbuild.yaml for Cloud SQL

```yaml
# Add Cloud SQL configuration to Cloud Run deployment
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
    [
      'run', 'deploy', '${_BACKEND_SERVICE}',
      '--image', 'gcr.io/$PROJECT_ID/${_BACKEND_SERVICE}:$COMMIT_SHA',
      '--platform', 'managed',
      '--region', '${_REGION}',
      '--allow-unauthenticated',
      '--port', '8080',
      '--memory', '1Gi',
      '--cpu', '2',
      '--add-cloudsql-instances', 'enterprise-certificate-mgmt:us-central1:certificate-manager-db',
      '--set-env-vars', 'NODE_ENV=production,DATABASE_PROVIDER=gcp-cloudsql,CLOUDSQL_CONNECTION_NAME=enterprise-certificate-mgmt:us-central1:certificate-manager-db,CLOUDSQL_HOST=/cloudsql/enterprise-certificate-mgmt:us-central1:certificate-manager-db,CLOUDSQL_PORT=5432,CLOUDSQL_USERNAME=cert_manager_app,CLOUDSQL_DATABASE=certificate_manager',
      '--set-secrets', 'CLOUDSQL_PASSWORD=certificate-manager-db-password:latest,JWT_SECRET=certificate-manager-jwt-secret:latest,GEMINI_API_KEY=certificate-manager-gemini-api-key:latest,GOOGLE_CLIENT_ID=certificate-manager-google-client-id:latest,GOOGLE_CLIENT_SECRET=certificate-manager-google-client-secret:latest',
      '--service-account', '1044697249626-compute@developer.gserviceaccount.com'
    ]
```

## Database Migration Process

### 1. Development to Cloud SQL Migration

```bash
# Set environment for migration
export DATABASE_PROVIDER=sqlite
export CLOUDSQL_CONNECTION_NAME=enterprise-certificate-mgmt:us-central1:certificate-manager-db
export CLOUDSQL_HOST=/cloudsql/enterprise-certificate-mgmt:us-central1:certificate-manager-db
export CLOUDSQL_USERNAME=cert_manager_app
export CLOUDSQL_PASSWORD=$(gcloud secrets versions access latest --secret=certificate-manager-db-password)
export CLOUDSQL_DATABASE=certificate_manager

# Run migration script
node src/database/migrate-to-cloudsql.js
```

### 2. Switching Database Providers at Runtime

```javascript
// Switch from SQLite to Cloud SQL
const dbService = new DatabaseService();
await dbService.switchProvider('gcp-cloudsql');

// Switch to AWS RDS (Version 2.0)
await dbService.switchProvider('aws-rds');
```

## Performance Optimization

### Connection Pooling Configuration

```env
# Production optimized settings
DB_CONNECTION_POOL_MAX=20        # Maximum connections
DB_CONNECTION_POOL_MIN=5         # Minimum connections
DB_CONNECTION_IDLE_TIMEOUT=10000 # 10 seconds
DB_CONNECTION_ACQUIRE_TIMEOUT=60000 # 60 seconds
DB_CONNECTION_EVICT_TIMEOUT=1000 # 1 second
```

### Database Indexing

The system automatically creates optimized indexes:

```sql
-- Performance indexes
CREATE INDEX idx_certificates_folder ON certificates(folder_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_valid_to ON certificates(valid_to);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_folders_type ON folders(type);
```

## Monitoring and Health Checks

### Database Health Check Endpoint

```bash
# Test database connectivity
curl http://your-backend/api/health/database

# Response
{
  "status": "healthy",
  "provider": "gcp-cloudsql",
  "connection": "active",
  "response_time": "15ms"
}
```

### Cloud SQL Monitoring

```bash
# Monitor Cloud SQL metrics
gcloud sql operations list --instance=certificate-manager-db
gcloud sql instances describe certificate-manager-db
```

## Backup and Recovery

### Automated Backups

```bash
# Configure automated backups
gcloud sql instances patch certificate-manager-db \
  --backup-start-time=03:00 \
  --backup-location=us-central1 \
  --retained-backups-count=30

# Manual backup
gcloud sql backups create --instance=certificate-manager-db
```

### Point-in-Time Recovery

```bash
# Restore to specific point in time
gcloud sql instances clone certificate-manager-db certificate-manager-db-restore \
  --point-in-time=2024-01-15T10:30:00Z
```

## Security Best Practices

### 1. Network Security

- Use private IP for production instances
- Configure VPC firewall rules
- Enable SSL connections only

### 2. Access Control

```bash
# Create read-only user for reporting
gcloud sql users create cert_manager_readonly \
  --instance=certificate-manager-db \
  --password=readonly_password

# Grant minimal permissions
gcloud sql databases sql --instance=certificate-manager-db \
  --query="GRANT SELECT ON ALL TABLES IN SCHEMA public TO cert_manager_readonly;"
```

### 3. Encryption

- Data at rest: Automatically encrypted
- Data in transit: Force SSL connections
- Application-level: Store sensitive data in Secret Manager

## Cost Optimization

### Development/Testing

- Use `db-f1-micro` or `db-g1-small` instances
- Enable automatic storage increase
- Use scheduled backups only

### Production

- Use `db-custom` instances sized for your workload
- Enable high availability for critical workloads
- Consider read replicas for read-heavy workloads
- Monitor and optimize connection pooling

### Cost Monitoring

```bash
# Monitor costs
gcloud billing projects link YOUR_PROJECT --billing-account=YOUR_BILLING_ACCOUNT
gcloud alpha billing budgets list
```

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check firewall rules
   - Verify connection string
   - Check Cloud SQL Auth Proxy

2. **Permission Denied**
   - Verify database user permissions
   - Check Cloud Run service account permissions
   - Ensure Cloud SQL API is enabled

3. **SSL Errors**
   - Download latest SSL certificates
   - Verify SSL configuration
   - Check certificate expiration

### Debug Commands

```bash
# Test connection from Cloud Run
gcloud run services proxy certificate-manager-api --port=8080
curl http://localhost:8080/api/health/database

# Check logs
gcloud run services logs read certificate-manager-api --limit=50

# Verify Cloud SQL status
gcloud sql instances list
gcloud sql operations list --instance=certificate-manager-db
```

## Version 2.0 Migration to AWS

When migrating to AWS RDS in version 2.0:

1. Create AWS RDS PostgreSQL instance
2. Update environment variables
3. Use the same migration script with AWS provider
4. Update IAM roles and security groups
5. Configure read replicas if needed

The flexible database configuration ensures smooth migration between cloud providers while maintaining data integrity and performance.