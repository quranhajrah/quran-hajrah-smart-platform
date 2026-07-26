import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { AppError } from '../http.js';
import type { IdentityUser, RequestMeta } from '../identity/types.js';
import { requireDocumentAccess } from '../documents/security.js';
import type { StorageProvider } from '../documents/storage.js';
import type { DocumentStore } from '../documents/store.js';
import type { DocumentRecord, DocumentVersionRecord } from '../documents/types.js';
import { createLogger, type Logger } from '../logger.js';
import { ExtractionProviderRegistry } from './providers.js';
import { InstitutionalExtractionService } from './rules.js';
import type { AnalysisStore } from './store.js';
import { AnalysisPipelineError } from './types.js';
import type {
  AnalysisListQuery,
  AnalysisPipelineStage,
  ConflictResult,
  ImportDecision,
  ProposalDecision,
  ProposalListQuery,
} from './types.js';

const pipelineStageLabels: Record<AnalysisPipelineStage, string> = {
  configuration: 'تحميل إعدادات التحليل',
  file_retrieval: 'استرجاع ملف المستند',
  provider_selection: 'اختيار معالج الملف',
  pdf_parsing: 'فتح بنية ملف PDF',
  text_extraction: 'استخراج النص والصفحات',
  proposal_generation: 'إنشاء المقترحات المؤسسية',
  page_creation: 'حفظ الصفحات والجداول المستخرجة',
  proposal_persistence: 'حفظ المقترحات المستخرجة',
  job_finalization: 'إنهاء مهمة التحليل',
  audit: 'تسجيل أثر التحليل',
};

const originalError = (error: unknown) =>
  error instanceof AnalysisPipelineError ? error.originalError : error;

const safeDiagnosticMessage = (error: unknown) => {
  const source = originalError(error);
  const message = source instanceof Error ? source.message : String(source);
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[redacted]@')
    .replace(/[A-Za-z]:\\[^\s]+/g, '[redacted-path]')
    .replace(/\/(?:home|var|srv|tmp)\/[^\s]+/g, '/[redacted-path]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
};

const failureCode = (error: unknown) => {
  const source = originalError(error);
  if (source instanceof AppError) return source.code;
  const code =
    source && typeof source === 'object' && 'code' in source
      ? String((source as { code?: unknown }).code ?? '')
      : '';
  if (code === 'P2028') return 'ANALYSIS_PERSISTENCE_TIMEOUT';
  if (code === 'ENOENT') return 'ANALYSIS_FILE_NOT_FOUND';
  if (code === 'EACCES' || code === 'EPERM') return 'ANALYSIS_FILE_PERMISSION_DENIED';
  return code || 'ANALYSIS_INTERNAL_ERROR';
};

export const analysisFailureDetails = (error: unknown, currentStage: AnalysisPipelineStage) => {
  const stage = error instanceof AnalysisPipelineError ? error.stage : currentStage;
  const source = originalError(error);
  const code = failureCode(error);
  const diagnosticMessage = safeDiagnosticMessage(error);
  const diagnosticId = createHash('sha256')
    .update(`${stage}|${code}|${diagnosticMessage}`)
    .digest('hex')
    .slice(0, 12);

  let userMessage: string;
  if (source instanceof AppError) {
    userMessage = source.message;
  } else if (code === 'ANALYSIS_PERSISTENCE_TIMEOUT') {
    userMessage =
      'اكتمل استخراج المستند، لكن انتهت مهلة حفظ النتائج في قاعدة البيانات. لم تُحفظ نتائج جزئية، ويمكن إعادة التحليل بأمان.';
  } else {
    const messages: Partial<Record<AnalysisPipelineStage, string>> = {
      configuration:
        'تعذر تحميل إعدادات تحليل المستند. تحقق من جاهزية قاعدة البيانات ثم أعد المحاولة.',
      file_retrieval:
        'تعذر استرجاع ملف المستند من التخزين. تحقق من وجود الملف وصلاحيات مجلد التخزين ثم أعد المحاولة.',
      provider_selection: 'نوع الملف غير مدعوم بواسطة معالجات التحليل الحالية.',
      pdf_parsing:
        'تعذر فتح بنية ملف PDF. قد يحتوي الملف على بنية غير متوافقة أو تلف يحتاج إلى إعادة تصدير.',
      text_extraction:
        'تم فتح الملف، لكن تعذر استخراج النص والصفحات منه. أعد تصدير الملف بصيغة PDF نصية ثم حاول مجددًا.',
      proposal_generation:
        'تم استخراج صفحات المستند، لكن تعذر إنشاء المقترحات المؤسسية. لم يتم استيراد أي بيانات.',
      page_creation:
        'تم استخراج صفحات المستند، لكن تعذر حفظها في قاعدة البيانات. لم تُحفظ نتائج جزئية.',
      proposal_persistence:
        'تم استخراج النص، لكن تعذر حفظ المقترحات في قاعدة البيانات. لم تُحفظ نتائج جزئية.',
      job_finalization: 'اكتمل استخراج المستند، لكن تعذر إنهاء مهمة التحليل في قاعدة البيانات.',
      audit: 'اكتمل مسار التحليل، لكن تعذر تسجيل أثر العملية.',
    };
    userMessage = messages[stage] ?? 'تعذر إكمال تحليل المستند. راجع سلامة الملف ثم أعد المحاولة.';
  }

  return {
    stage,
    stageLabel: pipelineStageLabels[stage],
    code,
    diagnosticId,
    diagnosticMessage,
    errorName: source instanceof Error ? source.name : 'UnknownError',
    userMessage: `${userMessage} (معرّف التشخيص: ${diagnosticId})`,
  };
};

const readWithinLimit = async (stream: Readable, maximumBytes: number) => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maximumBytes) {
      stream.destroy();
      throw new AppError(413, 'حجم الملف يتجاوز الحد المسموح للتحليل.', 'ANALYSIS_FILE_TOO_LARGE');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
};

