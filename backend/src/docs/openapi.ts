import type { Express } from 'express';
import * as swaggerUi from 'swagger-ui-express';

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'UTL-AcademyOS API',
    version: '0.1.0',
    description:
      'Multi-tenant AI-powered examination SaaS. All tenant-scoped requests require a Bearer JWT.',
  },
  servers: [{ url: '/api/v1', description: 'Current version' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
            required: ['code', 'message'],
          },
        },
      },
    },
  },
  paths: {
    '/health/live': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: { '200': { description: 'Process alive' } },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe (DB + Redis)',
        responses: {
          '200': { description: 'Ready' },
          '503': { description: 'Not ready' },
        },
      },
    },
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new institute + owner account',
        requestBody: { required: true },
        responses: { '201': { description: 'Created' }, '409': { description: 'Email taken' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive access + refresh tokens',
        responses: { '200': { description: 'OK' }, '401': { description: 'Invalid credentials' } },
      },
    },
  },
};

export function mountOpenApi(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'UTL API' }));
  app.get('/api/openapi.json', (_req, res) => res.json(spec));
}
