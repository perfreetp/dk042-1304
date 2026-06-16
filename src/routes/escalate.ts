import { FastifyInstance, FastifyRequest } from 'fastify';
import { caseService, blacklistService, warningService } from '../services';
import {
  escalateCaseSchema,
  disposalCaseSchema,
  EscalateCaseInput,
  DisposalCaseInput,
  QueryCaseInput,
  QueryWarningInput,
} from '../schemas';
import { authenticate, requireRoles } from '../middleware/auth';
import { UserRole, ReportStatus } from '../types/enums';
import { PaginationParams } from '../types';

export default async function escalateRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: EscalateCaseInput, Params: { id: string } }>('/cases/:id/escalate', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = escalateCaseSchema.parse(request.body);
      const assignment = await caseService.escalateCase(
        parseInt(request.params.id),
        validated,
        request.user?.userId
      );
      reply.send({
        success: true,
        data: assignment,
        message: '案件已升级',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string } }>('/cases/:id/auto-escalate', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await caseService.autoEscalateCase(
        parseInt(request.params.id),
        request.user?.userId
      );
      if (!result) {
        reply.send({
          success: false,
          message: '案件暂不满足自动升级条件',
        });
        return;
      }
      reply.send({
        success: true,
        data: result,
        message: '案件已自动升级',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/cases/auto-escalate-all', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const result = await caseService.checkAndEscalateAll();
      reply.send({
        success: true,
        data: result,
        message: `已检查 ${result.checkedCount} 件案件，自动升级 ${result.escalatedCount} 件`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: DisposalCaseInput, Params: { id: string } }>('/cases/:id/dispose', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = disposalCaseSchema.parse(request.body);
      const disposal = await caseService.addDisposal(
        parseInt(request.params.id),
        validated,
        request.user?.userId
      );
      reply.send({
        success: true,
        data: disposal,
        message: '处置记录已添加',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string }; Body: { remark?: string } }>('/cases/:id/resolve', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const caseItem = await caseService.resolveCase(
        parseInt(request.params.id),
        request.body.remark
      );
      reply.send({
        success: true,
        data: caseItem,
        message: '案件已解决',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: PaginationParams }>('/cases/escalated', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await caseService.getCaseList({
        ...request.query,
        status: ReportStatus.ESCALATED,
      } as QueryCaseInput);
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

  fastify.get<{ Querystring: PaginationParams & { plateNumber?: string; isActive?: boolean } }>('/blacklist', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await blacklistService.getBlacklist(request.query);
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

  fastify.get<{ Querystring: { limit?: number } }>('/blacklist/top', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await blacklistService.getTopBlacklist(request.query.limit);
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

  fastify.get('/blacklist/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await blacklistService.getBlacklistStats();
      reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string }; Body: { reason: string } }>('/blacklist/:id/remove', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const result = await blacklistService.removeFromBlacklist(
        parseInt(request.params.id),
        request.body.reason
      );
      reply.send({
        success: true,
        data: result,
        message: '已从黑名单移除',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: QueryWarningInput }>('/warnings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await warningService.getWarningList(request.query);
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

  fastify.get<{ Params: { id: string } }>('/warnings/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const warning = await warningService.getWarningDetail(parseInt(request.params.id));
      if (!warning) {
        reply.code(404).send({
          success: false,
          error: '预警不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: warning,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get('/warnings/unacknowledged/count', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const count = await warningService.getUnacknowledgedCount();
      reply.send({
        success: true,
        data: count,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string }; Body: { remark?: string } }>('/warnings/:id/acknowledge', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const warning = await warningService.acknowledgeWarning(
        parseInt(request.params.id),
        request.user!.userId,
        request.body
      );
      reply.send({
        success: true,
        data: warning,
        message: '预警已确认',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: { ids: number[]; remark?: string } }>('/warnings/batch-acknowledge', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const count = await warningService.batchAcknowledge(
        request.body.ids,
        request.user!.userId,
        request.body.remark
      );
      reply.send({
        success: true,
        data: { acknowledged: count },
        message: `已确认 ${count} 条预警`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/warnings/generate/overtime', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const count = await warningService.generateOvertimeWarnings();
      reply.send({
        success: true,
        data: { generated: count },
        message: `已生成 ${count} 条超时预警`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post('/warnings/generate/hotspot', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const count = await warningService.generateHotspotWarnings();
      reply.send({
        success: true,
        data: { generated: count },
        message: `已生成 ${count} 条重点点位预警`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string } }>('/cases/:id/warnings', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const warnings = await warningService.getWarningsByCaseId(parseInt(request.params.id));
      reply.send({
        success: true,
        data: warnings,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });
}
