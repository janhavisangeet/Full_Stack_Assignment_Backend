import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function getTestMongoUri(dbName: string): string {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pyramid-tasks';
  if (baseUri.startsWith('mongodb+srv://')) {
    const prefix = 'mongodb+srv://';
    const relativePart = baseUri.substring(prefix.length);
    const slashIndex = relativePart.indexOf('/');
    if (slashIndex === -1) {
      const qIndex = relativePart.indexOf('?');
      if (qIndex === -1) {
        return `${baseUri.replace(/\/$/, '')}/${dbName}`;
      } else {
        const host = relativePart.substring(0, qIndex);
        const params = relativePart.substring(qIndex);
        return `${prefix}${host}/${dbName}${params}`;
      }
    } else {
      const host = relativePart.substring(0, slashIndex);
      const rest = relativePart.substring(slashIndex + 1);
      const qIndex = rest.indexOf('?');
      if (qIndex === -1) {
        return `${prefix}${host}/${dbName}`;
      } else {
        const params = rest.substring(qIndex);
        return `${prefix}${host}/${dbName}${params}`;
      }
    }
  } else {
    const prefix = 'mongodb://';
    const relativePart = baseUri.substring(prefix.length);
    const slashIndex = relativePart.indexOf('/');
    if (slashIndex === -1) {
      return `${baseUri}/${dbName}`;
    } else {
      const host = relativePart.substring(0, slashIndex);
      return `${prefix}${host}/${dbName}`;
    }
  }
}

describe('ProjectsController (e2e)', () => {
  let app: INestApplication;
  let mongoConnection: Connection;
  let userToken: string;
  let anotherUserToken: string;

  beforeAll(async () => {
    process.env.MONGODB_URI = getTestMongoUri('pyramid-tasks-test-projects');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    
    // Register ValidationPipe to enable class-validator DTO validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    mongoConnection = app.get<Connection>(getConnectionToken());

    // Generate tokens for two different guest users
    const user1Login = await request(app.getHttpServer())
      .post('/api/auth/guest')
      .send({ name: 'UserOne' });
    userToken = user1Login.body.token;

    const user2Login = await request(app.getHttpServer())
      .post('/api/auth/guest')
      .send({ name: 'UserTwo' });
    anotherUserToken = user2Login.body.token;
  });

  afterAll(async () => {
    if (mongoConnection) {
      try {
        await mongoConnection.dropDatabase();
      } catch (e) {}
      try {
        await mongoConnection.close();
      } catch (e) {}
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clear projects collection before each test
    const collections = mongoConnection.collections;
    if (collections['projects']) {
      await collections['projects'].deleteMany({});
    }
  });

  describe('POST /api/projects', () => {
    it('should create a project for the authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'AbleSpace Platform',
          description: 'A tracking app for IEP goals',
          priority: 'high',
          lead: 'Jane Doe',
        })
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name', 'AbleSpace Platform');
      expect(response.body).toHaveProperty('userId');
    });

    it('should reject project creation if validation fails (e.g. empty name)', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: '', // name must not be empty
        })
        .expect(400);
    });

    it('should return 401 if unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .send({ name: 'Unauthorized project' })
        .expect(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should fetch projects belonging only to the authenticated user', async () => {
      // User 1 creates a project
      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'User 1 Project' });

      // User 2 creates a project
      await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ name: 'User 2 Project' });

      // User 1 fetches their projects
      const response1 = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response1.body.length).toBe(1);
      expect(response1.body[0]).toHaveProperty('name', 'User 1 Project');

      // User 2 fetches their projects
      const response2 = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(200);

      expect(response2.body.length).toBe(1);
      expect(response2.body[0]).toHaveProperty('name', 'User 2 Project');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return the project if owned by user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'My Main Project' });

      const projectId = createResponse.body._id;

      const getResponse = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(getResponse.body).toHaveProperty('name', 'My Main Project');
    });

    it('should return 403 Forbidden if user tries to fetch another user\'s project', async () => {
      // User 2 creates a project
      const createResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ name: 'Secret Project' });

      const projectId = createResponse.body._id;

      // User 1 attempts to fetch it
      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 404 if project does not exist at all', async () => {
      const nonExistentId = '60d5ecb5b5c9c925d4817d12'; // Valid hex format but non-existent
      await request(app.getHttpServer())
        .get(`/api/projects/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update a project owned by user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Old Project Name', priority: 'medium' });

      const projectId = createResponse.body._id;

      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'New Project Name', priority: 'high' })
        .expect(200);

      expect(updateResponse.body).toHaveProperty('name', 'New Project Name');
      expect(updateResponse.body).toHaveProperty('priority', 'high');
    });

    it('should return 403 Forbidden if user tries to update another user\'s project', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ name: 'Project to Steal' });

      const projectId = createResponse.body._id;

      await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Stolen Name' })
        .expect(403);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project owned by user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Project to Delete' });

      const projectId = createResponse.body._id;

      await request(app.getHttpServer())
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);

      // Verify it's gone
      await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 403 Forbidden if user tries to delete another user\'s project', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ name: 'Safe Project' });

      const projectId = createResponse.body._id;

      await request(app.getHttpServer())
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
