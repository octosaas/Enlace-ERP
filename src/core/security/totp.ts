/**
 * Enlace ERP - Algoritmo TOTP (RFC 6238 / RFC 4226)
 * PRD 02 - Seção 17 (Autenticação Multifator - MFA)
 */

import crypto from 'crypto';

// Alfabeto Base32 RFC 4648
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class TotpService {
  /**
   * Gera uma chave secreta aleatória em formato Base32
   */
  static generateSecret(length = 20): string {
    const randomBytes = crypto.randomBytes(length);
    let secret = '';
    for (let i = 0; i < randomBytes.length; i++) {
      secret += BASE32_CHARS[randomBytes[i] % 32];
    }
    return secret;
  }

  /**
   * Decodifica string Base32 em Buffer
   */
  private static base32Decode(base32: string): Buffer {
    const clean = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = '';
    for (let i = 0; i < clean.length; i++) {
      const val = BASE32_CHARS.indexOf(clean[i]);
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
  }

  /**
   * Gera o código numérico de 6 dígitos para o timestamp atual (janela de 30s)
   */
  static generateCode(secretBase32: string, timeStepWindow = 0): string {
    const key = this.base32Decode(secretBase32);
    const counter = Math.floor(Date.now() / 1000 / 30) + timeStepWindow;

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  /**
   * Valida código TOTP com tolerância de drift de tempo (janela atual, anterior e próxima)
   */
  static verifyCode(secretBase32: string, code: string): boolean {
    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) return false;

    // Permite drift de -1, 0, +1 janelas de 30s
    for (let window = -1; window <= 1; window++) {
      const expected = this.generateCode(secretBase32, window);
      if (expected === cleanCode) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gera códigos de recuperação alfanuméricos descartáveis
   */
  static generateRecoveryCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      codes.push(`${part1}-${part2}`);
    }
    return codes;
  }
}
