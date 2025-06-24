#!/bin/bash

# Enterprise Certificate Manager Deployment Script
# This script helps deploy the application to different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Copy environment file if it doesn't exist
    if [ ! -f .env ]; then
        if [ -f env.example ]; then
            cp env.example .env
            print_warning "Created .env file from env.example. Please edit it with your configuration."
        else
            print_error "env.example file not found. Please create a .env file manually."
            exit 1
        fi
    fi
    
    # Create necessary directories
    mkdir -p data uploads logs
    
    print_success "Environment setup complete!"
}

# Function to migrate existing data
migrate_data() {
    print_status "Migrating existing data..."
    
    # Check if old metadata.json exists
    if [ -f metadata.json ]; then
        print_warning "Found existing metadata.json. Backing up..."
        cp metadata.json metadata.json.backup
        
        # TODO: Add migration logic here
        print_warning "Manual migration may be required. Please check the documentation."
    fi
    
    print_success "Data migration complete!"
}

# Function to start preview mode
start_preview() {
    print_status "Starting preview mode (frontend only)..."
    
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    
    # Copy preview environment
    if [ -f env.preview ]; then
        cp env.preview .env.local
    fi
    
    # Start development server
    print_status "Starting frontend in preview mode..."
    print_warning "Preview mode uses mock data - no backend required!"
    print_status "Access the application at: http://localhost:3000"
    print_status "Default login: admin / admin123"
    
    npm run dev
}

# Function to build and start Docker containers
deploy_docker() {
    print_status "Deploying with Docker Compose..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Build and start containers
    docker-compose up -d --build
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        print_success "Docker deployment successful!"
        print_status "Frontend: http://localhost:3000"
        print_status "Backend API: http://localhost:8080"
        print_status "Health check: http://localhost:8080/health"
    else
        print_error "Docker deployment failed. Check logs with: docker-compose logs"
        exit 1
    fi
}

# Function to deploy to AWS Lambda
deploy_aws_lambda() {
    print_status "Deploying to AWS Lambda (Serverless)..."
    
    # Check if serverless is installed
    if ! command -v serverless &> /dev/null; then
        print_error "Serverless Framework is not installed. Please install it first:"
        print_status "npm install -g serverless"
        exit 1
    fi
    
    # Install serverless dependencies
    npm install --save-dev serverless-offline serverless-dotenv-plugin
    
    # Deploy
    serverless deploy --stage production
    
    print_success "AWS Lambda deployment complete!"
}

# Function to deploy to GCP Cloud Run
deploy_gcp_cloud_run() {
    print_status "Deploying to GCP Cloud Run..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud SDK is not installed. Please install it first."
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Get project ID from environment
    PROJECT_ID=${GCP_PROJECT_ID:-$(gcloud config get-value project)}
    if [ -z "$PROJECT_ID" ]; then
        print_error "GCP_PROJECT_ID not set and no default project configured."
        print_status "Please set GCP_PROJECT_ID in your .env file or run: gcloud config set project YOUR_PROJECT_ID"
        exit 1
    fi
    
    # Enable required APIs
    print_status "Enabling required GCP APIs..."
    gcloud services enable run.googleapis.com
    gcloud services enable containerregistry.googleapis.com
    gcloud services enable certificatemanager.googleapis.com
    
    # Configure Docker for GCR
    gcloud auth configure-docker
    
    # Build and push backend image
    print_status "Building and pushing backend image..."
    docker build -t gcr.io/$PROJECT_ID/certificate-manager-backend:latest backend/
    docker push gcr.io/$PROJECT_ID/certificate-manager-backend:latest
    
    # Build and push frontend image
    print_status "Building and pushing frontend image..."
    docker build -t gcr.io/$PROJECT_ID/certificate-manager-frontend:latest frontend/
    docker push gcr.io/$PROJECT_ID/certificate-manager-frontend:latest
    
    # Deploy backend service
    print_status "Deploying backend service..."
    gcloud run deploy certificate-manager-api \
        --image gcr.io/$PROJECT_ID/certificate-manager-backend:latest \
        --platform managed \
        --region ${GCP_LOCATION:-us-central1} \
        --allow-unauthenticated \
        --port 8080 \
        --memory 512Mi \
        --cpu 1 \
        --max-instances 10 \
        --set-env-vars NODE_ENV=production,GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=${GCP_LOCATION:-us-central1},JWT_SECRET=${JWT_SECRET},DATABASE_URL=${DATABASE_URL}
    
    # Get backend URL
    BACKEND_URL=$(gcloud run services describe certificate-manager-api --platform managed --region ${GCP_LOCATION:-us-central1} --format 'value(status.url)')
    
    # Deploy frontend service
    print_status "Deploying frontend service..."
    gcloud run deploy certificate-manager-frontend \
        --image gcr.io/$PROJECT_ID/certificate-manager-frontend:latest \
        --platform managed \
        --region ${GCP_LOCATION:-us-central1} \
        --allow-unauthenticated \
        --port 80 \
        --memory 256Mi \
        --cpu 0.5 \
        --max-instances 5 \
        --set-env-vars VITE_API_URL=$BACKEND_URL,VITE_ENVIRONMENT=gcp-cloud-run
    
    # Get frontend URL
    FRONTEND_URL=$(gcloud run services describe certificate-manager-frontend --platform managed --region ${GCP_LOCATION:-us-central1} --format 'value(status.url)')
    
    print_success "GCP Cloud Run deployment complete!"
    print_status "Frontend: $FRONTEND_URL"
    print_status "Backend API: $BACKEND_URL"
    print_status "Health check: $BACKEND_URL/health"
}

