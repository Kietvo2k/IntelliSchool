import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, cost: number, blockSize: number, parallelization: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { cost, blockSize, parallelization, maxmem: MAX_MEMORY }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, COST, BLOCK_SIZE, PARALLELIZATION);
  return ['scrypt', COST, BLOCK_SIZE, PARALLELIZATION, salt.toString('base64url'), derived.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, salt, expected] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const parsedCost = Number(cost);
  const parsedBlockSize = Number(blockSize);
  const parsedParallelization = Number(parallelization);
  if (![parsedCost, parsedBlockSize, parsedParallelization].every(Number.isSafeInteger)) return false;
  try {
    const actual = await deriveKey(password, Buffer.from(salt, 'base64url'), parsedCost, parsedBlockSize, parsedParallelization);
    const expectedBuffer = Buffer.from(expected, 'base64url');
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  } catch { return false; }
}
