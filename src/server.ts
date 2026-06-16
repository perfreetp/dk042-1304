import 'reflect-metadata';
import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { initializeDatabase } from './config/database';
import authRoutes from './routes/auth';
import receiveRoutes from './routes/receive';
import assignRoutes from './routes/assign';
import escalateRoutes from './routes/escalate';
import reviewRoutes from './routes/review';

const createServer = async (): Promise<FastifyInstance> => {
  const server = fastify({
    logger: {
      level: config.logLevel,
      transport: config.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  });

  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(swagger, {
    swagger: {
      info: {
        title: '僵尸车治理协同服务 API',
        description: '面向街道综治中心和城市停车治理人员的后端协同服务',
        version: '1.0.0',
      },
      tags: [
        { name: '认证', description: '用户认证相关接口' },
        { name: '接收', description: '举报接收和去重合并' },
        { name: '分派', description: '案件分派和处理' },
        { name: '升级', description: '案件升级和处置' },
        { name: '复盘', description: '统计分析和归档' },
      ],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
        },
      },
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  server.get('/health', async () => {
    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  });

  server.register(authRoutes, { prefix: '/api/auth' });
  server.register(receiveRoutes, { prefix: '/api/receive' });
  server.register(assignRoutes, { prefix: '/api/assign' });
  server.register(escalateRoutes, { prefix: '/api/escalate' });
  server.register(reviewRoutes, { prefix: '/api/review' });

  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.code(error.statusCode || 500).send({
      success: false,
      error: error.message || '服务器内部错误',
    });
  });

  server.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      success: false,
      error: '资源不存在',
      path: request.url,
    });
  });

  return server;
};

const start = async (): Promise<void> => {
  try {
    console.log('正在初始化数据库连接...');
    await initializeDatabase();

    console.log('正在创建服务器...');
    const server = await createServer();

    console.log('正在启动服务器...');
    await server.listen({
      port: config.port,
      host: '0.0.0.0',
    });

    console.log(`\n🚀 服务器启动成功!`);
    console.log(`📍 服务地址: http://localhost:${config.port}`);
    console.log(`📚 API文档: http://localhost:${config.port}/docs`);
    console.log(`💊 健康检查: http://localhost:${config.port}/health\n`);
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n正在关闭服务器...');
  process.exit(0);
});

if (require.main === module) {
  start();
}

export { createServer, start };
export default createServer;
