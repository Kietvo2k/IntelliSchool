import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors.js';

export async function folderSizeBytes(root: string): Promise<number> {
  let total = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) {
        try { total += (await stat(full)).size; } catch { /* unreadable file */ }
      }
    }
  }
  return total;
}

export async function assertQuota(roots: string[], quotaBytes: number, incomingBytes = 0): Promise<void> {
  if (quotaBytes <= 0) return;
  let used = 0;
  for (const root of roots) used += await folderSizeBytes(root);
  if (used + incomingBytes > quotaBytes) {
    throw new AppError(507, 'STORAGE_QUOTA_EXCEEDED', 'Hết dung lượng lưu trữ cho phép trên máy này.');
  }
}
