terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "certificate-manager-vpc"
  auto_create_subnetworks = false
}

# Subnet
resource "google_compute_subnetwork" "subnet" {
  name          = "certificate-manager-subnet"
  ip_cidr_range = "10.0.0.0/24"
  network       = google_compute_network.vpc.id
  region        = var.region
}

# Firewall rules
resource "google_compute_firewall" "allow_http" {
  name    = "allow-http"
  network = google_compute_network.vpc.id

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3000", "8080"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["web"]
}

# Compute instance
resource "google_compute_instance" "certificate_manager" {
  name         = "certificate-manager-vm"
  machine_type = "e2-medium"
  zone         = "${var.region}-a"

  tags = ["web"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
      size  = 20
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id
    access_config {
      // Ephemeral public IP
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_pub_key_file)}"
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    # Update system
    apt-get update
    apt-get install -y docker.io docker-compose git curl

    # Start Docker service
    systemctl start docker
    systemctl enable docker

    # Clone repository (replace with your repo URL)
    git clone https://github.com/your-username/enterprise-certificate-manager.git /opt/certificate-manager
    cd /opt/certificate-manager

    # Create environment file
    cat > .env << 'ENVEOF'
    GCP_PROJECT_ID=${var.project_id}
    GCP_LOCATION=${var.region}
    JWT_SECRET=${var.jwt_secret}
    NODE_ENV=production
    PORT=8080
    CORS_ORIGIN=http://localhost:3000
    ENVEOF

    # Start services
    docker-compose up -d
  EOF
}

# Output the external IP
output "external_ip" {
  value = google_compute_instance.certificate_manager.network_interface[0].access_config[0].nat_ip
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "ssh_user" {
  description = "SSH username"
  type        = string
  default     = "debian"
}

variable "ssh_pub_key_file" {
  description = "Path to SSH public key file"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "jwt_secret" {
  description = "JWT secret for authentication"
  type        = string
  sensitive   = true
} 