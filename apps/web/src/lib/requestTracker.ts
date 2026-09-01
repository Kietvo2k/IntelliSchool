import { useSyncExternalStore } from 'react';

export interface RequestTrackerState {
  activeCount: number;
  isPending: boolean;
  isSlow: boolean;
  isVerySlow: boolean;
}

const SLOW_THRESHOLD_MS = 2000;
const VERY_SLOW_THRESHOLD_MS = 6000;

const activeRequests: Map<string, number> = new Map();
let requestIdCounter = 0;
let checkInterval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

let currentState: RequestTrackerState = {
  activeCount: 0,
  isPending: false,
  isSlow: false,
  isVerySlow: false,
};

function computeState(): RequestTrackerState {
  const count = activeRequests.size;
  if (count === 0) {
    return {
      activeCount: 0,
      isPending: false,
      isSlow: false,
      isVerySlow: false,
    };
  }

  const now = Date.now();
  let longestDuration = 0;
  for (const startTime of activeRequests.values()) {
    const duration = now - startTime;
    if (duration > longestDuration) longestDuration = duration;
  }

  return {
    activeCount: count,
    isPending: count > 0,
    isSlow: longestDuration >= SLOW_THRESHOLD_MS,
    isVerySlow: longestDuration >= VERY_SLOW_THRESHOLD_MS,
  };
}

function updateState() {
  const nextState = computeState();
  if (
    currentState.activeCount !== nextState.activeCount ||
    currentState.isPending !== nextState.isPending ||
    currentState.isSlow !== nextState.isSlow ||
    currentState.isVerySlow !== nextState.isVerySlow
  ) {
    currentState = nextState;
    listeners.forEach((listener) => listener());
  }
}

function ensureTimer() {
  if (!checkInterval && activeRequests.size > 0) {
    checkInterval = setInterval(() => {
      updateState();
      if (activeRequests.size === 0 && checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    }, 250);
  }
}

export function beginTrackedRequest(): () => void {
  const id = `req-${++requestIdCounter}-${Date.now()}`;
  activeRequests.set(id, Date.now());
  updateState();
  ensureTimer();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeRequests.delete(id);
    updateState();
    if (activeRequests.size === 0 && checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  };
}

export function subscribeRequestTracker(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRequestTrackerSnapshot(): RequestTrackerState {
  return currentState;
}

export function useRequestTracker(): RequestTrackerState {
  return useSyncExternalStore(
    subscribeRequestTracker,
    getRequestTrackerSnapshot,
    getRequestTrackerSnapshot,
  );
}
