import { createConnection } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface AccountMailer {
  sendActivation(input: { to: string; displayName: string; token: string }): Promise<void>;
  sendPasswordReset(input: { to: string; token: string }): Promise<void>;
}

interface SmtpMailerOptions { host: string; port: number; from: string; appBaseUrl: string; }

function mailSubject(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function escapeHeader(value: string): string { return value.replaceAll(/[\r\n]/g, ' ').trim(); }

/** A deliberately small SMTP client for Mailpit and plain internal SMTP relays. */
export class SmtpMailer implements AccountMailer {
  constructor(private readonly options: SmtpMailerOptions) {}

  async sendActivation(input: { to: string; displayName: string; token: string }): Promise<void> {
    const url = new URL('/auth/activate', this.options.appBaseUrl);
    url.searchParams.set('token', input.token);
    await this.send(input.to, 'Kích hoạt tài khoản Smart Path', `Chào ${input.displayName},\n\nHãy đặt mật khẩu để kích hoạt tài khoản Smart Path của bạn trong 30 phút:\n${url.toString()}\n\nNếu bạn không yêu cầu tài khoản này, bạn có thể bỏ qua email.`);
  }

  async sendPasswordReset(input: { to: string; token: string }): Promise<void> {
    const url = new URL('/auth/reset-password', this.options.appBaseUrl);
    url.searchParams.set('token', input.token);
    await this.send(input.to, 'Đặt lại mật khẩu Smart Path', `Bạn có thể đặt lại mật khẩu trong 30 phút tại:\n${url.toString()}\n\nNếu không phải bạn yêu cầu, hãy bỏ qua email này.`);
  }

  private async send(to: string, subject: string, body: string): Promise<void> {
    const socket = await new Promise<ReturnType<typeof createConnection>>((resolve, reject) => {
      const connection = createConnection({ host: this.options.host, port: this.options.port });
      connection.once('connect', () => resolve(connection));
      connection.once('error', reject);
    });
    let buffer = '';
    const waitFor = (accepted: readonly string[]): Promise<string> => new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\r\n');
        const completeIndex = lines.findIndex((line) => /^\d{3} /.test(line));
        if (completeIndex < 0) return;
        const response = lines.slice(0, completeIndex + 1).join('\n');
        buffer = lines.slice(completeIndex + 1).join('\r\n');
        cleanup();
        if (!accepted.some((code) => lines[completeIndex]!.startsWith(code))) reject(new Error(`SMTP rejected message: ${response}`));
        else resolve(response);
      };
      const onError = (error: Error) => { cleanup(); reject(error); };
      const cleanup = () => { socket.off('data', onData); socket.off('error', onError); };
      socket.on('data', onData);
      socket.once('error', onError);
    });
    const command = async (line: string, accepted: readonly string[] = ['250']) => { socket.write(`${line}\r\n`); await waitFor(accepted); };
    try {
      await waitFor(['220']);
      await command('EHLO smart-path.local');
      await command(`MAIL FROM:<${escapeHeader(this.options.from)}>`);
      await command(`RCPT TO:<${escapeHeader(to)}>`);
      await command('DATA', ['354']);
      const message = [
        `From: ${escapeHeader(this.options.from)}`,
        `To: ${escapeHeader(to)}`,
        `Subject: ${mailSubject(subject)}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        body.replaceAll('\n.', '\n..'),
        '.',
      ].join('\r\n');
      socket.write(`${message}\r\n`);
      await waitFor(['250']);
      socket.write('QUIT\r\n');
    } finally { socket.end(); }
  }
}

export class FileMailer implements AccountMailer {
  constructor(private readonly options: { directory: string; from: string; appBaseUrl: string }) {}

  async sendActivation(input: { to: string; displayName: string; token: string }): Promise<void> {
    const url = new URL('/auth/activate', this.options.appBaseUrl);
    url.searchParams.set('token', input.token);
    await this.write(input.to, 'Kích hoạt tài khoản Smart Path', `Chào ${input.displayName},\n\nHãy đặt mật khẩu để kích hoạt tài khoản Smart Path của bạn trong 30 phút:\n${url.toString()}\n`);
  }

  async sendPasswordReset(input: { to: string; token: string }): Promise<void> {
    const url = new URL('/auth/reset-password', this.options.appBaseUrl);
    url.searchParams.set('token', input.token);
    await this.write(input.to, 'Đặt lại mật khẩu Smart Path', `Bạn có thể đặt lại mật khẩu trong 30 phút tại:\n${url.toString()}\n`);
  }

  private async write(to: string, subject: string, body: string): Promise<void> {
    await mkdir(this.options.directory, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const safeTo = to.replaceAll(/[^a-zA-Z0-9._@-]/g, '_');
    const text = `From: ${this.options.from}\nTo: ${to}\nSubject: ${subject}\nDate: ${new Date().toISOString()}\n\n${body}`;
    await writeFile(join(this.options.directory, `${stamp}-${safeTo}.txt`), text, 'utf8');
    console.log(`[mail] ${subject} → ${to}`);
  }
}
