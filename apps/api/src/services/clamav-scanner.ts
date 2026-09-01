import net from 'node:net';
import type { Readable } from 'node:stream';

export function parseClamAvResponse(response: string): 'CLEAN' | 'INFECTED' {
  // eslint-disable-next-line no-control-regex -- ClamAV framing may contain ASCII control bytes.
  const trimmed = response.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (/\bFOUND$/i.test(trimmed)) return 'INFECTED';
  if (/\bOK$/i.test(trimmed)) return 'CLEAN';
  throw new Error(trimmed.replace(/^stream:\s*/i, '') || 'ClamAV trả về phản hồi không hợp lệ.');
}

export interface QuarantineStreamStorage { getQuarantineStream(objectKey: string): Promise<Readable>; }

export class ClamAvScanner {
  constructor(
    private readonly storage: QuarantineStreamStorage,
    private readonly options: { host: string; port: number; timeoutMs?: number },
  ) {}

  async scan(objectKey: string): Promise<'CLEAN' | 'INFECTED'> {
    const source = await this.storage.getQuarantineStream(objectKey);
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.options.host, port: this.options.port });
      const response: Buffer[] = [];
      let settled = false;
      const finish = (error?: Error, result?: 'CLEAN' | 'INFECTED') => {
        if (settled) return;
        settled = true;
        source.destroy();
        socket.destroy();
        if (error) reject(error); else resolve(result!);
      };
      socket.setTimeout(this.options.timeoutMs ?? 30_000);
      socket.once('timeout', () => finish(new Error('ClamAV không phản hồi trong thời gian cho phép.')));
      socket.once('error', (error) => finish(error));
      socket.on('data', (chunk: Buffer) => response.push(chunk));
      socket.once('end', () => {
        try { finish(undefined, parseClamAvResponse(Buffer.concat(response).toString('utf8'))); }
        catch (error) { finish(error instanceof Error ? error : new Error('Không thể đọc phản hồi ClamAV.')); }
      });
      socket.once('connect', () => {
        socket.write('zINSTREAM\0');
        source.on('data', (chunk: Buffer) => {
          const payload = Buffer.from(chunk);
          const size = Buffer.allocUnsafe(4);
          size.writeUInt32BE(payload.length);
          socket.write(size);
          socket.write(payload);
        });
        source.once('error', (error) => finish(error));
        source.once('end', () => {
          const terminator = Buffer.alloc(4);
          socket.end(terminator);
        });
      });
    });
  }
}
