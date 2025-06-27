# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enterprise Certificate Manager is a multi-cloud certificate management system with React/TypeScript frontend and Node.js/Express backend. The system is designed for cloud-agnostic certificate management supporting GCP, AWS, and Azure, with pluggable vault systems for private certificate storage and flexible database backends for metadata management.

**Initial Version**: Deployed on GCP using Cloud Run for both frontend and backend services.

## Development Commands

### Frontend (React 19 + Vite + TypeScript)
```bash
cd frontend
npm install           # Install dependencies
npm run dev           # Start development server (port 3000)
npm run build         # Build for production
npm run build:docker  # Build for Docker deployment
npm run preview       # Preview production build
npm run serve         # Serve built files locally
```

### Backend (Node.js + Express + Multi-DB)
```bash
cd backend
npm install           # Install dependencies
npm run dev           # Start with nodemon (development)
npm start             # Start production server (port 8080)
npm test              # Run Jest tests
npm run build:docker  # Build for Docker deployment
```

### GCP Cloud Run Deployment (Primary)
```bash
./deploy.sh gcp-cloud-run    # Deploy both frontend and backend to GCP Cloud Run
./deploy.sh preview          # Frontend-only with mock data (development)
./deploy.sh docker           # Local Docker Compose testing
```

### Future Multi-Cloud Deployments
```bash
./deploy.sh aws-lambda       # Deploy to AWS Lambda (planned)
./deploy.sh azure            # Deploy to Azure Container Instances (planned)
./deploy.sh vm               # Deploy to VM with Terraform
```

## GCP Cloud Run Architecture (v1.0)

### Initial Deployment Strategy
- **Frontend Service**: React app served via Cloud Run (containerized with nginx)
- **Backend Service**: Node.js API on Cloud Run with auto-scaling
- **Database**: Cloud SQL PostgreSQL for metadata management
- **Vault**: GCP Secret Manager for private certificate storage
- **Certificate Management**: GCP Certificate Manager API integration

### GCP Cloud Run Services
```
GCP Project
├── Cloud Run Services
│   ├── certificate-manager-frontend (port 80)
│   │   ├── React SPA with nginx
│   │   ├── Environment: gcp-cloud-run
│   │   └── Auto-scaling: 0-5 instances
│   └── certificate-manager-api (port 8080)
│       ├── Node.js Express API
│       ├── GCP integrations enabled
│       └── Auto-scaling: 0-10 instances
├── Cloud SQL
│   └── PostgreSQL instance for metadata
├── Secret Manager
│   └── Private certificate storage
└── Certificate Manager
    └── SSL certificate management
```

### GCP Services Required
```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable certificatemanager.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Multi-Cloud Architecture (Future)

### Planned Cloud Provider Support
- **GCP** (v1.0): Certificate Manager, Cloud SQL, Secret Manager, Cloud Run
- **AWS** (v2.0): Certificate Manager, RDS, Secrets Manager, Lambda/ECS
- **Azure** (v3.0): Key Vault, Azure Database, Container Instances

### Database Backends (Metadata Management)
- **GCP v1.0**: Cloud SQL PostgreSQL (primary)
- **Future**: Multi-cloud database support
  - AWS RDS (PostgreSQL/MySQL)
  - Azure Database for PostgreSQL
  - SQLite (development only)

### Vault Systems (Private Certificate Storage)
- **GCP v1.0**: GCP Secret Manager (primary)
- **Future Multi-Vault Support**:
  - HashiCorp Vault (enterprise)
  - AWS Secrets Manager
  - Azure Key Vault
  - AWS Systems Manager Parameter Store

## Environment Configuration

### GCP Cloud Run Environment (v1.0)
```bash
# GCP Configuration (Primary)
CLOUD_PROVIDER=gcp
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GCP_SERVICE_ACCOUNT_KEY=path-to-service-account.json

# Database (Cloud SQL PostgreSQL)
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@cloud-sql-proxy/certificates
DATABASE_HOST=cloud-sql-instance-ip
DATABASE_NAME=certificates
DATABASE_USER=postgres-user
DATABASE_PASSWORD=stored-in-secret-manager

# Vault (GCP Secret Manager)
VAULT_PROVIDER=gcp-secret-manager
GCP_SECRET_PROJECT_ID=your-project-id

# Cloud Run Specific
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://frontend-cloud-run-url

# JWT Configuration
JWT_SECRET=stored-in-secret-manager
```

### Frontend Environment (GCP Cloud Run)
```bash
# Frontend specific for GCP Cloud Run
VITE_API_URL=https://api-cloud-run-url
VITE_CLOUD_PROVIDER=gcp
VITE_ENVIRONMENT=gcp-cloud-run
VITE_FEATURES=gcp-integration
```

### Future Multi-Cloud Environment Variables
```bash
# Multi-Cloud Provider Selection (v2.0+)
CLOUD_PROVIDER=gcp|aws|azure
VAULT_PROVIDER=gcp-secret-manager|aws-secrets-manager|azure-key-vault|hashicorp

