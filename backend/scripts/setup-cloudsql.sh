#!/bin/bash

# Cloud SQL PostgreSQL Setup Script for Enterprise Certificate Manager
# This script creates a high-availability Cloud SQL instance with proper security

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-enterprise-certificate-mgmt}"
REGION="${CLOUDSQL_REGION:-us-central1}"
INSTANCE_NAME="${CLOUDSQL_INSTANCE_NAME:-certificate-manager-db}"
DATABASE_NAME="${CLOUDSQL_DATABASE:-certificate_manager}"
DB_USER="${CLOUDSQL_USERNAME:-cert_manager_app}"
TIER="${CLOUDSQL_TIER:-db-custom-2-8192}"
STORAGE_SIZE="${CLOUDSQL_STORAGE_SIZE:-100GB}"
BACKUP_TIME="${CLOUDSQL_BACKUP_TIME:-03:00}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gcloud is installed and authenticated
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "Not authenticated with gcloud. Run 'gcloud auth login' first."
        exit 1
    fi
    
    # Set project
    gcloud config set project "$PROJECT_ID"
    log_success "Prerequisites checked. Project: $PROJECT_ID"
}

# Enable required APIs
enable_apis() {
    log_info "Enabling required APIs..."
    
    apis=(
        "sqladmin.googleapis.com"
        "secretmanager.googleapis.com"
        "run.googleapis.com"
        "cloudbuild.googleapis.com"
    )
    
    for api in "${apis[@]}"; do
        log_info "Enabling $api..."
        gcloud services enable "$api" --quiet
    done
    
    log_success "Required APIs enabled"
}

# Create Cloud SQL instance
create_cloudsql_instance() {
    log_info "Creating Cloud SQL PostgreSQL instance: $INSTANCE_NAME"
    
    # Check if instance already exists
    if gcloud sql instances describe "$INSTANCE_NAME" &>/dev/null; then
        log_warning "Cloud SQL instance '$INSTANCE_NAME' already exists."
        return 0
    fi
    
    # Determine availability type based on environment
    AVAILABILITY_TYPE="ZONAL"
    if [[ "${NODE_ENV:-production}" == "production" ]]; then
        AVAILABILITY_TYPE="REGIONAL"
        log_info "Production environment detected, using REGIONAL availability"
    fi
    
    # Create the instance
    gcloud sql instances create "$INSTANCE_NAME" \
        --database-version=POSTGRES_15 \
        --tier="$TIER" \
        --region="$REGION" \
        --availability-type="$AVAILABILITY_TYPE" \
        --storage-type=SSD \
        --storage-size="$STORAGE_SIZE" \
        --storage-auto-increase \
        --backup-start-time="$BACKUP_TIME" \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=04 \
        --maintenance-release-channel=production \
        --deletion-protection \
        --quiet
    
    log_success "Cloud SQL instance created: $INSTANCE_NAME"
}

# Create database
create_database() {
    log_info "Creating database: $DATABASE_NAME"
    
    # Check if database exists
    if gcloud sql databases describe "$DATABASE_NAME" --instance="$INSTANCE_NAME" &>/dev/null; then
        log_warning "Database '$DATABASE_NAME' already exists."
        return 0
    fi
    
    gcloud sql databases create "$DATABASE_NAME" \
        --instance="$INSTANCE_NAME" \
        --quiet
    
    log_success "Database created: $DATABASE_NAME"
}

# Create database user
create_database_user() {
    log_info "Creating database user: $DB_USER"
    
    # Generate secure password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Check if user exists
    if gcloud sql users describe "$DB_USER" --instance="$INSTANCE_NAME" &>/dev/null; then
        log_warning "Database user '$DB_USER' already exists."
        
        # Update password
        gcloud sql users set-password "$DB_USER" \
            --instance="$INSTANCE_NAME" \
            --password="$DB_PASSWORD" \
            --quiet
        
        log_info "Password updated for user: $DB_USER"
    else
        # Create user
        gcloud sql users create "$DB_USER" \
            --instance="$INSTANCE_NAME" \
            --password="$DB_PASSWORD" \
            --quiet
        
        log_success "Database user created: $DB_USER"
    fi
    
    # Store password in Secret Manager
    echo -n "$DB_PASSWORD" | gcloud secrets create certificate-manager-db-password \
        --data-file=- \
        --replication-policy="automatic" \
        --quiet 2>/dev/null || \
    echo -n "$DB_PASSWORD" | gcloud secrets versions add certificate-manager-db-password \
        --data-file=- \
        --quiet
    
    log_success "Database password stored in Secret Manager"
}

