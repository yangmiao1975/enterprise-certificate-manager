# Enterprise Certificate Manager

A comprehensive certificate management system with support for multiple deployment options including Docker, Serverless, and VM deployments. The system integrates with Google Cloud Platform Certificate Manager and provides a modern web interface for managing enterprise certificates.

## 🏗️ Architecture

### Frontend
- **React 19** with TypeScript
- **Vite** for fast development and optimized builds
- **React Query** for server state management
- **React Hook Form** for form handling
- **Modern UI** with responsive design
- **Preview Mode** - Run frontend without backend using mock data

### Backend
- **Node.js** with Express.js
- **SQLite** database for metadata storage
- **JWT** authentication with role-based access control
- **GCP Certificate Manager** integration for certificate storage
- **RESTful API** with comprehensive validation

## 🚀 Quick Start - Preview Mode (No Backend Required!)

The fastest way to see the application in action without setting up any backend:

```bash
# Start preview mode (frontend only with mock data)
./deploy.sh preview
```

This will:
- Start the frontend on http://localhost:3000
- Use mock data for all functionality
- No backend setup required
- Perfect for testing the UI and features

**Default login:** `admin` / `admin123`

## 🚀 Deployment Options

### 1. Docker Deployment (Recommended)

The easiest way to deploy the entire application using Docker Compose.

#### Prerequisites
- Docker and Docker Compose installed
- GCP project with Certificate Manager enabled
- GCP service account with appropriate permissions

#### Quick Start
```bash
# Clone the repository
git clone <repository-url>
cd enterprise-certificate-manager

# Copy environment file
cp env.example .env

# Edit environment variables
nano .env

# Start the application
docker-compose up -d

# Access the application
open http://localhost:3000
```

#### Environment Variables for Docker
```bash
# GCP Configuration
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key

# Server Configuration
PORT=8080
NODE_ENV=production
CORS_ORIGIN=http://localhost:3000
```

### 2. AWS Lambda Deployment

Deploy to AWS Lambda using the Serverless Framework for auto-scaling and pay-per-use pricing.

#### Prerequisites
- AWS CLI configured
- Serverless Framework installed
- GCP project with Certificate Manager enabled

#### Deployment Steps
```bash
# Install serverless dependencies
npm install -g serverless
npm install --save-dev serverless-offline serverless-dotenv-plugin

# Configure environment
cp env.example .env
# Edit .env with your configuration

# Deploy to AWS
./deploy.sh aws-lambda

# Deploy frontend to S3/CloudFront
npm run build:serverless
aws s3 sync frontend/dist s3://your-bucket-name
```

#### Serverless Configuration
The `serverless.yml` file configures:
- Lambda functions for API and frontend
- API Gateway for HTTP endpoints
- IAM roles and permissions
- Environment variables

### 3. GCP Cloud Run Deployment

Deploy to Google Cloud Run for serverless containerized applications.

#### Prerequisites
- Google Cloud SDK installed
- Docker installed
- GCP project with required APIs enabled

#### Deployment Steps
```bash
# Configure environment
cp env.example .env
# Edit .env with your GCP configuration

# Deploy to GCP Cloud Run
./deploy.sh gcp-cloud-run
```

#### Cloud Run Features
- Auto-scaling containers
- Pay-per-use pricing
- HTTPS by default
- Global load balancing
- Automatic health checks

### 4. VM Deployment (Google Cloud)

Deploy to a Google Cloud VM using Terraform for infrastructure as code.

#### Prerequisites
- Google Cloud SDK installed
- Terraform installed
- SSH key pair generated

#### Deployment Steps
```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Create terraform.tfvars file
cat > terraform.tfvars << EOF
project_id = "your-gcp-project-id"
region     = "us-central1"
jwt_secret = "your-super-secret-jwt-key"
EOF

# Deploy infrastructure
./deploy.sh vm

# Get the VM IP address
terraform output external_ip

# SSH to the VM and check the application
ssh debian@<VM_IP>
docker ps
```

## 🔧 Configuration

