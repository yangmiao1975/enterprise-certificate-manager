import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

const mockDb = {
  runAsync: jest.fn(),
  getAsync: jest.fn(),
  allAsync: jest.fn()
};
const mockPasswordService = {};

jest.unstable_mockModule('../src/database/flexible-init.js', () => ({
  getDatabase: () => mockDb,
  getDatabaseProvider: () => 'sqlite',
  getPasswordService: () => mockPasswordService,
  getDatabaseHealth: async () => ({ status: 'healthy', provider: 'sqlite', connected: true }),
  migration: {},
  initializeDatabase: async () => {}
}));

const { default: app } = await import('../src/index.js');

describe('Folder Management API', () => {
  let authToken;
  const testUser = { id: 1, username: 'testuser', role: 'admin' };

  beforeAll(() => {
    authToken = jwt.sign(testUser, process.env.JWT_SECRET || 'test-secret');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a folder', async () => {
    mockDb.getAsync.mockResolvedValueOnce(null); // No name conflict
    mockDb.getAsync.mockResolvedValueOnce({ id: 'parent' }); // Parent exists
    mockDb.runAsync.mockResolvedValue({});
    mockDb.getAsync.mockResolvedValueOnce({ id: 'new-folder', name: 'Test Folder' });
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test Folder', parentId: 'parent' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Folder');
  });

  it('should not create folder with duplicate name', async () => {
    mockDb.getAsync.mockResolvedValueOnce({ id: 'existing' });
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Duplicate' });
    expect(res.status).toBe(400);
  });

  it('should update a folder', async () => {
    mockDb.getAsync.mockResolvedValueOnce({ id: 'folder', name: 'Old' }); // Exists
    mockDb.getAsync.mockResolvedValueOnce(null); // No name conflict
    mockDb.runAsync.mockResolvedValue({});
    mockDb.getAsync.mockResolvedValueOnce({ id: 'folder', name: 'New' });
    const res = await request(app)
      .put('/api/folders/folder')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New');
  });

  it('should delete a folder', async () => {
    mockDb.getAsync.mockResolvedValueOnce({ id: 'folder', type: 'custom' });
    mockDb.runAsync.mockResolvedValue({});
    const res = await request(app)
      .delete('/api/folders/folder')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('should not delete a system folder', async () => {
    mockDb.getAsync.mockResolvedValueOnce({ id: 'folder', type: 'system' });
    const res = await request(app)
      .delete('/api/folders/folder')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  it('should move a folder', async () => {
    mockDb.getAsync.mockResolvedValueOnce({ id: 'folder', type: 'custom', name: 'Folder' }); // Folder exists
    mockDb.getAsync.mockResolvedValueOnce({ id: 'parent' }); // Parent exists
    mockDb.getAsync.mockResolvedValueOnce(null); // No name conflict
    mockDb.runAsync.mockResolvedValue({});
    const res = await request(app)
      .patch('/api/folders/folder/move')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ parentId: 'parent' });
    expect(res.status).toBe(200);
  });
}); 