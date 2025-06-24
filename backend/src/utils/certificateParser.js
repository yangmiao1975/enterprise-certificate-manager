import { Certificate } from 'pkijs';
import { fromBER } from 'asn1js';

export async function parseCertificate(pemContent) {
  try {
    // Remove PEM headers and decode base64
    const base64Data = pemContent
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');

    const binaryData = atob(base64Data);
    const uint8Array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
      uint8Array[i] = binaryData.charCodeAt(i);
    }

    // Parse ASN.1 structure
    const asn1 = fromBER(uint8Array.buffer);
    const certificate = new Certificate({ schema: asn1.result });

    // Extract certificate information
    const commonName = extractCommonName(certificate.subject);
    const issuer = extractIssuer(certificate.issuer);
    const subject = extractSubject(certificate.subject);
    const validFrom = certificate.notBefore.value;
    const validTo = certificate.notAfter.value;
    const algorithm = certificate.signatureAlgorithm.algorithmId;
    const serialNumber = certificate.serialNumber.valueBlock.valueHex.toString('hex').toUpperCase();

    // Calculate status
    const status = calculateStatus(validTo);

    return {
      commonName,
      issuer,
      subject,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      algorithm: algorithm.toString(),
      serialNumber: formatSerialNumber(serialNumber),
      status
    };
  } catch (error) {
    console.error('Error parsing certificate:', error);
    throw new Error('Invalid certificate format');
  }
}

function extractCommonName(subject) {
  try {
    const commonNameAttr = subject.typesAndValues.find(attr => 
      attr.type === '2.5.4.3' // Common Name OID
    );
    return commonNameAttr ? commonNameAttr.value.valueBlock.value : 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
}

function extractIssuer(issuer) {
  try {
    const parts = [];
    issuer.typesAndValues.forEach(attr => {
      const oid = attr.type;
      const value = attr.value.valueBlock.value;
      
      switch (oid) {
        case '2.5.4.6': // Country
          parts.push(`C=${value}`);
          break;
        case '2.5.4.10': // Organization
          parts.push(`O=${value}`);
          break;
        case '2.5.4.11': // Organizational Unit
          parts.push(`OU=${value}`);
          break;
        case '2.5.4.3': // Common Name
          parts.push(`CN=${value}`);
          break;
        case '2.5.4.7': // Locality
          parts.push(`L=${value}`);
          break;
        case '2.5.4.8': // State
          parts.push(`ST=${value}`);
          break;
      }
    });
    return parts.join(', ');
  } catch (error) {
    return 'Unknown Issuer';
  }
}

function extractSubject(subject) {
  try {
    const parts = [];
    subject.typesAndValues.forEach(attr => {
      const oid = attr.type;
      const value = attr.value.valueBlock.value;
      
      switch (oid) {
        case '2.5.4.6': // Country
          parts.push(`C=${value}`);
          break;
        case '2.5.4.10': // Organization
          parts.push(`O=${value}`);
          break;
        case '2.5.4.11': // Organizational Unit
          parts.push(`OU=${value}`);
          break;
        case '2.5.4.3': // Common Name
          parts.push(`CN=${value}`);
          break;
        case '2.5.4.7': // Locality
          parts.push(`L=${value}`);
          break;
        case '2.5.4.8': // State
          parts.push(`ST=${value}`);
          break;
      }
    });
    return parts.join(', ');
  } catch (error) {
    return 'Unknown Subject';
  }
}

function calculateStatus(validTo) {
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

function formatSerialNumber(serialNumber) {
  // Format as hex with colons
  return serialNumber.match(/.{1,2}/g).join(':').toUpperCase();
} 