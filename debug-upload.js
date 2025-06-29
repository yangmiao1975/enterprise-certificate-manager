/**
 * Debug Certificate Upload Script
 * This script will help us see the exact error message from the backend
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test certificate upload with detailed error logging
async function testUpload() {
  try {
    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;
    
    const certPath = '/Users/william/Downloads/certs/projects_1044697249626_locations_us-central1_caPools_certificateMgmt_certificates_20250628-cr6-u55.crt';
    const apiUrl = 'https://certificate-manager-api-1044697249626.us-central1.run.app/api/certificates';
    
    console.log('🔍 Testing certificate upload...');
    console.log('📄 Certificate file:', certPath);
    console.log('🌐 API URL:', apiUrl);
    
    // Read certificate file
    const certContent = fs.readFileSync(certPath);
    console.log('📦 File size:', certContent.length, 'bytes');
    console.log('📋 First 200 chars:', certContent.toString().substring(0, 200));
    
    // Create form data
    const formData = new FormData();
    formData.append('certificate', certContent, {
      filename: 'test-cert.crt',
      contentType: 'application/x-x509-ca-cert'
    });
    
    console.log('\n🚀 Sending upload request...');
    
    // Make request (this will likely fail due to authentication, but we'll see the error)
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        // Note: Missing authentication header - this will help us see auth errors vs parsing errors
        ...formData.getHeaders()
      }
    });
    
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📄 Response body:', responseText);
    
    if (!response.ok) {
      try {
        const errorJson = JSON.parse(responseText);
        console.log('❌ Parsed error:', errorJson);
      } catch (e) {
        console.log('❌ Raw error text:', responseText);
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('📋 Full error:', error);
  }
}

// Also test the local backend if it's running
async function testLocalUpload() {
  try {
    const FormData = (await import('form-data')).default;
    const fetch = (await import('node-fetch')).default;
    
    const certPath = '/Users/william/Downloads/certs/projects_1044697249626_locations_us-central1_caPools_certificateMgmt_certificates_20250628-cr6-u55.crt';
    const localUrl = 'http://localhost:8080/api/certificates';
    
    console.log('\n🏠 Testing local backend upload...');
    
    const certContent = fs.readFileSync(certPath);
    const formData = new FormData();
    formData.append('certificate', certContent, {
      filename: 'test-cert.crt',
      contentType: 'application/x-x509-ca-cert'
    });
    
    const response = await fetch(localUrl, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders()
      }
    });
    
    console.log('📊 Local response status:', response.status);
    const responseText = await response.text();
    console.log('📄 Local response:', responseText);
    
  } catch (error) {
    console.log('🏠 Local backend not running or not accessible');
  }
}

console.log('🔧 Certificate Upload Debug Tool');
console.log('================================\n');

testUpload();
testLocalUpload();