# Database Flexibility
DATABASE_TYPE=postgresql|mysql
DATABASE_URL=cloud-specific-connection-string

# AWS Configuration (Future)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=access-key
AWS_SECRET_ACCESS_KEY=secret-key

# Azure Configuration (Future)
AZURE_TENANT_ID=tenant-id
AZURE_CLIENT_ID=client-id
AZURE_CLIENT_SECRET=client-secret
```

## Architecture

### Frontend Structure (Cloud Run Optimized)
- **React 19** with TypeScript, optimized for containerized deployment
- **Build Process**: Multi-stage Docker build with nginx serving
- **State Management**: React Query for server state
- **Cloud Integration**: GCP-specific API integrations in v1.0
- **Performance**: Optimized for Cloud Run cold starts

### Backend Structure (Cloud Run Native)
- **Express.js** API designed for serverless/container deployment
- **Cold Start Optimization**: Minimal initialization time for Cloud Run
- **GCP Native Integration**: Direct integration with GCP services
- **Auto-scaling**: Configured for Cloud Run's scaling characteristics
- **Health Checks**: Cloud Run compatible health endpoints

### GCP Service Integration (v1.0)
```
backend/src/services/
├── gcp/
│   ├── certificateService.js     # GCP Certificate Manager
│   ├── secretService.js          # GCP Secret Manager
│   ├── databaseService.js        # Cloud SQL connection
│   └── cloudRunService.js        # Cloud Run specific utilities
├── database/
│   ├── cloudSqlAdapter.js        # Cloud SQL PostgreSQL adapter
│   └── migrations/               # Database migrations
└── vault/
    └── gcpSecretManager.js       # GCP Secret Manager integration
```

## Database Schema (GCP Cloud SQL)

Optimized for Cloud SQL PostgreSQL:
```sql
-- Core tables for v1.0
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    gcp_certificate_id VARCHAR(255),
    secret_manager_path VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES folders(id),
    permissions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## GCP Cloud Run Deployment

### Deployment Process
```bash
# 1. Build and push container images
docker build -t gcr.io/$PROJECT_ID/certificate-manager-backend:latest backend/
docker build -t gcr.io/$PROJECT_ID/certificate-manager-frontend:latest frontend/

# 2. Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/certificate-manager-backend:latest
docker push gcr.io/$PROJECT_ID/certificate-manager-frontend:latest

# 3. Deploy to Cloud Run
gcloud run deploy certificate-manager-api \
  --image gcr.io/$PROJECT_ID/certificate-manager-backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

gcloud run deploy certificate-manager-frontend \
  --image gcr.io/$PROJECT_ID/certificate-manager-frontend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Cloud Run Configuration
- **Memory**: Backend 512Mi, Frontend 256Mi
- **CPU**: Backend 1 vCPU, Frontend 0.5 vCPU
- **Concurrency**: Backend 80, Frontend 100
- **Timeout**: 300 seconds
- **Auto-scaling**: 0 to 10 instances (backend), 0 to 5 instances (frontend)

## Development Workflow

### GCP-First Development (v1.0)
1. **Local Development**: Use `npm run dev` with GCP service emulators
2. **GCP Testing**: Deploy to Cloud Run development environment
3. **Production**: Deploy to Cloud Run production environment

### Testing Strategy
```bash
# Local development with GCP emulators
gcloud beta emulators datastore start
gcloud beta emulators pubsub start

# Test GCP integrations locally
npm run dev  # Uses GCP emulators

# Deploy to Cloud Run staging
./deploy.sh gcp-cloud-run staging

# Deploy to Cloud Run production
./deploy.sh gcp-cloud-run production
```

## Security Considerations (GCP-Focused)

- **IAM**: Cloud Run service accounts with minimal required permissions
- **Secret Management**: All secrets stored in GCP Secret Manager
- **Network Security**: VPC connector for private Cloud SQL access
- **SSL/TLS**: Automatic HTTPS with managed certificates
- **Authentication**: JWT with secrets managed by Secret Manager

## Performance Optimization (Cloud Run)

- **Container Optimization**: Multi-stage builds for minimal image size
- **Cold Start Mitigation**: Keep-alive requests and optimized initialization
- **Database Connections**: Connection pooling for Cloud SQL
- **Caching**: Redis cache for frequently accessed data (future)

## Monitoring and Logging (GCP)

- **Cloud Monitoring**: CPU, memory, and request metrics
- **Cloud Logging**: Structured logging with correlation IDs
- **Error Reporting**: Automatic error detection and alerting
- **Tracing**: Cloud Trace for request performance analysis

## Future Multi-Cloud Roadmap

### Version 2.0 - AWS Support
- Lambda/ECS deployment options
- AWS Certificate Manager integration
- RDS database support
- AWS Secrets Manager integration

### Version 3.0 - Azure Support
- Azure Container Instances deployment
- Azure Key Vault integration
- Azure Database for PostgreSQL
- Azure App Configuration

### Version 4.0 - Hybrid Multi-Cloud
- Cross-cloud certificate replication
- Multi-cloud disaster recovery
- Unified monitoring across clouds
- Cost optimization recommendations