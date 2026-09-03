import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import { normalizeMathDelimiters } from '../../lib/math-markdown.js';

export default function AssistantRichTextImpl({ content }: { content: string }) {
  const normalizedContent = normalizeMathDelimiters(content);

  return (
    <div className="assistant-rich-text">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} skipHtml>
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
