import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';
import { TaskStatus, TaskPriority } from '../src/tasks/schemas/task.schema';

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

describe('TasksController (e2e)', () => {
  let app: INestApplication;
  let mongoConnection: Connection;
  let userToken: string;
  let anotherUserToken: string;

  beforeAll(async () => {
    process.env.MONGODB_URI = getTestMongoUri('pyramid-tasks-test-tasks');
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
    // Clear task collection before each test
    const collections = mongoConnection.collections;
    if (collections['tasks']) {
      await collections['tasks'].deleteMany({});
    }
  });

  describe('POST /api/tasks', () => {
    it('should create a task for the authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: 'Learn NestJS E2E',
          description: 'Write complete e2e tests',
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
        })
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('title', 'Learn NestJS E2E');
      expect(response.body).toHaveProperty('userId');
    });

    it('should reject task creation if validation fails (e.g. empty title)', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          title: '', // title must not be empty (MinLength(1))
        })
        .expect(400);
    });

    it('should return 401 if unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/tasks')
        .send({ title: 'Unauthorized task' })
        .expect(401);
    });
  });

  describe('GET /api/tasks', () => {
    it('should fetch tasks belonging only to the authenticated user', async () => {
      // User 1 creates a task
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'User 1 Task' });

      // User 2 creates a task
      await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ title: 'User 2 Task' });

      // User 1 fetches their tasks
      const response1 = await request(app.getHttpServer())
        .get('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response1.body.length).toBe(1);
      expect(response1.body[0]).toHaveProperty('title', 'User 1 Task');

      // User 2 fetches their tasks
      const response2 = await request(app.getHttpServer())
        .get('/api/tasks')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(200);

      expect(response2.body.length).toBe(1);
      expect(response2.body[0]).toHaveProperty('title', 'User 2 Task');
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return the task if owned by user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'My Specific Task' });

      const taskId = createResponse.body._id;

      const getResponse = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(getResponse.body).toHaveProperty('title', 'My Specific Task');
    });

    it('should return 403 Forbidden if user tries to fetch another user\'s task', async () => {
      // User 2 creates a task
      const createResponse = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ title: 'Secret Task' });

      const taskId = createResponse.body._id;

      // User 1 attempts to fetch it
      await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 404 if task does not exist at all', async () => {
      const nonExistentId = '60d5ecb5b5c9c925d4817d12'; // Valid hex format but non-existent
      await request(app.getHttpServer())
        .get(`/api/tasks/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('should update a task owned by user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Old Title', status: TaskStatus.TODO });

      const taskId = createResponse.body._id;

      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'New Title', status: TaskStatus.COMPLETED })
        .expect(200);

      expect(updateResponse.body).toHaveProperty('title', 'New Title');
      expect(updateResponse.body).toHaveProperty('status', TaskStatus.COMPLETED);
    });

    it('should return 403 Forbidden if user tries to update another user\'s task', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ title: 'Task to Steal' });

      const taskId = createResponse.body._id;

      await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Stolen Title' })
        .expect(403);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task owned by user', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Task to Delete' });

      const taskId = createResponse.body._id;

      await request(app.getHttpServer())
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(204);

      // Verify it's gone
      await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 403 Forbidden if user tries to delete another user\'s task', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send({ title: 'Safe Task' });

      const taskId = createResponse.body._id;

      await request(app.getHttpServer())
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
