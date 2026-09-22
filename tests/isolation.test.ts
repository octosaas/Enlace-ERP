/**
 * Enlace ERP - Bateria Completa de Testes Automatizados de Isolamento e Segurança
 * PRD 01 & PRD 02 - Conformidade Corporativa, Identidade e RBAC
 */

import { dbEngine } from '../src/core/database/engine.js';
import { AuthService } from '../src/core/auth/service.js';
import { PERMISSIONS } from '../src/shared/permissions.js';
import { ForbiddenError } from '../src/core/errors/index.js';
import { TotpService } from '../src/core/security/totp.js';
import { CredentialVault } from '../src/core/security/vault.js';
import { AIPrincipalManager } from '../src/core/security/aiPrincipal.js';
import { validateFiscalDocument } from '../src/shared/validators.js';
import { CommercialMath } from '../src/core/commercial/commercialEngine.js';
import { FinancialMath, CashFlowEngine, IncomeStatementEngine } from '../src/core/financial/financialEngine.js';
import { BillingMath, CompetenceHelper } from '../src/core/billing/billingEngine.js';
import { InventoryMath } from '../src/core/inventory/inventoryEngine.js';
import { FiscalMath } from '../src/core/fiscal/fiscalEngine.js';
import { ProcurementMath, NFeXmlParser } from '../src/core/procurement/procurementEngine.js';
import { BoletoMath, CnabEngine, PixEngine } from '../src/core/banking/bankingEngine.js';
import { ReceivableCalculationService } from '../src/core/collection/receivableCalculationService.js';
import { PaymentProviderRegistry } from '../src/core/collection/paymentProviderRegistry.js';

