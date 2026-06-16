import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services';
import {
  loginSchema,
  registerSchema,
  updateUserSchema,
  changePasswordSchema,
  LoginInput,
  RegisterInput,
  UpdateUserInput,
  ChangePasswordInput,
} from '../schemas';
import { authenticate, requireRoles } from '../middleware/auth';
import { UserRole } from '../types/enums';
import { PaginationParams } from '../types';

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: LoginInput }>('/login', {}, async (request, reply) => {
    try {
      const validated = loginSchema.parse(request.body);
      const result = await authService.login(validated);
      reply.send({
        success: true,
        data: result,
        message: '登录成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: RegisterInput }>('/register', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const validated = registerSchema.parse(request.body);
      const user = await authService.register(validated, request.user?.userId);
      reply.send({
        success: true,
        data: user,
        message: '用户创建成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get('/me', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const user = await authService.getCurrentUser(request.user!.userId);
      reply.send({
        success: true,
        data: user,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.put<{ Body: UpdateUserInput }>('/me', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = updateUserSchema.parse(request.body);
      const user = await authService.updateUser(request.user!.userId, validated);
      reply.send({
        success: true,
        data: user,
        message: '信息更新成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: ChangePasswordInput }>('/change-password', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = changePasswordSchema.parse(request.body);
      await authService.changePassword(request.user!.userId, validated);
      reply.send({
        success: true,
        message: '密码修改成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: PaginationParams & { role?: UserRole; isActive?: boolean } }>('/users', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const result = await authService.getUserList(request.query);
      reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string } }>('/users/:id', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const user = await authService.getUserById(parseInt(request.params.id));
      if (!user) {
        reply.code(404).send({
          success: false,
          error: '用户不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: user,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.put<{ Body: UpdateUserInput, Params: { id: string } }>('/users/:id', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const validated = updateUserSchema.parse(request.body);
      const user = await authService.updateUser(parseInt(request.params.id), validated);
      reply.send({
        success: true,
        data: user,
        message: '用户信息更新成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/users/:id', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const success = await authService.deleteUser(parseInt(request.params.id));
      if (!success) {
        reply.code(404).send({
          success: false,
          error: '用户不存在',
        });
        return;
      }
      reply.send({
        success: true,
        message: '用户删除成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { role: UserRole } }>('/users/by-role/:role', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const users = await authService.getUsersByRole(request.params.role);
      reply.send({
        success: true,
        data: users,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });
}
