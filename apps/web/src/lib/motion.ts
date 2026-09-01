/** Shared motion contract: transform/opacity only, 150–300ms, reduced-motion safe. */

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;
export const EASE_FLUID = [0.2, 0.8, 0.2, 1] as const;
export const APPLE_EASE = EASE_FLUID;

export const DURATION = {
  press: 0.1,
  fast: 0.16,
  base: 0.24,
  slow: 0.3,
  exit: 0.16,
  pathway: 0.48,
  radar: 0.5,
} as const;

export const STAGGER = 0.04;
export const STAGGER_MAX = 8;
export const SCROLL_AMOUNT = 0.15;

export const VIEWPORT_ONCE = { once: true, amount: SCROLL_AMOUNT, margin: '0px 0px -24px 0px' } as const;

const NAV_ORDER = [
  '/app',
  '/app/lessons',
  '/app/resources',
  '/app/question-banks',
  '/app/assignments',
  '/app/exam',
  '/app/grades',
  '/app/gradebook',
  '/app/my-path',
  '/app/messages',
  '/app/career-quiz',
  '/app/career-results',
  '/app/career-schools',
  '/app/aspirations',
  '/app/career-ai',
  '/app/ai-study',
  '/app/ai-assistant',
  '/app/profile',
];

export function navIndex(pathname: string): number {
  if (pathname === '/app' || pathname === '/app/') return 0;
  const exact = NAV_ORDER.indexOf(pathname);
  if (exact >= 0) return exact;
  const prefix = NAV_ORDER.findIndex((item, index) => index > 0 && (pathname === item || pathname.startsWith(`${item}/`)));
  return prefix >= 0 ? prefix : 0;
}

export function getNavDirection(from: string, to: string): 1 | -1 {
  return navIndex(to) >= navIndex(from) ? 1 : -1;
}

export function enterUp(reduce: boolean | null, delay = 0) {
  if (reduce) return { initial: false as const, animate: { opacity: 1, y: 0 } };
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: DURATION.base, delay, ease: EASE_OUT },
  };
}

export function routeVariants(direction: 1 | -1, reduce: boolean | null, fadeOnly = false) {
  if (reduce) {
    return {
      initial: { opacity: 1, x: 0 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 1, x: 0 },
    };
  }
  if (fadeOnly) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
      exit: { opacity: 0, transition: { duration: DURATION.exit, ease: EASE_IN } },
    };
  }
  return {
    initial: { opacity: 0, x: 16 * direction },
    animate: { opacity: 1, x: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
    exit: { opacity: 0, x: -12 * direction, transition: { duration: DURATION.exit, ease: EASE_IN } },
  };
}

export function scrollIn(reduce: boolean | null, index = 0) {
  if (reduce) return { initial: false as const };
  return {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: VIEWPORT_ONCE,
    transition: { duration: DURATION.base, delay: Math.min(index, STAGGER_MAX - 1) * STAGGER, ease: EASE_OUT },
  };
}
