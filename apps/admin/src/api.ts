export type Role = {
  id: string;
  name: string;
  displayName: string;
  isSystem: boolean;
  permissions: string[];
};
export type User = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  isActive: boolean;
  roles: Role[];
};
export type AuthPayload = { accessToken: string; user: User; permissions: string[] };
export type DocumentCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
};
export type OwningDepartment = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
};
export type DocumentLookups = {
  categories: DocumentCategory[];
  owningDepartments: OwningDepartment[];
};
export type DocumentRecord = {
  id: string;
  title: string;
  description?: string;
  originalFileName?: string;
  mimeType?: string;
  fileSize?: number;
  hasFile: boolean;
  categoryId: string;
  category: DocumentCategory;
  documentType: string;
  documentNumber?: string;
  documentDate?: string;
  effectiveDate?: string;
  expiryDate?: string;
  versionNumber: number;
  status: string;
  confidentialityLevel: string;
  owningDepartment: string;
  keywords: string[];
  isArchived: boolean;
  tags: Array<{ id: string; name: string; slug: string }>;
  createdBy: { id: string; fullName: string };
  updatedBy: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
};
export type DocumentVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  notes?: string;
  createdBy: { id: string; fullName: string };
  createdAt: string;
};
export type DocumentAudit = {
  id: string;
  documentId: string;
  versionId?: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user?: { id: string; fullName: string };
};
export type DocumentDashboard = {
  total: number;
  active: number;
  underReview: number;
  expiring: number;
  archived: number;
  recent: DocumentRecord[];
};
export type ExecutiveRecord = {
  id: string;
  [key: string]: unknown;
};
export type PageResult<T = ExecutiveRecord> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type ExecutiveHealth = {
  score: number | null;
  coverage: number;
  rating: string | null;
  components: Array<{
    key: string;
    label: string;
    weight: number;
    score: number | null;
    contribution: number | null;
    missing: boolean;
    explanation: string;
  }>;
  missingData: string[];
  explanation: string;
  history?: ExecutiveRecord[];
};
export type ExecutiveDashboard = {
  summary: {
    documents: {
      total: number;
      active: number;
      underReview: number;
      expiring: number;
      archived: number;
    };
    activeUsers: number;
    recentSystemActivity: number;
    objectives: { total: number; averageProgress: number | null };
    kpis: Record<string, number>;
    initiatives: {
      total: number;
      active: number;
      delayed: number;
      atRisk: number;
      completed: number;
      plannedBudget: number;
      actualSpending: number;
      budgetVariance: { amount: number; percentage: number | null };
    };
    risks: { open: number; critical: number; averageResidualScore: number | null };
  };
  associationIndicators: Record<
    string,
    {
      id: string;
      nameAr: string;
      value: number | string | null;
      unit: string | null;
      measuredAt: string | null;
    } | null
  >;
  institutionalMetrics: Record<
    string,
    {
      id: string;
      nameAr: string;
      value: number | string | null;
      unit: string | null;
      measuredAt: string | null;
    }
  >;
  health: ExecutiveHealth;
  recentDocuments: DocumentRecord[];
  recentActivities: ExecutiveRecord[];
  alerts: ExecutiveRecord[];
  upcomingDeadlines: ExecutiveRecord[];
  quickActions: string[];
};

const baseUrl =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export type ApiFieldError = {
  field: string;
  label: string;
  code: string;
  message: string;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly fields: ApiFieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string; fields?: ApiFieldError[] };
    } | null;
    throw new ApiRequestError(
      body?.error?.message ?? 'تعذر إكمال الطلب.',
      body?.error?.code,
      body?.error?.fields ?? [],
    );
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export async function uploadDocumentFile(
  documentId: string,
  file: File,
  newVersion = false,
  notes?: string,
) {
  return api<{ document: DocumentRecord; version: DocumentVersion }>(
    `/documents/${documentId}/${newVersion ? 'versions' : 'file'}`,
    {
      method: newVersion ? 'POST' : 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
        'X-File-Name': encodeURIComponent(file.name),
        ...(notes ? { 'X-Version-Notes': notes } : {}),
      },
    },
  );
}

export async function downloadDocument(document: DocumentRecord) {
  const response = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) throw new Error('تعذر تنزيل المستند.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = document.originalFileName || `${document.title}.bin`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function openExecutiveReportPrint(reportId: string) {
  const response = await fetch(`${baseUrl}/executive/reports/${reportId}/print`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!response.ok) throw new Error('تعذر فتح عرض التقرير.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
