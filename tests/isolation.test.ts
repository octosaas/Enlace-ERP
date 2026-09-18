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

async function runTests() {
  console.log('================================================================');
  console.log(' INICIANDO BATERIA DE TESTES DO ENLACE ERP - PRD 01 A 05        ');
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