export const hasSufficientEmbeddedText = (
  pages: Array<{ text: string }>,
  minimumCharacters: number,
) => pages.reduce((total, page) => total + page.text.length, 0) >= minimumCharacters;

export class DocumentAnalysisService {
  constructor(
    private readonly analysisStore: AnalysisStore,
    private readonly documentStore: DocumentStore,
    private readonly storage: StorageProvider,
    private readonly logger: Logger = createLogger('info'),
    private readonly providers = new ExtractionProviderRegistry(),
    private readonly extractor = new InstitutionalExtractionService(),
  ) {}

  async start(documentId: string, user: IdentityUser, context: RequestMeta, force = false) {
    const [configuration, document] = await Promise.all([
      this.analysisStore.getConfiguration(),
      this.requiredDocument(documentId),
    ]);
    await requireDocumentAccess(this.documentStore, document, user, 'edit');
    if (!configuration.isActive) {
      throw new AppError(409, 'تحليل المستندات متوقف مؤقتًا.', 'ANALYSIS_DISABLED');
    }
    if (!configuration.enabledDocumentTypes.includes(document.documentType)) {
      throw new AppError(
        422,
        'نوع المستند غير مفعّل للتحليل في الإعدادات الحالية.',
        'ANALYSIS_DOCUMENT_TYPE_DISABLED',
      );
    }
    const version = await this.currentVersion(document);
    const stableFingerprint = createHash('sha256')
      .update(
        [
          document.id,
          version.id,
          version.checksum,
          configuration.providerVersion,
          [...configuration.enabledRuleIds].sort().join(','),
        ].join('|'),
      )
      .digest('hex');
    const fingerprint = force
      ? createHash('sha256').update(`${stableFingerprint}|${randomUUID()}`).digest('hex')
      : stableFingerprint;
    const existing = force ? null : await this.analysisStore.findJobByFingerprint(fingerprint);
    if (existing && existing.status !== 'FAILED' && existing.status !== 'CANCELLED') {
      return { job: existing, reused: true };
    }
    const job =
      existing ??
      (await this.analysisStore.createJob({
        documentId: document.id,
        documentVersionId: version.id,
        fingerprint,
        extractionVersion: configuration.providerVersion,
        requestedById: user.id,
        reviewDueAt: new Date(Date.now() + configuration.reviewSlaHours * 3_600_000),
      }));
    if (existing) await this.analysisStore.clearJobForRetry(existing.id);
    await this.analysisStore.createAudit({
      jobId: job.id,
      userId: user.id,
      action: existing ? 'ANALYSIS_RETRIED' : 'ANALYSIS_REQUESTED',
      description: existing ? 'Document analysis retry requested.' : 'Document analysis requested.',
      metadata: force ? { forcedReanalysis: true } : undefined,
      ...context,
    });
    this.runInBackground(job.id, document, version);
    return {
      job: (await this.analysisStore.getJob(job.id)) ?? job,
      reused: false,
    };
  }

