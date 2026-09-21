/**
 * Enlace ERP - Tipos e Contratos Compartilhados (Shared Types)
 * PRD 01 - Fundação, Arquitetura e Isolamento por CNPJ
 */

export type SegmentType =
  | 'comercio'
  | 'servicos'
  | 'restaurante'
  | 'construcao'
  | 'manutencao'
  | 'tecnologia'
  | 'telecom'
  | 'profissional_liberal'
  | 'outro';

export type UserRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer';

export type UserStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  status: UserStatus;
  isPlatformAdmin?: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: string;
  failedLoginAttempts: number;
  lockoutUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  cnpj: string; // Ex: '12.345.678/0001-95'
  cleanCnpj: string; // Ex: '12345678000195'
  legalName: string; // Razão Social
  tradeName: string; // Nome Fantasia
  segment: SegmentType;
  schemaNamespace: string; // Ex: 'tenant_12345678000195'
  status: 'active' | 'suspended' | 'provisioning';
  createdAt: string;
  updatedAt: string;
}

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface Membership {
  id: string;
  userId: string;
  companyId: string;
  role: UserRole;
  permissions: string[];
  status: MembershipStatus;
  isActive: boolean;
  invitedAt?: string;
  acceptedAt?: string;
  revokedAt?: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  userId: string;
  activeCompanyId?: string;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
  isCurrent?: boolean;
  isRevoked: boolean;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
}

export interface RefreshToken {
  id: string;
  sessionId: string;
  userId: string;
  tokenHash: string;
  isRevoked: boolean;
  isUsed: boolean;
  replacedByTokenHash?: string;
  createdAt: string;
  expiresAt: string;
}

export interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  role: UserRole;
  invitedByUserId: string;
  invitedByName: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
}

export type SecurityEventSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SecurityEventType =
  | 'SECURITY_LOGIN_FAILURE'
  | 'SECURITY_BRUTE_FORCE'
  | 'SECURITY_INVALID_TOKEN'
  | 'SECURITY_PERMISSION_DENIED'
  | 'SECURITY_SUSPICIOUS_SESSION'
  | 'SECURITY_CROSS_INSTANCE_ATTEMPT'
  | 'SECURITY_MFA_FAILED'
  | 'SECURITY_TOKEN_REUSE_DETECTED'
  | 'SECURITY_ACCOUNT_LOCKED';

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  userId?: string;
  userEmail?: string;
  companyId?: string;
  schemaNamespace?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  details: Record<string, unknown>;
  mitigationTaken: string;
}

