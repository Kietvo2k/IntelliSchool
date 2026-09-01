import { useEffect, useRef, type FormEvent, type MouseEvent } from 'react';

export interface RichTextValue {
  html: string;
  text: string;
}

interface RichTextEditorProps {
  label: string;
  value: RichTextValue;
  onChange: (value: RichTextValue) => void;
  maxLength?: number;
  placeholder?: string;
}

function command(commandName: string, value?: string) {
  if (typeof document === 'undefined') return;
  document.execCommand(commandName, false, value);
}

export function RichTextEditor({ label, value, onChange, maxLength = 20_000, placeholder }: RichTextEditorProps) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor.current || document.activeElement === editor.current) return;
    if (editor.current.innerText !== value.text) editor.current.innerText = value.text;
  }, [value.text]);
  function update(event: FormEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const text = element.innerText.slice(0, maxLength);
    if (text.length >= maxLength) {
      const selection = window.getSelection();
      element.innerText = text;
      if (selection) { selection.selectAllChildren(element); selection.collapseToEnd(); }
    }
    onChange({ html: element.innerHTML, text });
  }
  function toolbar(event: MouseEvent<HTMLButtonElement>, name: string, arg?: string) {
    event.preventDefault();
    editor.current?.focus();
    command(name, arg);
    if (editor.current) onChange({ html: editor.current.innerHTML, text: editor.current.innerText.slice(0, maxLength) });
  }
  return (
    <div className="rich-editor">
      <label className="rich-editor-label">{label}</label>
      <div className="rich-editor-toolbar" role="toolbar" aria-label={`Công cụ ${label}`}>
        <button type="button" aria-label="Đậm" onMouseDown={(event) => toolbar(event, 'bold')}>Đậm</button>
        <button type="button" aria-label="Nghiêng" onMouseDown={(event) => toolbar(event, 'italic')}>Nghiêng</button>
        <button type="button" aria-label="Gạch chân" onMouseDown={(event) => toolbar(event, 'underline')}>Gạch chân</button>
        <button type="button" aria-label="Danh sách" onMouseDown={(event) => toolbar(event, 'insertUnorderedList')}>Danh sách</button>
        <button type="button" aria-label="Danh sách số" onMouseDown={(event) => toolbar(event, 'insertOrderedList')}>1. 2. 3.</button>
        <button type="button" aria-label="Công thức" onMouseDown={(event) => toolbar(event, 'insertText', ' \\( \\) ')}>Công thức</button>
      </div>
      <div
        ref={editor}
        className="rich-editor-surface"
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={update}
      />
      <p className="rich-editor-meta">{value.text.length}/{maxLength} ký tự · Nội dung được lưu tự động</p>
    </div>
  );
}
