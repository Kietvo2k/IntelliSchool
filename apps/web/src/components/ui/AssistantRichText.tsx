import { lazy, Suspense } from 'react';
import { normalizeMathDelimiters } from '../../lib/math-markdown.js';

const AssistantRichTextImpl = lazy(() => import('./AssistantRichTextImpl.js'));

/** Render AI output as safe markdown and math; raw HTML is intentionally ignored. */
export function AssistantRichText({ content }: { content: string }) {
  return (
    <Suspense fallback={<p className="assistant-rich-text">{normalizeMathDelimiters(content)}</p>}>
      <AssistantRichTextImpl content={content} />
    </Suspense>
  );
}
