import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  statisticsService,
  archiveService,
  holidayService,
} from '../services';
import {
  monthlyReportSchema,
  efficiencyStatsSchema,
  hotspotQuerySchema,
  createHolidaySchema,
  updateHolidaySchema,
  holidayCleanupSchema,
  dashboardSchema,
  MonthlyReportInput,
  EfficiencyStatsInput,
  HotspotQueryInput,
  CreateHolidayInput,
  UpdateHolidayInput,
  HolidayCleanupInput,
  QueryArchiveInput,
  DashboardInput,
} from '../schemas';
import { authenticate, requireRoles } from '../middleware/auth';
import { UserRole, HolidayType, ReportStatus } from '../types/enums';
import { PaginationParams } from '../types';
import { ZodError } from 'zod';

function formatZodError(error: ZodError): string {
  return error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
}

export default async function reviewRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: DashboardInput }>('/dashboard', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validatedQuery = dashboardSchema.parse(request.query);
      const data = await statisticsService.getDashboard(validatedQuery);
      reply.send({
        success: true,
        data,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        reply.code(400).send({
          success: false,
          error: formatZodError(error),
        });
        return;
      }
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get('/statistics/overview', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await statisticsService.getOverallStats();
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

  fastify.get<{ Querystring: MonthlyReportInput }>('/statistics/monthly', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validatedQuery = monthlyReportSchema.parse(request.query);
      const report = await statisticsService.getMonthlyReport(validatedQuery);
      reply.send({
        success: true,
        data: report,
      });
    } catch (error: any) {
      if (error instanceof ZodError) {
        reply.code(400).send({
          success: false,
          error: formatZodError(error),
        });
        return;
      }
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: EfficiencyStatsInput }>('/statistics/efficiency', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validatedQuery = efficiencyStatsSchema.parse(request.query);
      const stats = await statisticsService.getEfficiencyStats(validatedQuery);
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

  fastify.get<{ Querystring: HotspotQueryInput }>('/statistics/hotspots', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validatedQuery = hotspotQuerySchema.parse(request.query);
      const hotspots = await statisticsService.getHotspots(validatedQuery);
      reply.send({
        success: true,
        data: hotspots,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: { days?: number } }>('/statistics/trend', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const trend = await statisticsService.getTrendData(request.query.days || 30);
      reply.send({
        success: true,
        data: trend,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get('/statistics/remind', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await statisticsService.getRemindStats();
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

  fastify.get<{ Querystring: { startDate?: Date; endDate?: Date } }>('/statistics/disposal', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await statisticsService.getDisposalStats(request.query.startDate, request.query.endDate);
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

  fastify.get<{ Querystring: QueryArchiveInput }>('/archives', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await archiveService.getArchiveList(request.query);
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

  fastify.get<{ Params: { id: string } }>('/archives/:id', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const archive = await archiveService.getArchiveById(parseInt(request.params.id));
      if (!archive) {
        reply.code(404).send({
          success: false,
          error: '归档记录不存在',
        });
        return;
      }
      reply.send({
        success: true,
        data: archive,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string } }>('/cases/:id/archive', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const archive = await archiveService.archiveCase(
        parseInt(request.params.id),
        request.user?.userId
      );
      reply.send({
        success: true,
        data: archive,
        message: '案件已归档',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: { caseIds: number[] } }>('/archives/batch', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const result = await archiveService.batchArchive(
        request.body.caseIds,
        request.user?.userId
      );
      reply.send({
        success: true,
        data: result,
        message: `批量归档完成：成功 ${result.success} 件，失败 ${result.failed} 件`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: { daysOld?: number } }>('/archives/auto', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const result = await archiveService.archiveResolvedCases(
        request.body.daysOld || 30,
        request.user?.userId
      );
      reply.send({
        success: true,
        data: result,
        message: `自动归档完成：共 ${result.totalResolved} 件已解决案件，已归档 ${result.archived} 件`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: { startDate?: Date; endDate?: Date } }>('/archives/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await archiveService.getArchiveStats(request.query.startDate, request.query.endDate);
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

  fastify.get<{ Querystring: PaginationParams & { year?: number; type?: HolidayType; isActive?: boolean } }>('/holidays', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await holidayService.getHolidayList(request.query);
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

  fastify.get('/holidays/active', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const holiday = await holidayService.getActiveHoliday();
      reply.send({
        success: true,
        data: holiday,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Querystring: { days?: number } }>('/holidays/upcoming', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const holidays = await holidayService.getUpcomingHolidays(request.query.days || 30);
      reply.send({
        success: true,
        data: holidays,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Body: CreateHolidayInput }>('/holidays', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const validated = createHolidaySchema.parse(request.body);
      const holiday = await holidayService.createHoliday(validated);
      reply.send({
        success: true,
        data: holiday,
        message: '节假日已创建',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.put<{ Body: UpdateHolidayInput, Params: { id: string } }>('/holidays/:id', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const validated = updateHolidaySchema.parse(request.body);
      const holiday = await holidayService.updateHoliday(
        parseInt(request.params.id),
        validated
      );
      reply.send({
        success: true,
        data: holiday,
        message: '节假日已更新',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.post<{ Params: { id: string } }>('/holidays/:id/activate', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const holiday = await holidayService.activateHoliday(parseInt(request.params.id));
      reply.send({
        success: true,
        data: holiday,
        message: '节假日专项清理已启动',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string }; Querystring: PaginationParams & { status?: ReportStatus } }>('/holidays/:id/cases', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const result = await holidayService.getHolidayCases(
        parseInt(request.params.id),
        request.query
      );
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

  fastify.get<{ Params: { id: string } }>('/holidays/:id/stats', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const stats = await holidayService.getHolidayStats(parseInt(request.params.id));
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

  fastify.post<{ Body: HolidayCleanupInput }>('/holidays/cleanup', {
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      const validated = holidayCleanupSchema.parse(request.body);
      const result = await holidayService.executeCleanup(
        validated,
        request.user?.userId
      );
      reply.send({
        success: true,
        data: result,
        message: `清理执行完成：共 ${result.total} 件，成功 ${result.success} 件，失败 ${result.failed} 件`,
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/holidays/:id', {
    preHandler: [authenticate, requireRoles(UserRole.ADMIN)],
  }, async (request, reply) => {
    try {
      const success = await holidayService.deleteHoliday(parseInt(request.params.id));
      if (!success) {
        reply.code(404).send({
          success: false,
          error: '节假日不存在',
        });
        return;
      }
      reply.send({
        success: true,
        message: '节假日已删除',
      });
    } catch (error: any) {
      reply.code(400).send({
        success: false,
        error: error.message,
      });
    }
  });
}
