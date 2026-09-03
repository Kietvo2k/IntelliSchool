import sanitizeHtml from 'sanitize-html';

const lessonAllowedTags = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'sub', 'sup', 'code', 'pre',
  'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a',
];

/** Sanitize lesson HTML on the server with a deliberately small allowlist. */
export function sanitizeLessonHtml(html: string): string {
  return sanitizeHtml(html.slice(0, 50_000), {
    allowedTags: lessonAllowedTags,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'completelyDiscard',
    nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp', 'iframe', 'svg', 'math', 'form'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target === '_blank'
          ? { ...attribs, rel: 'noopener noreferrer' }
          : attribs,
      }),
    },
  });
}

export function youtubeOrVimeoId(url: string): { provider: 'YOUTUBE' | 'VIMEO'; id: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace('/', '').slice(0, 20);
      return id ? { provider: 'YOUTUBE', id } : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = parsed.searchParams.get('v') ?? (parsed.pathname.startsWith('/embed/') ? parsed.pathname.slice(7) : '');
      return id ? { provider: 'YOUTUBE', id: id.slice(0, 20) } : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
      return /^\d+$/.test(id) ? { provider: 'VIMEO', id } : null;
    }
    return null;
  } catch {
    return null;
  }
}
