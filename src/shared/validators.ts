/**
 * Enlace ERP - Validadores e Formatadores Fiscais Brasileiros (PRD 03)
 * Algoritmo oficial de verificação de dígitos para CPF e CNPJ (Módulo 11)
 */

/**
 * Remove pontuações e caracteres não numéricos
 */
export function cleanDocument(doc: string): string {
  return (doc || '').replace(/\D/g, '');
}

/**
 * Validação rigorosa de CPF brasileiro (11 dígitos)
 * Calcula os dois dígitos verificadores via Módulo 11
 */
export function validateCPF(cpfRaw: string): boolean {
  const cpf = cleanDocument(cpfRaw);
  if (cpf.length !== 11) return false;

  // Rejeita sequências repetidas conhecidas (111.111.111-11, 222.222.222-22, etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let rest = 11 - (sum % 11);
  const digit1 = rest >= 10 ? 0 : rest;
  if (digit1 !== parseInt(cpf.charAt(9), 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  rest = 11 - (sum % 11);
  const digit2 = rest >= 10 ? 0 : rest;
  if (digit2 !== parseInt(cpf.charAt(10), 10)) return false;

  return true;
}

/**
 * Validação rigorosa de CNPJ brasileiro (14 dígitos)
 * Calcula os dois dígitos verificadores via Módulo 11 com pesos alternados
 */
export function validateCNPJ(cnpjRaw: string): boolean {
  const cnpj = cleanDocument(cnpjRaw);
  if (cnpj.length !== 14) return false;

  // Rejeita sequências repetidas conhecidas
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Primeiro dígito
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj.charAt(i), 10) * weights1[i];
  }
  let rest = sum % 11;
  const digit1 = rest < 2 ? 0 : 11 - rest;
  if (digit1 !== parseInt(cnpj.charAt(12), 10)) return false;

  // Segundo dígito
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj.charAt(i), 10) * weights2[i];
  }
  rest = sum % 11;
  const digit2 = rest < 2 ? 0 : 11 - rest;
  if (digit2 !== parseInt(cnpj.charAt(13), 10)) return false;

  return true;
}

/**
 * Valida documento baseado no tipo de pessoa
 */
export function validateFiscalDocument(type: 'PF' | 'PJ' | 'ESTRANGEIRO', doc: string): {
  isValid: boolean;
  message?: string;
} {
  if (type === 'ESTRANGEIRO') {
    return { isValid: doc.trim().length >= 5 };
  }

  const clean = cleanDocument(doc);
  if (type === 'PF') {
    const valid = validateCPF(clean);
    return {
      isValid: valid,
      message: valid ? undefined : 'CPF inválido conforme algoritmo da Receita Federal.',
    };
  }

  if (type === 'PJ') {
    const valid = validateCNPJ(clean);
    return {
      isValid: valid,
      message: valid ? undefined : 'CNPJ inválido conforme algoritmo da Receita Federal.',
    };
  }

  return { isValid: false, message: 'Tipo de documento não reconhecido.' };
}

/**
 * Formata CPF ou CNPJ conforme comprimento
 */
export function formatDocument(raw: string): string {
  const clean = cleanDocument(raw);
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return raw;
}

/**
 * Formata CEP
 */
export function formatCEP(raw: string): string {
  const clean = cleanDocument(raw);
  if (clean.length === 8) {
    return clean.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  return raw;
}

/**
 * Formata Telefone Brasileiro (com 8 ou 9 dígitos)
 */
export function formatPhone(raw: string): string {
  const clean = cleanDocument(raw);
  if (clean.length === 11) {
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (clean.length === 10) {
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return raw;
}

/**
 * Gera CPF válido para testes em ambiente de demonstração
 */
export function generateTestCPF(): string {
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  let rest = 11 - (sum % 11);
  const d1 = rest >= 10 ? 0 : rest;
  digits.push(d1);
  sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
  rest = 11 - (sum % 11);
  const d2 = rest >= 10 ? 0 : rest;
  digits.push(d2);
  return formatDocument(digits.join(''));
}

/**
 * Gera CNPJ válido para testes em ambiente de demonstração
 */
export function generateTestCNPJ(): string {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  base.push(0, 0, 0, 1);
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += base[i] * weights1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  base.push(d1);
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += base[i] * weights2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  base.push(d2);
  return formatDocument(base.join(''));
}
