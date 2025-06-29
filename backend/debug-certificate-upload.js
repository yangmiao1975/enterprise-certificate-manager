/**
 * Backend Certificate Upload Debug
 * This will help debug the exact error happening in the upload process
 */

import fs from 'fs';
import { parseCertificate } from './src/utils/certificateParser.js';
import gcpCertificateService from './src/services/gcpCertificateService.js';

async function debugCertificateUpload() {
  const certPath = '/Users/william/Downloads/certs/projects_1044697249626_locations_us-central1_caPools_certificateMgmt_certificates_20250628-cr6-u55.crt';
  
  console.log('🔍 Backend Certificate Upload Debug');
  console.log('====================================');
  
  try {
    // Step 1: Read the file
    console.log('\n📖 Step 1: Reading certificate file...');
    const fileBuffer = fs.readFileSync(certPath);
    console.log('✅ File read successfully');
    console.log('📦 File size:', fileBuffer.length, 'bytes');
    
    // Step 2: Parse certificate
    console.log('\n🔬 Step 2: Parsing certificate...');
    const certificateData = await parseCertificate(fileBuffer, 'test-cert.crt');
    console.log('✅ Certificate parsed successfully');
    console.log('📋 Parsed data:', JSON.stringify(certificateData, null, 2));
    
    // Step 3: Test GCP service
    console.log('\n☁️ Step 3: Testing GCP service...');
    console.log('🔑 GCP Project ID:', process.env.GCP_PROJECT_ID);
    console.log('🌍 GCP Location:', process.env.GCP_LOCATION || 'us-central1');
    
    if (!process.env.GCP_PROJECT_ID) {
      console.log('❌ GCP_PROJECT_ID not set - this might cause issues');
    }
    
    try {
      const gcpResult = await gcpCertificateService.createCertificate(certificateData, fileBuffer);
      console.log('✅ GCP service call successful');
      console.log('📋 GCP result:', JSON.stringify(gcpResult, null, 2));
    } catch (gcpError) {
      console.log('❌ GCP service call failed');
      console.log('💥 Error:', gcpError.message);
      console.log('📋 Stack:', gcpError.stack);
    }
    
  } catch (error) {
    console.error('❌ Debug test failed at some step');
    console.error('💥 Error:', error.message);
    console.error('📋 Stack:', error.stack);
  }
}

// Also test just the parsing step
async function testParsingOnly() {
  console.log('\n🧪 Testing parsing only...');
  
  try {
    const certPath = '/Users/william/Downloads/certs/projects_1044697249626_locations_us-central1_caPools_certificateMgmt_certificates_20250628-cr6-u55.crt';
    const fileBuffer = fs.readFileSync(certPath);
    
    console.log('📄 Raw file preview:', fileBuffer.toString('utf8').substring(0, 200));
    
    const parsed = await parseCertificate(fileBuffer, 'test-cert.crt');
    console.log('✅ Parsing successful');
    console.log('📋 Result:', parsed);
    
  } catch (parseError) {
    console.error('❌ Parsing failed');
    console.error('💥 Error:', parseError.message);
  }
}

console.log('Starting debug tests...\n');
testParsingOnly();
debugCertificateUpload();