# Function to deploy to VM
deploy_vm() {
    print_status "Deploying to VM with Terraform..."
    
    # Check if terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install Terraform first."
        exit 1
    fi
    
    # Navigate to terraform directory
    cd terraform
    
    # Initialize terraform
    terraform init
    
    # Check if terraform.tfvars exists
    if [ ! -f terraform.tfvars ]; then
        print_warning "terraform.tfvars not found. Please create it with your configuration."
        print_status "Example terraform.tfvars:"
        echo "project_id = \"your-gcp-project-id\""
        echo "region     = \"us-central1\""
        echo "jwt_secret = \"your-super-secret-jwt-key\""
        exit 1
    fi
    
    # Deploy
    terraform plan
    terraform apply -auto-approve
    
    # Get the VM IP
    VM_IP=$(terraform output -raw external_ip)
    print_success "VM deployment complete!"
    print_status "VM IP: $VM_IP"
    print_status "SSH: ssh debian@$VM_IP"
    
    cd ..
}

# Function to show logs
show_logs() {
    print_status "Showing Docker logs..."
    docker-compose logs -f
}

# Function to stop services
stop_services() {
    print_status "Stopping Docker services..."
    docker-compose down
    print_success "Services stopped!"
}

# Function to show help
show_help() {
    echo "Enterprise Certificate Manager Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  preview     Start frontend in preview mode (no backend required)"
    echo "  docker      Deploy using Docker Compose (recommended)"
    echo "  aws-lambda  Deploy to AWS Lambda using Serverless Framework"
    echo "  gcp-cloud-run Deploy to GCP Cloud Run"
    echo "  vm          Deploy to VM using Terraform"
    echo "  setup       Setup environment and migrate data"
    echo "  logs        Show Docker logs"
    echo "  stop        Stop Docker services"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 preview          # Start frontend preview (no backend needed)"
    echo "  $0 setup"
    echo "  $0 docker"
    echo "  $0 aws-lambda"
    echo "  $0 gcp-cloud-run"
    echo "  $0 vm"
    echo ""
    echo "Preview Mode:"
    echo "  - No backend setup required"
    echo "  - Uses mock data for demonstration"
    echo "  - Perfect for testing the UI"
    echo "  - Access at http://localhost:3000"
}

# Main script logic
case "${1:-help}" in
    "preview")
        check_prerequisites
        start_preview
        ;;
    "docker")
        check_prerequisites
        setup_environment
        migrate_data
        deploy_docker
        ;;
    "aws-lambda")
        check_prerequisites
        setup_environment
        migrate_data
        deploy_aws_lambda
        ;;
    "gcp-cloud-run")
        check_prerequisites
        setup_environment
        migrate_data
        deploy_gcp_cloud_run
        ;;
    "vm")
        check_prerequisites
        setup_environment
        migrate_data
        deploy_vm
        ;;
    "setup")
        check_prerequisites
        setup_environment
        migrate_data
        ;;
    "logs")
        show_logs
        ;;
    "stop")
        stop_services
        ;;
    "help"|*)
        show_help
        ;;
esac 