# Configure networking
configure_networking() {
    log_info "Configuring networking..."
    
    # Get current instance info
    INSTANCE_INFO=$(gcloud sql instances describe "$INSTANCE_NAME" --format="json")
    CONNECTION_NAME=$(echo "$INSTANCE_INFO" | jq -r '.connectionName')
    
    log_info "Connection name: $CONNECTION_NAME"
    
    # Store connection info in Secret Manager
    echo -n "$CONNECTION_NAME" | gcloud secrets create certificate-manager-cloudsql-connection \
        --data-file=- \
        --replication-policy="automatic" \
        --quiet 2>/dev/null || \
    echo -n "$CONNECTION_NAME" | gcloud secrets versions add certificate-manager-cloudsql-connection \
        --data-file=- \
        --quiet
    
    log_success "Connection information stored in Secret Manager"
}

# Create database URL secret
create_database_url_secret() {
    log_info "Creating database URL secret..."
    
    CONNECTION_NAME=$(gcloud secrets versions access latest --secret="certificate-manager-cloudsql-connection")
    
    # Create PostgreSQL connection URL for Cloud SQL
    DB_URL="postgresql://${DB_USER}:password_placeholder@/cloudsql/${CONNECTION_NAME}:5432/${DATABASE_NAME}"
    
    echo -n "$DB_URL" | gcloud secrets create certificate-manager-database-url \
        --data-file=- \
        --replication-policy="automatic" \
        --quiet 2>/dev/null || \
    echo -n "$DB_URL" | gcloud secrets versions add certificate-manager-database-url \
        --data-file=- \
        --quiet
    
    log_success "Database URL secret created"
}

# Grant Cloud Run service account access
grant_cloudsql_access() {
    log_info "Granting Cloud Run service account access to Cloud SQL..."
    
    # Get the default compute service account
    SERVICE_ACCOUNT="${PROJECT_ID//[:-]/-}-compute@developer.gserviceaccount.com"
    
    # Grant Cloud SQL Client role
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/cloudsql.client" \
        --quiet
    
    # Grant Secret Manager Secret Accessor role
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/secretmanager.secretAccessor" \
        --quiet
    
    log_success "Service account permissions granted"
}

# Test connection
test_connection() {
    log_info "Testing database connection..."
    
    # This would require Cloud SQL Proxy to be installed and running
    log_info "To test the connection manually:"
    echo "  1. Install Cloud SQL Proxy:"
    echo "     wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy"
    echo "     chmod +x cloud_sql_proxy"
    echo ""
    echo "  2. Start proxy:"
    echo "     ./cloud_sql_proxy -instances=$CONNECTION_NAME=tcp:5432"
    echo ""
    echo "  3. Test connection:"
    echo "     psql 'postgresql://$DB_USER:PASSWORD@localhost:5432/$DATABASE_NAME'"
    echo ""
    echo "  Password stored in Secret Manager: certificate-manager-db-password"
}

# Generate environment configuration
generate_env_config() {
    log_info "Generating environment configuration..."
    
    CONNECTION_NAME=$(gcloud secrets versions access latest --secret="certificate-manager-cloudsql-connection")
    
    cat > cloudsql.env << EOF
# Cloud SQL Configuration for Certificate Manager
# Add these to your Cloud Run environment variables

DATABASE_PROVIDER=gcp-cloudsql
NODE_ENV=production

# Cloud SQL Configuration
CLOUDSQL_CONNECTION_NAME=$CONNECTION_NAME
CLOUDSQL_HOST=/cloudsql/$CONNECTION_NAME
CLOUDSQL_PORT=5432
CLOUDSQL_USERNAME=$DB_USER
CLOUDSQL_DATABASE=$DATABASE_NAME

# Connection Pooling
DB_CONNECTION_POOL_MAX=20
DB_CONNECTION_POOL_MIN=5
DB_CONNECTION_IDLE_TIMEOUT=10000
DB_CONNECTION_ACQUIRE_TIMEOUT=60000
DB_CONNECTION_EVICT_TIMEOUT=1000

# Security (use Secret Manager)
# CLOUDSQL_PASSWORD=<from secret: certificate-manager-db-password>

# Google Cloud Project
GOOGLE_CLOUD_PROJECT=$PROJECT_ID
EOF
    
    log_success "Environment configuration saved to: cloudsql.env"
}

