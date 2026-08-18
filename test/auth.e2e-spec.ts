import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let mongoConnection: Connection;

  beforeAll(async () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/pyramid-tasks-test-auth';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api'); // Match global prefix in main.ts
    
    // Register ValidationPipe to enable profile validation checks
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Get Mongoose connection to clean database before/after tests
    mongoConnection = app.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    // Close resources and drop test database
    try {
      await mongoConnection.dropDatabase();
    } catch (e) {}
    await mongoConnection.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clear database collections to keep tests isolated
    const collections = mongoConnection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  describe('POST /api/auth/guest', () => {
    it('should create a guest user and return a JWT token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/guest')
        .send({ name: 'TestGuest' })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('name', 'TestGuest');
      expect(response.body.user).toHaveProperty('isGuest', true);
      expect(response.body.user).toHaveProperty('_id');
    });

    it('should generate a random name if name is not provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/guest')
        .send({})
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.name).toContain('Guest_');
      expect(response.body.user).toHaveProperty('isGuest', true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile if token is valid', async () => {
      // Create a guest session
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/guest')
        .send({ name: 'MeGuest' });

      const token = loginResponse.body.token;

      // Access protected profile endpoint
      const profileResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('name', 'MeGuest');
      expect(profileResponse.body).toHaveProperty('isGuest', true);
    });

    it('should return 401 if token is missing', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should return 401 if token is invalid', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('should update profile fields successfully', async () => {
      // Create session
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/guest')
        .send({ name: 'Initial' });

      const token = loginResponse.body.token;

      // Update fields
      const updateResponse = await request(app.getHttpServer())
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'UpdatedName',
          email: 'test@example.com',
          title: 'Senior Developer',
          username: 'developer123',
        })
        .expect(200);

      expect(updateResponse.body).toHaveProperty('name', 'UpdatedName');
      expect(updateResponse.body).toHaveProperty('email', 'test@example.com');
      expect(updateResponse.body).toHaveProperty('title', 'Senior Developer');
      expect(updateResponse.body).toHaveProperty('username', 'developer123');

      // Verify fields persist when requesting /me
      const profileResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('name', 'UpdatedName');
      expect(profileResponse.body).toHaveProperty('email', 'test@example.com');
      expect(profileResponse.body).toHaveProperty('title', 'Senior Developer');
      expect(profileResponse.body).toHaveProperty('username', 'developer123');
    });

    it('should reject invalid email formats', async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/guest')
        .send({ name: 'ValidUser' });

      const token = loginResponse.body.token;

      await request(app.getHttpServer())
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });
});

