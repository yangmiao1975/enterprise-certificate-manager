import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

// Mock dependencies
const mockDb = {
  runAsync: jest.fn(),
  getAsync: jest.fn(),
  allAsync: jest.fn()
};
const mockGcpService = {
  createCertificate: jest.fn().mockResolvedValue({
    id: 'gcp-cert-id',
    normalizedPem: '---PEM---',
    gcpCertificateName: 'gcp-cert-name'
  })
};
const mockParseCertificate = jest.fn().mockResolvedValue({
  commonName: 'test.example.com',
  issuer: 'Test CA',
  subject: 'CN=test.example.com',
  validFrom: '2024-01-01T00:00:00Z',
  validTo: '2025-01-01T00:00:00Z',
  algorithm: 'sha256WithRSAEncryption',
  serialNumber: '123456',
  status: 'VALID'
});
const mockPasswordService = {};

jest.unstable_mockModule('../src/database/flexible-init.js', () => ({
  getDatabase: () => mockDb,
  getDatabaseProvider: () => 'sqlite',
  getPasswordService: () => mockPasswordService,
  getDatabaseHealth: async () => ({ status: 'healthy', provider: 'sqlite', connected: true }),
  migration: {},
  initializeDatabase: async () => {}
}));
jest.unstable_mockModule('../src/services/gcpCertificateService.js', () => ({
  default: mockGcpService
}));
jest.unstable_mockModule('../src/utils/certificateParser.js', () => ({
  parseCertificate: mockParseCertificate
}));

const { default: app } = await import('../src/index.js');

describe('Certificate Upload API', () => {
  let authToken;
  const testUser = { id: 1, username: 'testuser', role: 'admin' };

  beforeAll(() => {
    authToken = jwt.sign(testUser, process.env.JWT_SECRET || 'test-secret');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload a certificate successfully', async () => {
    const res = await request(app)
      .post('/api/certificates')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('certificate', Buffer.from('dummy-cert'), 'test.crt');
    expect(res.status).toBe(201);
    expect(mockGcpService.createCertificate).toHaveBeenCalled();
    expect(mockDb.runAsync).toHaveBeenCalled();
    expect(res.body.common_name).toBe('test.example.com');
  });

  it('should return 400 if no file is provided', async () => {
    const res = await request(app)
      .post('/api/certificates')
      .set('Authorization', `Bearer ${authToken}`)
      .field('folderId', 'some-folder');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/file is required/i);
  });

  it('should return 401 if not authenticated', async () => {
    const res = await request(app)
      .post('/api/certificates')
      .attach('certificate', Buffer.from('dummy-cert'), 'test.crt');
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid file type', async () => {
    const res = await request(app)
      .post('/api/certificates')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('certificate', Buffer.from('dummy-cert'), 'test.txt');
    expect(res.status).toBe(400);
  });
}); 