  async retry(jobId: string, user: IdentityUser, context: RequestMeta) {
    const job = await this.requiredJob(jobId, user, 'edit');
    if (!['FAILED', 'OCR_REQUIRED', 'CANCELLED'].includes(job.status)) {
      throw new AppError(
        409,
        'يمكن إعادة المحاولة فقط للتحليل المتعثر أو الملغى أو المحتاج إلى OCR.',
        'ANALYSIS_RETRY_NOT_ALLOWED',
      );
    }
    const document = await this.requiredDocument(job.documentId);
    const versions = await this.documentStore.listVersions(job.documentId);
    const version = versions.find((candidate) => candidate.id === job.documentVersionId);
    if (!version) throw new AppError(404, 'Document version not found.', 'NOT_FOUND');
    const reset = await this.analysisStore.clearJobForRetry(job.id);
    await this.analysisStore.createAudit({
      jobId,
      userId: user.id,
      action: 'ANALYSIS_RETRIED',
      description: 'Document analysis retry requested.',
      ...context,
    });
    this.runInBackground(job.id, document, version);
    return reset;
  }

  async cancel(jobId: string, user: IdentityUser, context: RequestMeta) {
    const job = await this.requiredJob(jobId, user, 'edit');
    if (!['QUEUED', 'PROCESSING'].includes(job.status)) {
      throw new AppError(
        409,
        'لا يمكن إلغاء التحليل في حالته الحالية.',
        'ANALYSIS_CANCEL_NOT_ALLOWED',
      );
    }
    const updated = await this.analysisStore.updateJob(job.id, {
      status: 'CANCELLED',
      completedAt: new Date(),
      failureReason: 'أُلغي التحليل بواسطة مستخدم مخوّل.',
    });
    await this.analysisStore.createAudit({
      jobId,
      userId: user.id,
      action: 'ANALYSIS_CANCELLED',
      description: 'Document analysis cancelled.',
      ...context,
    });
    return updated;
  }

  async list(query: AnalysisListQuery, user: IdentityUser) {
    const result = await this.analysisStore.listJobs(query);
    const allowed = [];
    for (const job of result.items) {
      const document = await this.documentStore.findDocument(job.documentId);
      if (!document) continue;
      try {
        await requireDocumentAccess(this.documentStore, document, user, 'view');
        allowed.push(job);
      } catch {
        // Confidential records are deliberately indistinguishable from absent records.
      }
    }
    // Avoid leaking the count of confidential analysis jobs.
    return { ...result, items: allowed, total: allowed.length };
  }

  async get(jobId: string, user: IdentityUser) {
    return this.requiredJob(jobId, user, 'view');
  }

  async pages(jobId: string, user: IdentityUser) {
    await this.requiredJob(jobId, user, 'view');
    return this.analysisStore.listPages(jobId);
  }

  async tables(jobId: string, user: IdentityUser) {
    await this.requiredJob(jobId, user, 'view');
    return this.analysisStore.listTables(jobId);
  }

  async proposals(jobId: string, query: ProposalListQuery, user: IdentityUser) {
    await this.requiredJob(jobId, user, 'view');
    return this.analysisStore.listProposals(jobId, query);
  }

  async updateProposal(
    proposalId: string,
    input: {
      title?: string;
      editedData?: Record<string, unknown>;
      importTargetType?: Parameters<AnalysisStore['updateProposal']>[1]['importTargetType'];
    },
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const proposal = await this.requiredProposal(proposalId, user, 'edit');
    const updated = await this.analysisStore.updateProposal(proposalId, input);
    await this.analysisStore.createAudit({
      jobId: proposal.jobId,
      proposalId,
      userId: user.id,
      action: 'PROPOSAL_EDITED',
      description: 'Extraction proposal edited before approval.',
      metadata: { fields: Object.keys(input) },
      ...context,
    });
    return updated;
  }

  async reviewProposal(
    proposalId: string,
    decision: Exclude<ProposalDecision, 'PENDING'>,
    user: IdentityUser,
    context: RequestMeta,
    comment?: string,
    editedData?: Record<string, unknown>,
  ) {
    const proposal = await this.requiredProposal(proposalId, user, 'edit');
    const updated = await this.analysisStore.reviewProposal(
      proposalId,
      decision,
      user.id,
      comment,
      editedData,
    );
    await this.analysisStore.refreshJobReviewStatus(proposal.jobId);
    await this.analysisStore.createAudit({
      jobId: proposal.jobId,
      proposalId,
      userId: user.id,
      action: `PROPOSAL_${decision}`,
      description: `Extraction proposal ${decision.toLowerCase()}.`,
      metadata: comment ? { hasComment: true } : undefined,
      ...context,
    });
    return updated;
  }

