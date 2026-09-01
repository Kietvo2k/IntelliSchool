import { useCallback, useEffect, useState } from 'react';
import { apiRequest, ApiRequestError } from './api.js';

export interface SubjectOption { id: string; code: string; name: string; }
export interface ClassOption { id: string; code: string; name: string; gradeLevel: number | null; schoolYear: string; }
export interface PersonOption { id: string; displayName: string; email: string; studentCode?: string; }

export function useCatalog<T>(path: string | null) {
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(path ? 'loading' : 'ready');
  const [message, setMessage] = useState('');

  const reload = useCallback(async () => {
    if (!path) { setItems([]); setState('ready'); return; }
    setState('loading');
    setMessage('');
    try {
      const data = await apiRequest<T[]>(path);
      setItems(data ?? []);
      setState('ready');
    } catch (error) {
      setState('error');
      setMessage(error instanceof ApiRequestError ? error.message : 'Chưa thể tải danh mục.');
      throw error;
    }
  }, [path]);

  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);

  return { items, state, message, reload };
}
