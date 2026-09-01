export type LessonStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ResourceStatus = 'QUARANTINED' | 'PROCESSING' | 'READY' | 'REJECTED';

export type LessonBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'resource'; resourceId: string }
  | { type: 'formula'; latex: string }
  | { type: 'html'; html: string }
  | { type: 'video_url'; url: string };

export interface LessonVideo {
  url?: string;
  resourceId?: string;
  provider?: string;
  embedId?: string;
}

export interface LessonContent {
  blocks: LessonBlock[];
  availableFrom?: string | null;
  availableUntil?: string | null;
  video?: LessonVideo;
}

export interface ResourceOption {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  status: ResourceStatus;
  visibility?: 'PRIVATE' | 'CLASS' | 'SCHOOL';
  contributionStatus?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export function isLessonBlock(value: unknown): value is LessonBlock {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  const block = value as { type: string };
  return block.type === 'heading' || block.type === 'paragraph' || block.type === 'bullets' || block.type === 'resource' || block.type === 'formula' || block.type === 'html' || block.type === 'video_url';
}

export function parseLessonContent(content: unknown): LessonContent {
  const record = content && typeof content === 'object' ? content as Record<string, unknown> : {};
  const blocks = Array.isArray(record.blocks) ? record.blocks.filter(isLessonBlock) : [];
  const video = record.video && typeof record.video === 'object' ? record.video as LessonVideo : {};
  return {
    blocks,
    availableFrom: typeof record.availableFrom === 'string' ? record.availableFrom : null,
    availableUntil: typeof record.availableUntil === 'string' ? record.availableUntil : null,
    video,
  };
}

export function isImageMime(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg';
}

export function embedVideoSrc(video?: LessonVideo): string | null {
  const url = video?.url ?? '';
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({ enablejsapi: '1' });
    if (origin) params.set('origin', origin);
    const withParams = (base: string) => `${base}?${params.toString()}`;
    if (host === 'youtu.be') return withParams(`https://www.youtube-nocookie.com/embed/${parsed.pathname.slice(1)}`);
    if (host.includes('youtube.com')) {
      const id = parsed.searchParams.get('v') ?? parsed.pathname.split('/').pop();
      return id ? withParams(`https://www.youtube-nocookie.com/embed/${id}`) : null;
    }
    if (host.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}
