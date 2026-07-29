import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { asyncRoute, requireAuth, requirePermission, validate } from '../http.js';
import type { IdentityStore } from '../identity/store.js';
import type { ExecutiveAiReasoningService } from './service.js';
import { EXECUTIVE_AI_VERSION, type ExecutiveAiRequestType } from './types.js';

const question = z.string().trim().min(2).max(1200);
const questionSchema = z.object({ question }).strict();
const reportSchema = z
  .object({ question: question.optional().default('إعداد تقرير مجلس الإدارة من المعرفة المؤسسية') })
  .strict();
const recommendationsSchema = z
  .object({ question: question.optional().default('إعداد توصيات تنفيذية للرئيس التنفيذي') })
  .strict();
const donorProposalSchema = z
  .object({ question: question.optional().default('إعداد مقترح مهني موجه إلى جهة مانحة') })
  .strict();
const meetingMinutesSchema = z
  .object({ question: question.optional().default('إعداد مسودة محضر اجتماع تنفيذي') })
  .strict();
const executiveReportSchema = z
  .object({ question: question.optional().default('إعداد تقرير تنفيذي مهني') })
  .strict();
const decisionSchema = z
  .object({ question: question.optional().default('إعداد مشروع قرار تنفيذي') })
  .strict();
const actionPlanSchema = z
  .object({ question: question.optional().default('إعداد خطة عمل تنفيذية') })
  .strict();
const letterSchema = z
  .object({
    question,
    recipient: z.string().trim().min(2).max(160),
    subject: z.string().trim().min(2).max(240),
  })
  .strict();

const action = (service: ExecutiveAiReasoningService, type: ExecutiveAiRequestType) =>
  asyncRoute(async (request, response) => {
    response.json(
      await service.execute(
        {
          type,
          question: request.body.question,
          ...(type === 'OFFICIAL_LETTER'
            ? { recipient: request.body.recipient, subject: request.body.subject }
            : {}),
        },
        request.identity!,
        request.context,
      ),
    );
  });

export const createExecutiveAiRouter = (
  identityStore: IdentityStore,
  service: ExecutiveAiReasoningService,
  config: AppConfig,
) => {
  const router = Router();
  router.use('/executive-ai', requireAuth(identityStore, config));
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get('/executive-ai/capabilities', requirePermission('executive_ai.use'), (_req, res) =>
    res.json({
      version: EXECUTIVE_AI_VERSION,
      language: 'ar',
      evidenceRequired: true,
      externalGenerativeProvider: false,
      professionalRewrite: true,
      directParagraphCopying: false,
      referencesPresentedSeparately: true,
      modes: [
        'QUESTION',
        'BOARD_REPORT',
        'CEO_RECOMMENDATIONS',
        'OFFICIAL_LETTER',
        'DONOR_PROPOSAL',
        'MEETING_MINUTES',
        'EXECUTIVE_REPORT',
        'DECISION',
        'ACTION_PLAN',
      ],
    }),
  );
  router.post(
    '/executive-ai/ask',
    requirePermission('executive_ai.use'),
    limiter,
    validate(questionSchema),
    action(service, 'QUESTION'),
  );
  router.post(
    '/executive-ai/board-report',
    requirePermission('executive_ai.reports'),
    limiter,
    validate(reportSchema),
    action(service, 'BOARD_REPORT'),
  );
  router.post(
    '/executive-ai/recommendations',
    requirePermission('executive_ai.recommendations'),
    limiter,
    validate(recommendationsSchema),
    action(service, 'CEO_RECOMMENDATIONS'),
  );
  router.post(
    '/executive-ai/official-letter',
    requirePermission('executive_ai.letters'),
    limiter,
    validate(letterSchema),
    action(service, 'OFFICIAL_LETTER'),
  );
  router.post(
    '/executive-ai/donor-proposal',
    requirePermission('executive_ai.reports'),
    limiter,
    validate(donorProposalSchema),
    action(service, 'DONOR_PROPOSAL'),
  );
  router.post(
    '/executive-ai/meeting-minutes',
    requirePermission('executive_ai.reports'),
    limiter,
    validate(meetingMinutesSchema),
    action(service, 'MEETING_MINUTES'),
  );
  router.post(
    '/executive-ai/executive-report',
    requirePermission('executive_ai.reports'),
    limiter,
    validate(executiveReportSchema),
    action(service, 'EXECUTIVE_REPORT'),
  );
  router.post(
    '/executive-ai/decision',
    requirePermission('executive_ai.recommendations'),
    limiter,
    validate(decisionSchema),
    action(service, 'DECISION'),
  );
  router.post(
    '/executive-ai/action-plan',
    requirePermission('executive_ai.recommendations'),
    limiter,
    validate(actionPlanSchema),
    action(service, 'ACTION_PLAN'),
  );
  return router;
};
