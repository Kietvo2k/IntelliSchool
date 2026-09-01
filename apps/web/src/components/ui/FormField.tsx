import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function FormField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="ws-field">
      <label className="ws-label" htmlFor={id}>{label}</label>
      {children}
      {hint && <small id={`${id}-help`} className="text-muted">{hint}</small>}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ws-input ${className ?? ''}`} {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`ws-select ${className ?? ''}`} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ws-textarea ${className ?? ''}`} {...props} />;
}
