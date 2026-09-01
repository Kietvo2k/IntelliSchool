import { lazy, Suspense } from 'react';

const AssistantRichTextImpl = lazy(() => import('./AssistantRichTextImpl.js'));

/** Render AI output as safe markdown and math; raw HTML is intentionally ignored. */
export function AssistantRichText({ content }: { content: string }) {
  return (
    <Suspense fallback={<p className="assistant-rich-text">{content}</p>}>
      <AssistantRichTextImpl content={content} />
    </Suspense>
  );
}