  async bulkReview(
    ids: string[],
    decision: 'APPROVED' | 'REJECTED',
    user: IdentityUser,
    context: RequestMeta,
    comment?: string,
  ) {
    const proposals = await Promise.all(
      ids.map((proposalId) => this.requiredProposal(proposalId, user, 'edit')),
    );
    if (new Set(proposals.map((proposal) => proposal.jobId)).size !== 1) {
      throw new AppError(
        400,
        'يجب أن تنتمي المقترحات المحددة إلى مهمة تحليل واحدة.',
        'ANALYSIS_BULK_JOB_MISMATCH',
      );
    }
    const reviewed = await this.analysisStore.reviewProposals(ids, decision, user.id, comment);
    const jobId = proposals[0]!.jobId;
    await this.analysisStore.refreshJobReviewStatus(jobId);
    await this.analysisStore.createAudit({
      jobId,
      userId: user.id,
      action: `PROPOSALS_BULK_${decision}`,
      description: `Bulk ${decision.toLowerCase()} applied to extraction proposals.`,
      metadata: { count: ids.length },
      ...context,
    });
    return reviewed;
  }

  async importPreview(jobId: string, user: IdentityUser, context: RequestMeta) {
    await this.requiredJob(jobId, user, 'edit');
    const conflicts = await this.analysisStore.detectConflicts(jobId);
    await this.analysisStore.createAudit({
      jobId,
      userId: user.id,
      action: 'IMPORT_PREVIEWED',
      description: 'Extraction import preview generated.',
      metadata: {
        conflicts: conflicts.filter((item) => item.status === 'conflict').length,
      },
      ...context,
    });
    return conflicts;
  }

  async import(
    jobId: string,
    decisions: ImportDecision[],
    idempotencyKey: string | undefined,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const job = await this.requiredJob(jobId, user, 'edit');
    if (!['APPROVED', 'PARTIALLY_APPROVED', 'IMPORTED'].includes(job.status)) {
      throw new AppError(
        409,
        'لا توجد مقترحات معتمدة جاهزة للاستيراد.',
        'ANALYSIS_IMPORT_NOT_READY',
      );
    }
    const batch = await this.analysisStore.importApproved(
      jobId,
      idempotencyKey ?? randomUUID(),
      decisions,
      user.id,
    );
    await this.analysisStore.createAudit({
      jobId,
      importBatchId: batch.id,
      userId: user.id,
      action: 'PROPOSALS_IMPORTED',
      description: 'Approved extraction proposals imported transactionally.',
      metadata: { status: batch.status },
      ...context,
    });
    return batch;
  }

  async importBatch(batchId: string, user: IdentityUser) {
    const batch = await this.analysisStore.getImportBatch(batchId);
    if (!batch) throw new AppError(404, 'Import batch not found.', 'NOT_FOUND');
    await this.requiredJob(batch.jobId, user, 'view');
    return batch;
  }

  async sourceReferences(
    targetType: Parameters<AnalysisStore['listSourceReferences']>[0],
    targetRecordId: string,
    user: IdentityUser,
  ) {
    const references = await this.analysisStore.listSourceReferences(targetType, targetRecordId);
    const allowed = [];
    for (const reference of references) {
      const document = await this.documentStore.findDocument(reference.sourceDocumentId);
      if (!document) continue;
      try {
        await requireDocumentAccess(this.documentStore, document, user, 'view');
        allowed.push(reference);
      } catch {
        // Do not disclose the existence of confidential source documents.
      }
    }
    return allowed;
  }

  async audit(jobId: string, page: number, pageSize: number, user: IdentityUser) {
    await this.requiredJob(jobId, user, 'view');
    return this.analysisStore.listAudit(jobId, page, pageSize);
  }

  configuration() {
    return this.analysisStore.getConfiguration();
  }

  updateConfiguration(
    input: Parameters<AnalysisStore['updateConfiguration']>[0],
    user: IdentityUser,
    context: RequestMeta,
  ) {
    return this.analysisStore.updateConfiguration(input, user.id).then(async (configuration) => {
      await this.analysisStore.createAudit({
        userId: user.id,
        action: 'ANALYSIS_CONFIGURATION_UPDATED',
        description: 'Document analysis configuration updated.',
        metadata: { fields: Object.keys(input) },
        ...context,
      });
      return configuration;
    });
  }

