import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload, UserRole } from '../types';
import { authService } from '../services';

export const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({
        success: false,
        error: '未提供认证令牌',
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    const user = await authService.getCurrentUser(decoded.userId);
    if (!user) {
      reply.code(401).send({
        success: false,
        error: '用户不存在或已被禁用',
      });
      return;
    }

    request.user = decoded;
  } catch (error) {
    reply.code(401).send({
      success: false,
      error: '认证令牌无效或已过期',
    });
  }
};

export const requireRoles = (...roles: UserRole[]) => {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      reply.code(401).send({
        success: false,
        error: '未认证',
      });
      return;
    }

    if (!roles.includes(request.user.role) && request.user.role !== UserRole.ADMIN) {
      reply.code(403).send({
        success: false,
        error: '权限不足',
      });
      return;
    }
  };
};

export const optionalAuth = async (request: FastifyRequest): Promise<void> => {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      const user = await authService.getCurrentUser(decoded.userId);
      if (user) {
        request.user = decoded;
      }
    }
  } catch (error) {
  }
};
