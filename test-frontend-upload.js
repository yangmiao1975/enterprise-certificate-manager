/**
 * Test Frontend Upload Flow
 * This mimics exactly what the frontend does
 */

import fs from 'fs';

async function testFrontendUpload() {
  console.log('🔍 Testing Frontend Upload Flow');
  console.log('===============================\n');
  
  try {
    const fetch = (await import('node-fetch')).default;
    const FormData = (await import('form-data')).default;
    
    const certPath = '/Users/william/Downloads/certs/projects_1044697249626_locations_us-central1_caPools_certificateMgmt_certificates_20250628-cr6-u55.crt';
    
    // Read the certificate file as the frontend would
    const fileBuffer = fs.readFileSync(certPath);
    console.log('📄 File loaded:', certPath);
    console.log('📦 File size:', fileBuffer.length, 'bytes');
    
    // Create FormData exactly like the frontend
    const formData = new FormData();
    formData.append('certificate', fileBuffer, {
      filename: 'projects_1044697249626_locations_us-central1_caPools_certificateMgmt_certificates_20250628-cr6-u55.crt',
      contentType: 'application/x-x509-ca-cert'
    });
    
    // Optional folder ID (frontend sometimes sends this)
    formData.append('folderId', '');
    
    console.log('📋 FormData created');
    console.log('🔑 Form has certificate and folderId fields');
    
    // Test different endpoints
    const endpoints = [
      'http://localhost:8080/api/certificates',
      'https://certificate-manager-api-1044697249626.us-central1.run.app/api/certificates'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🌐 Testing endpoint: ${endpoint}`);
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          headers: {
            // No Authorization header to test the specific 400 vs 401 error
            ...formData.getHeaders()
          },
          timeout: 30000
        });
        
        console.log('📊 Status:', response.status);
        console.log('📊 Status Text:', response.statusText);
        console.log('📊 Headers:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log('📄 Response Body:', responseText);
        
        // Try to parse as JSON
        try {
          const jsonResponse = JSON.parse(responseText);
          console.log('📋 Parsed JSON:', JSON.stringify(jsonResponse, null, 2));
        } catch (e) {
          console.log('📄 (Not valid JSON)');
        }
        
      } catch (fetchError) {
        console.log('❌ Request failed:', fetchError.message);
        if (fetchError.code === 'ECONNREFUSED') {
          console.log('💡 Server not running locally');
        }
      }
    }
    
    // Test with authentication header (you'll need to provide a valid token)
    console.log('\n🔐 Testing with mock authentication...');
    const authResponse = await fetch('https://certificate-manager-api-1044697249626.us-central1.run.app/api/certificates', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer mock-token-for-testing',
        ...formData.getHeaders()
      }
    });
    
    console.log('📊 Auth test status:', authResponse.status);
    const authResponseText = await authResponse.text();
    console.log('📄 Auth test response:', authResponseText);
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    console.error('📋 Stack:', error.stack);
  }
}

testFrontendUpload();