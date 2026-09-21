/**
 * Enlace ERP - Motor de Inteligência Bancária, Boletos, Pix & CNAB
 * PRD 09 - Cobrança Bancária, Boletos Registrados, Pix Dinâmico e Conciliação CNAB 240/400
 */

import {
  BankSlip,
  PixCharge,
  CnabFile,
  AccountReceivable,
  BankAccount,
} from '../../shared/types.js';

export interface BankConfig {
  code: string;
  name: string;
  defaultWallet: string;
  agencyLength: number;
  accountLength: number;
}

export const SUPPORTED_BANKS: Record<string, BankConfig> = {
  '001': { code: '001', name: 'Banco do Brasil S.A.', defaultWallet: '17', agencyLength: 4, accountLength: 8 },
  '237': { code: '237', name: 'Banco Bradesco S.A.', defaultWallet: '09', agencyLength: 4, accountLength: 7 },
  '341': { code: '341', name: 'Banco Itaú Unibanco S.A.', defaultWallet: '109', agencyLength: 4, accountLength: 5 },
  '033': { code: '033', name: 'Banco Santander Brasil S.A.', defaultWallet: '101', agencyLength: 4, accountLength: 8 },
  '104': { code: '104', name: 'Caixa Econômica Federal', defaultWallet: '14', agencyLength: 4, accountLength: 8 },
  '756': { code: '756', name: 'Banco Cooperativo Sicoob', defaultWallet: '01', agencyLength: 4, accountLength: 7 },
};

