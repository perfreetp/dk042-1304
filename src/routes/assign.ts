import { FastifyInstance, FastifyRequest } from 'fastify';
import { caseService } from '../services';
import {
  assignCaseSchema,
  queryCaseSchema,
  AssignCaseInput,
  QueryCaseInput,
} from '../schemas';
import { authenticate, requireRoles } from '../middleware/auth';
import { UserRole, AssignmentStatus, ReportStatus } from '../types/enums';
import { PaginationParams } from '../types';

export default async function assignRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: QueryCaseInput }>('/cases', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await caseService.getCaseList(request.query);
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

  fastify.get<{ Querystring: PaginationParams }>('/cases/pending', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await caseService.getCaseList({
        ...request.query,
        status: ReportStatus.PENDING,
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

  fastify.get<{ Querystring: PaginationParams }>('/cases/processing', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await caseService.getCaseList({
        ...request.query,
        status: ReportStatus.PROCESSING,
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

  fastify.get<{ Querystring: PaginationParams & { status?: AssignmentStatus } }>('/cases/my', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await caseService.getCasesByAssignee(request.user!.userId, request.query);
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

  fastify.get<{ Params: { id: string } }>('/cases/:id/detail', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const caseItem = await caseService.getCaseDetail(parseInt(request.params.id));
      if (!caseItem) {
        reply.code(404).send({
          success: false,
          error: '案件不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: caseItem,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string } }>('/cases/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const caseItem = await caseService.getCaseById(parseInt(request.params.id));
      if (!caseItem) {
        reply.code(404).send({
          success: false,
          error: '案件不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: caseItem,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { caseNumber: string } }>('/cases/number/:caseNumber', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const caseItem = await caseService.getCaseByNumber(request.params.caseNumber);
      if (!caseItem) {
        reply.code(404).send({
          success: false,
          error: '案件不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: caseItem,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: AssignCaseInput, Params: { id: string } }>('/cases/:id/assign', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = assignCaseSchema.parse(request.body);
      const assignment = await caseService.assignCase(
        parseInt(request.params.id),
        validated,
        request.user?.userId
      );
      reply.send({
        success: true,
        data: assignment,
        message: '案件分派成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string } }>('/cases/:id/auto-assign', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const assignment = await caseService.autoAssignCase(
        parseInt(request.params.id),
        request.user?.userId
      );
      reply.send({
        success: true,
        data: assignment,
        message: '案件已自动分派',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: { caseIds: number[] } }>('/cases/batch-auto-assign', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const caseId of request.body.caseIds) {
        try {
          await caseService.autoAssignCase(caseId, request.user?.userId);
          successCount++;
        } catch (e) {
          failCount++;
          results.push({ caseId, error: (e as Error).message });
        }
      }

      reply.send({
        success: true,
        data: {
          successCount,
          failCount,
          errors: results,
        },
        message: `批量分派完成：成功 ${successCount} 件，失败 ${failCount} 件`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string }; Body: { remark?: string } }>('/assignments/:id/accept', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { Assignment } = await import('../entities');
      const { getRepository } = await import('../config/database');
      const assignmentRepo = getRepository(Assignment);

      const assignment = await assignmentRepo.findOne({ where: { id: parseInt(request.params.id) } });
      if (!assignment) {
        reply.code(404).send({
          success: false,
          error: '分派记录不存在',
        });
        return;
      }

      if (assignment.assigneeId !== request.user?.userId) {
        reply.code(403).send({
          success: false,
          error: '无权处理此分派',
        });
        return;
      }

      assignment.status = AssignmentStatus.ACCEPTED;
      assignment.acceptedAt = new Date();
      assignment.acceptRemark = request.body.remark;

      await assignmentRepo.save(assignment);

      reply.send({
        success: true,
        data: assignment,
        message: '已接受分派',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string }; Body: { reason: string } }>('/assignments/:id/reject', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { Assignment } = await import('../entities');
      const { getRepository } = await import('../config/database');
      const assignmentRepo = getRepository(Assignment);

      const assignment = await assignmentRepo.findOne({ where: { id: parseInt(request.params.id) } });
      if (!assignment) {
        reply.code(404).send({
          success: false,
          error: '分派记录不存在',
        });
        return;
      }

      assignment.status = AssignmentStatus.REJECTED;
      assignment.rejectedAt = new Date();
      assignment.rejectReason = request.body.reason;

      await assignmentRepo.save(assignment);

      reply.send({
        success: true,
        data: assignment,
        message: '已拒绝分派',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string } }>('/assignments/:id/start', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const { Assignment } = await import('../entities');
      const { getRepository } = await import('../config/database');
      const assignmentRepo = getRepository(Assignment);

      const assignment = await assignmentRepo.findOne({ where: { id: parseInt(request.params.id) } });
      if (!assignment) {
        reply.code(404).send({
          success: false,
          error: '分派记录不存在',
        });
        return;
      }

      if (assignment.assigneeId !== request.user?.userId) {
        reply.code(403).send({
          success: false,
          error: '无权处理此分派',
        });
        return;
      }

      assignment.status = AssignmentStatus.IN_PROGRESS;

      await assignmentRepo.save(assignment);

      reply.send({
        success: true,
        data: assignment,
        message: '已开始处置',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string } }>('/cases/:id/timeline', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const timeline = await caseService.getCaseTimeline(parseInt(request.params.id));
      reply.send({
        success: true,
        data: timeline,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });
}