export interface MFASetupResponse {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export interface ModuleDefinition {
  id: string;
  name: string;
  code: string;
  description: string;
  isCore: boolean;
  iconName: string;
}

export interface CompanyModuleStatus {
  moduleId: string;
  companyId: string;
  isEnabled: boolean;
  activatedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string | null;
  userEmail: string | null;
  companyId: string | null;
  companyCnpj: string | null;
  schemaNamespace?: string;
  action: string;
  resource: string;
  resourceId?: string;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  ipAddress?: string;
  userAgent?: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export interface TenantContext {
  requestId: string;
  correlationId: string;
  user?: User;
  activeCompany?: Company;
  membership?: Membership;
  schemaNamespace?: string;
  sessionId?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    schemaNamespace?: string;
  };
}

export interface SecurityTestResult {
  id: string;
  title: string;
  description: string;
  category: 'ISOLATION' | 'IDOR' | 'RBAC' | 'AUTH' | 'INTEGRITY' | 'BRUTE_FORCE' | 'SESSION';
  passed: boolean;
  statusCode: number;
  expectedStatus: number;
  responseMessage: string;
  testedAt: string;
  details: string;
}

// ==========================================
// PRD 03 - CADASTROS CENTRAIS & ESTRUTURA FINANCEIRA
// ==========================================

export type PersonType = 'PF' | 'PJ' | 'ESTRANGEIRO';
export type BusinessPartnerRole =
  | 'CLIENTE'
  | 'FORNECEDOR'
  | 'TRANSPORTADORA'
  | 'COLABORADOR'
  | 'PARCEIRO'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'CARRIER'
  | 'EMPLOYEE'
  | 'PARTNER';
export type PartnerStatus = 'ATIVO' | 'INATIVO' | 'BLOQUEADO';

export interface Address {
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  ibgeCode?: string;
}

export interface BusinessPartner {
  id: string;
  personType: PersonType;
  document: string; // apenas dígitos (ex: 12345678000195 ou 12345678901)
  formattedDocument: string;
  roles: BusinessPartnerRole[];
  name: string; // Razão Social ou Nome Completo
  tradeName?: string; // Nome Fantasia
  stateRegistration?: string; // Inscrição Estadual
  municipalRegistration?: string; // Inscrição Municipal
  email: string;
  phone: string;
  address: Address;
  creditLimit: number;
  paymentTermsDays: number;
  status: PartnerStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AccountCategory = 'ATIVO' | 'PASSIVO' | 'PATRIMONIO_LIQUIDO' | 'RECEITA' | 'DESPESA';
export type AccountType = 'SINTETICA' | 'ANALITICA';
export type AccountNature = 'DEVEDORA' | 'CREDORA';

export interface ChartOfAccount {
  id: string;
  code: string; // Ex: '1.1.1.01'
  name: string;
  category: AccountCategory;
  type: AccountType;
  nature: AccountNature;
  level: number;
  parentId?: string;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
}

export interface CostCenter {
  id: string;
  code: string; // Ex: '10.01'
  name: string;
  responsible: string;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
}

// ============================================================================
// PRD 04 - ORÇAMENTOS, VENDAS, CONTRATOS E ORDENS DE SERVIÇO (COMERCIAL & OPS)
// ============================================================================

export type ProductItemType = 'PRODUCT' | 'SERVICE';

export interface Product {
  id: string;
  code: string; // Ex: 'PRD-001' ou 'SRV-001'
  name: string;
  type: ProductItemType;
  description?: string;
  unit: string; // Ex: 'UN', 'HORA', 'MÊS', 'M2', 'LICENÇA'
  unitPrice: number;
  costPrice?: number;
  status: 'ATIVO' | 'INATIVO';
  createdAt: string;
  updatedAt: string;
}

// --- ORÇAMENTOS (QUOTES) ---
export type QuoteStatus =
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELED';

export interface QuoteItem {
  id: string;
  quoteId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // Valor monetário calculado
  discountPercent?: number;
  surcharge: number; // Valor monetário calculado
  surchargePercent?: number;
  total: number;
  sortOrder: number;
}

export interface Quote {
  id: string;
  instanceId?: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'ORC-000001'
  status: QuoteStatus;
  issueDate: string;
  validUntil: string;
  description: string;
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  notes?: string;
  internalNotes?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalMethod?: 'USER' | 'CUSTOMER' | 'SYSTEM';
  convertedSaleId?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

// --- VENDAS (SALES) ---
export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type SaleSourceType = 'QUOTE' | 'CONTRACT' | 'MANUAL' | 'OS' | 'OTHER';

export interface SaleItem {
  id: string;
  saleId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  surcharge: number;
  total: number;
  sortOrder: number;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'VEN-000001'
  status: SaleStatus;
  saleDate: string;
  sourceType: SaleSourceType;
  sourceId?: string; // Ex: sourceQuoteId
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  notes?: string;
  internalNotes?: string;
  confirmedAt?: string;
  completedAt?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
}

// --- CONTRATOS (CONTRACTS) ---
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELED' | 'FINISHED';
export type ContractRenewalType = 'MANUAL' | 'AUTOMATIC';
export type BillingFrequency = 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'AVULSO';

export interface ContractItem {
  id: string;
  contractId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  frequency: BillingFrequency;
  startDate: string;
  endDate?: string;
  total: number;
}

export interface Contract {
  id: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'CTR-000001'
  title: string;
  description: string;
  status: ContractStatus;
  startDate: string;
  endDate?: string;
  renewalType: ContractRenewalType;
  billingFrequency: BillingFrequency;
  value: number; // Valor recorrente ou total contratual
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: ContractItem[];
}

// --- ORDENS DE SERVIÇO (SERVICE ORDERS / OS) ---
export type ServiceOrderStatus = 'OPEN' | 'SCHEDULED' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELED';
export type ServiceOrderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ServiceOrderSourceType = 'AVULSA' | 'SALE' | 'CONTRACT' | 'QUOTE';

export interface ServiceOrderItem {
  id: string;
  serviceOrderId: string;
  itemType: ProductItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ServiceOrderAssignment {
  id: string;
  serviceOrderId: string;
  userId: string;
  userName: string;
  role: 'RESPONSAVEL_PRINCIPAL' | 'TECNICO' | 'PARTICIPANTE';
  assignedAt: string;
}

export interface ServiceOrderEvent {
  id: string;
  serviceOrderId: string;
  eventType: string; // Ex: 'OS_CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'SCHEDULED', 'COMMENT_ADDED'
  description: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface ServiceOrderComment {
  id: string;
  serviceOrderId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  customerName?: string;
  customerDocument?: string;
  number: string; // Ex: 'OS-000001'
  title: string;
  description: string;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  scheduledStart?: string;
  scheduledEnd?: string;
  startedAt?: string;
  finishedAt?: string;
  completedAt?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  sourceType: ServiceOrderSourceType;
  sourceId?: string;
  notes?: string;
  internalNotes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: ServiceOrderItem[];
  assignments: ServiceOrderAssignment[];
  events: ServiceOrderEvent[];
  comments: ServiceOrderComment[];
}

export interface CommercialDashboardMetrics {
  openQuotesCount: number;
  openQuotesValue: number;
  approvedQuotesCount: number;
  approvedQuotesValue: number;
  confirmedSalesCount: number;
  confirmedSalesValue: number;
  activeContractsCount: number;
  activeContractsValue: number;
  serviceOrdersByStatus: {
    open: number;
    scheduled: number;
    inProgress: number;
    waiting: number;
    completed: number;
    canceled: number;
  };
}

// ============================================================================
// PRD PARTE 05 — FATURAMENTO, COMPETÊNCIAS E RECORRÊNCIA (BILLING MODULE)
// ============================================================================

export type BillingDocumentStatus = 'DRAFT' | 'PENDING' | 'ISSUED' | 'CANCELED';

export type BillingSourceType = 'SALE' | 'CONTRACT' | 'SERVICE_ORDER' | 'MANUAL';

export type BillingItemType = 'PRODUCT' | 'SERVICE' | 'OTHER';

export type RecurringFrequency =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'YEARLY'
  | 'ANNUAL'
  | 'CUSTOM';

export type RecurringStatus = 'ACTIVE' | 'SUSPENDED' | 'PAUSED' | 'CANCELED' | 'FINISHED';

export type DueRule = 'FIXED_DAY' | 'DAYS_AFTER_ISSUE' | 'DAYS_AFTER_COMPETENCE';

export interface BillingItem {
  id: string;
  billingId: string;
  itemType: BillingItemType;
  productId?: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  surcharge: number;
  total: number;
  sortOrder: number;
  sourceType?: BillingSourceType;
  sourceId?: string;
}

export interface BillingDocument {
  id: string;
  instanceId: string; // namespace do schema do tenant
  customerId: string;
  customerName: string;
  customerDocument?: string;
  number: string; // Ex: 'FAT-000001'
  status: BillingDocumentStatus;
  sourceType: BillingSourceType;
  sourceId?: string;
  sourceNumber?: string; // Ex: 'VEN-000001', 'CTR-000001', 'OS-000001'
  recurringBillingId?: string;
  issueDate: string; // YYYY-MM-DD
  competenceStart: string; // YYYY-MM-DD
  competenceEnd: string; // YYYY-MM-DD
  competenceLabel: string; // Ex: '09/2026'
  dueDate: string; // YYYY-MM-DD
  subtotal: number;
  discount: number;
  surcharge: number;
  total: number;
  description?: string;
  notes?: string;
  internalNotes?: string;
  cancellationReason?: string;
  canceledAt?: string;
  canceledBy?: string;
  issuedAt?: string;
  issuedBy?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  items: BillingItem[];
  // Campos para desacoplamento e preparação futura (Seções 43, 44 e 74)
  collectionId?: string;
  fiscalDocumentId?: string;
  isPaidPreview?: boolean;
}

export interface RecurringBillingItem {
  id?: string;
  description: string;
  itemType: BillingItemType;
  productId?: string;
  serviceId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  surcharge?: number;
  total?: number;
}

export interface RecurringBilling {
  id: string;
  instanceId: string;
  customerId: string;
  customerName: string;
  customerDocument?: string;
  contractId?: string;
  contractNumber?: string;
  status: RecurringStatus;
  frequency: RecurringFrequency;
  customIntervalMonths?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  nextBillingDate: string; // YYYY-MM-DD
  dayOfMonth: number; // 1..31
  dueRule: DueRule;
  dueDays: number;
  amount: number;
  description: string;
  notes?: string;
  items: RecurringBillingItem[];
  lastGeneratedCompetence?: string; // Ex: '09/2026'
  lastGeneratedAt?: string;
  lastGeneratedBillingId?: string;
  lastGeneratedBillingNumber?: string;
  lastError?: {
    code: string;
    message: string;
    attemptCount?: number;
    lastAttemptAt?: string;
    timestamp?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BillingGenerationLog {
  id: string;
  instanceId: string;
  recurringBillingId: string;
  competenceStart: string;
  competenceEnd: string;
  competenceLabel: string;
  billingId?: string;
  billingNumber?: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
  executedAt: string;
  workerId?: string;
}

export interface BillingDashboardMetrics {
  totalIssuedValue: number;
  totalIssuedCount: number;
  totalCanceledValue: number;
  totalCanceledCount: number;
  totalPendingValue: number;
  totalPendingCount: number;
  totalDraftCount: number;
  activeRecurringCount: number;
  activeRecurringMonthlyValue: number;
  upcomingDueCount: number;
  upcomingDueValue: number;
  byCompetence: Array<{ competence: string; total: number; count: number }>;
  bySource: Array<{ sourceType: BillingSourceType; total: number; count: number }>;
  totalBilledCurrentMonth?: number;
  totalBilledPreviousMonth?: number;
  byStatus?: Record<string, number>;
  bySourceType?: Record<string, number>;
  pendingCount?: number;
  pendingValue?: number;
  issuedCount?: number;
  issuedValue?: number;
  canceledCount?: number;
  canceledValue?: number;
  monthlyRecurringRevenue?: number;
}

// ============================================================================
// PRD 05 - GESTÃO FINANCEIRA, TESOURARIA, CONTAS A RECEBER E PAGAR & DRE
// ============================================================================

export type PaymentMethod =
  | 'PIX'
  | 'BOLETO'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'OTHER';

export type FinancialTitleStatus =
  | 'OPEN'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OVERDUE'
  | 'CANCELED';

export interface AccountReceivable {
  id: string;
  number: string; // Ex: 'REC-000001'
  customerId: string;
  customerName: string;
  customerDocument?: string;
  saleId?: string;
  saleNumber?: string;
  contractId?: string;
  contractNumber?: string;
  chartOfAccountId: string;
  chartOfAccountCode: string;
  costCenterId?: string;
  costCenterCode?: string;
  description: string;
  issueDate: string;
  dueDate: string;
  originalValue: number;
  fineRate: number; // % de multa (ex: 2%)
  interestRate: number; // % de juros ao mês (ex: 1%)
  discountValue: number;
  fineValue: number;
  interestValue: number;
  paidValue: number;
  balanceValue: number; // Saldo residual a receber
  status: FinancialTitleStatus;
  paymentMethod?: PaymentMethod;
  bankAccountId?: string;
  paidAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountPayable {
  id: string;
  number: string; // Ex: 'PAG-000001'
  supplierId: string;
  supplierName: string;
  supplierDocument?: string;
  chartOfAccountId: string;
  chartOfAccountCode: string;
  costCenterId?: string;
  costCenterCode?: string;
  description: string;
  issueDate: string;
  dueDate: string;
  originalValue: number;
  discountValue: number;
  fineValue: number;
  interestValue: number;
  paidValue: number;
  balanceValue: number; // Saldo residual a pagar
  status: FinancialTitleStatus;
  paymentMethod?: PaymentMethod;
  bankAccountId?: string;
  paidAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  name: string; // Ex: 'Itaú Unibanco S.A.'
  bankCode: string; // Ex: '341'
  agency: string;
  accountNumber: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'INVESTMENT' | 'CASH';
  currentBalance: number;
  initialBalance: number;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  date: string;
  description: string;
  category: string;
  relatedTitleId?: string;
  relatedTitleType?: 'RECEIVABLE' | 'PAYABLE' | 'TRANSFER';
  reconciled: boolean;
  reconciledAt?: string;
  createdAt: string;
}

export interface CashFlowDay {
  date: string;
  inflowsPredicted: number;
  inflowsRealized: number;
  outflowsPredicted: number;
  outflowsRealized: number;
  netDay: number;
  cumulativeBalance: number;
}

export interface IncomeStatementItem {
  code: string;
  name: string;
  level: number;
  type: 'REVENUE' | 'DEDUCTION' | 'COST' | 'EXPENSE' | 'RESULT';
  value: number;
  percentage: number;
}

export interface FinancialDashboardMetrics {
  totalReceivablesBalance: number;
  overdueReceivablesCount: number;
  overdueReceivablesValue: number;
  receivablesDueTodayCount: number;
  receivablesDueTodayValue: number;
  totalPayablesBalance: number;
  overduePayablesCount: number;
  overduePayablesValue: number;
  payablesDueTodayCount: number;
  payablesDueTodayValue: number;
  treasuryTotalBalance: number;
  cashFlow30DaysNet: number;
  defaultRatePercent: number;
  bankAccountsSummary: Array<{
    id: string;
    name: string;
    balance: number;
    bankCode: string;
    color?: string;
  }>;
}

// ============================================================================
// PRD 06 — GESTÃO DE ESTOQUE & ALMOXARIFADO (WMS BÁSICO)
// ============================================================================

export interface Warehouse {
  id: string;
  companyId: string;
  code: string; // Ex: 'ALM-01', 'DEP-01'
  name: string; // Ex: 'Almoxarifado Central', 'Depósito Matriz'
  description?: string;
  location?: string; // Ex: 'Galpão Principal - Ala Norte'
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockItem {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  quantity: number; // Saldo físico real em estoque
  reservedQuantity: number; // Quantidade reservada em pedidos de venda ou OS
  availableQuantity: number; // Saldo disponível para movimentação (quantity - reservedQuantity)
  minQuantity: number; // Estoque mínimo / ponto de reposição
  maxQuantity: number; // Estoque máximo operacional
  averageCost: number; // Custo Médio Ponderado (CMP) em BRL
  lastCost: number; // Último custo unitário de aquisição em BRL
  totalValue: number; // Valor total patrimonial (quantity * averageCost)
  locationRack?: string; // Localização física / Endereçamento (ex: 'Rua A / Prateleira 02')
  updatedAt: string;
}

export type StockMovementType =
  | 'INBOUND_PURCHASE' // Entrada por compra / fornecedor
  | 'INBOUND_ADJUSTMENT' // Entrada por ajuste de inventário / contagem
  | 'OUTBOUND_SALE' // Saída por faturamento / expedição de venda
  | 'OUTBOUND_SERVICE_ORDER' // Saída por aplicação de peças em Ordem de Serviço
  | 'OUTBOUND_ADJUSTMENT' // Saída por perda, avaria ou ajuste negativo
  | 'TRANSFER_IN' // Entrada decorrente de transferência entre depósitos
  | 'TRANSFER_OUT' // Saída decorrente de transferência entre depósitos
  | 'RETURN'; // Devolução de mercadoria

export type StockMovementReferenceType =
  | 'SALE'
  | 'PURCHASE'
  | 'SERVICE_ORDER'
  | 'TRANSFER'
  | 'MANUAL'
  | 'INVENTORY_COUNT';

export interface StockMovement {
  id: string;
  companyId: string;
  movementNumber: string; // Ex: 'MOV-000001'
  movementType: StockMovementType;
  productId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  warehouseId: string;
  warehouseName: string;
  targetWarehouseId?: string; // Quando for transferência entre depósitos
  targetWarehouseName?: string;
  quantity: number; // Quantidade movimentada (sempre valor absoluto positivo)
  unitCost: number; // Custo unitário da operação em BRL
  totalCost: number; // Valor total da movimentação em BRL
  previousStock: number; // Saldo anterior daquele depósito
  currentStock: number; // Novo saldo calculado
  previousAverageCost: number; // CMP anterior
  newAverageCost: number; // Novo CMP após recálculo
  referenceType?: StockMovementReferenceType;
  referenceId?: string; // ID da venda, OS ou compra relacionada
  referenceDocument?: string; // Ex: 'VEN-000001', 'OS-000002', 'NF-10293'
  batchNumber?: string; // Número de lote para rastreabilidade
  expirationDate?: string; // Data de validade (YYYY-MM-DD)
  notes?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export interface StockTransferInput {
  sourceWarehouseId: string;
  targetWarehouseId: string;
  productId: string;
  quantity: number;
  notes?: string;
}

export interface InventoryMetrics {
  totalItems: number; // Quantidade de SKUs com cadastro de estoque
  totalStockUnits: number; // Soma de unidades físicas em estoque
  totalInventoryValue: number; // Valor patrimonial total avaliado a CMP (R$)
  lowStockCount: number; // Itens em ou abaixo do ponto de reposição
  outOfStockCount: number; // Itens com estoque zerado
  movementsCountThisMonth: number; // Total de movimentações no mês vigente
  activeWarehousesCount: number; // Quantidade de depósitos operacionais
}

// ============================================================================
// PRD 07 — MÓDULO FISCAL, TRIBUTAÇÃO BRASILEIRA, EMISSÃO DF-e & SPED
// ============================================================================

export type FiscalDocumentModel = 'NFE_55' | 'NFSE' | 'NFCE_65';
export type FiscalDocumentType = 'INBOUND' | 'OUTBOUND';
export type FiscalDocumentStatus = 'DRAFT' | 'AUTHORIZED' | 'REJECTED' | 'CANCELED' | 'DENIED';
export type TaxRegime = 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';

export interface FiscalOperation {
  id: string;
  cfop: string; // Ex: '5.102', '5.405', '5.933', '1.102', '6.102'
  description: string;
  type: FiscalDocumentType;
  applicableRegime: 'ALL' | 'SIMPLES_NACIONAL' | 'REGIME_NORMAL';
  icmsCst: string; // CSOSN (102, 500) ou CST (00, 40, 60)
  icmsRate: number; // Alíquota padrão (%)
  pisCst: string; // CST PIS (01, 07, 49)
  pisRate: number; // Alíquota padrão (%)
  cofinsCst: string; // CST COFINS (01, 07, 49)
  cofinsRate: number; // Alíquota padrão (%)
  issRate: number; // Alíquota padrão ISS (%)
  isDefault?: boolean;
}

export interface FiscalItem {
  id: string;
  itemSequence: number; // 1, 2, 3...
  productId?: string;
  productCode: string;
  productName: string;
  ncm: string; // NCM com 8 dígitos (ex: '8471.30.12')
  cest?: string; // Código Especificador da ST (quando aplicável)
  cfop: string; // CFOP específico do item
  unit: string; // 'UN', 'CX', 'KG', 'SV'
  quantity: number;
  unitPrice: number;
  totalPrice: number; // quantity * unitPrice
  discount: number;
  netTotal: number; // totalPrice - discount
  // Tributos Estaduais (ICMS)
  icmsCst: string;
  icmsBase: number;
  icmsRate: number;
  icmsValue: number;
  // Tributos Federais (IPI, PIS, COFINS)
  ipiCst?: string;
  ipiBase: number;
  ipiRate: number;
  ipiValue: number;
  pisCst: string;
  pisBase: number;
  pisRate: number;
  pisValue: number;
  cofinsCst: string;
  cofinsBase: number;
  cofinsRate: number;
  cofinsValue: number;
  // Tributos Municipais (ISS)
  serviceCode?: string; // Código da Lista da LC 116/03 (ex: '01.07')
  issBase: number;
  issRate: number;
  issValue: number;
  issWithheld: boolean;
  // Transparência Fiscal (IBPT)
  approximateTaxes: number;
}

export interface FiscalCorrectionLetter {
  id: string;
  sequenceNumber: number; // 1, 2, 3...
  correctionText: string; // Mínimo 15 caracteres
  protocolNumber: string;
  issuedAt: string;
  issuedByName: string;
}

export interface FiscalDocument {
  id: string;
  companyId: string;
  model: FiscalDocumentModel;
  series: string; // Ex: '1'
  number: number; // Ex: 1001
  accessKey: string; // 44 dígitos (NF-e/NFC-e) ou Código de Verificação (NFS-e)
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss
  type: FiscalDocumentType;
  status: FiscalDocumentStatus;
  natureOfOperation: string; // Ex: 'Venda de Mercadoria', 'Prestação de Serviços'
  cfopPrincipal: string; // Ex: '5.102' ou '5.933'
  // Dados do Destinatário / Tomador
  partnerId?: string;
  partnerName: string;
  partnerCnpjCpf: string;
  partnerStateRegistration?: string; // Inscrição Estadual
  partnerEmail?: string;
  partnerAddress: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    ibgeCode?: string;
  };
  // Itens da Nota
  items: FiscalItem[];
  // Totais Consolidados
  totalProducts: number;
  totalServices: number;
  totalDiscounts: number;
  totalFreight: number;
  totalInsurance: number;
  totalOtherExpenses: number;
  totalTaxableAmount: number;
  totalICMS: number;
  totalIPI: number;
  totalPIS: number;
  totalCOFINS: number;
  totalISS: number;
  totalWithheldTaxes: number; // Retenções (IRRF + INSS + CSLL + PIS/COFINS)
  totalApproximateTaxes: number; // Lei 12.741/2012
  netTotal: number; // Valor Total da Nota Fiscal (a pagar)
  // Protocolos e Rastreabilidade SEFAZ / Prefeitura
  protocolNumber?: string;
  authorizedAt?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  canceledAt?: string;
  correctionLetters: FiscalCorrectionLetter[];
  // Vínculos Operacionais
  billingDocumentId?: string;
  saleId?: string;
  xmlPayload?: string;
  additionalInfo?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalInutilization {
  id: string;
  model: FiscalDocumentModel;
  series: string;
  startNumber: number;
  endNumber: number;
  year: number;
  justification: string;
  protocolNumber: string;
  registeredAt: string;
  registeredByName: string;
}

export interface FiscalMetrics {
  totalAuthorizedValue: number;
  totalAuthorizedCount: number;
  countNFe: number;
  countNFSe: number;
  countNFCe: number;
  totalICMSPeriod: number;
  totalISSPeriod: number;
  totalPISCOFINSPeriod: number;
  pendingDraftCount: number;
  canceledCount: number;
}

export interface SpedBlockSummary {
  block: string;
  name: string;
  recordCount: number;
  description: string;
}

// ============================================================================
// PRD 08 — MÓDULO DE COMPRAS, SUPRIMENTOS & ENTRADA DE MERCADORIAS (PROCUREMENT)
// ============================================================================

export type PurchaseRequisitionPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export type PurchaseRequisitionStatus =
  | 'RASCUNHO'
  | 'PENDENTE_APROVACAO'
  | 'APROVADA'
  | 'REJEITADA'
  | 'EM_COTACAO'
  | 'CONCLUIDA'
  | 'CANCELADA';

export interface PurchaseRequisitionItem {
  id: string;
  productId?: string;
  productCode?: string;
  productName: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  estimatedTotalPrice: number;
  notes?: string;
}

export interface PurchaseRequisition {
  id: string;
  number: string; // Ex: 'RC-000001'
  requestedById: string;
  requestedByName: string;
  department: string;
  costCenterId?: string;
  costCenterName?: string;
  priority: PurchaseRequisitionPriority;
  status: PurchaseRequisitionStatus;
  neededByDate: string; // YYYY-MM-DD
  justification: string;
  items: PurchaseRequisitionItem[];
  totalEstimated: number;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  purchaseOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseQuotationStatus =
  | 'ABERTA'
  | 'EM_ANALISE'
  | 'HOMOLOGADA'
  | 'CANCELADA';

export interface QuotationItemProposal {
  itemId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercentage: number;
  icmsPercentage: number;
  ipiPercentage: number;
  freightAmount: number;
  totalPrice: number;
  deliveryDays: number;
  isWinning?: boolean;
}

export interface SupplierQuotationProposal {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierDocument: string;
  supplierContact?: string;
  deliveryDays: number;
  freightType: 'CIF' | 'FOB';
  paymentTerm: string;
  items: QuotationItemProposal[];
  subtotal: number;
  freightTotal: number;
  discountTotal: number;
  grandTotal: number;
  notes?: string;
  submittedAt: string;
  isOverallWinner?: boolean;
}

export interface PurchaseQuotation {
  id: string;
  number: string; // Ex: 'COT-000001'
  title: string;
  requisitionIds: string[];
  status: PurchaseQuotationStatus;
  deadlineDate: string; // YYYY-MM-DD
  items: {
    id: string;
    productId?: string;
    productCode?: string;
    productName: string;
    quantity: number;
    unit: string;
    targetPrice?: number;
  }[];
  proposals: SupplierQuotationProposal[];
  winningSupplierId?: string;
  winningSupplierName?: string;
  totalWinningAmount?: number;
  savingsAmount?: number;
  savingsPercentage?: number;
  homologatedById?: string;
  homologatedByName?: string;
  homologatedAt?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus =
  | 'RASCUNHO'
  | 'PENDENTE_APROVACAO'
  | 'APROVADO'
  | 'REJEITADO'
  | 'EMITIDO_AO_FORNECEDOR'
  | 'RECEBIDO_PARCIAL'
  | 'RECEBIDO_TOTAL'
  | 'CANCELADO';

export interface PurchaseOrderItem {
  id: string;
  productId?: string;
  productCode?: string;
  productName: string;
  quantity: number;
  quantityReceived: number;
  unit: string;
  unitPrice: number;
  discountAmount: number;
  aliquotIPI: number;
  aliquotICMS: number;
  totalAmount: number;
}

export interface PurchaseOrder {
  id: string;
  number: string; // Ex: 'PC-000001'
  supplierId: string;
  supplierName: string;
  supplierDocument: string;
  supplierContact?: string;
  quotationId?: string;
  requisitionId?: string;
  status: PurchaseOrderStatus;
  paymentTerm: string;
  paymentMethod: PaymentMethod;
  expectedDeliveryDate: string; // YYYY-MM-DD
  deliveryAddress: string;
  warehouseId: string;
  warehouseName: string;
  costCenterId?: string;
  costCenterName?: string;
  subtotal: number;
  discountTotal: number;
  freightTotal: number;
  taxesTotal: number;
  grandTotal: number;
  items: PurchaseOrderItem[];
  notes?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  issuedAt?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type InboundInvoiceStatus =
  | 'IMPORTADA'
  | 'PROCESSADA'
  | 'CANCELADA';

export interface InboundInvoiceItem {
  id: string;
  productCodeSupplier: string;
  productName: string;
  ncm: string;
  cfop: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  discountAmount: number;
  icmsAmount: number;
  ipiAmount: number;
  pisAmount: number;
  cofinsAmount: number;
  internalProductId?: string;
  internalProductCode?: string;
  internalProductName?: string;
  batchNumber?: string;
  expirationDate?: string;
}

export interface InboundInvoiceInstallment {
  id: string;
  number: string;
  dueDate: string; // YYYY-MM-DD
  amount: number;
  paymentTitleId?: string;
}

export interface InboundInvoice {
  id: string;
  accessKey: string; // Chave de 44 dígitos da NF-e
  number: string;
  series: string;
  issueDate: string;
  entryDate: string;
  supplierId?: string;
  supplierName: string;
  supplierDocument: string;
  supplierStateRegistration?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  warehouseId: string;
  warehouseName: string;
  totalProducts: number;
  totalFreight: number;
  totalInsurance: number;
  totalDiscount: number;
  totalIPI: number;
  totalICMS: number;
  totalPIS: number;
  totalCOFINS: number;
  netTotal: number;
  status: InboundInvoiceStatus;
  items: InboundInvoiceItem[];
  installments: InboundInvoiceInstallment[];
  xmlRaw?: string;
  processedAt?: string;
  processedByName?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchasesDashboardMetrics {
  totalSpentPeriod: number;
  activeOrdersCount: number;
  pendingRequisitionsCount: number;
  pendingApprovalOrdersCount: number;
  averageLeadTimeDays: number;
  totalQuotationsSavings: number;
  recentOrders: PurchaseOrder[];
  topSuppliers: { supplierName: string; totalAmount: number; count: number }[];
}

// ============================================================================
// PRD 09 — COBRANÇA BANCÁRIA, BOLETOS, PIX DINÂMICO & CONCILIAÇÃO CNAB (240/400)
// ============================================================================

export type BankSlipStatus = 'DRAFT' | 'REGISTERED' | 'PAID' | 'CANCELED' | 'OVERDUE';

export interface BankSlip {
  id: string;
  ourNumber: string;
  documentNumber: string;
  barcode: string;
  digitableLine: string;
  bankCode: string;
  bankName: string;
  agency: string;
  account: string;
  wallet: string;
  payerName: string;
  payerDocument: string;
  payerAddress?: string;
  beneficiaryName: string;
  beneficiaryDocument: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  finePercent: number;
  interestMonthlyPercent: number;
  status: BankSlipStatus;
  paidAmount?: number;
  paidDate?: string;
  accountReceivableId?: string;
  billingDocumentId?: string;
  instructions?: string[];
  createdAt: string;
  updatedAt: string;
}

export type PixKeyType = 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
export type PixChargeStatus = 'ACTIVE' | 'CONCLUDED' | 'EXPIRED' | 'CANCELED';

export interface PixCharge {
  id: string;
  txid: string;
  accountReceivableId?: string;
  billingDocumentId?: string;
  customerName: string;
  customerDocument: string;
  description: string;
  amount: number;
  keyType: PixKeyType;
  key: string;
  emvPayload: string;
  qrCodeSvg: string;
  status: PixChargeStatus;
  expiresAt: string;
  paidAt?: string;
  endToEndId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CnabType = 'REMESSA' | 'RETORNO';
export type CnabStandard = 'CNAB240' | 'CNAB400';
export type CnabFileStatus = 'GENERATED' | 'TRANSMITTED' | 'PROCESSED' | 'ERROR';

export interface CnabFile {
  id: string;
  filename: string;
  type: CnabType;
  standard: CnabStandard;
  bankCode: string;
  bankName: string;
  bankAccountId: string;
  sequenceNumber: number;
  generationDate: string;
  totalRecords: number;
  totalAmount: number;
  status: CnabFileStatus;
  contentRaw: string;
  itemsCount: number;
  itemsSuccessCount: number;
  itemsErrorCount: number;
  processingLog?: string[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  processedAt?: string;
}

export type DunningChannel = 'EMAIL' | 'WHATSAPP' | 'SMS';

export interface CollectionDunningRule {
  id: string;
  name: string;
  triggerDays: number;
  channel: DunningChannel;
  templateSubject: string;
  templateBody: string;
  includePix: boolean;
  includeBoleto: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankingDashboardMetrics {
  totalToCollect: number;
  totalCollectedMonth: number;
  defaultRate: number;
  boletosActiveCount: number;
  pixActiveCount: number;
  pendingRemessaCount: number;
  agingBreakdown: {
    upTo30Days: number;
    from31To60Days: number;
    from61To90Days: number;
    above90Days: number;
    onTime: number;
  };
  channelPerformance: {
    boletoVolume: number;
    pixVolume: number;
    transferVolume: number;
  };
  recentTransactions: {
    id: string;
    titleNumber: string;
    customerName: string;
    method: 'BOLETO' | 'PIX' | 'TRANSFER';
    amount: number;
    date: string;
    status: string;
  }[];
}



