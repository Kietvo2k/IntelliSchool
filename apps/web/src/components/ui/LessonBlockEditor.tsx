import type { LessonBlock, ResourceOption } from '../../lib/lms.js';
import { FormField, SelectInput, TextArea, TextInput } from './FormField.js';

export function LessonBlockEditor({
  blocks, onChange, resources,
}: {
  blocks: LessonBlock[];
  onChange: (blocks: LessonBlock[]) => void;
  resources: ResourceOption[];
}) {
  function update(index: number, next: LessonBlock) {
    onChange(blocks.map((block, current) => current === index ? next : block));
  }
  function move(index: number, direction: -1 | 1) {
    const to = index + direction;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[to]] = [next[to]!, next[index]!];
    onChange(next);
  }
  function add(block: LessonBlock) {
    onChange([...blocks, block]);
  }

  return (
    <div className="grid gap-4">
      <div className="table-actions">
        <button className="ws-btn ws-btn-quiet" type="button" onClick={() => add({ type: 'heading', text: 'Tiêu đề mục', level: 2 })}>Thêm tiêu đề</button>
        <button className="ws-btn ws-btn-quiet" type="button" onClick={() => add({ type: 'paragraph', text: '' })}>Thêm đoạn</button>
        <button className="ws-btn ws-btn-quiet" type="button" onClick={() => add({ type: 'bullets', items: [''] })}>Thêm danh sách</button>
        <button className="ws-btn ws-btn-quiet" type="button" onClick={() => add({ type: 'resource', resourceId: resources[0]?.id ?? '' })} disabled={resources.length === 0}>Gắn tài nguyên</button>
        <button className="ws-btn ws-btn-quiet" type="button" onClick={() => add({ type: 'formula', latex: '' })}>Thêm công thức</button>
        <button className="ws-btn ws-btn-quiet" type="button" onClick={() => add({ type: 'html', html: '<p></p>' })}>Soạn HTML</button>
        <button className="ws-btn ws-btn-quiet" type="button" onClick={() => add({ type: 'video_url', url: '' })}>Video URL</button>
      </div>
      {resources.length === 0 && <p className="text-sm text-muted">Chưa có tệp READY cùng lớp/môn để gắn vào bài. Tải lên ở Thư viện số và đợi quét xong.</p>}
      {blocks.length === 0 && <p className="workspace-state" role="status">Chưa có nội dung. Thêm tiêu đề, đoạn văn, danh sách hoặc tài nguyên.</p>}
      {blocks.map((block, index) => (
        <article className="workspace-feature" key={`${block.type}-${index}`}>
          <p>{block.type === 'heading' ? 'Tiêu đề' : block.type === 'paragraph' ? 'Đoạn văn' : block.type === 'bullets' ? 'Danh sách' : block.type === 'formula' ? 'Công thức' : block.type === 'html' ? 'Tài liệu giàu' : block.type === 'video_url' ? 'Video' : 'Tài nguyên'}</p>
          {block.type === 'heading' && (
            <>
              <FormField id={`block-level-${index}`} label="Cấp tiêu đề">
                <SelectInput id={`block-level-${index}`} value={block.level} onChange={(event) => update(index, { ...block, level: Number(event.target.value) as 2 | 3 })}>
                  <option value={2}>Tiêu đề lớn</option>
                  <option value={3}>Tiêu đề nhỏ</option>
                </SelectInput>
              </FormField>
              <FormField id={`block-heading-${index}`} label="Nội dung tiêu đề">
                <TextInput id={`block-heading-${index}`} value={block.text} maxLength={2000} onChange={(event) => update(index, { ...block, text: event.target.value })} />
              </FormField>
            </>
          )}
          {block.type === 'paragraph' && (
            <FormField id={`block-paragraph-${index}`} label="Đoạn văn">
              <TextArea id={`block-paragraph-${index}`} value={block.text} maxLength={10_000} onChange={(event) => update(index, { ...block, text: event.target.value })} />
            </FormField>
          )}
          {block.type === 'bullets' && (
            <FormField id={`block-bullets-${index}`} label="Mỗi ý một dòng">
              <TextArea id={`block-bullets-${index}`} value={block.items.join('\n')} onChange={(event) => update(index, { type: 'bullets', items: event.target.value.split('\n') })} />
            </FormField>
          )}
          {block.type === 'resource' && (
            <FormField id={`block-resource-${index}`} label="Tệp đã quét sạch">
              <SelectInput id={`block-resource-${index}`} value={block.resourceId} onChange={(event) => update(index, { type: 'resource', resourceId: event.target.value })}>
                <option value="">Chọn tệp READY</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>{resource.originalName}</option>
                ))}
              </SelectInput>
            </FormField>
          )}
          {block.type === 'formula' && (
            <FormField id={`block-formula-${index}`} label="LaTeX / KaTeX">
              <TextInput id={`block-formula-${index}`} value={block.latex} onChange={(event) => update(index, { type: 'formula', latex: event.target.value })} />
            </FormField>
          )}
          {block.type === 'html' && (
            <FormField id={`block-html-${index}`} label="Nội dung (chữ, bảng, công thức trong HTML)">
              <TextArea id={`block-html-${index}`} value={block.html} maxLength={50_000} rows={8} onChange={(event) => update(index, { type: 'html', html: event.target.value })} />
            </FormField>
          )}
          {block.type === 'video_url' && (
            <FormField id={`block-video-${index}`} label="URL YouTube hoặc Vimeo">
              <TextInput id={`block-video-${index}`} value={block.url} onChange={(event) => update(index, { type: 'video_url', url: event.target.value })} />
            </FormField>
          )}
          <div className="table-actions">
            <button className="ws-btn ws-btn-quiet" type="button" onClick={() => move(index, -1)} disabled={index === 0}>Lên</button>
            <button className="ws-btn ws-btn-quiet" type="button" onClick={() => move(index, 1)} disabled={index === blocks.length - 1}>Xuống</button>
            <button className="ws-btn ws-btn-quiet" type="button" onClick={() => onChange(blocks.filter((_, current) => current !== index))}>Xóa khối</button>
          </div>
        </article>
      ))}
    </div>
  );
}
