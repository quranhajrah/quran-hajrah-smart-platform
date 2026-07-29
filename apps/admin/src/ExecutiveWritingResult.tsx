import { useState } from 'react';
import type { ExecutiveAiWritingResponse } from './executive-insights-data';
import { Link } from './router';

export function WritingResult({
  result,
  allowFullCopy = false,
}: {
  result: ExecutiveAiWritingResponse;
  allowFullCopy?: boolean;
}) {
  const [copied, setCopied] = useState('');
  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  };
  const prose = [result.answer, result.executiveRecommendation].filter(Boolean).join('\n\n');
  const evidence = result.supportingReferences
    .map((reference) => `[${reference.reference}] «${reference.quote}» — ${reference.relevance}`)
    .join('\n');
  const sources = result.sources
    .map(
      (source) =>
        `[${source.reference}] ${source.documentTitle} — الإصدار ${source.versionNumber}${
          source.pageNumber ? `، الصفحة ${source.pageNumber}` : ''
        }`,
    )
    .join('\n');
  const fullResult = [
    prose,
    evidence ? `الاقتباسات الداعمة:\n${evidence}` : '',
    sources ? `المصادر:\n${sources}` : '',
    result.limitations.length ? `الحدود:\n${result.limitations.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return (
    <section className="ex-writing-result" aria-live="polite">
      <header>
        <div>
          <small>Enterprise {result.version}</small>
          <h3>{result.status === 'ANSWERED' ? 'الصياغة التنفيذية المهنية' : 'الأدلة غير كافية'}</h3>
        </div>
        <div className="ex-writing-stats">
          <span>{result.evidence.documentCount.toLocaleString('ar-SA')} مستند</span>
          <span>{result.evidence.chunkCount.toLocaleString('ar-SA')} مرجع</span>
        </div>
      </header>
      <pre>{result.answer}</pre>
      {result.executiveRecommendation && (
        <div className="ex-writing-recommendation">
          <h4>التوصية التنفيذية</h4>
          <p>{result.executiveRecommendation}</p>
        </div>
      )}
      <div className="ex-writing-copy-actions">
        <button type="button" onClick={() => void copy('prose', prose)} disabled={!prose}>
          {copied === 'prose' ? 'تم نسخ الصياغة' : 'نسخ الصياغة فقط'}
        </button>
        {allowFullCopy && (
          <button
            type="button"
            className="ex-secondary-button"
            onClick={() => void copy('full', fullResult)}
            disabled={!fullResult}
          >
            {copied === 'full' ? 'تم نسخ النتيجة الكاملة' : 'نسخ النتيجة الكاملة'}
          </button>
        )}
        <button
          type="button"
          className="ex-secondary-button"
          onClick={() => void copy('evidence', evidence)}
          disabled={!evidence}
        >
          {copied === 'evidence' ? 'تم نسخ الأدلة' : 'نسخ الاقتباسات منفصلة'}
        </button>
      </div>
      {result.supportingReferences.length > 0 && (
        <div className="ex-writing-evidence">
          <h4>الاقتباسات الداعمة — منفصلة عن الصياغة</h4>
          {result.supportingReferences.map((reference) => (
            <blockquote key={reference.reference}>
              <p>
                [{reference.reference}] «{reference.quote}»
              </p>
              <footer>{reference.relevance}</footer>
            </blockquote>
          ))}
        </div>
      )}
      {result.sources.length > 0 && (
        <div className="ex-writing-sources">
          <h4>المصادر المصرح بها</h4>
          <ol>
            {result.sources.map((source) => (
              <li key={`${source.reference}-${source.documentId}-${source.pageNumber ?? 0}`}>
                <Link to={source.sourceUrl}>
                  [{source.reference}] {source.documentTitle}
                </Link>
                <span>
                  الإصدار {source.versionNumber}
                  {source.pageNumber ? ` · الصفحة ${source.pageNumber}` : ''}
                  {source.section ? ` · ${source.section}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {result.limitations.length > 0 && (
        <div className="ex-writing-limitations">
          <h4>الحدود</h4>
          <ul>
            {result.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
