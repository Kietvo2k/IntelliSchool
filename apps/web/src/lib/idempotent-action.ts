export interface SubmissionTicket {
  key: string;
}

interface ActiveSubmission {
  fingerprint: string;
  key: string;
  inFlight: boolean;
}

function fingerprint(input: unknown): string {
  try {
    return JSON.stringify(input) ?? String(input);
  } catch {
    return String(input);
  }
}

/** Keeps one logical mutation single-flight and reuses its key after an uncertain failure. */
export function createIdempotentAction(prefix: string, keyFactory: (prefix: string) => string): {
  begin(input: unknown): SubmissionTicket | null;
  end(input: unknown, succeeded: boolean): void;
} {
  let active: ActiveSubmission | null = null;
  return {
    begin(input) {
      const nextFingerprint = fingerprint(input);
      if (active?.inFlight) return null;
      if (!active || active.fingerprint !== nextFingerprint) {
        active = { fingerprint: nextFingerprint, key: keyFactory(prefix), inFlight: true };
      } else {
        active.inFlight = true;
      }
      return { key: active.key };
    },
    end(input, succeeded) {
      if (!active || active.fingerprint !== fingerprint(input)) return;
      active.inFlight = false;
      if (succeeded) active = null;
    },
  };
}