### GCP Certificate Manager Setup

1. **Enable Certificate Manager API**
```bash
gcloud services enable certificatemanager.googleapis.com
```

2. **Create Service Account**
```bash
gcloud iam service-accounts create certificate-manager \
    --display-name="Certificate Manager Service Account"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:certificate-manager@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/certificatemanager.admin"
```

3. **Download Service Account Key**
```bash
gcloud iam service-accounts keys create key.json \
    --iam-account=certificate-manager@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### Database Configuration

The application uses SQLite by default, but you can configure other databases:

```bash
# For PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/certificates

# For MySQL
DATABASE_URL=mysql://user:password@localhost:3306/certificates
```

## 📁 Project Structure

```
enterprise-certificate-manager/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API services (real + mock)
│   │   ├── utils/           # Utility functions
│   │   ├── types/           # TypeScript types
│   │   └── main.tsx         # Application entry point
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── env.*               # Environment configurations
├── backend/                  # Node.js backend API
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Express middleware
│   │   ├── services/        # Business logic
│   │   ├── database/        # Database initialization
│   │   └── utils/           # Utility functions
│   ├── package.json
│   └── Dockerfile
├── terraform/               # Infrastructure as Code
│   └── main.tf
├── docker-compose.yml       # Docker Compose configuration
├── serverless.yml          # Serverless Framework configuration
├── gcp-cloud-run.yml       # GCP Cloud Run configuration
├── deploy.sh               # Deployment script
├── migrate-frontend.sh     # Frontend migration script
├── env.example             # Environment variables template
└── README.md
```

## 🔐 Authentication & Authorization

### Default Users
- **Admin**: `admin` / `admin123` (Full system access)
- **Manager**: `manager` / `manager123` (Certificate and folder management)
- **Viewer**: `viewer` / `viewer123` (Read-only access)

### Roles and Permissions

| Role | Permissions |
|------|-------------|
| Admin | Full system access, user management, system settings |
| Manager | Certificate management, folder management, notifications |
| Viewer | Read-only access to certificates and folders |

## 📊 Features

### Certificate Management
- Upload certificates (PEM format)
- View certificate details and status
- Download certificates
- Renew certificates
- Delete certificates
- Search and filter certificates

### Folder Organization
- Create custom folders
- Organize certificates by folders
- Set folder permissions
- Access control by roles and users

### User Management
- Create and manage users
- Role-based access control
- Password management
- User activity tracking

### System Monitoring
- Certificate expiration monitoring
- System health checks
- Usage statistics
- Audit logging

## 🔧 Development

### Local Development
```bash
# Start backend
cd backend
npm install
npm run dev

# Start frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Frontend Migration
If you have existing frontend code, use the migration script:

```bash
# Migrate existing frontend to new structure
./migrate-frontend.sh

# Then start preview mode
./deploy.sh preview
```

### Building for Production
```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd backend
npm run build
```

### Testing
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 🚨 Security Considerations

1. **Environment Variables**: Never commit sensitive information to version control
2. **JWT Secrets**: Use strong, unique JWT secrets in production
3. **GCP Permissions**: Follow the principle of least privilege for service accounts
4. **HTTPS**: Always use HTTPS in production environments
5. **Database Security**: Use encrypted connections and secure database credentials

## 📈 Monitoring and Logging

### Health Checks
- Backend: `GET /health`
- Frontend: Built-in health check endpoint

### Logging
- Application logs are written to stdout/stderr
- Docker logs: `docker-compose logs -f`
- Cloud logging integration available for GCP/AWS

### Metrics
- Certificate counts by status
- User activity metrics
- System performance metrics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation
- Review the troubleshooting guide

## 🔄 Updates and Maintenance

### Regular Maintenance Tasks
- Monitor certificate expirations
- Review and rotate JWT secrets
- Update dependencies
- Backup database
- Monitor system health

### Backup Strategy
- Database backups (SQLite files or database dumps)
- Configuration backups
- Certificate backups (stored in GCP)
- User data backups
