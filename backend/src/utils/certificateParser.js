import { X509Certificate } from '@peculiar/x509';

export async function parseCertificate(fileContent, originalName = "") {
  try {
    let der;
    const contentStr = fileContent.toString('utf8');
    if (contentStr.includes('-----BEGIN CERTIFICATE-----')) {
      // PEM: strip header/footer and decode base64
      let pem = contentStr
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\r?\n|\r/g, '');
      der = Buffer.from(pem, 'base64');
    } else {
      // DER: use buffer as-is
      der = fileContent;
    }

    const cert = new X509Certificate(der);
    // Debug logging for certificate fields
    console.log(`[parseCertificate] File: ${originalName}`);
    console.log('  subject:', cert.subject);
    console.log('  issuer:', cert.issuer);
    console.log('  notBefore:', cert.notBefore, 'isValid:', cert.notBefore instanceof Date && !isNaN(cert.notBefore));
    console.log('  notAfter:', cert.notAfter, 'isValid:', cert.notAfter instanceof Date && !isNaN(cert.notAfter));
    console.log('  serialNumber:', cert.serialNumber);
    console.log('  publicKey algorithm:', cert.publicKey?.algorithm?.name);

    // Try to get CN, fallback to parsing subject, then to first DNS SAN from subjectAltName
    let commonName = cert.subjectCommonName;
    if (!commonName || commonName === 'Unknown') {
      // Try to parse CN from subject string
      const subjectMatch = cert.subject.match(/CN=([^,]+)/);
      if (subjectMatch && subjectMatch[1]) {
        commonName = subjectMatch[1].trim();
      }
    }
    if (!commonName || commonName === 'Unknown') {
      // Try to extract first DNS from subjectAltName string
      if (typeof cert.subjectAltName === 'string') {
        const dnsMatch = cert.subjectAltName.match(/DNS:([^,\s]+)/);
        if (dnsMatch && dnsMatch[1]) {
          commonName = dnsMatch[1].toLowerCase();
        }
      }
    }

    return {
      commonName: commonName || 'Unknown',
      issuer: cert.issuer,
      subject: cert.subject,
      validFrom: cert.notBefore instanceof Date && !isNaN(cert.notBefore) ? cert.notBefore.toISOString() : null,
      validTo: cert.notAfter instanceof Date && !isNaN(cert.notAfter) ? cert.notAfter.toISOString() : null,
      algorithm: cert.publicKey?.algorithm?.name || 'Unknown',
      serialNumber: cert.serialNumber,
      status: calculateStatus(cert.notAfter),
    };
  } catch (error) {
    console.error(`[parseCertificate] Error parsing certificate (${originalName}):`, error);
    throw new Error('Invalid or unsupported certificate format. This parser supports PEM/DER X.509 certificates with RSA, EC, Ed25519, and more.');
  }
}

function calculateStatus(validTo) {
  if (!validTo) return 'UNKNOWN';
  const now = new Date();
  const expiryDate = new Date(validTo);
  const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  if (expiryDate < now) {
    return 'EXPIRED';
  } else if (daysUntilExpiry <= 30) {
    return 'EXPIRING_SOON';
  } else {
    return 'VALID';
  }
} 