  summary() {
    return this.analysisStore.summary();
  }

  private runInBackground(jobId: string, document: DocumentRecord, version: DocumentVersionRecord) {
    setImmediate(() => {
      void this.process(jobId, document, version).catch((error) => {
        const details = analysisFailureDetails(error, 'job_finalization');
        this.logger.error({
          event: 'document_analysis_background_failure',
          jobId,
          stage: details.stage,
          errorName: details.errorName,
          errorCode: details.code,
          errorMessage: details.diagnosticMessage,
          diagnosticId: details.diagnosticId,
        });
      });
    });
  }

  private async process(jobId: string, document: DocumentRecord, version: DocumentVersionRecord) {
    let stage: AnalysisPipelineStage = 'configuration';
    const reportStage = (
      nextStage: AnalysisPipelineStage,
      status: 'started' | 'completed',
      metadata?: Record<string, unknown>,
    ) => {
      stage = nextStage;
      this.logger.info({
        event: 'document_analysis_stage',
        jobId,
        stage: nextStage,
        stageLabel: pipelineStageLabels[nextStage],
        status,
        ...metadata,
      });
    };
    const transitionStage = (nextStage: AnalysisPipelineStage) => {
      if (stage !== nextStage) {
        reportStage(stage, 'completed');
        reportStage(nextStage, 'started');
      }
    };

    try {
      reportStage('configuration', 'started');
      const configuration = await this.analysisStore.getConfiguration();
      const current = await this.analysisStore.getJob(jobId);
      if (!current || current.status === 'CANCELLED') return;
      await this.analysisStore.updateJob(jobId, {
        status: 'PROCESSING',
        startedAt: new Date(),
        failureReason: null,
      });
      reportStage('configuration', 'completed');

      reportStage('file_retrieval', 'started');
      if (!(await this.storage.exists(version.storagePath))) {
        throw new AppError(
          404,
          'تعذر العثور على ملف المستند في التخزين.',
          'ANALYSIS_FILE_NOT_FOUND',
        );
      }
      const stream = await this.storage.read(version.storagePath);
      const data = await readWithinLimit(stream, configuration.maxFileSizeBytes);
      reportStage('file_retrieval', 'completed', { fileSizeBytes: data.byteLength });

      reportStage('provider_selection', 'started');
      const provider = this.providers.resolve({
        fileName: version.originalFileName,
        mimeType: version.mimeType,
      });
      reportStage('provider_selection', 'completed', { provider: provider.name });

      const firstExtractionStage: AnalysisPipelineStage =
        version.mimeType === 'application/pdf' ||
        version.originalFileName.toLowerCase().endsWith('.pdf')
          ? 'pdf_parsing'
          : 'text_extraction';
      reportStage(firstExtractionStage, 'started', { provider: provider.name });
      const extraction = await provider.extractDocument({
        fileName: version.originalFileName,
        mimeType: version.mimeType,
        data,
        maximumBytes: configuration.maxFileSizeBytes,
        maximumPages: configuration.maxPages,
        maximumTables: configuration.maxTables,
        reportStage: transitionStage,
      });
      reportStage(stage, 'completed', {
        provider: provider.name,
        pageCount: extraction.pages.length,
        tableCount: extraction.pages.reduce((total, page) => total + page.tables.length, 0),
      });
      const latest = await this.analysisStore.getJob(jobId);
      if (!latest || latest.status === 'CANCELLED') return;
      const textCharacters = extraction.pages.reduce((total, page) => total + page.text.length, 0);
      if (!hasSufficientEmbeddedText(extraction.pages, configuration.minimumTextCharacters)) {
        await this.analysisStore.updateJob(jobId, {
          status: 'OCR_REQUIRED',
          extractionProvider: extraction.provider,
          extractionMethod: extraction.extractionMethod,
          extractionVersion: extraction.providerVersion,
          completedAt: new Date(),
          pageCount: extraction.pages.length,
          tableCount: extraction.pages.reduce((sum, page) => sum + page.tables.length, 0),
          providerMetadata: extraction.metadata,
          failureReason:
            'لم يُعثر على نص مضمّن كافٍ. يحتاج المستند إلى OCR، وهي خدمة غير مفعلة في هذا الإصدار.',
        });
        await this.analysisStore.createAudit({
          jobId,
          action: 'ANALYSIS_OCR_REQUIRED',
          description: 'Insufficient embedded text detected; OCR is required.',
          metadata: { pageCount: extraction.pages.length, textCharacters },
        });
        return;
      }

      reportStage('proposal_generation', 'started');
      const tables = provider.extractTables(extraction.pages, configuration.maxTables);
      const enabledRules = new Set(configuration.enabledRuleIds);
      const proposals = this.extractor
        .extract({ documentType: document.documentType, pages: extraction.pages, tables })
        .filter(
          (proposal) =>
            enabledRules.has(proposal.extractionRuleId) &&
            proposal.confidence >= configuration.proposalConfidence,
        );
      reportStage('proposal_generation', 'completed', { proposalCount: proposals.length });

      reportStage('page_creation', 'started');
      await this.analysisStore.saveExtraction(jobId, {
        provider: extraction.provider,
        providerVersion: extraction.providerVersion,
        extractionMethod: extraction.extractionMethod,
        metadata: extraction.metadata,
        pages: extraction.pages,
        proposals,
        reportStage: transitionStage,
      });
      reportStage(stage, 'completed');

      reportStage('audit', 'started');
      await this.analysisStore.createAudit({
        jobId,
        action: 'ANALYSIS_COMPLETED',
        description: 'Document text extraction and deterministic proposal generation completed.',
        metadata: {
          pageCount: extraction.pages.length,
          tableCount: tables.length,
          proposalCount: proposals.length,
        },
      });
      reportStage('audit', 'completed');
    } catch (error) {
      const details = analysisFailureDetails(error, stage);
      this.logger.error({
        event: 'document_analysis_failed',
        jobId,
        stage: details.stage,
        stageLabel: details.stageLabel,
        errorName: details.errorName,
        errorCode: details.code,
        errorMessage: details.diagnosticMessage,
        diagnosticId: details.diagnosticId,
      });
      const current = await this.analysisStore.getJob(jobId);
      if (current?.status !== 'CANCELLED') {
        await this.analysisStore.updateJob(jobId, {
          status: 'FAILED',
          completedAt: new Date(),
          failureReason: details.userMessage,
          providerMetadata: {
            failure: {
              stage: details.stage,
              stageLabel: details.stageLabel,
              errorCode: details.code,
              diagnosticId: details.diagnosticId,
            },
          },
        });
        try {
          await this.analysisStore.createAudit({
            jobId,
            action: 'ANALYSIS_FAILED',
            description: 'Document analysis failed at a recorded pipeline stage.',
            metadata: {
              stage: details.stage,
              stageLabel: details.stageLabel,
              errorName: details.errorName,
              errorCode: details.code,
              errorMessage: details.diagnosticMessage,
              diagnosticId: details.diagnosticId,
            },
          });
        } catch (auditError) {
          const auditDetails = analysisFailureDetails(auditError, 'audit');
          this.logger.error({
            event: 'document_analysis_failure_audit_failed',
            jobId,
            stage: 'audit',
            errorName: auditDetails.errorName,
            errorCode: auditDetails.code,
            errorMessage: auditDetails.diagnosticMessage,
            diagnosticId: auditDetails.diagnosticId,
          });
        }
      }
      throw error;
    }
  }