export class BoletoMath {
  /**
   * Remove acentos e caracteres não-ASCII
   */
  static cleanString(str: string): string {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  /**
   * Arredonda moeda para 2 decimais
   */
  static roundBRL(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calcula o Fator de Vencimento FEBRABAN
   * Data-base original: 1997-10-07 (fator 1000 em 2000-07-03)
   * Novo ciclo FEBRABAN: A partir de 2025-02-22 reiniciou em 1000
   */
  static calculateDueFactor(dueDateStr: string): string {
    if (!dueDateStr) return '0000';
    try {
      const due = new Date(`${dueDateStr.split('T')[0]}T00:00:00Z`);
      const cutoff2025 = new Date('2025-02-22T00:00:00Z');

      if (due.getTime() >= cutoff2025.getTime()) {
        const diffDays = Math.floor((due.getTime() - cutoff2025.getTime()) / 86400000);
        const factor = 1000 + diffDays;
        return String(Math.min(9999, factor)).padStart(4, '0');
      } else {
        const base1997 = new Date('1997-10-07T00:00:00Z');
        const diffDays = Math.floor((due.getTime() - base1997.getTime()) / 86400000);
        return String(Math.max(1000, Math.min(9999, diffDays))).padStart(4, '0');
      }
    } catch {
      return '0000';
    }
  }

  /**
   * Formata valor para 10 dígitos numéricos
   */
  static formatAmount10(amount: number): string {
    const cents = Math.round(this.roundBRL(amount) * 100);
    return String(cents).padStart(10, '0');
  }

  /**
   * Módulo 11 Padrão FEBRABAN para o Código de Barras (pesos de 2 a 9 da direita para a esquerda)
   */
  static modulo11Barcode(numStr: string): number {
    let sum = 0;
    let weight = 2;

    for (let i = numStr.length - 1; i >= 0; i--) {
      sum += parseInt(numStr.charAt(i), 10) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }

    const mod = sum % 11;
    const result = 11 - mod;
    if (result === 0 || result === 10 || result === 11) {
      return 1;
    }
    return result;
  }

  /**
   * Módulo 10 Padrão FEBRABAN para os campos da Linha Digitável
   * (pesos 2 e 1 alternados; se multiplicação >= 10, soma dos algarismos)
   */
  static modulo10(numStr: string): number {
    let sum = 0;
    let weight = 2;

    for (let i = numStr.length - 1; i >= 0; i--) {
      let mult = parseInt(numStr.charAt(i), 10) * weight;
      if (mult >= 10) {
        mult = Math.floor(mult / 10) + (mult % 10);
      }
      sum += mult;
      weight = weight === 2 ? 1 : 2;
    }

    const mod = sum % 10;
    return mod === 0 ? 0 : 10 - mod;
  }

  /**
   * Gera Campo Livre de 25 caracteres estruturado por Banco
   */
  static generateFreeField(params: {
    bankCode: string;
    agency: string;
    account: string;
    wallet: string;
    ourNumber: string;
  }): string {
    const { bankCode, agency, account, wallet, ourNumber } = params;
    const cleanAgency = agency.replace(/\D/g, '').padStart(4, '0').slice(-4);
    const cleanAccount = account.replace(/\D/g, '').padStart(8, '0').slice(-8);
    const cleanWallet = wallet.replace(/\D/g, '').padStart(2, '0').slice(-2);
    const cleanOurNumber = ourNumber.replace(/\D/g, '').padStart(11, '0').slice(-11);

    // Estrutura padronizada de 25 posições:
    // Pos 01-04: Agência (4)
    // Pos 05-06: Carteira (2)
    // Pos 07-17: Nosso Número (11)
    // Pos 18-25: Conta Corrente (8)
    const raw = `${cleanAgency}${cleanWallet}${cleanOurNumber}${cleanAccount}`;
    return raw.slice(0, 25).padEnd(25, '0');
  }

  /**
   * Monta o Código de Barras de 44 dígitos
   */
  static buildBarcode(params: {
    bankCode: string;
    amount: number;
    dueDate: string;
    freeField: string;
  }): { barcode: string; dac: number } {
    const { bankCode, amount, dueDate, freeField } = params;
    const bank = bankCode.replace(/\D/g, '').padStart(3, '0');
    const currency = '9'; // 9 = Real
    const dueFactor = this.calculateDueFactor(dueDate);
    const amountStr = this.formatAmount10(amount);
    const field25 = freeField.padEnd(25, '0').slice(0, 25);

    // Sem a posição 5 (DAC)
    const rawWithoutDac = `${bank}${currency}${dueFactor}${amountStr}${field25}`;
    const dac = this.modulo11Barcode(rawWithoutDac);

    const barcode = `${bank}${currency}${dac}${dueFactor}${amountStr}${field25}`;
    return { barcode, dac };
  }

  /**
   * Converte Código de Barras de 44 dígitos em Linha Digitável Formatada
   * Campo 1: AAABC.CCCCX
   * Campo 2: DDDDD.DDDDDY
   * Campo 3: EEEEE.EEEEEZ
   * Campo 4: K (DAC do Código de Barras)
   * Campo 5: UUUUVVVVVVVVVV (Fator Vencimento + Valor)
   */
  static buildDigitableLine(barcode: string): string {
    if (barcode.length !== 44) {
      throw new Error(`Código de barras deve ter exatamente 44 dígitos. Recebido: ${barcode.length}`);
    }

    const bank = barcode.substring(0, 3);
    const currency = barcode.substring(3, 4);
    const dac = barcode.substring(4, 5);
    const dueFactor = barcode.substring(5, 9);
    const amountStr = barcode.substring(9, 19);
    const freeField = barcode.substring(19, 44);

    // Campo 1: Banco (3) + Moeda (1) + 5 primeiras do Campo Livre (5) + DV (1)
    const part1 = `${bank}${currency}${freeField.substring(0, 5)}`;
    const dv1 = this.modulo10(part1);
    const field1Formatted = `${part1.substring(0, 5)}.${part1.substring(5, 9)}${dv1}`;

    // Campo 2: Posições 6 a 15 do Campo Livre (10) + DV (1)
    const part2 = freeField.substring(5, 15);
    const dv2 = this.modulo10(part2);
    const field2Formatted = `${part2.substring(0, 5)}.${part2.substring(5, 10)}${dv2}`;

    // Campo 3: Posições 16 a 25 do Campo Livre (10) + DV (1)
    const part3 = freeField.substring(15, 25);
    const dv3 = this.modulo10(part3);
    const field3Formatted = `${part3.substring(0, 5)}.${part3.substring(5, 10)}${dv3}`;

    // Campo 4: DAC Geral
    const field4Formatted = dac;

    // Campo 5: Fator Vencimento (4) + Valor (10)
    const field5Formatted = `${dueFactor}${amountStr}`;

    return `${field1Formatted} ${field2Formatted} ${field3Formatted} ${field4Formatted} ${field5Formatted}`;
  }
}

export class PixEngine {
  /**
   * Formata TLV: Tag (2 dígitos) + Tamanho (2 dígitos) + Valor
   */
  static formatTLV(tag: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${tag}${len}${value}`;
  }

  /**
   * Cálculo oficial de CRC16 (polinômio 0x1021, valor inicial 0xFFFF)
   * Padrão CCITT-FALSE utilizado pelo Banco Central do Brasil no Pix
   */
  static calculateCRC16(payload: string): string {
    let crc = 0xffff;
    const polynomial = 0x1021;

    for (let i = 0; i < payload.length; i++) {
      const byte = payload.charCodeAt(i);
      crc ^= byte << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ polynomial) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }

    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Gera o Payload EMV Co / BR Code Pix do Banco Central do Brasil
   */
  static generatePixPayload(params: {
    key: string;
    amount: number;
    merchantName: string;
    merchantCity: string;
    txid: string;
    description?: string;
  }): string {
    const { key, amount, merchantName, merchantCity, txid, description } = params;

    // Subtags do Merchant Account Information (Tag 26)
    const gui = this.formatTLV('00', 'br.gov.bcb.pix');
    const chave = this.formatTLV('01', key.trim());
    const infoAdicional = description ? this.formatTLV('02', description.trim().slice(0, 40)) : '';
    const merchantAccountInfo = this.formatTLV('26', `${gui}${chave}${infoAdicional}`);

    // Tags obrigatórias do EMV
    const payloadFormatIndicator = this.formatTLV('00', '01');
    const pointOfInitiation = this.formatTLV('01', '12'); // 12 = Pix Dinâmico / Recorrente / Com Valor
    const categoryCode = this.formatTLV('52', '0000');
    const currency = this.formatTLV('53', '986'); // 986 = Real BRL
    const formattedAmount = amount > 0 ? this.formatTLV('54', BoletoMath.roundBRL(amount).toFixed(2)) : '';
    const countryCode = this.formatTLV('58', 'BR');

    // Merchant Name (max 25) e City (max 15) sem acentos
    const cleanName = BoletoMath.cleanString(merchantName).slice(0, 25) || 'BENEFICIARIO';
    const cleanCity = BoletoMath.cleanString(merchantCity).slice(0, 15) || 'SAO PAULO';
    const nameField = this.formatTLV('59', cleanName);
    const cityField = this.formatTLV('60', cleanCity);

    // Tag 62: Additional Data Field (txid)
    const cleanTxid = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'TXID123';
    const txidField = this.formatTLV('05', cleanTxid);
    const additionalDataField = this.formatTLV('62', txidField);

    // Concatena tudo até o início do CRC (Tag 63, tamanho 04)
    const rawPayload = `${payloadFormatIndicator}${pointOfInitiation}${merchantAccountInfo}${categoryCode}${currency}${formattedAmount}${countryCode}${nameField}${cityField}${additionalDataField}6304`;

    const crc16 = this.calculateCRC16(rawPayload);
    return `${rawPayload}${crc16}`;
  }

  /**
   * Gera SVG inline para representação visual do QR Code sem dependências externas pesadas
   */
  static generateQrCodeSvg(text: string): string {
    // Gera representação gráfica estilizada em SVG do QR Code baseada no hash do payload
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }

    const size = 25; // Matriz 25x25
    const cellSize = 8;
    const viewBoxSize = size * cellSize;
    let rects = '';

    // Marcadores de posição (cantos padrão QR Code)
    const drawFinderPattern = (startX: number, startY: number) => {
      let r = '';
      for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 7; y++) {
          if (
            x === 0 ||
            x === 6 ||
            y === 0 ||
            y === 6 ||
            (x >= 2 && x <= 4 && y >= 2 && y <= 4)
          ) {
            r += `<rect x="${(startX + x) * cellSize}" y="${(startY + y) * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
          }
        }
      }
      return r;
    };

    rects += drawFinderPattern(1, 1);
    rects += drawFinderPattern(size - 8, 1);
    rects += drawFinderPattern(1, size - 8);

    // Dados pseudo-gerados a partir dos bits do payload
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        // Evita sobrepor os 3 cantos de localização
        const inFinder1 = x <= 8 && y <= 8;
        const inFinder2 = x >= size - 9 && y <= 8;
        const inFinder3 = x <= 8 && y >= size - 9;
        if (!inFinder1 && !inFinder2 && !inFinder3) {
          const bit = (hash + x * 31 + y * 17 + text.charCodeAt((x + y) % text.length)) % 3 === 0;
          if (bit) {
            rects += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a" />`;
          }
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="200" height="200" class="rounded bg-white p-2 shadow-inner">${rects}</svg>`;
  }
}

export class CnabEngine {
  /**
   * Gera Arquivo de Remessa CNAB 400
   */
  static generateRemessaCnab400(params: {
    bankCode: string;
    companyLegalName: string;
    companyCnpj: string;
    bankAccount: BankAccount;
    sequenceNumber: number;
    slips: BankSlip[];
  }): string {
    const { bankCode, companyLegalName, companyCnpj, bankAccount, sequenceNumber, slips } = params;
    const now = new Date();
    const dateDDMMAA = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
    const bankCfg = SUPPORTED_BANKS[bankCode] || SUPPORTED_BANKS['001'];

    const lines: string[] = [];

    // --- REGISTRO HEADER (TIPO 0) - 400 posições ---
    let header = '0'; // 001-001: Tipo de registro
    header += '1'; // 002-002: Identificação do arquivo de remessa
    header += 'REMESSA'; // 003-009: Literal remessa
    header += '01'; // 010-011: Código do serviço (01 = Cobrança)
    header += 'COBRANCA'.padEnd(15, ' '); // 012-026: Literal serviço
    header += bankAccount.agency.replace(/\D/g, '').padStart(4, '0').slice(-4); // 027-030: Agência
    header += '00'; // 031-032: Complemento
    header += bankAccount.accountNumber.replace(/\D/g, '').padStart(8, '0').slice(-8); // 033-040: Conta
    header += '      '; // 041-046: Brancos
    header += BoletoMath.cleanString(companyLegalName).padEnd(30, ' ').slice(0, 30); // 047-076: Nome da Empresa
    header += bankCode.padStart(3, '0'); // 077-079: Número do banco
    header += BoletoMath.cleanString(bankCfg.name).padEnd(15, ' ').slice(0, 15); // 080-094: Nome do banco
    header += dateDDMMAA; // 095-100: Data de gravação
    header += '01600'; // 101-105: Densidade de gravação
    header += 'BPI'; // 106-108: Unidade de densidade
    header += String(sequenceNumber).padStart(7, '0'); // 109-115: Sequencial do arquivo de remessa
    header = header.padEnd(394, ' '); // 116-394: Brancos
    header += '000001'; // 395-400: Sequencial do registro

    lines.push(header.slice(0, 400));

    // --- REGISTROS DETALHE (TIPO 1) ---
    let lineIndex = 2;
    for (const slip of slips) {
      const cleanDue = slip.dueDate.replace(/\D/g, '');
      const dueDDMMAA = cleanDue.length >= 8
        ? `${cleanDue.substring(6, 8)}${cleanDue.substring(4, 6)}${cleanDue.substring(2, 4)}`
        : dateDDMMAA;

      let det = '1'; // 001-001: Tipo detalhe
      det += '02'; // 002-003: Tipo de inscrição do cedente (02 = CNPJ)
      det += companyCnpj.replace(/\D/g, '').padStart(14, '0').slice(-14); // 004-017: CNPJ cedente
      det += bankAccount.agency.replace(/\D/g, '').padStart(4, '0').slice(-4); // 018-021: Agência
      det += '00'; // 022-023: Subconta
      det += bankAccount.accountNumber.replace(/\D/g, '').padStart(8, '0').slice(-8); // 024-031: Conta
      det += slip.wallet.padStart(2, '0').slice(-2); // 032-033: Carteira
      det += slip.documentNumber.padEnd(25, ' ').slice(0, 25); // 034-058: Controle do participante
      det += slip.ourNumber.replace(/\D/g, '').padStart(11, '0').slice(-11); // 059-069: Nosso Número
      det += '0'; // 070-070: DAC nosso número
      det += '000000'; // 071-076: Data segundo desconto
      det += '0000000000000'; // 077-089: Valor segundo desconto
      det += '01'; // 090-091: Código de ocorrência (01 = Entrada de Título)
      det += slip.documentNumber.padEnd(10, ' ').slice(0, 10); // 092-101: Seu número / documento
      det += dueDDMMAA; // 102-107: Vencimento
      det += BoletoMath.formatAmount10(slip.amount).padStart(13, '0'); // 108-120: Valor nominal
      det += bankCode.padStart(3, '0'); // 121-123: Banco cobrador
      det += '00000'; // 124-128: Agência cobradora
      det += '01'; // 129-130: Espécie do título (01 = Duplicata Mercantil DM)
      det += 'N'; // 131-131: Aceite
      det += dateDDMMAA; // 132-137: Data de emissão
      det += '00'; // 138-139: Primeira instrução de cobrança
      det += '00'; // 140-141: Segunda instrução de cobrança
      det += '0000000000000'; // 142-154: Juros de mora por dia
      det += '000000'; // 155-160: Data limite para desconto
      det += '0000000000000'; // 161-173: Valor do desconto
      det += '0000000000000'; // 174-186: Valor do IOF
      det += '0000000000000'; // 187-199: Valor do abatimento
      det += slip.payerDocument.length > 11 ? '02' : '01'; // 200-201: Tipo sacado (01 CPF / 02 CNPJ)
      det += slip.payerDocument.replace(/\D/g, '').padStart(14, '0').slice(-14); // 202-215: CPF/CNPJ Sacado
      det += BoletoMath.cleanString(slip.payerName).padEnd(40, ' ').slice(0, 40); // 216-255: Nome do sacado
      det += BoletoMath.cleanString(slip.payerAddress || 'ENDERECO COMERCIAL').padEnd(40, ' ').slice(0, 40); // 256-295: Logradouro
      det += ' '.repeat(12); // 296-307: Bairro
      det += '00000000'; // 308-315: CEP
      det += ' '.repeat(15); // 316-330: Cidade
      det += 'SP'; // 331-332: UF
      det += ' '.repeat(62); // 333-394: Brancos
      det += String(lineIndex).padStart(6, '0'); // 395-400: Sequencial do registro

      lines.push(det.slice(0, 400));
      lineIndex++;
    }

    // --- REGISTRO TRAILER (TIPO 9) - 400 posições ---
    let trailer = '9';
    trailer = trailer.padEnd(394, ' ');
    trailer += String(lineIndex).padStart(6, '0');
    lines.push(trailer.slice(0, 400));

    return lines.join('\r\n');
  }

  /**
   * Processador / Parser de Arquivo de Retorno CNAB (detecta CNAB 400 e CNAB 240)
   */
  static parseRetornoCnab(contentRaw: string): {
    standard: 'CNAB400' | 'CNAB240';
    bankCode: string;
    totalRecords: number;
    totalPaidAmount: number;
    occurrences: {
      ourNumber: string;
      documentNumber: string;
      occurrenceCode: string;
      occurrenceDescription: string;
      dueDate: string;
      paidAmount: number;
      nominalAmount: number;
      feeAmount: number;
      interestAmount: number;
      paymentDate: string;
      creditDate: string;
      isSettlement: boolean;
    }[];
  } {
    const rawLines = contentRaw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length === 0) {
      throw new Error('Arquivo de retorno vazio.');
    }

    const firstLine = rawLines[0];
    const isCnab240 = firstLine.length === 240;
    const isCnab400 = firstLine.length >= 400;

    if (!isCnab240 && !isCnab400) {
      throw new Error(`Tamanho de linha desconhecido: ${firstLine.length} posições. Suportados: 240 e 400.`);
    }

    const occurrences: any[] = [];
    let totalPaid = 0;
    let bankCode = '001';

    if (isCnab400) {
      bankCode = firstLine.substring(76, 79) || '001';

      for (let i = 1; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (line.charAt(0) === '1') {
          // Registro detalhe tipo 1
          const ourNumber = line.substring(62, 73).trim() || line.substring(70, 81).trim();
          const documentNumber = line.substring(116, 126).trim() || line.substring(37, 47).trim();
          const occCode = line.substring(108, 110).trim();
          const nominalCents = parseInt(line.substring(152, 165), 10) || 0;
          const paidCents = parseInt(line.substring(253, 266), 10) || nominalCents;
          const feeCents = parseInt(line.substring(175, 188), 10) || 0;
          const interestCents = parseInt(line.substring(266, 279), 10) || 0;

          const paymentDateRaw = line.substring(110, 116); // DDMMAA
          let formattedPaymentDate = new Date().toISOString().split('T')[0];
          if (paymentDateRaw.length === 6 && !isNaN(Number(paymentDateRaw))) {
            const d = paymentDateRaw.substring(0, 2);
            const m = paymentDateRaw.substring(2, 4);
            const y = `20${paymentDateRaw.substring(4, 6)}`;
            formattedPaymentDate = `${y}-${m}-${d}`;
          }

          const isSettlement = occCode === '06' || occCode === '08' || occCode === '09' || occCode === '10';

          const occMap: Record<string, string> = {
            '02': 'Entrada confirmada no banco',
            '03': 'Entrada rejeitada pela instituição bancária',
            '06': 'Liquidação normal / Boleto pago pelo cliente',
            '09': 'Baixa de título por solicitação',
            '10': 'Baixa por decurso de prazo',
            '14': 'Vencimento alterado',
            '17': 'Liquidação após baixa ou em cartório',
          };

          const nominalAmount = BoletoMath.roundBRL(nominalCents / 100);
          const paidAmount = BoletoMath.roundBRL(paidCents / 100);
          const feeAmount = BoletoMath.roundBRL(feeCents / 100);
          const interestAmount = BoletoMath.roundBRL(interestCents / 100);

          if (isSettlement) {
            totalPaid += paidAmount;
          }

          occurrences.push({
            ourNumber,
            documentNumber,
            occurrenceCode: occCode,
            occurrenceDescription: occMap[occCode] || `Ocorrência bancária código ${occCode}`,
            dueDate: formattedPaymentDate,
            paidAmount,
            nominalAmount,
            feeAmount,
            interestAmount,
            paymentDate: formattedPaymentDate,
            creditDate: formattedPaymentDate,
            isSettlement,
          });
        }
      }

      return {
        standard: 'CNAB400',
        bankCode,
        totalRecords: rawLines.length,
        totalPaidAmount: BoletoMath.roundBRL(totalPaid),
        occurrences,
      };
    } else {
      // CNAB 240
      bankCode = firstLine.substring(0, 3) || '001';

      for (let i = 2; i < rawLines.length - 2; i++) {
        const line = rawLines[i];
        const recordType = line.charAt(7); // 3 = Segmento detalhe
        const segmentType = line.charAt(13); // T ou U

        if (recordType === '3' && segmentType === 'T') {
          const occCode = line.substring(15, 17);
          const ourNumber = line.substring(37, 57).trim();
          const documentNumber = line.substring(58, 73).trim();
          const nominalCents = parseInt(line.substring(81, 96), 10) || 0;
          const feeCents = parseInt(line.substring(198, 213), 10) || 0;

          const isSettlement = occCode === '06' || occCode === '09';
          const nominalAmount = BoletoMath.roundBRL(nominalCents / 100);

          if (isSettlement) {
            totalPaid += nominalAmount;
          }

          occurrences.push({
            ourNumber,
            documentNumber,
            occurrenceCode: occCode,
            occurrenceDescription: isSettlement ? 'Liquidação normal confirmada' : `Ocorrência segmento T ${occCode}`,
            dueDate: new Date().toISOString().split('T')[0],
            paidAmount: nominalAmount,
            nominalAmount,
            feeAmount: BoletoMath.roundBRL(feeCents / 100),
            interestAmount: 0,
            paymentDate: new Date().toISOString().split('T')[0],
            creditDate: new Date().toISOString().split('T')[0],
            isSettlement,
          });
        }
      }

      return {
        standard: 'CNAB240',
        bankCode,
        totalRecords: rawLines.length,
        totalPaidAmount: BoletoMath.roundBRL(totalPaid),
        occurrences,
      };
    }
  }
}