# Update Cloud Build configuration
update_cloudbuild() {
    log_info "Updating Cloud Build configuration..."
    
    CONNECTION_NAME=$(gcloud secrets versions access latest --secret="certificate-manager-cloudsql-connection")
    
    log_info "Add this to your cloudbuild.yaml Cloud Run deployment step:"
    echo ""
    echo "  --add-cloudsql-instances '$CONNECTION_NAME' \\"
    echo "  --set-env-vars 'DATABASE_PROVIDER=gcp-cloudsql,CLOUDSQL_CONNECTION_NAME=$CONNECTION_NAME,CLOUDSQL_HOST=/cloudsql/$CONNECTION_NAME,CLOUDSQL_PORT=5432,CLOUDSQL_USERNAME=$DB_USER,CLOUDSQL_DATABASE=$DATABASE_NAME' \\"
    echo "  --set-secrets 'CLOUDSQL_PASSWORD=certificate-manager-db-password:latest' \\"
    echo ""
}

# Print summary
print_summary() {
    log_success "Cloud SQL setup completed!"
    echo ""
    echo "📊 Summary:"
    echo "  Instance: $INSTANCE_NAME"
    echo "  Database: $DATABASE_NAME"
    echo "  User: $DB_USER"
    echo "  Region: $REGION"
    echo "  Tier: $TIER"
    echo ""
    echo "🔐 Secrets created:"
    echo "  certificate-manager-db-password"
    echo "  certificate-manager-cloudsql-connection"
    echo "  certificate-manager-database-url"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Update your Cloud Run deployment with the Cloud SQL configuration"
    echo "  2. Run database migration: node src/database/migrate-to-cloudsql.js"
    echo "  3. Update DATABASE_PROVIDER environment variable to 'gcp-cloudsql'"
    echo "  4. Restart your application"
    echo ""
    echo "📁 Configuration files created:"
    echo "  cloudsql.env - Environment variables for local testing"
    echo ""
}

# Main execution
main() {
    log_info "Starting Cloud SQL setup for Enterprise Certificate Manager"
    echo ""
    
    check_prerequisites
    enable_apis
    create_cloudsql_instance
    create_database
    create_database_user
    configure_networking
    create_database_url_secret
    grant_cloudsql_access
    generate_env_config
    update_cloudbuild
    test_connection
    print_summary
}

# Show help
show_help() {
    echo "Cloud SQL Setup Script for Enterprise Certificate Manager"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help           Show this help message"
    echo "  --project PROJECT    Google Cloud Project ID (default: \$GOOGLE_CLOUD_PROJECT)"
    echo "  --region REGION      Cloud SQL region (default: us-central1)"
    echo "  --instance NAME      Cloud SQL instance name (default: certificate-manager-db)"
    echo "  --database NAME      Database name (default: certificate_manager)"
    echo "  --user USER          Database user (default: cert_manager_app)"
    echo "  --tier TIER          Instance tier (default: db-custom-2-8192)"
    echo "  --storage SIZE       Storage size (default: 100GB)"
    echo ""
    echo "Environment Variables:"
    echo "  GOOGLE_CLOUD_PROJECT - Google Cloud Project ID"
    echo "  CLOUDSQL_REGION      - Cloud SQL region"
    echo "  CLOUDSQL_INSTANCE_NAME - Instance name"
    echo "  CLOUDSQL_DATABASE    - Database name"
    echo "  CLOUDSQL_USERNAME    - Database user"
    echo "  CLOUDSQL_TIER        - Instance tier"
    echo "  CLOUDSQL_STORAGE_SIZE - Storage size"
    echo "  CLOUDSQL_BACKUP_TIME - Backup time (HH:MM format)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use default settings"
    echo "  $0 --project my-project --region us-east1"
    echo "  $0 --tier db-custom-4-16384 --storage 200GB"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --project)
            PROJECT_ID="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --instance)
            INSTANCE_NAME="$2"
            shift 2
            ;;
        --database)
            DATABASE_NAME="$2"
            shift 2
            ;;
        --user)
            DB_USER="$2"
            shift 2
            ;;
        --tier)
            TIER="$2"
            shift 2
            ;;
        --storage)
            STORAGE_SIZE="$2"
            shift 2
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main