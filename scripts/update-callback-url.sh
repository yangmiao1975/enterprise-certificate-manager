#!/bin/bash
# Usage: ./update-callback-url.sh <service-name> <region>
# Example: ./update-callback-url.sh certificate-manager-api us-central1

SERVICE_NAME=${1:-certificate-manager-api}
REGION=${2:-us-central1}

# Fetch the deployed backend URL
echo "Fetching Cloud Run URL for service: $SERVICE_NAME in region: $REGION..."
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

if [ -z "$BACKEND_URL" ]; then
  echo "ERROR: Could not fetch backend URL. Is the service name and region correct?"
  exit 1
fi

CALLBACK_URL="${BACKEND_URL}/api/auth/google/callback"
echo "Updating GOOGLE_CALLBACK_URL to: $CALLBACK_URL"

gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --update-env-vars "GOOGLE_CALLBACK_URL=$CALLBACK_URL"

echo "GOOGLE_CALLBACK_URL updated successfully!" 