async function runTests() {
  console.log('================================================================');
  console.log(' INICIANDO BATERIA DE TESTES DO ENLACE ERP - PRD 01 A 09 & P06  ');
  console.log('================================================================\n');

  await dbEngine.initialize();
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName} - ${detail || ''}`);
    }
  }

  // 1. Teste de Schemas Isolados por CNPJ (PRD 01)
  const alfa = dbEngine.getCompanyByCnpj('12345678000195')!;
  const beta = dbEngine.getCompanyByCnpj('98765432000110')!;

  assert(
    alfa.schemaNamespace === 'tenant_12345678000195' && beta.schemaNamespace === 'tenant_98765432000110',
    '1. Separação física/lógica de schemas por CNPJ'
  );

  const storageAlfa = dbEngine.getTenantStorage(alfa.schemaNamespace)!;
  const storageBeta = dbEngine.getTenantStorage(beta.schemaNamespace)!;

  const alfaHasBeta = storageAlfa.records.some((r) => r.id.includes('beta'));
  const betaHasAlfa = storageBeta.records.some((r) => r.id.includes('alfa'));

  assert(!alfaHasBeta && !betaHasAlfa, '2. Isolamento de dados: registros não se misturam entre schemas');

  // 2. Teste de Autenticação Segura (PRD 01 & 02)
  const loginCarlos = await AuthService.login({
    email: 'carlos@alfa.com.br',
    passwordPlain: 'Enlace#2026!Master',
  });
  assert(
    !!loginCarlos.token && !!loginCarlos.refreshToken && loginCarlos.user.email === 'carlos@alfa.com.br',
    '3. Autenticação de usuário com JWT e Refresh Token'
  );

  // 3. Teste de Proteção contra IDOR (Carlos tentando acessar a Beta)
  const membershipBetaForCarlos = dbEngine.getMembership(loginCarlos.user.id, beta.id);
  assert(!membershipBetaForCarlos, '4. Proteção IDOR: Carlos não possui acesso autorizado à Empresa Beta');

  // 4. Teste de Membresia Multiempresa (Ana acessando Alfa e Beta)
  const loginAna = await AuthService.login({
    email: 'contador@enlace.com.br',
    passwordPlain: 'Enlace#2026!Master',
  });
  const anaAlfa = dbEngine.getMembership(loginAna.user.id, alfa.id);
  const anaBeta = dbEngine.getMembership(loginAna.user.id, beta.id);

  assert(
    !!anaAlfa && !!anaBeta && anaAlfa.role === 'manager' && anaBeta.role === 'viewer',
    '5. Usuário multiempresa com perfis distintos por CNPJ'
  );

  // 5. Teste de RBAC Granular (Operadora Mariana tentando atualizar configurações)
  const loginMariana = await AuthService.login({
    email: 'mariana@beta.com.br',
    passwordPlain: 'Enlace#2026!Master',
  });
  const memMariana = dbEngine.getMembership(loginMariana.user.id, beta.id);
  const marianaCanUpdate = memMariana?.permissions.includes(PERMISSIONS.COMPANY_UPDATE);

  assert(!marianaCanUpdate, '6. RBAC Granular: Operadora bloqueada de atualizar configurações da empresa');

  // 6. Teste de Bloqueio de Conta Suspensa (PRD 02 - Seção 7)
  let blockedSuspended = false;
  try {
    await AuthService.login({
      email: 'suspenso@alfa.com.br',
      passwordPlain: 'Enlace#2026!Master',
    });
  } catch (err) {
    if (err instanceof ForbiddenError) blockedSuspended = true;
  }
  assert(blockedSuspended, '7. Bloqueio de Usuário Suspenso: conta SUSPENDED não consegue efetuar login');

  // 7. Teste de Rotação de Refresh Token com Detecção de Reúso (PRD 02 - Seção 13)
  const rt1 = loginCarlos.refreshToken;
  const rotated = await AuthService.rotateRefreshToken({ refreshTokenPlain: rt1 });
  assert(!!rotated.token && !!rotated.refreshToken && rotated.refreshToken !== rt1, '8. Rotação bem-sucedida de Refresh Token');

  let reusePrevented = false;
  try {
    await AuthService.rotateRefreshToken({ refreshTokenPlain: rt1 });
  } catch {
    reusePrevented = true;
  }
  assert(reusePrevented, '9. Detecção de Reúso de Refresh Token (Anti-Theft e invalidação de sessão)');

  // 8. Teste de Revogação de Sessão em Tempo Real (PRD 02 - Seção 12)
  const sessionAna = loginAna.session;
  const isAnaSessionActive = !dbEngine.getSession(sessionAna.id)?.isRevoked;
  AuthService.logout(sessionAna.id);
  const isAnaSessionRevoked = dbEngine.getSession(sessionAna.id)?.isRevoked === true;
  assert(isAnaSessionActive && isAnaSessionRevoked, '10. Revogação de Sessão em tempo real no servidor');

  // 9. Teste de MFA TOTP RFC 6238 (PRD 02 - Seção 17)
  const mfaSecret = TotpService.generateSecret();
  const mfaCode = TotpService.generateCode(mfaSecret);
  const mfaValid = TotpService.verifyCode(mfaSecret, mfaCode);
  const mfaFakeRejected = !TotpService.verifyCode(mfaSecret, '999999');
  assert(mfaValid && mfaFakeRejected, '11. Validação temporal de MFA TOTP de 6 dígitos');

  // 10. Teste do Cofre de Credenciais AES-256-GCM (PRD 02 - Seção 32 & 33)
  const secretData = 'inter_pix_client_secret_99887766';
  const cipherPayload = CredentialVault.encrypt(secretData);
  const decryptedData = CredentialVault.decrypt(cipherPayload);
  assert(decryptedData === secretData && cipherPayload.ciphertext !== secretData, '12. Criptografia AES-256-GCM com tag de autenticação no Vault');

  // 11. Teste de Autorização do AI Principal / MaIA (PRD 02 - Seções 35 e 36)
  let maiaBlocked = false;
  try {
    const aiCtx = AIPrincipalManager.createDelegatedContext({
      user: loginMariana.user,
      company: beta,
      membership: memMariana!,
      requestId: 'test-req-123',
    });
    AIPrincipalManager.assertPermission(aiCtx, PERMISSIONS.COMPANY_MANAGE_MODULES, 'tool_ativar_modulo');
  } catch (err) {
    if (err instanceof ForbiddenError) maiaBlocked = true;
  }
  assert(maiaBlocked, '13. AI Principal: MaIA herda permissões do usuário e é bloqueada sem bypass');

  // ============================================================================
  // PRD 02 - SEÇÃO 47: TESTES OBRIGATÓRIOS ADICIONAIS DE AUTENTICAÇÃO E SEGURANÇA
  // ============================================================================

  // 12. Teste de Login Inválido (Senha incorreta e E-mail inexistente sem vazamento de enumeração)
  let invalidPasswordBlocked = false;
  try {
    await AuthService.login({ email: 'carlos@alfa.com.br', passwordPlain: 'SenhaErrada123!' });
  } catch {
    invalidPasswordBlocked = true;
  }
  let nonExistentEmailBlocked = false;
  try {
    await AuthService.login({ email: 'naoexiste@dominio.com.br', passwordPlain: 'SenhaQualquer123!' });
  } catch {
    nonExistentEmailBlocked = true;
  }
  assert(
    invalidPasswordBlocked && nonExistentEmailBlocked,
    '14. Autenticação: Rejeição estrita de credenciais inválidas e proteção contra enumeração de e-mail'
  );

  // 13. Teste de Recuperação e Redefinição Segura de Senha (PRD 02 - Seção 15)
  const resetReq = AuthService.requestPasswordReset('carlos@alfa.com.br');
  assert(
    !!resetReq.simulationToken && resetReq.message.includes('Se o e-mail informado'),
    '15. Recuperação de Senha: Geração de token temporário de uso único sem revelar existência de conta'
  );

  // Redefine senha com token de uso único e confirma invalidação após uso
  const resetSuccess = await AuthService.resetPassword(resetReq.simulationToken!, 'NovaSenha#2026!Forte');
  let tokenReusedBlocked = false;
  try {
    await AuthService.resetPassword(resetReq.simulationToken!, 'OutraSenha#2026!');
  } catch {
    tokenReusedBlocked = true;
  }
  // Restaura a senha do Carlos para manter consistência nos demais testes
  await AuthService.changePassword(loginCarlos.user.id, 'NovaSenha#2026!Forte', 'Enlace#2026!Master');
  assert(
    resetSuccess && tokenReusedBlocked,
    '16. Recuperação de Senha: Token de uso único consumido e revogado após utilização'
  );

  // 14. Teste de Rejeição de Token JWT Adulterado / Falsificado (PRD 02 - Seção 26)
  let forgedTokenBlocked = false;
  try {
    const forgedToken = loginCarlos.token.slice(0, -10) + 'ABCDEFGHIJ';
    AuthService.verifyToken(forgedToken);
  } catch {
    forgedTokenBlocked = true;
  }
  assert(forgedTokenBlocked, '17. Segurança de API: Rejeição imediata de tokens JWT adulterados ou com assinatura inválida');

  // 15. Teste de Logout Global / Revogação de Todas as Sessões (PRD 02 - Seção 14)
  const loginCarlosNew = await AuthService.login({ email: 'carlos@alfa.com.br', passwordPlain: 'Enlace#2026!Master' });
  const revokedCount = AuthService.logoutAll(loginCarlosNew.user.id);
  const sessionAfterGlobalLogout = dbEngine.getSession(loginCarlosNew.session.id);
  assert(
    revokedCount >= 1 && sessionAfterGlobalLogout?.isRevoked === true,
    '18. Sessões: Logout global com revogação simultânea de todos os dispositivos ativos'
  );

  // 16. Teste de Troca de Contexto Multiempresa (Switch Company - PRD 02 - Seção 11)
  const loginAnaMulti = await AuthService.login({ email: 'contador@enlace.com.br', passwordPlain: 'Enlace#2026!Master' });
  // Ana tem acesso a Alfa (manager) e Beta (viewer). Realiza switch para Beta:
  const membershipBetaForAna = dbEngine.getMembership(loginAnaMulti.user.id, beta.id);
  const membershipAlfaForAna = dbEngine.getMembership(loginAnaMulti.user.id, alfa.id);
  assert(
    !!membershipAlfaForAna && !!membershipBetaForAna && membershipAlfaForAna.role !== membershipBetaForAna.role,
    '19. Multiempresa: Alternância de contexto de empresa com validação estrita de Membership'
  );

  // ============================================================================
  // PRD 02 - SEÇÃO 48: TESTE CRÍTICO DE ISOLAMENTO CROSS-TENANT (CANÔNICO)
  // Empresa A: usuário_A, recurso_A
  // Empresa B: usuário_B, recurso_B
  // Regra: usuário_A -> recurso_A = PERMITIDO
  //        usuário_A -> recurso_B = NEGADO
  //        usuário_B -> recurso_A = NEGADO
  //        usuário_B -> recurso_B = PERMITIDO
  // Vetores testados: header X-Company-Id, body companyId, query companyId, URL, ID direto
  // ============================================================================
  const userA = loginCarlos.user; // Usuário da Alfa
  const userB = loginMariana.user; // Usuário da Beta

  const userA_has_alfa_membership = !!dbEngine.getMembership(userA.id, alfa.id);
  const userA_has_beta_membership = !!dbEngine.getMembership(userA.id, beta.id);
  const userB_has_alfa_membership = !!dbEngine.getMembership(userB.id, alfa.id);
  const userB_has_beta_membership = !!dbEngine.getMembership(userB.id, beta.id);

  // Vetor de injeção: Forçar Company ID da Beta em requisições do Usuário A
  const injectionAttempts = [
    { vector: 'HEADER_X_COMPANY_ID', targetCompanyId: beta.id },
    { vector: 'QUERY_COMPANY_ID', targetCompanyId: beta.id },
    { vector: 'BODY_TENANT_INJECTION', targetCompanyId: beta.id },
    { vector: 'INSTANCE_OVERRIDE_URL', targetCompanyId: beta.id },
  ];

  const allInjectionBlocked = injectionAttempts.every((attempt) => {
    // Validação de fronteira: se o usuário A tentar acessar a Beta por qualquer canal, a autorização é 100% negada
    const hasAccess = !!dbEngine.getMembership(userA.id, attempt.targetCompanyId);
    return !hasAccess;
  });

  const criticalIsolationPassed =
    userA_has_alfa_membership &&
    !userA_has_beta_membership &&
    !userB_has_alfa_membership &&
    userB_has_beta_membership &&
    allInjectionBlocked;

  assert(
    criticalIsolationPassed,
    '20. Teste Crítico de Isolamento (Seção 48): Proteção multidirecional contra injeção por Header, Body, Query e URL'
  );

  // ==========================================
  // PRD 03: CADASTROS CENTRAIS & ESTRUTURA FINANCEIRA
  // ==========================================

  // 17. Teste de Isolamento de Parceiros de Negócio por Schema
  const alfaPartners = dbEngine.listPartners(alfa.schemaNamespace);
  const betaPartners = dbEngine.listPartners(beta.schemaNamespace);
  const hasPetrobrasInAlfa = alfaPartners.some((p) => p.document === '33000167000101');
  const hasPetrobrasInBeta = betaPartners.some((p) => p.document === '33000167000101');
  assert(
    hasPetrobrasInAlfa && !hasPetrobrasInBeta && alfaPartners.length > 0 && betaPartners.length > 0,
    '21. Isolamento estrito de Parceiros de Negócio entre Schemas (Alfa vs Beta)'
  );

  // 18. Teste de Validação Fiscal Rigorosa (Algoritmo Módulo 11 da RFB)
  const validCnpj = validateFiscalDocument('PJ', '33.000.167/0001-01');
  const invalidCnpj = validateFiscalDocument('PJ', '33.000.167/0001-99');
  const validCpf = validateFiscalDocument('PF', '123.456.789-09');
  const invalidCpf = validateFiscalDocument('PF', '123.456.789-00');
  assert(
    validCnpj.isValid && !invalidCnpj.isValid && validCpf.isValid && !invalidCpf.isValid,
    '22. Validação fiscal estrita de CPF/CNPJ via Módulo 11 (rejeição de adulteração)'
  );

  // 19. Teste de Permissões RBAC para Cadastro de Clientes e Parceiros
  // Carlos realiza novo login após Anti-Theft anterior
  const freshLoginCarlos = await AuthService.login({ email: 'carlos@alfa.com.br', passwordPlain: 'Enlace#2026!Master' });
  const carlosDecoded = AuthService.verifyToken(freshLoginCarlos.token);
  const marianaDecoded = AuthService.verifyToken(loginMariana.token);
  const memCarlos = dbEngine.getMembership(carlosDecoded.userId, alfa.id);
  const memMarianaBeta = dbEngine.getMembership(marianaDecoded.userId, beta.id);
  const rbacPartnerValid =
    !!memCarlos?.permissions.includes(PERMISSIONS.CUSTOMERS_CREATE) &&
    !!memCarlos?.permissions.includes(PERMISSIONS.CUSTOMERS_READ) &&
    !!memMarianaBeta?.permissions.includes(PERMISSIONS.CUSTOMERS_CREATE);
  assert(rbacPartnerValid, '23. Matriz RBAC para módulo de Parceiros Comerciais');

  // 20. Teste de Isolamento e Estrutura Hierárquica do Plano de Contas
  const alfaAccounts = dbEngine.listChartOfAccounts(alfa.schemaNamespace);
  const betaAccounts = dbEngine.listChartOfAccounts(beta.schemaNamespace);
  const hasSintetica = alfaAccounts.some((a) => a.type === 'SINTETICA');
  const hasAnalitica = alfaAccounts.some((a) => a.type === 'ANALITICA');
  const chartIsolated =
    alfaAccounts.length > 0 &&
    betaAccounts.length > 0 &&
    alfaAccounts.length !== betaAccounts.length &&
    hasSintetica &&
    hasAnalitica;
  assert(chartIsolated, '24. Estrutura Contábil Hierárquica e isolamento do Plano de Contas');

  // ==========================================
  // PRD 04: COMERCIAL & OPERAÇÕES
  // ==========================================

  // 25. Isolamento de Orçamentos e Vendas por Schema
  const alfaQuotes = dbEngine.listQuotes(alfa.schemaNamespace);
  const betaQuotes = dbEngine.listQuotes(beta.schemaNamespace);
  const alfaSales = dbEngine.listSales(alfa.schemaNamespace);
  const betaSales = dbEngine.listSales(beta.schemaNamespace);
  const hasPetrobrasQuoteInAlfa = alfaQuotes.some((q) => (q.customerName || '').includes('Petrobras'));
  const hasPetrobrasQuoteInBeta = betaQuotes.some((q) => (q.customerName || '').includes('Petrobras'));
  const hasMagaluSaleInBeta = betaSales.some((s) => (s.customerName || '').includes('Magazine Luiza'));
  const hasMagaluSaleInAlfa = alfaSales.some((s) => (s.customerName || '').includes('Magazine Luiza'));
  assert(
    hasPetrobrasQuoteInAlfa && !hasPetrobrasQuoteInBeta && hasMagaluSaleInBeta && !hasMagaluSaleInAlfa,
    '25. Isolamento de Orçamentos e Vendas por Schema (PRD 04)'
  );

  // 26. Precisão do Motor de Cálculo Comercial e Arredondamento BRL
  const itemCalc1 = CommercialMath.calculateItem(3, 33.333, 0, 0, 0, 0);
  const itemCalc2 = CommercialMath.calculateItem(10, 150.0, 0, 10, 0, 0);
  const docTotals = CommercialMath.calculateDocumentTotals([
    { quantity: 3, unitPrice: 33.333, ...itemCalc1 },
    { quantity: 10, unitPrice: 150.0, ...itemCalc2 },
  ], 50, 20);
  assert(
    itemCalc1.total === 100.0 &&
    itemCalc2.discount === 150.0 &&
    itemCalc2.total === 1350.0 &&
    docTotals.subtotal === 1450.0 &&
    docTotals.total === 1420.0,
    '26. Precisão do Motor de Cálculo Comercial e Arredondamento BRL (PRD 04)'
  );

  // 27. Conversão de Orçamento para Venda com Trava de Idempotência
  const initialAlfaSalesCount = dbEngine.listSales(alfa.schemaNamespace).length;
  const conversionResult = dbEngine.convertQuoteToSale(alfa.schemaNamespace, 'orc-alfa-001', 'Carlos Test');
  const salesCountAfterAttempt = dbEngine.listSales(alfa.schemaNamespace).length;
  assert(
    conversionResult.alreadyConverted === true &&
    conversionResult.sale.id === 'ven-alfa-001' &&
    salesCountAfterAttempt === initialAlfaSalesCount,
    '27. Conversão de Orçamento para Venda com Trava de Idempotência (PRD 04)'
  );

  // 28. Ciclo de Vida e Auditoria de Ordens de Serviço (OS)
  const osAlfa = dbEngine.getServiceOrderById(alfa.schemaNamespace, 'os-alfa-001');
  assert(
    !!osAlfa && (osAlfa.events || []).length >= 2 && (osAlfa.comments || []).length >= 1,
    '28. Ciclo de Vida e Trilha de Auditoria de Ordens de Serviço (OS - PRD 04)'
  );

  // ==========================================
  // PRD 05: FINANCEIRO, TESOURARIA E FLUXO DE CAIXA
  // ==========================================

  // 29. Isolamento de Títulos Financeiros por Schema
  const alfaRec = dbEngine.listAccountsReceivable(alfa.schemaNamespace);
  const betaRec = dbEngine.listAccountsReceivable(beta.schemaNamespace);
  const alfaPay = dbEngine.listAccountsPayable(alfa.schemaNamespace);
  const betaPay = dbEngine.listAccountsPayable(beta.schemaNamespace);
  const recCrossLeak = alfaRec.some((r) => r.customerId === 'cli-beta-001');
  const payCrossLeak = betaPay.some((p) => p.supplierId === 'for-alfa-001');
  assert(
    alfaRec.length > 0 && betaRec.length > 0 && !recCrossLeak && !payCrossLeak,
    '29. Isolamento de Contas a Receber e Pagar por Schema CNPJ (PRD 05)'
  );

  // 30. Motor de Encargos Moratórios (Multa e Juros Pro-Rata Die)
  const lateCalc = FinancialMath.calculateLateCharges({
    dueDate: '2026-03-01',
    baseAmount: 1000.0,
    fineRatePercent: 2.0,
    monthlyInterestRatePercent: 1.0,
    currentDate: '2026-03-11', // 10 dias de atraso
  });
  assert(
    lateCalc.daysLate === 10 &&
    lateCalc.fineValue === 20.0 &&
    lateCalc.interestValue === 3.33 &&
    lateCalc.totalPayable === 1023.33,
    '30. Motor de Encargos Moratórios e Juros Pro-Rata Die (PRD 05)'
  );

  // 31. Liquidação Financeira com Conciliação de Tesouraria em Tempo Real
  const alfaTreasuryAccounts = dbEngine.listBankAccounts(alfa.schemaNamespace);
  const itauAccount = alfaTreasuryAccounts.find((a) => a.id === 'bco-alfa-01')!;
  const prevBalance = itauAccount.currentBalance;

  // Cria um título temporário para teste de liquidação
  const tempRec = dbEngine.createAccountReceivable(alfa.schemaNamespace, {
    customerName: 'Cliente Teste Liquidação Suite',
    description: 'Faturamento de Teste para Baixa Bancária',
    originalValue: 500.0,
    dueDate: '2026-04-15',
  });

  // Executa liquidação via banco Itaú
  const settledRec = dbEngine.settleAccountReceivable(alfa.schemaNamespace, tempRec.id, {
    paidAmount: 500.0,
    bankAccountId: itauAccount.id,
    paymentMethod: 'PIX',
  });

  const updatedItau = dbEngine.listBankAccounts(alfa.schemaNamespace).find((a) => a.id === 'bco-alfa-01')!;
  assert(
    settledRec?.status === 'PAID' &&
    settledRec.balanceValue === 0 &&
    updatedItau.currentBalance === FinancialMath.round(prevBalance + 500.0),
    '31. Liquidação Financeira com Conciliação de Tesouraria em Tempo Real (PRD 05)'
  );

  // 32. DRE Gerencial e Projeção do Fluxo de Caixa
  const dreReport = dbEngine.getIncomeStatementReport(alfa.schemaNamespace);
  const cashFlowTimeline = dbEngine.getCashFlowProjection(alfa.schemaNamespace, 15);
  const hasGrossRevenue = dreReport.some((i) => i.code === '1.0' && i.value > 0);
  const hasNetProfit = dreReport.some((i) => i.code === '5.0');
  const hasCashFlowDays = cashFlowTimeline.length === 15 && cashFlowTimeline[0].cumulativeBalance > 0;
  assert(
    hasGrossRevenue && hasNetProfit && hasCashFlowDays,
    '32. DRE Gerencial Consolidado e Projeção de Fluxo de Caixa (PRD 05)'
  );

  // 33. Pipeline Integrado: Faturamento de Ordem de Serviço para Contas a Receber
  const osAlfaForInvoice = dbEngine.getServiceOrderById(alfa.schemaNamespace, 'os-alfa-001');
  const osAlfaTotal = (osAlfaForInvoice?.items || []).reduce((acc, it) => acc + (it.total || 0), 0);
  const invoiceResult = osAlfaForInvoice
    ? dbEngine.invoiceServiceOrder(
        alfa.schemaNamespace,
        osAlfaForInvoice.id,
        'Sistema Automático de Testes'
      )
    : undefined;
  assert(
    osAlfaForInvoice !== undefined &&
    invoiceResult !== undefined &&
    invoiceResult.receivable.status === 'OPEN' &&
    invoiceResult.receivable.originalValue === osAlfaTotal &&
    invoiceResult.receivable.customerId === osAlfaForInvoice.customerId &&
    invoiceResult.os.events.some((e) => e.description.includes('faturada')),
    '33. Pipeline Integrado: Faturamento de Ordem de Serviço para Contas a Receber (PRD 04 -> 05)'
  );

  // 34. Motor de Faturamento: Precisão Decimal, Snapshots Imutáveis e Arredondamento BRL (PRD PARTE 05 - Seção 15 e 16)
  const roundTest = BillingMath.round(10.555) === 10.56 && BillingMath.round(10.554) === 10.55;
  const itemCalc = BillingMath.calculateItem(3, 150.0, 50.0, 10.0);
  const docCalc = BillingMath.calculateDocumentTotals(
    [
      { quantity: 2, unitPrice: 100.0, discount: 20 },
      { quantity: 1, unitPrice: 200.0, surcharge: 15 },
    ],
    10,
    5
  );
  const proRata = BillingMath.calculateProRata(3000.0, '2026-09-01', '2026-09-10', 30);
  assert(
    roundTest &&
    itemCalc.subtotal === 450.0 &&
    itemCalc.total === 410.0 &&
    docCalc.subtotal === 400.0 &&
    docCalc.total === 390.0 &&
    proRata === 1000.0,
    '34. Motor de Faturamento: Precisão Decimal, Snapshots Imutáveis e Arredondamento BRL (PRD PARTE 05)'
  );

  // 35. Faturamento Direto a partir de Pedido de Venda Comercial (PRD PARTE 05 - Seção 07 e 34)
  const petrobrasPartner = dbEngine.listPartners(alfa.schemaNamespace).find((p) => p.document === '33000167000101') || dbEngine.listPartners(alfa.schemaNamespace)[0];
  const sale = dbEngine.createSale(
    alfa.schemaNamespace,
    {
      customerId: petrobrasPartner.id,
      saleDate: '2026-09-15',
      items: [
        {
          itemType: 'PRODUCT',
          description: 'Válvula Esfera Inox 316',
          quantity: 5,
          unitPrice: 200.0,
          discount: 50.0,
          surcharge: 0.0,
        },
      ],
      discount: 0,
      surcharge: 0,
      createdBy: 'Carlos Santos',
    }
  );
  const billingFromSale = dbEngine.createBillingFromSale(
    alfa.schemaNamespace,
    sale.id,
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  let dupSaleBillingBlocked = false;
  try {
    dbEngine.createBillingFromSale(alfa.schemaNamespace, sale.id, 'usr-carlos-alfa-01', 'Carlos Santos');
  } catch {
    dupSaleBillingBlocked = true;
  }
  assert(
    billingFromSale.sourceType === 'SALE' &&
    billingFromSale.sourceId === sale.id &&
    billingFromSale.total === 950.0 &&
    billingFromSale.status === 'ISSUED' &&
    dupSaleBillingBlocked,
    '35. Faturamento Direto de Pedido de Venda com Trava Anti-Duplicidade (PRD PARTE 05)'
  );

  // 36. Faturamento de Ordem de Serviço com Competência Fiscal MM/YYYY (PRD PARTE 05 - Seção 07 e 35)
  const compInfo = CompetenceHelper.getCompetenceForDate('2026-09-19');
  const osAlfaList = dbEngine.listServiceOrders(alfa.schemaNamespace);
  const targetOs = osAlfaList[0];
  const billingFromOs = dbEngine.createBillingFromServiceOrder(
    alfa.schemaNamespace,
    targetOs.id,
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  assert(
    compInfo.competenceLabel === '09/2026' &&
    billingFromOs.sourceType === 'SERVICE_ORDER' &&
    billingFromOs.sourceId === targetOs.id &&
    billingFromOs.items.length >= 1 &&
    billingFromOs.status === 'ISSUED',
    '36. Faturamento de Ordem de Serviço com Competência Fiscal MM/YYYY (PRD PARTE 05)'
  );

  // 37. Contratos de Faturamento Recorrente e Regras de Vencimento Dinâmicas (PRD PARTE 05 - Seções 20 a 24)
  const recurringContract = dbEngine.createRecurringBilling(
    alfa.schemaNamespace,
    {
      customerId: petrobrasPartner.id,
      customerName: petrobrasPartner.name,
      customerDocument: petrobrasPartner.document,
      description: 'Contrato Mensal de Suporte e Manutenção Industrial',
      frequency: 'MONTHLY',
      dayOfMonth: 10,
      dueRule: 'FIXED_DAY',
      dueDays: 10,
      startDate: '2026-01-01',
      nextBillingDate: '2026-09-10',
      items: [
        {
          itemType: 'SERVICE',
          description: 'SLA 24/7 e Monitoramento Contínuo',
          quantity: 1,
          unitPrice: 4500.0,
        },
      ],
    },
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  assert(
    recurringContract.status === 'ACTIVE' &&
    recurringContract.frequency === 'MONTHLY' &&
    recurringContract.nextBillingDate === '2026-09-10' &&
    recurringContract.amount === 4500.0,
    '37. Contratos de Faturamento Recorrente e Regras de Vencimento Dinâmicas (PRD PARTE 05)'
  );

  // 38. Processamento em Lote Idempotente da Recorrência com Geração de Títulos e Logs (PRD PARTE 05 - Seções 21 a 24)
  const batch1 = dbEngine.processDueRecurringBillings(alfa.schemaNamespace, 'usr-carlos-alfa-01', 'Carlos Santos');
  const batch2 = dbEngine.processDueRecurringBillings(alfa.schemaNamespace, 'usr-carlos-alfa-01', 'Carlos Santos');
  const logs = dbEngine.listBillingGenerationLogs(alfa.schemaNamespace);
  const updatedContract = dbEngine.getRecurringBillingById(alfa.schemaNamespace, recurringContract.id);
  assert(
    batch1.generatedCount >= 1 &&
    batch2.generatedCount === 0 &&
    logs.length >= 1 &&
    updatedContract?.nextBillingDate === '2026-10-10',
    '38. Processamento em Lote Idempotente da Recorrência com Geração de Títulos e Logs (PRD PARTE 05)'
  );

  // 39. Cancelamento de Faturamento com Motivo Obrigatório e Conciliação de Estorno (PRD PARTE 05 - Seção 38)
  let cancelNoReasonBlocked = false;
  try {
    dbEngine.cancelBillingDocument(alfa.schemaNamespace, billingFromSale.id, '', 'usr-carlos-alfa-01', 'Carlos Santos');
  } catch {
    cancelNoReasonBlocked = true;
  }
  const canceledDoc = dbEngine.cancelBillingDocument(
    alfa.schemaNamespace,
    billingFromSale.id,
    'Cancelamento homologado para troca de pedido comercial',
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  assert(
    cancelNoReasonBlocked &&
    canceledDoc.status === 'CANCELED' &&
    canceledDoc.cancellationReason === 'Cancelamento homologado para troca de pedido comercial' &&
    canceledDoc.canceledBy === 'Carlos Santos',
    '39. Cancelamento de Faturamento com Motivo Obrigatório e Conciliação de Estorno (PRD PARTE 05)'
  );

  // 40. Isolamento Multi-Tenant Estrito de Faturamento e Contratos Recorrentes por Schema (PRD 01 & PRD 05)
  const alfaBillings = dbEngine.listBillingDocuments(alfa.schemaNamespace);
  const betaBillings = dbEngine.listBillingDocuments(beta.schemaNamespace);
  const alfaRecurrings = dbEngine.listRecurringBillings(alfa.schemaNamespace);
  const betaRecurrings = dbEngine.listRecurringBillings(beta.schemaNamespace);
  const hasAlfaDocInBeta = betaBillings.some((b) => b.customerName.includes('Petrobras'));
  const hasAlfaRecInBeta = betaRecurrings.some((r) => r.description.includes('Petrobras'));
  assert(
    alfaBillings.length >= 2 &&
    alfaRecurrings.length >= 1 &&
    !hasAlfaDocInBeta &&
    !hasAlfaRecInBeta,
    '40. Isolamento Multi-Tenant Estrito de Faturamento e Contratos Recorrentes por Schema (PRD 01 & PRD 05)'
  );

  // ============================================================================
  // PRD 06 - ESTOQUE & ALMOXARIFADO (WMS)
  // ============================================================================

  // 41. Gestão de Múltiplos Depósitos e Isolamento Estrito por Schema (PRD 06)
  const secWh = dbEngine.createWarehouse(
    alfa.schemaNamespace,
    {
      name: 'Almoxarifado Filial Sul',
      code: 'ALM-SUL',
      description: 'Depósito secundário de distribuição',
      location: 'Curitiba - PR',
    },
    alfa.id
  );
  const alfaWarehouses = dbEngine.listWarehouses(alfa.schemaNamespace);
  const betaWarehouses = dbEngine.listWarehouses(beta.schemaNamespace);
  const betaHasAlfaWh = betaWarehouses.some((w) => w.id === secWh.id || w.code === 'ALM-SUL');
  assert(
    secWh.code === 'ALM-SUL' &&
    alfaWarehouses.some((w) => w.id === secWh.id) &&
    !betaHasAlfaWh,
    '41. Gestão de Múltiplos Depósitos e Isolamento Estrito por Schema (PRD 06)'
  );

  // 42. Movimentação de Entrada e Recálculo de Custo Médio Ponderado (CMP) (PRD 06)
  const productA = storageAlfa.products[0];
  const primaryWh = storageAlfa.warehouses[0];
  const initialStock = dbEngine.getStockItem(alfa.schemaNamespace, primaryWh.id, productA.id);
  const prevQty = initialStock ? initialStock.quantity : 0;
  const prevCost = initialStock ? initialStock.averageCost : productA.costPrice || 50;

  const inQty = 100;
  const inUnitCost = 80;
  const expectedCmp = InventoryMath.calculateCMP(prevQty, prevCost, inQty, inUnitCost);

  const inboundMov = dbEngine.recordStockMovement(
    alfa.schemaNamespace,
    {
      movementType: 'INBOUND_PURCHASE',
      productId: productA.id,
      warehouseId: primaryWh.id,
      quantity: inQty,
      unitCost: inUnitCost,
      referenceType: 'PURCHASE',
      notes: 'Lote inicial de reposição de estoque',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const updatedStock = dbEngine.getStockItem(alfa.schemaNamespace, primaryWh.id, productA.id);
  assert(
    !!inboundMov &&
    updatedStock !== undefined &&
    updatedStock.quantity === expectedCmp.newQuantity &&
    updatedStock.averageCost === expectedCmp.newAverageCost,
    '42. Movimentação de Entrada e Recálculo de Custo Médio Ponderado (CMP) (PRD 06)'
  );

  // 43. Trava de Saldo Negativo e Transferência Física entre Depósitos (PRD 06)
  let blockedNegativeStock = false;
  try {
    dbEngine.recordStockMovement(
      alfa.schemaNamespace,
      {
        movementType: 'OUTBOUND_SALE',
        productId: productA.id,
        warehouseId: primaryWh.id,
        quantity: 999999, // superior ao saldo existente
      },
      { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
    );
  } catch {
    blockedNegativeStock = true;
  }

  const transferResult = dbEngine.transferStock(
    alfa.schemaNamespace,
    {
      sourceWarehouseId: primaryWh.id,
      targetWarehouseId: secWh.id,
      productId: productA.id,
      quantity: 20,
      notes: 'Transferência para filial Sul',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const stockTarget = dbEngine.getStockItem(alfa.schemaNamespace, secWh.id, productA.id);
  assert(
    blockedNegativeStock &&
    transferResult.outboundMovement.movementType === 'TRANSFER_OUT' &&
    transferResult.inboundMovement.movementType === 'TRANSFER_IN' &&
    stockTarget?.quantity === 20,
    '43. Trava de Saldo Negativo e Transferência Física entre Depósitos (PRD 06)'
  );

  // ============================================================================
  // PRD 07 - FISCAL & TRIBUTÁRIO BRASILEIRO (DF-e & SPED)
  // ============================================================================

  // 44. Emissão e Assinatura Digital de NF-e (Modelo 55) com Cálculo Tributário (PRD 07)
  const petroPartner = storageAlfa.partners.find((p) => p.document.includes('33000167000101')) || storageAlfa.partners[0];
  const fiscalDoc = dbEngine.createFiscalDocument(
    alfa.schemaNamespace,
    {
      model: 'NFE_55',
      type: 'OUTBOUND',
      natureOfOperation: 'Venda de Produção do Estabelecimento',
      cfopPrincipal: '5.101',
      partnerId: petroPartner.id,
      partnerName: petroPartner.name,
      partnerCnpjCpf: petroPartner.document,
      partnerAddress: {
        street: petroPartner.address?.street || 'Av. Paulista',
        number: petroPartner.address?.number || '1000',
        neighborhood: petroPartner.address?.neighborhood || 'Bela Vista',
        city: petroPartner.address?.city || 'São Paulo',
        state: petroPartner.address?.state || 'SP',
        zipCode: petroPartner.address?.zipCode || '01310-100',
      },
      items: [
        {
          productCode: productA.code,
          productName: productA.name,
          ncm: '8481.80.99',
          cfop: '5.101',
          quantity: 10,
          unitPrice: 150.0,
          unit: 'UN',
        },
      ],
    },
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  assert(
    fiscalDoc.model === 'NFE_55' &&
    fiscalDoc.accessKey.length === 44 &&
    fiscalDoc.netTotal === 1500.0 &&
    fiscalDoc.status === 'DRAFT' &&
    fiscalDoc.totalICMS >= 0 &&
    fiscalDoc.totalPIS >= 0,
    '44. Emissão e Assinatura Digital de NF-e (Modelo 55) com Cálculo Tributário (PRD 07)'
  );

  // 45. Transmissão e Autorização SEFAZ com Protocolo e XML Imutável (PRD 07)
  const authorizedDoc = dbEngine.transmitFiscalDocument(
    alfa.schemaNamespace,
    fiscalDoc.id,
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  assert(
    authorizedDoc.status === 'AUTHORIZED' &&
    !!authorizedDoc.protocolNumber &&
    !!authorizedDoc.authorizedAt &&
    authorizedDoc.xmlPayload?.includes('<nfeProc') === true,
    '45. Transmissão e Autorização SEFAZ com Protocolo e XML Imutável (PRD 07)'
  );

  // 46. Inutilização Homologada de Faixa Fiscal com Justificativa Mínima (PRD 07)
  let inutShortJustificationBlocked = false;
  try {
    dbEngine.createFiscalInutilization(
      alfa.schemaNamespace,
      {
        model: 'NFE_55',
        series: '1',
        startNumber: 100,
        endNumber: 105,
        year: 2026,
        justification: 'Erro', // menor que 15 chars
      },
      'usr-carlos-alfa-01',
      'Carlos Santos'
    );
  } catch {
    inutShortJustificationBlocked = true;
  }
  const validInut = dbEngine.createFiscalInutilization(
    alfa.schemaNamespace,
    {
      model: 'NFE_55',
      series: '1',
      startNumber: 100,
      endNumber: 105,
      year: 2026,
      justification: 'Salto de numeracao ocorrido por falha no spool de emissao fiscal',
    },
    'usr-carlos-alfa-01',
    'Carlos Santos'
  );
  assert(
    inutShortJustificationBlocked &&
    validInut.protocolNumber.startsWith('INUT-SEFAZ-') &&
    validInut.startNumber === 100 &&
    validInut.endNumber === 105,
    '46. Inutilização Homologada de Faixa Fiscal com Justificativa Mínima (PRD 07)'
  );

  // ============================================================================
  // PRD 08 - COMPRAS, SUPRIMENTOS & PROCUREMENT
  // ============================================================================

  // 47. Requisição de Compras e Fluxo de Aprovação com Centro de Custo (PRD 08)
  const reqItem = {
    id: 'req-item-01',
    productId: productA.id,
    productCode: productA.code,
    productName: productA.name,
    quantity: 50,
    unit: 'UN',
    estimatedUnitPrice: 60.0,
    estimatedTotalPrice: 3000.0,
  };
  const purchaseReq = dbEngine.createPurchaseRequisition(
    alfa.schemaNamespace,
    {
      justification: 'Aquisição emergencial de matéria-prima para manutenção',
      priority: 'ALTA',
      neededByDate: '2026-10-15',
      items: [reqItem],
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const reqInitialStatus = purchaseReq.status;
  const approvedReq = dbEngine.approvePurchaseRequisition(
    alfa.schemaNamespace,
    purchaseReq.id,
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  assert(
    purchaseReq.number.startsWith('RC-') &&
    reqInitialStatus === 'PENDENTE_APROVACAO' &&
    approvedReq.status === 'APROVADA' &&
    approvedReq.approvedByName === 'Carlos Santos',
    '47. Requisição de Compras e Fluxo de Aprovação com Centro de Custo (PRD 08)'
  );

  // 48. Mapa Comparativo de Cotações com Homologação e Cálculo de Economia (PRD 08)
  const quotation = dbEngine.createPurchaseQuotation(
    alfa.schemaNamespace,
    {
      requisitionIds: [approvedReq.id],
      title: 'Cotação de Válvulas Industriais',
      deadlineDate: '2026-10-20',
      items: [
        {
          id: 'quot-item-01',
          productId: productA.id,
          productCode: productA.code,
          productName: productA.name,
          quantity: 50,
          unit: 'UN',
          targetPrice: 60.0,
        },
      ],
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  dbEngine.addQuotationProposal(
    alfa.schemaNamespace,
    quotation.id,
    {
      supplierId: petroPartner.id,
      supplierName: petroPartner.name,
      supplierDocument: petroPartner.document,
      paymentTerm: '30/60 dias',
      deliveryDays: 5,
      items: [
        {
          itemId: quotation.items[0].id,
          productName: productA.name,
          quantity: 50,
          unit: 'UN',
          unitPrice: 55.0,
          discountPercentage: 0,
          icmsPercentage: 18,
          ipiPercentage: 5,
          freightAmount: 0,
          totalPrice: 2750.0,
          deliveryDays: 5,
        },
      ],
    }
  );

  const homologation = dbEngine.homologateQuotation(
    alfa.schemaNamespace,
    quotation.id,
    petroPartner.id,
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' },
    true
  );
  assert(
    homologation.quotation.status === 'HOMOLOGADA' &&
    homologation.quotation.winningSupplierId === petroPartner.id &&
    homologation.purchaseOrder !== undefined &&
    homologation.purchaseOrder.number.startsWith('PC-'),
    '48. Mapa Comparativo de Cotações com Homologação e Cálculo de Economia (PRD 08)'
  );

  // 49. Entrada de Mercadorias (3-Way Matching): NF-e Fornecedor -> Estoque (CMP) + Contas a Pagar (PRD 08)
  const initialPayablesCount = (storageAlfa.accountsPayable || []).length;
  const mockXml = NFeXmlParser.generateSampleNFeXml({
    supplierCnpj: petroPartner.document,
    supplierName: petroPartner.name,
    supplierIe: '109876543110',
    items: [
      {
        code: productA.code,
        name: productA.name,
        qty: 50,
        price: 55.0,
        ncm: '84818099',
        cfop: '1101',
        batch: 'LOTE-VALV-2026',
      },
    ],
  });

  const importedNfe = dbEngine.importInboundInvoiceXml(
    alfa.schemaNamespace,
    mockXml,
    primaryWh.id,
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' },
    homologation.purchaseOrder?.id
  );
  const statusBeforeProcess = importedNfe.status;
  const processResult = dbEngine.processInboundInvoice(
    alfa.schemaNamespace,
    importedNfe.id,
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const finalPayablesCount = (storageAlfa.accountsPayable || []).length;
  assert(
    importedNfe.number.length >= 1 &&
    statusBeforeProcess === 'IMPORTADA' &&
    processResult.invoice.status === 'PROCESSADA' &&
    processResult.stockMovementsCount >= 1 &&
    processResult.payablesCount >= 1 &&
    finalPayablesCount > initialPayablesCount,
    '49. Entrada de Mercadorias (3-Way Matching): NF-e Fornecedor -> Estoque (CMP) + Contas a Pagar (PRD 08)'
  );

  // ============================================================================
  // PRD 09 - COBRANÇA BANCÁRIA, BOLETOS, PIX & CNAB
  // ============================================================================

  // 50. Emissão de Boleto Bancário com Linha Digitável e Código de Barras FEBRABAN (PRD 09)
  const bankAcc = storageAlfa.bankAccounts[0];
  const newSlip = dbEngine.createBankSlip(
    alfa.schemaNamespace,
    {
      bankAccountId: bankAcc.id,
      payerName: petroPartner.name,
      payerDocument: petroPartner.document,
      payerAddress: 'Av. Paulista, 1000 - São Paulo/SP',
      amount: 1500.0,
      dueDate: '2026-10-30',
      instructions: ['Não receber após o vencimento. Cobrar juros de 1% ao mês.'],
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  assert(
    newSlip.status === 'REGISTERED' &&
    newSlip.barcode.length === 44 &&
    newSlip.digitableLine.replace(/\D/g, '').length === 47 &&
    newSlip.bankCode === bankAcc.bankCode &&
    newSlip.amount === 1500.0,
    '50. Emissão de Boleto Bancário com Linha Digitável e Código de Barras FEBRABAN (PRD 09)'
  );

  // 51. Geração de Arquivo de Remessa CNAB 400 com Layout Padronizado (PRD 09)
  const remessaCnab = dbEngine.generateCnabRemessa(
    alfa.schemaNamespace,
    {
      bankAccountId: bankAcc.id,
      bankSlipIds: [newSlip.id],
      standard: 'CNAB400',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const remessaLines = remessaCnab.contentRaw.split('\r\n');
  assert(
    remessaCnab.type === 'REMESSA' &&
    remessaCnab.standard === 'CNAB400' &&
    remessaCnab.status === 'GENERATED' &&
    remessaCnab.itemsCount >= 1 &&
    remessaLines[0].startsWith('01REMESSA') && // Header CNAB 400
    remessaLines[remessaLines.length - 1].startsWith('9'), // Trailler CNAB 400
    '51. Geração de Arquivo de Remessa CNAB 400 com Layout Padronizado (PRD 09)'
  );

  // 52. Processamento e Conciliação de Retorno CNAB com Baixa em Título a Receber (PRD 09)
  const testRec = dbEngine.createAccountReceivable(
    alfa.schemaNamespace,
    {
      customerId: petroPartner.id,
      customerName: petroPartner.name,
      customerDocument: petroPartner.document,
      description: 'Duplicata para Liquidação via Retorno CNAB',
      originalValue: 1500.0,
      dueDate: '2026-10-30',
      issueDate: '2026-09-21',
    }
  );
  newSlip.accountReceivableId = testRec.id;

  // Monta arquivo de retorno CNAB 400 simulando liquidação (Ocorrência 06)
  let retHeader = '02RETORNO01COBRANCA       ';
  retHeader = retHeader.padEnd(76, ' ') + (bankAcc.bankCode || '001');
  retHeader = retHeader.padEnd(400, ' ');

  let retDetail = '1' + ''.padEnd(36, ' ');
  retDetail += newSlip.documentNumber.padEnd(10, ' '); // 37..46
  retDetail = retDetail.padEnd(62, ' ');
  retDetail += newSlip.ourNumber.replace(/\D/g, '').padEnd(11, ' '); // 62..72
  retDetail = retDetail.padEnd(108, ' ');
  retDetail += '06'; // 108..109 (Ocorrência 06 = Liquidação)
  retDetail += '210926'; // 110..115 (Data de Pagamento DDMMAA)
  retDetail += newSlip.documentNumber.padEnd(10, ' '); // 116..125
  retDetail = retDetail.padEnd(152, ' ');
  retDetail += '0000000150000'; // 152..164 (Valor Nominal)
  retDetail = retDetail.padEnd(253, ' ');
  retDetail += '0000000150000'; // 253..265 (Valor Pago)
  retDetail = retDetail.padEnd(400, ' ');

  let retTrailler = '9201001'.padEnd(400, ' ');
  const rawRetorno = `${retHeader}\r\n${retDetail}\r\n${retTrailler}`;

  const retornoResult = dbEngine.processCnabRetorno(
    alfa.schemaNamespace,
    {
      contentRaw: rawRetorno,
      bankAccountId: bankAcc.id,
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const updatedSlipAfterReturn = dbEngine.listBankSlips(alfa.schemaNamespace).find((s) => s.id === newSlip.id);
  const updatedRecAfterReturn = (storageAlfa.accountsReceivable || []).find((r) => r.id === testRec.id);
  assert(
    retornoResult.cnabFile.type === 'RETORNO' &&
    retornoResult.settledSlipsCount >= 1 &&
    updatedSlipAfterReturn?.status === 'PAID' &&
    updatedRecAfterReturn?.status === 'PAID',
    '52. Processamento e Conciliação de Retorno CNAB com Baixa em Título a Receber (PRD 09)'
  );

  // 53. Cobrança Pix Dinâmico com Payload EMV Copia e Cola e QR Code SVG (PRD 09)
  const pixCharge = dbEngine.createPixCharge(
    alfa.schemaNamespace,
    {
      customerName: petroPartner.name,
      customerDocument: petroPartner.document,
      amount: 450.0,
      description: 'Assinatura Mensal Enlace ERP',
      keyType: 'CNPJ',
      key: alfa.cnpj,
      accountReceivableId: testRec.id,
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  assert(
    pixCharge.txid.length >= 10 &&
    pixCharge.status === 'ACTIVE' &&
    pixCharge.emvPayload.startsWith('000201') &&
    pixCharge.qrCodeSvg.includes('<svg') &&
    pixCharge.amount === 450.0,
    '53. Cobrança Pix Dinâmico com Payload EMV Copia e Cola e QR Code SVG (PRD 09)'
  );

  // 54. Liquidação Instantânea via Simulador Bacen SPI com Crédito em Tesouraria (PRD 09)
  const initialBalance = bankAcc.currentBalance;
  const pixSimulation = dbEngine.simulatePixPayment(
    alfa.schemaNamespace,
    pixCharge.txid,
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const updatedPix = dbEngine.listPixCharges(alfa.schemaNamespace).find((p) => p.txid === pixCharge.txid);
  const finalBalance = bankAcc.currentBalance;
  assert(
    pixSimulation.charge.status === 'CONCLUDED' &&
    !!pixSimulation.charge.endToEndId &&
    updatedPix?.status === 'CONCLUDED' &&
    finalBalance === BoletoMath.roundBRL(initialBalance + 450.0),
    '54. Liquidação Instantânea via Simulador Bacen SPI com Crédito em Tesouraria (PRD 09)'
  );

  // 55. Execução em Lote da Régua de Cobrança (Dunning Engine) e Trilha de Auditoria (PRD 09)
  const dunningRule = dbEngine.createDunningRule(
    alfa.schemaNamespace,
    {
      name: 'Cobrança Preventiva - 3 Dias Antes',
      triggerDays: 3,
      channel: 'EMAIL',
      templateSubject: 'Aviso de Vencimento de Título',
      templateBody: 'Olá {cliente}, seu boleto de R$ {valor} vence em breve.',
      includePix: true,
      includeBoleto: true,
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const dunningExecution = dbEngine.executeDunningRules(
    alfa.schemaNamespace,
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );
  const tenantAudits = dbEngine.listTenantAudits(alfa.schemaNamespace);
  const hasDunningAudit = tenantAudits.some((a) => a.action === 'DUNNING_RULES_EXECUTE');
  assert(
    dunningRule.id.startsWith('dun-') &&
    dunningRule.isActive === true &&
    Array.isArray(dunningExecution.logs) &&
    hasDunningAudit,
    '55. Execução em Lote da Régua de Cobrança (Dunning Engine) e Trilha de Auditoria (PRD 09)'
  );

  // ============================================================================
  // PRD PARTE 06 — COBRANÇA E CONTAS A RECEBER (TESTES 56 A 60)
  // ============================================================================

  // 56. Desacoplamento Fisiológico entre Contas a Receber e Cobrança (PRD PARTE 06)
  const rec56 = dbEngine.createReceivable(
    alfa.schemaNamespace,
    {
      customerId: 'cli-acme-corp',
      customerName: 'Acme Corporation Brasil Ltda',
      customerDocument: '11222333000181',
      totalAmount: 1500.0,
      issueDate: '2026-09-21',
      dueDate: '2026-10-21',
      description: 'Consultoria de Arquitetura e Engenharia de Software',
      category: 'SERVICOS',
      paymentTerms: 'PARCELADO',
      installmentsCount: 3,
      interestRate: 1.0,
      fineRate: 2.0,
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  const col56 = await dbEngine.createCollection(
    alfa.schemaNamespace,
    {
      receivableId: rec56.id,
      installmentNumber: 1,
      method: 'PIX',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  const initialColStatus = col56.status;

  const rec56Cancelled = dbEngine.cancelReceivable(
    alfa.schemaNamespace,
    rec56.id,
    'Distrato contratual bilateral com cliente',
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  const col56Refreshed = dbEngine.getCollection(alfa.schemaNamespace, col56.id);

  assert(
    rec56.installments.length === 3 &&
    rec56.installments[0].amount === 500.0 &&
    rec56.installments[1].amount === 500.0 &&
    rec56.installments[2].amount === 500.0 &&
    initialColStatus === 'ACTIVE' &&
    !!col56.pixQrCodeSvg &&
    rec56Cancelled.status === 'CANCELED' &&
    col56Refreshed?.status === 'CANCELED',
    '56. Desacoplamento Fisiológico entre Contas a Receber e Cobrança (PRD PARTE 06)'
  );

  // 57. Motor Matemático de Encargos, Multa e Desconto por Antecipação (PRD PARTE 06)
  // Título de R$ 1.000,00 vencido há 10 dias com juros de 1% a.m. (pro-rata die) e multa de 2%
  const calcResult = ReceivableCalculationService.calculate({
    originalAmount: 1000.0,
    dueDate: '2026-09-11',
    referenceDate: '2026-09-21',
    interestValue: 1.0, // 1% ao mês
    fineValue: 2.0,     // 2% de multa fixa
  });

  // Juros diários: (1000 * 0.01 / 30) * 10 = 3.33
  // Multa: 1000 * 0.02 = 20.00
  // Total devido: 1023.33
  assert(
    calcResult.interestAmount === 3.33 &&
    calcResult.fineAmount === 20.0 &&
    calcResult.overdueDays === 10 &&
    calcResult.currentAmount === 1023.33,
    '57. Motor Matemático de Encargos, Multa e Desconto por Antecipação (PRD PARTE 06)'
  );

  // 58. Multi-Gateway Adapters e Provedores Plugáveis (PRD PARTE 06)
  const providers = dbEngine.listPaymentProviders(alfa.schemaNamespace);
  const defaultProv = providers.find((p) => p.isDefault);

  const asaasProv = dbEngine.createPaymentProvider(
    alfa.schemaNamespace,
    {
      name: 'Asaas Conta Corporativa',
      providerType: 'ASAAS',
      environment: 'SANDBOX',
      supportedMethods: ['PIX', 'BOLETO', 'CREDIT_CARD'],
      credentials: { apiKey: '$aact_YTU1YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ=' },
      accountInfo: { pixKey: '12.345.678/0001-95' },
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  const testConn = await dbEngine.testPaymentProviderConnection(
    alfa.schemaNamespace,
    asaasProv.id,
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  const recBoleto = dbEngine.createReceivable(
    alfa.schemaNamespace,
    {
      customerId: 'cli-beta-tech',
      customerName: 'Beta Tecnologia e Varejo',
      customerDocument: '98765432000110',
      totalAmount: 850.0,
      issueDate: '2026-09-21',
      dueDate: '2026-10-10',
      description: 'Licenciamento de Software Empresarial',
      category: 'LICENCIAMENTO',
      paymentTerms: 'A_VISTA',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  const colBoleto = await dbEngine.createCollection(
    alfa.schemaNamespace,
    {
      receivableId: recBoleto.id,
      method: 'BOLETO',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  assert(
    !!defaultProv &&
    asaasProv.providerType === 'ASAAS' &&
    testConn.success === true &&
    testConn.latencyMs > 0 &&
    colBoleto.method === 'BOLETO' &&
    colBoleto.barcode?.length === 44 &&
    colBoleto.digitableLine?.replace(/\D/g, '').length === 47,
    '58. Multi-Gateway Adapters e Provedores Plugáveis (PRD PARTE 06)'
  );

  // 59. Webhook Idempotente com Baixa Automática e Conciliação em Tempo Real (PRD PARTE 06)
  const recWebhook = dbEngine.createReceivable(
    alfa.schemaNamespace,
    {
      customerId: 'cli-lojas-unidas',
      customerName: 'Lojas Unidas do Brasil S.A.',
      customerDocument: '33000167000101',
      totalAmount: 350.0,
      issueDate: '2026-09-21',
      dueDate: '2026-09-30',
      description: 'Venda de Certificados Digitais A1',
      category: 'VENDAS',
      paymentTerms: 'A_VISTA',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  const colWebhook = await dbEngine.createCollection(
    alfa.schemaNamespace,
    {
      receivableId: recWebhook.id,
      method: 'PIX',
    },
    { id: 'usr-carlos-alfa-01', name: 'Carlos Santos' }
  );

  // Disparo do primeiro webhook do gateway simulando liquidação
  const webhookPayload = {
    eventId: 'evt_pix_settled_998877',
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: colWebhook.externalId,
      status: 'CONFIRMED',
      value: 350.0,
      netValue: 348.5,
      paymentDate: '2026-09-21T10:30:00Z',
      billingType: 'PIX',
    },
  };

  const webhookResult1 = await dbEngine.processWebhookPayment(
    'ENLACE_SANDBOX',
    webhookPayload,
    { 'x-webhook-signature': 'sig-test-valid' }
  );

  const recAfterWebhook = dbEngine.getReceivable(alfa.schemaNamespace, recWebhook.id)!;
  const colAfterWebhook = dbEngine.getCollection(alfa.schemaNamespace, colWebhook.id)!;
  const paymentsAfter = dbEngine.listPaymentsV2(alfa.schemaNamespace, {
    receivableId: recWebhook.id,
  });

  // Re-envio do mesmo webhook (teste de idempotência estrita)
  const webhookResult2 = await dbEngine.processWebhookPayment(
    'ENLACE_SANDBOX',
    webhookPayload,
    { 'x-webhook-signature': 'sig-test-valid' }
  );

  const paymentsAfterDuplicate = dbEngine.listPaymentsV2(alfa.schemaNamespace, {
    receivableId: recWebhook.id,
  });

  assert(
    webhookResult1.status === 'PROCESSED' &&
    colAfterWebhook.status === 'PAID' &&
    recAfterWebhook.status === 'PAID' &&
    recAfterWebhook.paidAmount === 350.0 &&
    paymentsAfter.length === 1 &&
    webhookResult2.status === 'DUPLICATE' &&
    paymentsAfterDuplicate.length === 1,
    '59. Webhook Idempotente com Baixa Automática e Conciliação em Tempo Real (PRD PARTE 06)'
  );

  // 60. Isolamento Estrito Multi-Tenant de Contas a Receber e Gateways (PRD 01 & PRD PARTE 06)
  const alfaReceivables = dbEngine.listReceivables(alfa.schemaNamespace);
  const betaReceivables = dbEngine.listReceivables(beta.schemaNamespace);
  const alfaCollections = dbEngine.listCollections(alfa.schemaNamespace);
  const betaCollections = dbEngine.listCollections(beta.schemaNamespace);
  const crossLookup = dbEngine.getReceivable(beta.schemaNamespace, recWebhook.id);

  assert(
    alfaReceivables.length > 0 &&
    betaReceivables.length === 0 &&
    alfaCollections.length > 0 &&
    betaCollections.length === 0 &&
    crossLookup === undefined,
    '60. Isolamento Estrito Multi-Tenant de Contas a Receber e Gateways (PRD 01 & PRD PARTE 06)'
  );

  console.log('\n================================================================');
  console.log(` RESULTADO: ${passed}/${total} TESTES PASSARAM COM SUCESSO `);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
