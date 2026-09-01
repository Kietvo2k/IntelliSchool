import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

export default function AssistantRichTextImpl({ content }: { content: string }) {
  return (
    <div className="assistant-rich-text">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} skipHtml>
        {content}
      </ReactMarkdown>
    </div>
  );
}
