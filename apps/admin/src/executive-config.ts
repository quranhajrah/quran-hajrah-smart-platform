export type ExecutiveEntityDefinition = {
  key: 'metrics' | 'objectives' | 'kpis' | 'initiatives' | 'risks' | 'reports';
  title: string;
  singular: string;
  permission: string;
  managePermission: string;
  columns: Array<{
    key: string;
    label: string;
    format?: 'status' | 'percent' | 'currency' | 'date';
  }>;
};

export const entityDefinitions: Record<string, ExecutiveEntityDefinition> = {
  metrics: {
    key: 'metrics',
    title: 'سجل المؤشرات المؤسسية',
    singular: 'مؤشر',
    permission: 'metrics.view',
    managePermission: 'metrics.manage',
    columns: [
      { key: 'nameAr', label: 'المؤشر' },
      { key: 'key', label: 'المفتاح' },
      { key: 'currentNumericValue', label: 'القيمة الحالية' },
      { key: 'targetValue', label: 'المستهدف' },
      { key: 'frequency', label: 'الدورية' },
    ],
  },
  objectives: {
    key: 'objectives',
    title: 'الأهداف الاستراتيجية',
    singular: 'هدف استراتيجي',
    permission: 'strategy.view',
    managePermission: 'strategy.manage',
    columns: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الهدف' },
      { key: 'strategicAxis', label: 'المحور' },
      { key: 'progress', label: 'التقدم', format: 'percent' },
      { key: 'status', label: 'الحالة', format: 'status' },
    ],
  },
  kpis: {
    key: 'kpis',
    title: 'إدارة مؤشرات الأداء',
    singular: 'مؤشر أداء',
    permission: 'kpi.view',
    managePermission: 'kpi.manage',
    columns: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'المؤشر' },
      { key: 'currentValue', label: 'الحالي' },
      { key: 'target', label: 'المستهدف' },
      { key: 'status', label: 'الحالة', format: 'status' },
    ],
  },
  initiatives: {
    key: 'initiatives',
    title: 'المبادرات التشغيلية',
    singular: 'مبادرة',
    permission: 'initiatives.view',
    managePermission: 'initiatives.manage',
    columns: [
      { key: 'code', label: 'الرمز' },
      { key: 'name', label: 'المبادرة' },
      { key: 'department', label: 'الإدارة' },
      { key: 'progress', label: 'التقدم', format: 'percent' },
      { key: 'status', label: 'الحالة', format: 'status' },
      { key: 'budget', label: 'الموازنة', format: 'currency' },
    ],
  },
  risks: {
    key: 'risks',
    title: 'سجل المخاطر المؤسسية',
    singular: 'خطر',
    permission: 'risks.view',
    managePermission: 'risks.manage',
    columns: [
      { key: 'code', label: 'الرمز' },
      { key: 'title', label: 'الخطر' },
      { key: 'category', label: 'التصنيف' },
      { key: 'inherentScore', label: 'الكامن' },
      { key: 'residualScore', label: 'المتبقي' },
      { key: 'status', label: 'الحالة', format: 'status' },
    ],
  },
  reports: {
    key: 'reports',
    title: 'التقارير التنفيذية',
    singular: 'تقرير',
    permission: 'reports.view',
    managePermission: 'reports.create',
    columns: [
      { key: 'title', label: 'التقرير' },
      { key: 'reportType', label: 'النوع' },
      { key: 'status', label: 'الحالة', format: 'status' },
      { key: 'generatedAt', label: 'تاريخ التوليد', format: 'date' },
    ],
  },
};
