/**
 * Test Certificate Parsing
 * This will help us identify if the issue is in certificate parsing
 */

import fs from 'fs';
import { X509Certificate } from '@peculiar/x509';

async function testCertificateParsing() {
  const certPath = '/Users/william/Downloads/certs/projects_1044697249626_locations_us-central1_caPools_certificateMgmt_certificates_20250628-cr6-u55.crt';
  
  console.log('🔍 Testing certificate parsing...');
  console.log('📄 Certificate file:', certPath);
  
  try {
    // Read the file
    const fileContent = fs.readFileSync(certPath);
    console.log('📦 File size:', fileContent.length, 'bytes');
    
    // Test the exact parsing logic from the backend
    let der;
    const contentStr = fileContent.toString('utf8');
    console.log('📋 Content preview:', contentStr.substring(0, 100) + '...');
    
    if (contentStr.includes('-----BEGIN CERTIFICATE-----')) {
      console.log('✅ Detected PEM format');
      
      // PEM: strip header/footer and decode base64
      let pem = contentStr
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\r?\n|\r/g, '');
      
      console.log('📝 Cleaned PEM length:', pem.length);
      console.log('📝 First 50 chars of cleaned PEM:', pem.substring(0, 50));
      
      der = Buffer.from(pem, 'base64');
      console.log('📦 DER buffer size:', der.length);
    } else {
      console.log('📝 Detected DER format');
      der = fileContent;
    }

    // Try to parse with @peculiar/x509
    console.log('\n🔬 Parsing with @peculiar/x509...');
    const cert = new X509Certificate(der);
    
    console.log('✅ Certificate parsed successfully!');
    console.log('📋 Subject:', cert.subject);
    console.log('📋 Issuer:', cert.issuer);
    console.log('📋 Not Before:', cert.notBefore);
    console.log('📋 Not After:', cert.notAfter);
    console.log('📋 Serial Number:', cert.serialNumber);
    console.log('📋 Subject Common Name:', cert.subjectCommonName);
    
    // Test the commonName extraction logic
    let commonName = cert.subjectCommonName;
    console.log('🏷️ Initial CN:', commonName);
    
    if (!commonName || commonName === 'Unknown') {
      const subjectMatch = cert.subject.match(/CN=([^,]+)/);
      if (subjectMatch && subjectMatch[1]) {
        commonName = subjectMatch[1].trim();
        console.log('🏷️ CN from subject parsing:', commonName);
      }
    }
    
    if (!commonName || commonName === 'Unknown') {
      if (typeof cert.subjectAltName === 'string') {
        const dnsMatch = cert.subjectAltName.match(/DNS:([^,\s]+)/);
        if (dnsMatch && dnsMatch[1]) {
          commonName = dnsMatch[1].toLowerCase();
          console.log('🏷️ CN from SAN:', commonName);
        }
      }
    }
    
    console.log('🏷️ Final CN:', commonName || 'Unknown');
    
    // Test status calculation
    const now = new Date();
    const expiryDate = new Date(cert.notAfter);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    let status;
    if (expiryDate < now) {
      status = 'EXPIRED';
    } else if (daysUntilExpiry <= 30) {
      status = 'EXPIRING_SOON';
    } else {
      status = 'VALID';
    }
    
    console.log('📊 Status:', status);
    console.log('📅 Days until expiry:', daysUntilExpiry);
    
    // Create the full parsed object
    const parsed = {
      commonName: commonName || 'Unknown',
      issuer: cert.issuer,
      subject: cert.subject,
      validFrom: cert.notBefore instanceof Date && !isNaN(cert.notBefore) ? cert.notBefore.toISOString() : null,
      validTo: cert.notAfter instanceof Date && !isNaN(cert.notAfter) ? cert.notAfter.toISOString() : null,
      algorithm: cert.publicKey?.algorithm?.name || 'Unknown',
      serialNumber: cert.serialNumber,
      status: status,
    };
    
    console.log('\n📦 Final parsed object:');
    console.log(JSON.stringify(parsed, null, 2));
    
    console.log('\n✅ Certificate parsing test PASSED!');
    
  } catch (error) {
    console.error('❌ Certificate parsing test FAILED!');
    console.error('💥 Error:', error.message);
    console.error('📋 Stack:', error.stack);
  }
}

testCertificateParsing();