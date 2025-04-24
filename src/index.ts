import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import path from 'path';
import routes from './routes';
import config from './config';
import dotenv from 'dotenv';
import { connectMongo } from './utils/db';

dotenv.config(); // ЗАВАНТАЖИТИ .env ПЕРШИМ

console.log('Mongo URI:', process.env.MONGODB_URI);

async function start() {
  try {
    console.log(`Starting server in ${config.server.env} mode`);

    // 1. Підключення до MongoDB перед стартом сервера
    await connectMongo();

    const fastify = Fastify({
      logger: {
        level: config.logger.level,
        transport: config.isDevelopment ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        } : undefined,
      }
    });

    await fastify.register(cors, {
      origin: config.cors.origin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });

    await fastify.register(multipart, {
      limits: {
        fileSize: config.upload.maxFileSize,
      }
    });

    await fastify.register(fastifyStatic, {
      root: config.storage.uploadsDir,
      prefix: '/api/files/',
      decorateReply: false,
    });

    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Music Tracks API',
          description: 'API for managing music tracks',
          version: '1.0.0',
        }
      }
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true
      }
    });

    await fastify.register(routes);

    await fastify.listen({ 
      port: config.server.port, 
      host: config.server.host 
    });

    console.log(`Server is running on http://${config.server.host}:${config.server.port}`);
    console.log(`Swagger documentation available on http://${config.server.host}:${config.server.port}/documentation`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

start();