  private async requiredDocument(id: string) {
    const document = await this.documentStore.findDocument(id);
    if (!document) throw new AppError(404, 'Document not found.', 'NOT_FOUND');
    return document;
  }

  private async currentVersion(document: DocumentRecord) {
    if (!document.storagePath || document.versionNumber < 1) {
      throw new AppError(409, 'يجب رفع ملف للمستند قبل بدء التحليل.', 'ANALYSIS_FILE_REQUIRED');
    }
    const version = (await this.documentStore.listVersions(document.id))[0];
    if (!version) throw new AppError(404, 'Document version not found.', 'NOT_FOUND');
    return version;
  }

  private async requiredJob(id: string, user: IdentityUser, capability: 'view' | 'edit') {
    const job = await this.analysisStore.getJob(id);
    if (!job) throw new AppError(404, 'Analysis job not found.', 'NOT_FOUND');
    const document = await this.requiredDocument(job.documentId);
    await requireDocumentAccess(this.documentStore, document, user, capability);
    return job;
  }

  private async requiredProposal(id: string, user: IdentityUser, capability: 'view' | 'edit') {
    const proposal = await this.analysisStore.getProposal(id);
    if (!proposal) throw new AppError(404, 'Extraction proposal not found.', 'NOT_FOUND');
    const document = await this.requiredDocument(proposal.documentId);
    await requireDocumentAccess(this.documentStore, document, user, capability);
    return proposal;
  }
}

export type ImportPreview = ConflictResult[];
