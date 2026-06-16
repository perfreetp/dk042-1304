import { FastifyInstance, FastifyRequest } from 'fastify';
import { reportService, vehicleService } from '../services';
import {
  createReportSchema,
  updateReportSchema,
  queryReportSchema,
  mergeReportSchema,
  CreateReportInput,
  UpdateReportInput,
  QueryReportInput,
  MergeReportInput,
} from '../schemas';
import { authenticate, optionalAuth } from '../middleware/auth';
import { ReportSource, UserRole } from '../types/enums';
import { PaginationParams } from '../types';

export default async function receiveRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: CreateReportInput }>('/reports', {
    preHandler: [optionalAuth],
  }, async (request, reply) => {
    try {
      const validated = createReportSchema.parse(request.body);
      const result = await reportService.createReport(validated, request.user?.userId);
      reply.send({
        success: true,
        data: result,
        message: result.isNewCase ? '举报成功，已创建新案件' : '举报成功，已合并至现有案件',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: CreateReportInput }>('/reports/resident', {
  }, async (request, reply) => {
    try {
      const bodyWithSource = { ...request.body, source: ReportSource.RESIDENT };
      const validated = createReportSchema.parse(bodyWithSource);
      const result = await reportService.createReport(validated);
      reply.send({
        success: true,
        data: result,
        message: '居民举报已受理',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: CreateReportInput }>('/reports/property', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const bodyWithSource = { ...request.body, source: ReportSource.PROPERTY, reporterId: request.user?.userId };
      const validated = createReportSchema.parse(bodyWithSource);
      const result = await reportService.createReport(validated, request.user?.userId);
      reply.send({
        success: true,
        data: result,
        message: '物业上报已受理',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: CreateReportInput }>('/reports/patrol', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const bodyWithSource = { ...request.body, source: ReportSource.PATROL, reporterId: request.user?.userId };
      const validated = createReportSchema.parse(bodyWithSource);
      const result = await reportService.createReport(validated, request.user?.userId);
      reply.send({
        success: true,
        data: result,
        message: '巡查发现已记录',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: QueryReportInput }>('/reports', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await reportService.getReportList(request.query);
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

  fastify.get<{ Querystring: PaginationParams }>('/reports/pending', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await reportService.getPendingReports(request.query);
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

  fastify.get<{ Params: { source: ReportSource }; Querystring: PaginationParams }>('/reports/source/:source', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await reportService.getReportsBySource(request.params.source, request.query);
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

  fastify.get<{ Params: { id: string } }>('/reports/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const report = await reportService.getReportById(parseInt(request.params.id));
      if (!report) {
        reply.code(404).send({
          success: false,
          error: '举报记录不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: report,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.put<{ Body: UpdateReportInput, Params: { id: string } }>('/reports/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = updateReportSchema.parse(request.body);
      const report = await reportService.updateReport(parseInt(request.params.id), validated);
      reply.send({
        success: true,
        data: report,
        message: '举报记录更新成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/reports/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const success = await reportService.deleteReport(parseInt(request.params.id));
      if (!success) {
        reply.code(404).send({
          success: false,
          error: '举报记录不存在',
        });
        return;
      }
      reply.send({
        success: true,
        message: '举报记录删除成功',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: MergeReportInput }>('/reports/merge', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = mergeReportSchema.parse(request.body);
      const result = await reportService.mergeReports(validated);
      reply.send({
        success: true,
        data: result,
        message: `成功合并 ${result.mergedCount} 条举报记录`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: { plateNumber: string; location: string; hours?: number } }>('/reports/duplicates/check', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const duplicates = await reportService.findPotentialDuplicates(
        request.query.plateNumber,
        request.query.location,
        request.query.hours
      );
      reply.send({
        success: true,
        data: {
          duplicates,
          count: duplicates.length,
        },
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { caseId: string } }>('/reports/case/:caseId', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const reports = await reportService.getReportsByCaseId(parseInt(request.params.caseId));
      reply.send({
        success: true,
        data: reports,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: { startDate?: Date; endDate?: Date } }>('/reports/stats/summary', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await reportService.getReportStats(request.query.startDate, request.query.endDate);
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

  fastify.get<{ Querystring: { keyword: string; limit?: number } }>('/vehicles/search', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const vehicles = await vehicleService.searchVehicles(request.query.keyword, request.query.limit);
      reply.send({
        success: true,
        data: vehicles,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string } }>('/vehicles/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const vehicle = await vehicleService.getVehicleById(parseInt(request.params.id));
      if (!vehicle) {
        reply.code(404).send({
          success: false,
          error: '车辆不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: vehicle,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { plateNumber: string } }>('/vehicles/plate/:plateNumber', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const vehicle = await vehicleService.getVehicleByPlateNumber(request.params.plateNumber);
      if (!vehicle) {
        reply.code(404).send({
          success: false,
          error: '车辆不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: vehicle,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string } }>('/vehicles/:id/history', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const history = await vehicleService.getVehicleHistory(parseInt(request.params.id));
      reply.send({
        success: true,
        data: history,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });
}
