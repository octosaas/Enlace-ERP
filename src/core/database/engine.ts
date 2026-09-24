/**
 * Enlace ERP - Database Engine & Multi-Tenant Schema Manager
 * PRD 01 & PRD 02 - Camada Central de Identidade, RBAC e Isolamento por CNPJ
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  Company,
  Membership,
  User,
  AuditLogEntry,
  UserSession,
  RefreshToken,
  Invitation,
  PasswordResetToken,
  SecurityEvent,
  UserRole,
  BusinessPartner,
  ChartOfAccount,
  CostCenter,
  Product,
  Quote,
  QuoteItem,
  QuoteStatus,
  Sale,
  SaleItem,
  SaleStatus,
  Contract,
  ContractItem,
  ContractStatus,
  ServiceOrder,
  ServiceOrderItem,
  ServiceOrderAssignment,
  ServiceOrderEvent,
  ServiceOrderComment,
  ServiceOrderStatus,
  CommercialDashboardMetrics,
  PaymentMethod,
  FinancialTitleStatus,
  AccountReceivable,
  AccountPayable,
  BankAccount,
  BankTransaction,
  CashFlowDay,
  IncomeStatementItem,
  FinancialDashboardMetrics,
  BillingDocument,
  BillingItem,
  BillingDocumentStatus,
  BillingSourceType,
  BillingItemType,
  RecurringFrequency,
  RecurringStatus,
  DueRule,
  RecurringBilling,
  RecurringBillingItem,
  BillingGenerationLog,
  BillingDashboardMetrics,
  Warehouse,
  StockItem,
  StockMovement,
  StockMovementType,
  StockMovementReferenceType,
  StockTransferInput,
  InventoryMetrics,
  FiscalDocument,
  FiscalItem,
  FiscalDocumentModel,
  FiscalDocumentStatus,
  FiscalDocumentType,
  FiscalOperation,
  FiscalInutilization,
  FiscalCorrectionLetter,
  FiscalMetrics,
  SpedBlockSummary,
  TaxRegime,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  PurchaseRequisitionPriority,
  PurchaseRequisitionStatus,
  PurchaseQuotation,
  SupplierQuotationProposal,
  QuotationItemProposal,
  PurchaseQuotationStatus,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  InboundInvoice,
  InboundInvoiceItem,
  InboundInvoiceInstallment,
  InboundInvoiceStatus,
  PurchasesDashboardMetrics,
  // PRD 09
  BankSlip,
  BankSlipStatus,
  PixCharge,
  PixChargeStatus,
  PixKeyType,
  CnabFile,
  CnabFileStatus,
  CnabType,
  CnabStandard,
  CollectionDunningRule,
  DunningChannel,
  BankingDashboardMetrics,
  // PRD PARTE 06
  Receivable,
  ReceivableInstallment,
  Collection,
  PaymentRecord,
  PaymentProviderConfig,
  WebhookEventRecord,
  ReceivablesDashboardMetrics,
  CustomerReceivablesSummary,
  SpotlightRecordResult,
} from '../../shared/types.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../../shared/permissions.js';
import { cleanDocument, formatDocument } from '../../shared/validators.js';
import { logger } from '../logger/index.js';
import { CommercialMath } from '../commercial/commercialEngine.js';
import { FinancialMath, CashFlowEngine, IncomeStatementEngine } from '../financial/financialEngine.js';
import {
  BillingMath,
  CompetenceHelper,
  BillingStateMachine,
  RecurringBillingConcurrencyManager,
} from '../billing/billingEngine.js';
import { InventoryMath, InventoryEngine } from '../inventory/inventoryEngine.js';
import { FiscalMath, FiscalXmlGenerator, SpedFiscalEngine } from '../fiscal/fiscalEngine.js';
import { ProcurementMath, QuotationComparator, NFeXmlParser } from '../procurement/procurementEngine.js';
import { BoletoMath, PixEngine, CnabEngine, SUPPORTED_BANKS } from '../banking/bankingEngine.js';
import { CollectionEngine } from '../collection/collectionEngine.js';
import { PaymentProviderRegistry } from '../collection/paymentProviderRegistry.js';
import { PostgresService } from './postgres.js';
import { RepositoryManager } from './repositories/index.js';
import { DatabaseSeeder } from './seed.js';

export interface TenantStorage {
  settings: {
    timezone: string;
    currency: string;
    documentRetentionDays: number;
    updatedAt: string;
  };
  auditLogs: AuditLogEntry[];
  modulesConfig: Record<string, boolean>;
  records: Array<{
    id: string;
    title: string;
    secretData: string;
    createdAt: string;
  }>;
  partners: BusinessPartner[];
  chartOfAccounts: ChartOfAccount[];
  costCenters: CostCenter[];

  // PRD 04 - Comercial e Operações
  products: Product[];
  quotes: Quote[];
  sales: Sale[];
  contracts: Contract[];
  serviceOrders: ServiceOrder[];
  sequentialCounters: {
    quote: number;
    sale: number;
    contract: number;
    serviceOrder: number;
    receivable: number;
    payable: number;
    billing: number;
    inventoryMovement: number;
    warehouse: number;
    fiscalNFe: number;
    fiscalNFSe: number;
    fiscalNFCe: number;
    purchaseRequisition: number;
    purchaseQuotation: number;
    purchaseOrder: number;
    inboundInvoice: number;
    bankSlip: number;
    cnabRemessa: number;
  };

  // PRD 05 - Financeiro e Tesouraria
  accountsReceivable: AccountReceivable[];
  accountsPayable: AccountPayable[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];

  // PRD PARTE 05 - Faturamento, Competências e Recorrência
  billingDocuments: BillingDocument[];
  recurringBillings: RecurringBilling[];
  billingGenerationLogs: BillingGenerationLog[];

  // PRD 06 - Estoque & Almoxarifado (WMS)
  warehouses: Warehouse[];
  stockItems: StockItem[];
  stockMovements: StockMovement[];

  // PRD 07 - Módulo Fiscal & Tributário Brasileiro (DF-e, SPED)
  fiscalDocuments: FiscalDocument[];
  fiscalOperations: FiscalOperation[];
  fiscalInutilizations: FiscalInutilization[];

  // PRD 08 - Compras, Suprimentos & Entrada de Mercadorias (Procurement)
  purchaseRequisitions: PurchaseRequisition[];
  purchaseQuotations: PurchaseQuotation[];
  purchaseOrders: PurchaseOrder[];
  inboundInvoices: InboundInvoice[];

  // PRD 09 - Cobrança Bancária, Boletos, Pix & CNAB
  bankSlips: BankSlip[];
  pixCharges: PixCharge[];
  cnabFiles: CnabFile[];
  dunningRules: CollectionDunningRule[];

  // PRD PARTE 06 - Cobrança e Contas a Receber (Billing -> Receivable -> Collection -> Payment)
  receivablesV2: Receivable[];
  collectionsV2: Collection[];
  paymentsV2: PaymentRecord[];
  paymentProvidersV2: PaymentProviderConfig[];
  webhookEventsV2: WebhookEventRecord[];
}

export type StoredUser = User & {
  passwordHash: string;
  mfaSecret?: string;
  recoveryCodes?: string[];
};

class DatabaseEngine {
  private isInitialized = false;

  // Repositório do Control Plane (Global)
  private users = new Map<string, StoredUser>();
  private companies = new Map<string, Company>();
  private memberships = new Map<string, Membership>();
  private companyModules = new Map<string, Record<string, boolean>>();

  // Repositório de Identidade, Sessões & Segurança (PRD 02)
  private sessions = new Map<string, UserSession>();
  private revokedSessionIds = new Set<string>();
  private refreshTokens = new Map<string, RefreshToken>();
  private invitations = new Map<string, Invitation>();
  private passwordResets = new Map<string, PasswordResetToken>();
  private securityEvents: SecurityEvent[] = [];

  // Repositórios Isolados por Schema de Tenant (tenant_<cleanCnpj>)
  private tenantSchemas = new Map<string, TenantStorage>();

  async initialize() {
    if (this.isInitialized) return;

    logger.info('[DatabaseEngine] Inicializando motor de banco de dados e schemas isolados (PRD 01 & 02)...');

    // Seed inicial seguro para demonstração e validação do PRD 01 e 02
    const passwordHash = await bcrypt.hash('Enlace#2026!Master', 10);

    // 1. Usuários de Teste (Global)
    const userAna: StoredUser = {
      id: 'usr-11111111-1111-4111-8111-111111111111',
      email: 'contador@enlace.com.br',
      name: 'Ana Silva (Contadora Multiempresa)',
      phone: '+55 11 98888-1111',
      status: 'ACTIVE',
      isPlatformAdmin: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const userCarlos: StoredUser = {
      id: 'usr-22222222-2222-4222-8222-222222222222',
      email: 'carlos@alfa.com.br',
      name: 'Carlos Santos (Diretor Alfa)',
      phone: '+55 11 97777-2222',
      status: 'ACTIVE',
      isPlatformAdmin: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const userMariana: StoredUser = {
      id: 'usr-33333333-3333-4333-8333-333333333333',
      email: 'mariana@beta.com.br',
      name: 'Mariana Lima (Operadora Beta)',
      phone: '+55 21 96666-3333',
      status: 'ACTIVE',
      isPlatformAdmin: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Usuário desativado para teste de login bloqueado (Seção 47)
    const userSuspenso: StoredUser = {
      id: 'usr-44444444-4444-4444-8444-444444444444',
      email: 'suspenso@alfa.com.br',
      name: 'Roberto Bloqueado (Ex-Funcionário)',
      phone: '+55 11 95555-4444',
      status: 'SUSPENDED',
      isPlatformAdmin: false,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(userAna.id, userAna);
    this.users.set(userCarlos.id, userCarlos);
    this.users.set(userMariana.id, userMariana);
    this.users.set(userSuspenso.id, userSuspenso);

    // 2. Empresas com CNPJs distintos e Schemas Dedicados
    const companyAlfa: Company = {
      id: 'cmp-aaaa-1111-alfa-000000000001',
      cnpj: '12.345.678/0001-95',
      cleanCnpj: '12345678000195',
      legalName: 'Alfa Serviços Empresariais Ltda',
      tradeName: 'Alfa Soluções',
      segment: 'servicos',
      schemaNamespace: 'tenant_12345678000195',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const companyBeta: Company = {
      id: 'cmp-bbbb-2222-beta-000000000002',
      cnpj: '98.765.432/0001-10',
      cleanCnpj: '98765432000110',
      legalName: 'Beta Soluções e Comércio S/A',
      tradeName: 'Beta Distribuidora',
      segment: 'comercio',
      schemaNamespace: 'tenant_98765432000110',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.companies.set(companyAlfa.id, companyAlfa);
    this.companies.set(companyBeta.id, companyBeta);

    // 3. Memberships (Relação Usuário <-> Empresa)
    // Ana tem acesso a Alfa (Manager) e a Beta (Viewer)
    const memAnaAlfa: Membership = {
      id: 'mem-ana-alfa-01',
      userId: userAna.id,
      companyId: companyAlfa.id,
      role: 'manager',
      permissions: ROLE_DEFAULT_PERMISSIONS['manager'],
      status: 'ACTIVE',
      isActive: true,
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const memAnaBeta: Membership = {
      id: 'mem-ana-beta-02',
      userId: userAna.id,
      companyId: companyBeta.id,
      role: 'viewer',
      permissions: ROLE_DEFAULT_PERMISSIONS['viewer'],
      status: 'ACTIVE',
      isActive: true,
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Carlos tem acesso apenas à Alfa (Owner com autoridade máxima)
    const memCarlosAlfa: Membership = {
      id: 'mem-carlos-alfa-03',
      userId: userCarlos.id,
      companyId: companyAlfa.id,
      role: 'owner',
      permissions: ROLE_DEFAULT_PERMISSIONS['owner'],
      status: 'ACTIVE',
      isActive: true,
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Mariana tem acesso apenas à Beta (Operator)
    const memMarianaBeta: Membership = {
      id: 'mem-mariana-beta-04',
      userId: userMariana.id,
      companyId: companyBeta.id,
      role: 'operator',
      permissions: ROLE_DEFAULT_PERMISSIONS['operator'],
      status: 'ACTIVE',
      isActive: true,
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.memberships.set(memAnaAlfa.id, memAnaAlfa);
    this.memberships.set(memAnaBeta.id, memAnaBeta);
    this.memberships.set(memCarlosAlfa.id, memCarlosAlfa);
    this.memberships.set(memMarianaBeta.id, memMarianaBeta);

    // 4. Provisionamento dos Schemas Isolados (PRD 01, 02 & 03)
    this.provisionTenantSchema(companyAlfa.schemaNamespace, {
      settings: {
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        documentRetentionDays: 1825,
        updatedAt: new Date().toISOString(),
      },
      auditLogs: [],
      modulesConfig: {
        finance: true,
        services: true,
        customers: true,
        contracts: true,
        inventory: true,
        sales: true,
        billing: true,
        fiscal: true,
        purchases: true,
        banking: true,
        collections: true,
      },
      records: [
        {
          id: 'rec-alfa-001',
          title: 'Contrato de Consultoria TI - Exclusivo Alfa Ltda',
          secretData: 'Dados Confidenciais Financeiros da Alfa (CNPJ 12.345.678/0001-95)',
          createdAt: new Date().toISOString(),
        },
      ],
      partners: [
        {
          id: 'ptn-alfa-001',
          personType: 'PJ',
          document: '33000167000101',
          formattedDocument: '33.000.167/0001-01',
          roles: ['CLIENTE'],
          name: 'Petróleo Brasileiro S.A. - Petrobras',
          tradeName: 'Petrobras Corporate',
          stateRegistration: '80.123.456',
          municipalRegistration: '987654',
          email: 'suprimentos@petrobras.com.br',
          phone: '(21) 3876-4000',
          address: {
            zipCode: '20031-912',
            street: 'Avenida República do Chile',
            number: '65',
            neighborhood: 'Centro',
            city: 'Rio de Janeiro',
            state: 'RJ',
            ibgeCode: '3304557',
          },
          creditLimit: 500000,
          paymentTermsDays: 30,
          status: 'ATIVO',
          notes: 'Cliente corporativo com faturamento direto via NF-e.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'ptn-alfa-002',
          personType: 'PJ',
          document: '53113791000122',
          formattedDocument: '53.113.791/0001-22',
          roles: ['FORNECEDOR'],
          name: 'Totvs S.A.',
          tradeName: 'Totvs Brasil',
          stateRegistration: '109.876.543.210',
          municipalRegistration: '112233',
          email: 'financeiro@totvs.com.br',
          phone: '(11) 2099-7000',
          address: {
            zipCode: '02511-000',
            street: 'Avenida Braz Leme',
            number: '1000',
            neighborhood: 'Santana',
            city: 'São Paulo',
            state: 'SP',
            ibgeCode: '3550308',
          },
          creditLimit: 100000,
          paymentTermsDays: 28,
          status: 'ATIVO',
          notes: 'Fornecedor de licenças em nuvem e infraestrutura.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'ptn-alfa-003',
          personType: 'PF',
          document: '12345678909',
          formattedDocument: '123.456.789-09',
          roles: ['CLIENTE'],
          name: 'Dra. Juliana Mendes',
          tradeName: 'Consultoria Médica JM',
          email: 'juliana.mendes@med.com.br',
          phone: '(11) 98765-4321',
          address: {
            zipCode: '01415-000',
            street: 'Rua Bela Cintra',
            number: '1200',
            complement: 'Conjunto 81',
            neighborhood: 'Consolação',
            city: 'São Paulo',
            state: 'SP',
            ibgeCode: '3550308',
          },
          creditLimit: 50000,
          paymentTermsDays: 15,
          status: 'ATIVO',
          notes: 'Cliente de consultoria em TI hospitalar.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'ptn-alfa-004',
          personType: 'PJ',
          document: '48740351000165',
          formattedDocument: '48.740.351/0001-65',
          roles: ['TRANSPORTADORA'],
          name: 'Braspress Transportes Urgentes Ltda',
          tradeName: 'Braspress Logística',
          stateRegistration: '336.987.654.111',
          email: 'operacional@braspress.com.br',
          phone: '(11) 3429-1000',
          address: {
            zipCode: '07034-911',
            street: 'Rodovia Presidente Dutra',
            number: 'Km 220',
            neighborhood: 'Vila Augusta',
            city: 'Guarulhos',
            state: 'SP',
            ibgeCode: '3518800',
          },
          creditLimit: 80000,
          paymentTermsDays: 30,
          status: 'ATIVO',
          notes: 'Transportadora homologada para remessas e equipamentos.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      chartOfAccounts: [
        { id: 'coa-alfa-01', code: '1.0.0.00', name: 'ATIVO TOTAL', category: 'ATIVO', type: 'SINTETICA', nature: 'DEVEDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-02', code: '1.1.0.00', name: 'Ativo Circulante', category: 'ATIVO', type: 'SINTETICA', nature: 'DEVEDORA', level: 2, parentId: 'coa-alfa-01', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-03', code: '1.1.1.00', name: 'Disponibilidades Financeiras', category: 'ATIVO', type: 'SINTETICA', nature: 'DEVEDORA', level: 3, parentId: 'coa-alfa-02', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-04', code: '1.1.1.01', name: 'Caixa Geral Matriz', category: 'ATIVO', type: 'ANALITICA', nature: 'DEVEDORA', level: 4, parentId: 'coa-alfa-03', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-05', code: '1.1.1.02', name: 'Banco Itaú Conta Movimento', category: 'ATIVO', type: 'ANALITICA', nature: 'DEVEDORA', level: 4, parentId: 'coa-alfa-03', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-06', code: '1.1.1.03', name: 'Banco Inter - Conta PIX', category: 'ATIVO', type: 'ANALITICA', nature: 'DEVEDORA', level: 4, parentId: 'coa-alfa-03', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-07', code: '1.1.2.00', name: 'Contas a Receber de Clientes', category: 'ATIVO', type: 'ANALITICA', nature: 'DEVEDORA', level: 3, parentId: 'coa-alfa-02', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-08', code: '2.0.0.00', name: 'PASSIVO TOTAL', category: 'PASSIVO', type: 'SINTETICA', nature: 'CREDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-09', code: '2.1.0.00', name: 'Passivo Circulante', category: 'PASSIVO', type: 'SINTETICA', nature: 'CREDORA', level: 2, parentId: 'coa-alfa-08', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-10', code: '2.1.1.00', name: 'Fornecedores Nacionais', category: 'PASSIVO', type: 'ANALITICA', nature: 'CREDORA', level: 3, parentId: 'coa-alfa-09', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-11', code: '2.1.2.00', name: 'Obrigações Trabalhistas a Pagar', category: 'PASSIVO', type: 'ANALITICA', nature: 'CREDORA', level: 3, parentId: 'coa-alfa-09', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-12', code: '2.1.3.00', name: 'Impostos e Tributos Retidos (ISS/IRRF)', category: 'PASSIVO', type: 'ANALITICA', nature: 'CREDORA', level: 3, parentId: 'coa-alfa-09', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-13', code: '3.0.0.00', name: 'PATRIMÔNIO LÍQUIDO', category: 'PATRIMONIO_LIQUIDO', type: 'SINTETICA', nature: 'CREDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-14', code: '3.1.0.00', name: 'Capital Social Integralizado', category: 'PATRIMONIO_LIQUIDO', type: 'ANALITICA', nature: 'CREDORA', level: 2, parentId: 'coa-alfa-13', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-15', code: '4.0.0.00', name: 'RECEITAS OPERACIONAIS BRUTAS', category: 'RECEITA', type: 'SINTETICA', nature: 'CREDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-16', code: '4.1.0.00', name: 'Receita de Serviços de Consultoria TI', category: 'RECEITA', type: 'ANALITICA', nature: 'CREDORA', level: 2, parentId: 'coa-alfa-15', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-17', code: '4.2.0.00', name: 'Receita de Licenciamento SaaS', category: 'RECEITA', type: 'ANALITICA', nature: 'CREDORA', level: 2, parentId: 'coa-alfa-15', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-18', code: '5.0.0.00', name: 'CUSTOS E DESPESAS OPERACIONAIS', category: 'DESPESA', type: 'SINTETICA', nature: 'DEVEDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-19', code: '5.1.0.00', name: 'Despesas com Folha e Encargos', category: 'DESPESA', type: 'ANALITICA', nature: 'DEVEDORA', level: 2, parentId: 'coa-alfa-18', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-alfa-20', code: '5.2.0.00', name: 'Despesas com Infraestrutura Cloud & TI', category: 'DESPESA', type: 'ANALITICA', nature: 'DEVEDORA', level: 2, parentId: 'coa-alfa-18', status: 'ATIVO', createdAt: new Date().toISOString() },
      ],
      costCenters: [
        { id: 'cc-alfa-01', code: '10.00', name: 'Diretoria e Governança Corporativa', responsible: 'Carlos Santos', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'cc-alfa-02', code: '20.00', name: 'Comercial & Novos Negócios', responsible: 'Juliana Paes', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'cc-alfa-03', code: '30.00', name: 'Engenharia e Consultoria Técnica', responsible: 'Renato Dias', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'cc-alfa-04', code: '40.00', name: 'Administrativo, Jurídico & Financeiro', responsible: 'Ana Silva', status: 'ATIVO', createdAt: new Date().toISOString() },
      ],
      products: [
        {
          id: 'prd-alfa-01',
          code: 'PRD-001',
          name: 'Licença Enlace Cloud Enterprise',
          type: 'PRODUCT',
          description: 'Licença mensal por usuário com auditoria avançada e RBAC.',
          unit: 'LICENÇA',
          unitPrice: 1500.0,
          costPrice: 350.0,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'srv-alfa-01',
          code: 'SRV-001',
          name: 'Consultoria Especializada em Arquitetura Cloud',
          type: 'SERVICE',
          description: 'Horas de engenharia de software e segurança de infraestrutura.',
          unit: 'HORA',
          unitPrice: 250.0,
          costPrice: 120.0,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'srv-alfa-02',
          code: 'SRV-002',
          name: 'Suporte Técnico N3 Dedicado 24x7',
          type: 'SERVICE',
          description: 'SLA de 15 minutos para incidentes críticos.',
          unit: 'MÊS',
          unitPrice: 3800.0,
          costPrice: 1500.0,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'prd-alfa-02',
          code: 'PRD-002',
          name: 'Roteador Corporativo Gigabit SD-WAN',
          type: 'PRODUCT',
          description: 'Equipamento para túneis VPN redundantes.',
          unit: 'UN',
          unitPrice: 850.0,
          costPrice: 480.0,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      quotes: [
        {
          id: 'orc-alfa-001',
          number: 'ORC-000001',
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          status: 'APPROVED',
          issueDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
          validUntil: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
          description: 'Projeto de Modernização de Arquitetura e Licenciamento Enterprise',
          subtotal: 13000.0,
          discount: 500.0,
          surcharge: 0,
          total: 12500.0,
          approvedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          approvedBy: 'Carlos Santos (Proprietário)',
          approvalMethod: 'USER',
          convertedSaleId: 'ven-alfa-001',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          items: [
            {
              id: 'item-orc-01',
              quoteId: 'orc-alfa-001',
              itemType: 'SERVICE',
              serviceId: 'srv-alfa-01',
              description: 'Consultoria Especializada em Arquitetura Cloud (40 horas)',
              quantity: 40,
              unitPrice: 250.0,
              discount: 0,
              surcharge: 0,
              total: 10000.0,
              sortOrder: 1,
            },
            {
              id: 'item-orc-02',
              quoteId: 'orc-alfa-001',
              itemType: 'PRODUCT',
              productId: 'prd-alfa-01',
              description: 'Licença Enlace Cloud Enterprise (2 licenças anuais)',
              quantity: 2,
              unitPrice: 1500.0,
              discount: 0,
              surcharge: 0,
              total: 3000.0,
              sortOrder: 2,
            },
          ],
        },
        {
          id: 'orc-alfa-002',
          number: 'ORC-000002',
          customerId: 'ptn-alfa-003',
          customerName: 'Juliana Paes de Camargo',
          customerDocument: '315.421.788-90',
          status: 'SENT',
          issueDate: new Date().toISOString().split('T')[0],
          validUntil: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
          description: 'Sustentação Médica e Suporte Técnico Especializado',
          subtotal: 6300.0,
          discount: 300.0,
          surcharge: 0,
          total: 6000.0,
          createdBy: 'Carlos Santos',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-orc-03',
              quoteId: 'orc-alfa-002',
              itemType: 'SERVICE',
              serviceId: 'srv-alfa-02',
              description: 'Suporte Técnico N3 Dedicado 24x7 (Mensalidade)',
              quantity: 1,
              unitPrice: 3800.0,
              discount: 0,
              surcharge: 0,
              total: 3800.0,
              sortOrder: 1,
            },
            {
              id: 'item-orc-04',
              quoteId: 'orc-alfa-002',
              itemType: 'SERVICE',
              serviceId: 'srv-alfa-01',
              description: 'Consultoria Especializada (10 horas)',
              quantity: 10,
              unitPrice: 250.0,
              discount: 0,
              surcharge: 0,
              total: 2500.0,
              sortOrder: 2,
            },
          ],
        },
      ],
      sales: [
        {
          id: 'ven-alfa-001',
          number: 'VEN-000001',
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          status: 'CONFIRMED',
          saleDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          sourceType: 'QUOTE',
          sourceId: 'orc-alfa-001',
          subtotal: 13000.0,
          discount: 500.0,
          surcharge: 0,
          total: 12500.0,
          confirmedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          items: [
            {
              id: 'item-ven-01',
              saleId: 'ven-alfa-001',
              itemType: 'SERVICE',
              serviceId: 'srv-alfa-01',
              description: 'Consultoria Especializada em Arquitetura Cloud (40 horas)',
              quantity: 40,
              unitPrice: 250.0,
              discount: 0,
              surcharge: 0,
              total: 10000.0,
              sortOrder: 1,
            },
            {
              id: 'item-ven-02',
              saleId: 'ven-alfa-001',
              itemType: 'PRODUCT',
              productId: 'prd-alfa-01',
              description: 'Licença Enlace Cloud Enterprise (2 licenças anuais)',
              quantity: 2,
              unitPrice: 1500.0,
              discount: 0,
              surcharge: 0,
              total: 3000.0,
              sortOrder: 2,
            },
          ],
        },
      ],
      contracts: [
        {
          id: 'ctr-alfa-001',
          number: 'CTR-000001',
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          title: 'Contrato de Manutenção e Sustentação de Sistemas Cloud',
          description: 'Acordo de Nível de Serviço (SLA) corporativo com atendimento 24/7.',
          status: 'ACTIVE',
          startDate: '2026-01-01',
          endDate: '2027-01-01',
          renewalType: 'AUTOMATIC',
          billingFrequency: 'MENSAL',
          value: 8500.0,
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-ctr-01',
              contractId: 'ctr-alfa-001',
              itemType: 'SERVICE',
              serviceId: 'srv-alfa-02',
              description: 'Suporte Técnico N3 Dedicado 24x7',
              quantity: 1,
              unitPrice: 8500.0,
              frequency: 'MENSAL',
              startDate: '2026-01-01',
              total: 8500.0,
            },
          ],
        },
      ],
      serviceOrders: [
        {
          id: 'os-alfa-001',
          number: 'OS-000001',
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          title: 'Implementação e Setup de Infraestrutura em Nuvem',
          description: 'Configuração de clusters Kubernetes, pipelines CI/CD e VPCs seguras.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          scheduledStart: new Date(Date.now() - 2 * 86400000).toISOString(),
          scheduledEnd: new Date(Date.now() + 5 * 86400000).toISOString(),
          startedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          assignedUserId: userCarlos.id,
          assignedUserName: userCarlos.name,
          sourceType: 'CONTRACT',
          sourceId: 'ctr-alfa-001',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-os-01',
              serviceOrderId: 'os-alfa-001',
              itemType: 'SERVICE',
              serviceId: 'srv-alfa-01',
              description: 'Engenharia de Implantação Cloud',
              quantity: 20,
              unitPrice: 250.0,
              total: 5000.0,
            },
          ],
          assignments: [
            {
              id: 'asg-01',
              serviceOrderId: 'os-alfa-001',
              userId: userCarlos.id,
              userName: userCarlos.name,
              role: 'RESPONSAVEL_PRINCIPAL',
              assignedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
            },
          ],
          events: [
            {
              id: 'evt-01',
              serviceOrderId: 'os-alfa-001',
              eventType: 'OS_CREATED',
              description: 'Ordem de serviço aberta vinculada ao Contrato CTR-000001.',
              createdBy: userCarlos.name,
              createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
            },
            {
              id: 'evt-02',
              serviceOrderId: 'os-alfa-001',
              eventType: 'STATUS_CHANGED',
              description: 'Status alterado para EM ANDAMENTO.',
              createdBy: userCarlos.name,
              createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
            },
          ],
          comments: [
            {
              id: 'cmt-01',
              serviceOrderId: 'os-alfa-001',
              userId: userCarlos.id,
              userName: userCarlos.name,
              content: 'Kick-off de implantação realizado com a equipe de infraestrutura da Petrobras. Ambientes homologados.',
              createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
              updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
            },
          ],
        },
      ],
      sequentialCounters: {
        quote: 2,
        sale: 1,
        contract: 1,
        serviceOrder: 1,
        receivable: 3,
        payable: 3,
        billing: 3,
        inventoryMovement: 1,
        warehouse: 2,
        fiscalNFe: 1001,
        fiscalNFSe: 501,
        fiscalNFCe: 2001,
        purchaseRequisition: 2,
        purchaseQuotation: 1,
        purchaseOrder: 1,
        inboundInvoice: 1,
        bankSlip: 1,
        cnabRemessa: 0,
      },
      accountsReceivable: [
        {
          id: 'rec-alfa-001',
          number: 'REC-000001',
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          saleId: 'ven-alfa-001',
          saleNumber: 'VEN-000001',
          chartOfAccountId: 'coa-alfa-04',
          chartOfAccountCode: '1.1.2.01',
          costCenterId: 'cc-alfa-01',
          costCenterCode: 'CC-01',
          description: 'Faturamento Venda VEN-000001 - Consultoria e Licenças',
          issueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
          originalValue: 12500.0,
          fineRate: 2.0,
          interestRate: 1.0,
          discountValue: 0,
          fineValue: 0,
          interestValue: 0,
          paidValue: 0,
          balanceValue: 12500.0,
          status: 'OPEN',
          notes: 'Duplicata mercantil vinculada ao pedido de venda.',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        {
          id: 'rec-alfa-002',
          number: 'REC-000002',
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          contractId: 'ctr-alfa-001',
          contractNumber: 'CTR-000001',
          chartOfAccountId: 'coa-alfa-04',
          chartOfAccountCode: '1.1.2.01',
          costCenterId: 'cc-alfa-01',
          costCenterCode: 'CC-01',
          description: 'Mensalidade Contrato CTR-000001 (Sustentação Cloud)',
          issueDate: new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0],
          dueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          originalValue: 8500.0,
          fineRate: 2.0,
          interestRate: 1.0,
          discountValue: 0,
          fineValue: 0,
          interestValue: 0,
          paidValue: 8500.0,
          balanceValue: 0,
          status: 'PAID',
          paymentMethod: 'PIX',
          bankAccountId: 'bco-alfa-01',
          paidAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          notes: 'Liquidado via chave PIX CNPJ com conciliação automática.',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        {
          id: 'rec-alfa-003',
          number: 'REC-000003',
          customerId: 'ptn-alfa-003',
          customerName: 'Juliana Paes de Camargo',
          customerDocument: '315.421.788-90',
          chartOfAccountId: 'coa-alfa-04',
          chartOfAccountCode: '1.1.2.01',
          costCenterId: 'cc-alfa-01',
          costCenterCode: 'CC-01',
          description: 'Treinamento Técnico em Arquitetura de Microsserviços',
          issueDate: new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0],
          dueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          originalValue: 3200.0,
          fineRate: 2.0,
          interestRate: 1.0,
          discountValue: 0,
          fineValue: 64.0,
          interestValue: 5.33,
          paidValue: 0,
          balanceValue: 3269.33,
          status: 'OVERDUE',
          notes: 'Título em atraso de 5 dias; cobrança com encargos calculados.',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      accountsPayable: [
        {
          id: 'pag-alfa-001',
          number: 'PAG-000001',
          supplierId: 'ptn-alfa-002',
          supplierName: 'Totvs S.A.',
          supplierDocument: '53.113.791/0001-22',
          chartOfAccountId: 'coa-alfa-06',
          chartOfAccountCode: '2.1.2.01',
          costCenterId: 'cc-alfa-01',
          costCenterCode: 'CC-01',
          description: 'Licenciamento de Servidores e Banco de Dados Cloud',
          issueDate: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
          originalValue: 4600.0,
          discountValue: 0,
          fineValue: 0,
          interestValue: 0,
          paidValue: 0,
          balanceValue: 4600.0,
          status: 'OPEN',
          notes: 'Fatura de fornecedor com vencimento programado.',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        },
        {
          id: 'pag-alfa-002',
          number: 'PAG-000002',
          supplierId: 'ptn-alfa-002',
          supplierName: 'Totvs S.A.',
          supplierDocument: '53.113.791/0001-22',
          chartOfAccountId: 'coa-alfa-06',
          chartOfAccountCode: '2.1.2.01',
          costCenterId: 'cc-alfa-01',
          costCenterCode: 'CC-01',
          description: 'Fatura Mensal de Nuvem (Mês Anterior)',
          issueDate: new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0],
          dueDate: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
          originalValue: 4600.0,
          discountValue: 0,
          fineValue: 0,
          interestValue: 0,
          paidValue: 4600.0,
          balanceValue: 0,
          status: 'PAID',
          paymentMethod: 'BOLETO',
          bankAccountId: 'bco-alfa-01',
          paidAt: new Date(Date.now() - 15 * 86400000).toISOString(),
          notes: 'Boleto bancário quitado em dia no Banco Itaú.',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        },
        {
          id: 'pag-alfa-003',
          number: 'PAG-000003',
          supplierId: 'ptn-alfa-002',
          supplierName: 'Companhia Energética / Datacenter',
          supplierDocument: '00.000.000/0001-00',
          chartOfAccountId: 'coa-alfa-08',
          chartOfAccountCode: '3.1.2.01',
          costCenterId: 'cc-alfa-02',
          costCenterCode: 'CC-02',
          description: 'Fornecimento de Energia e Climatização Datacenter',
          issueDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          originalValue: 1850.0,
          discountValue: 0,
          fineValue: 0,
          interestValue: 0,
          paidValue: 0,
          balanceValue: 1850.0,
          status: 'OPEN',
          notes: 'Despesa fixa operacional do prédio sede.',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        },
      ],
      bankAccounts: [
        {
          id: 'bco-alfa-01',
          name: 'Itaú Unibanco S.A. (Conta Principal)',
          bankCode: '341',
          agency: '1234',
          accountNumber: '56789-0',
          accountType: 'CHECKING',
          currentBalance: 148500.0,
          initialBalance: 100000.0,
          color: '#ec7000',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'bco-alfa-02',
          name: 'Banco do Brasil S.A. (Operações)',
          bankCode: '001',
          agency: '4321',
          accountNumber: '98765-4',
          accountType: 'CHECKING',
          currentBalance: 85200.0,
          initialBalance: 50000.0,
          color: '#fcf800',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'bco-alfa-03',
          name: 'Caixa Pequeno / Fundo Fixo',
          bankCode: '000',
          agency: '0001',
          accountNumber: '0001-0',
          accountType: 'CASH',
          currentBalance: 3800.0,
          initialBalance: 2000.0,
          color: '#10b981',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      bankTransactions: [
        {
          id: 'txn-alfa-001',
          bankAccountId: 'bco-alfa-01',
          type: 'CREDIT',
          amount: 8500.0,
          date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          description: 'RECEBIMENTO PIX PETROBRAS CTR-000001',
          category: 'Recebimento de Cliente',
          relatedTitleId: 'rec-alfa-002',
          relatedTitleType: 'RECEIVABLE',
          reconciled: true,
          reconciledAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        {
          id: 'txn-alfa-002',
          bankAccountId: 'bco-alfa-01',
          type: 'DEBIT',
          amount: 4600.0,
          date: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
          description: 'LIQUIDAÇÃO BOLETO TOTVS S.A.',
          category: 'Fornecedores',
          relatedTitleId: 'pag-alfa-002',
          relatedTitleType: 'PAYABLE',
          reconciled: true,
          reconciledAt: new Date(Date.now() - 15 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        },
        {
          id: 'txn-alfa-003',
          bankAccountId: 'bco-alfa-01',
          type: 'CREDIT',
          amount: 15000.0,
          date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
          description: 'TRANSFERÊNCIA DOC/TED RECEBIDA',
          category: 'Recebimentos Diversos',
          reconciled: false,
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
      ],
      billingDocuments: [
        {
          id: 'fat-alfa-001',
          instanceId: companyAlfa.schemaNamespace,
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          number: 'FAT-000001',
          status: 'ISSUED',
          sourceType: 'SALE',
          sourceId: 'ven-alfa-001',
          sourceNumber: 'VEN-000001',
          issueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          competenceStart: '2026-09-01',
          competenceEnd: '2026-09-30',
          competenceLabel: '09/2026',
          dueDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
          subtotal: 13000.0,
          discount: 500.0,
          surcharge: 0,
          total: 12500.0,
          description: 'Faturamento Venda VEN-000001 - Consultoria Cloud e Licenças Enlace',
          issuedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          issuedBy: 'Carlos Santos',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          items: [
            {
              id: 'item-fat-01',
              billingId: 'fat-alfa-001',
              itemType: 'SERVICE',
              serviceId: 'srv-alfa-01',
              description: 'Consultoria Especializada em Arquitetura Cloud (40 horas)',
              quantity: 40,
              unitPrice: 250.0,
              discount: 0,
              surcharge: 0,
              total: 10000.0,
              sortOrder: 1,
              sourceType: 'SALE',
              sourceId: 'ven-alfa-001',
            },
            {
              id: 'item-fat-02',
              billingId: 'fat-alfa-001',
              itemType: 'PRODUCT',
              productId: 'prd-alfa-01',
              description: 'Licença Enlace Cloud Enterprise (2 licenças anuais)',
              quantity: 2,
              unitPrice: 1500.0,
              discount: 0,
              surcharge: 0,
              total: 3000.0,
              sortOrder: 2,
              sourceType: 'SALE',
              sourceId: 'ven-alfa-001',
            },
          ],
        },
        {
          id: 'fat-alfa-002',
          instanceId: companyAlfa.schemaNamespace,
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          number: 'FAT-000002',
          status: 'ISSUED',
          sourceType: 'CONTRACT',
          sourceId: 'ctr-alfa-001',
          sourceNumber: 'CTR-000001',
          recurringBillingId: 'rec-bill-alfa-001',
          issueDate: new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0],
          competenceStart: '2026-08-01',
          competenceEnd: '2026-08-31',
          competenceLabel: '08/2026',
          dueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          subtotal: 8500.0,
          discount: 0,
          surcharge: 0,
          total: 8500.0,
          description: 'Mensalidade Recorrente Contrato CTR-000001 - Suporte e Sustentação 24x7',
          issuedAt: new Date(Date.now() - 35 * 86400000).toISOString(),
          issuedBy: 'Carlos Santos',
          createdBy: 'Carlos Santos',
          createdAt: new Date(Date.now() - 35 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          items: [
            {
              id: 'item-fat-03',
              billingId: 'fat-alfa-002',
              itemType: 'SERVICE',
              description: 'Sustentação Mensal Cloud 24x7 e Monitoramento Contínuo',
              quantity: 1,
              unitPrice: 8500.0,
              discount: 0,
              surcharge: 0,
              total: 8500.0,
              sortOrder: 1,
              sourceType: 'CONTRACT',
              sourceId: 'ctr-alfa-001',
            },
          ],
        },
        {
          id: 'fat-alfa-003',
          instanceId: companyAlfa.schemaNamespace,
          customerId: 'ptn-alfa-003',
          customerName: 'Juliana Paes de Camargo',
          customerDocument: '315.421.788-90',
          number: 'FAT-000003',
          status: 'PENDING',
          sourceType: 'MANUAL',
          issueDate: new Date().toISOString().split('T')[0],
          competenceStart: '2026-09-01',
          competenceEnd: '2026-09-30',
          competenceLabel: '09/2026',
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
          subtotal: 3200.0,
          discount: 0,
          surcharge: 0,
          total: 3200.0,
          description: 'Treinamento Técnico em Arquitetura de Microsserviços para Engenharia',
          createdBy: 'Carlos Santos',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-fat-04',
              billingId: 'fat-alfa-003',
              itemType: 'SERVICE',
              description: 'Workshop Hands-on: Clean Architecture & Multi-Tenancy (16h)',
              quantity: 1,
              unitPrice: 3200.0,
              discount: 0,
              surcharge: 0,
              total: 3200.0,
              sortOrder: 1,
              sourceType: 'MANUAL',
            },
          ],
        },
      ],
      recurringBillings: [
        {
          id: 'rec-bill-alfa-001',
          instanceId: companyAlfa.schemaNamespace,
          customerId: 'ptn-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          contractId: 'ctr-alfa-001',
          contractNumber: 'CTR-000001',
          status: 'ACTIVE',
          frequency: 'MONTHLY',
          startDate: '2026-01-01',
          nextBillingDate: '2026-09-10',
          dayOfMonth: 10,
          dueRule: 'FIXED_DAY',
          dueDays: 10,
          amount: 8500.0,
          description: 'Contrato Recorrente de Sustentação Cloud & SLA 99.99%',
          items: [
            {
              description: 'Sustentação Mensal Cloud 24x7 e Monitoramento Contínuo',
              itemType: 'SERVICE',
              quantity: 1,
              unitPrice: 8500.0,
              discount: 0,
              surcharge: 0,
              total: 8500.0,
            },
          ],
          lastGeneratedCompetence: '08/2026',
          lastGeneratedAt: new Date(Date.now() - 35 * 86400000).toISOString(),
          lastGeneratedBillingId: 'fat-alfa-002',
          lastGeneratedBillingNumber: 'FAT-000002',
          createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 35 * 86400000).toISOString(),
        },
      ],
      billingGenerationLogs: [
        {
          id: 'log-gen-alfa-001',
          instanceId: companyAlfa.schemaNamespace,
          recurringBillingId: 'rec-bill-alfa-001',
          competenceStart: '2026-08-01',
          competenceEnd: '2026-08-31',
          competenceLabel: '08/2026',
          billingId: 'fat-alfa-002',
          billingNumber: 'FAT-000002',
          status: 'SUCCESS',
          attemptCount: 1,
          executedAt: new Date(Date.now() - 35 * 86400000).toISOString(),
          workerId: 'scheduler-auto-01',
        },
      ],
      warehouses: [
        {
          id: 'wh-alfa-01',
          companyId: companyAlfa.id,
          code: 'ALM-01',
          name: 'Almoxarifado Central Matriz',
          description: 'Estoque principal de licenças, mídias e insumos corporativos',
          location: 'Matriz São Paulo - Galpão A',
          isDefault: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'wh-alfa-02',
          companyId: companyAlfa.id,
          code: 'DEP-02',
          name: 'Depósito Avançado Filial Campinas',
          description: 'Depósito para atendimento rápido regional e peças',
          location: 'Campinas - Setor Logístico',
          isDefault: false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      stockItems: [
        {
          id: 'stk-alfa-01',
          companyId: companyAlfa.id,
          warehouseId: 'wh-alfa-01',
          warehouseName: 'Almoxarifado Central Matriz',
          productId: 'prd-alfa-01',
          productCode: 'PRD-001',
          productName: 'Licença Enlace Cloud Enterprise',
          productUnit: 'LICENÇA',
          quantity: 150,
          reservedQuantity: 10,
          availableQuantity: 140,
          minQuantity: 30,
          maxQuantity: 500,
          averageCost: 350.0,
          lastCost: 350.0,
          totalValue: 52500.0,
          locationRack: 'Ala Digital / Servidor A1',
          updatedAt: new Date().toISOString(),
        },
      ],
      stockMovements: [
        {
          id: 'mov-alfa-01',
          companyId: companyAlfa.id,
          movementNumber: 'MOV-000001',
          movementType: 'INBOUND_PURCHASE',
          productId: 'prd-alfa-01',
          productCode: 'PRD-001',
          productName: 'Licença Enlace Cloud Enterprise',
          productUnit: 'LICENÇA',
          warehouseId: 'wh-alfa-01',
          warehouseName: 'Almoxarifado Central Matriz',
          quantity: 150,
          unitCost: 350.0,
          totalCost: 52500.0,
          previousStock: 0,
          currentStock: 150,
          previousAverageCost: 0,
          newAverageCost: 350.0,
          referenceType: 'PURCHASE',
          referenceDocument: 'NF-50123',
          notes: 'Aquisição inicial de lote de licenças corporativas.',
          createdById: 'usr-001',
          createdByName: 'Carlos Santos',
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        },
      ],
      fiscalOperations: [
        {
          id: 'fop-alfa-01',
          cfop: '5.102',
          description: 'Venda de mercadoria adquirida de terceiros (Operação interna)',
          type: 'OUTBOUND',
          applicableRegime: 'ALL',
          icmsCst: '102',
          icmsRate: 18.0,
          pisCst: '07',
          pisRate: 0.65,
          cofinsCst: '07',
          cofinsRate: 3.0,
          issRate: 0,
          isDefault: true,
        },
        {
          id: 'fop-alfa-02',
          cfop: '5.933',
          description: 'Prestação de serviço tributado pelo ISSQN (Municipal São Paulo)',
          type: 'OUTBOUND',
          applicableRegime: 'ALL',
          icmsCst: '00',
          icmsRate: 0,
          pisCst: '01',
          pisRate: 0.65,
          cofinsCst: '01',
          cofinsRate: 3.0,
          issRate: 5.0,
          isDefault: true,
        },
        {
          id: 'fop-alfa-03',
          cfop: '6.102',
          description: 'Venda de mercadoria adquirida de terceiros para outro Estado',
          type: 'OUTBOUND',
          applicableRegime: 'ALL',
          icmsCst: '102',
          icmsRate: 12.0,
          pisCst: '07',
          pisRate: 0.65,
          cofinsCst: '07',
          cofinsRate: 3.0,
          issRate: 0,
        },
        {
          id: 'fop-alfa-04',
          cfop: '1.102',
          description: 'Compra para comercialização (Entrada de mercadorias)',
          type: 'INBOUND',
          applicableRegime: 'ALL',
          icmsCst: '102',
          icmsRate: 18.0,
          pisCst: '50',
          pisRate: 0.65,
          cofinsCst: '50',
          cofinsRate: 3.0,
          issRate: 0,
        },
      ],
      fiscalDocuments: [
        {
          id: 'doc-alfa-01',
          companyId: companyAlfa.id,
          model: 'NFE_55',
          series: '1',
          number: 1001,
          accessKey: '35250912345678000195550010000010011849204821',
          issueDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
          issueTime: '14:22:10',
          type: 'OUTBOUND',
          status: 'AUTHORIZED',
          natureOfOperation: 'Venda de Mercadorias e Softwares',
          cfopPrincipal: '5.102',
          partnerId: 'part-alfa-01',
          partnerName: 'Tech Solutions Brasil Ltda',
          partnerCnpjCpf: '11.222.333/0001-81',
          partnerStateRegistration: '110.223.344.556',
          partnerEmail: 'fiscal@techsolutions.com.br',
          partnerAddress: {
            street: 'Av. Brigadeiro Faria Lima',
            number: '3477',
            neighborhood: 'Itaim Bibi',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '04538-133',
            ibgeCode: '3550308',
          },
          items: [
            {
              id: 'fitem-alfa-01',
              itemSequence: 1,
              productId: 'prd-alfa-01',
              productCode: 'PRD-001',
              productName: 'Licença Enlace Cloud Enterprise',
              ncm: '8523.49.90',
              cfop: '5.102',
              unit: 'LICENÇA',
              quantity: 10,
              unitPrice: 1450.0,
              totalPrice: 14500.0,
              discount: 0,
              netTotal: 14500.0,
              icmsCst: '102',
              icmsBase: 14500.0,
              icmsRate: 18.0,
              icmsValue: 2610.0,
              ipiCst: '99',
              ipiBase: 0,
              ipiRate: 0,
              ipiValue: 0,
              pisCst: '07',
              pisBase: 14500.0,
              pisRate: 0.65,
              pisValue: 94.25,
              cofinsCst: '07',
              cofinsBase: 14500.0,
              cofinsRate: 3.0,
              cofinsValue: 435.0,
              issBase: 0,
              issRate: 0,
              issValue: 0,
              issWithheld: false,
              approximateTaxes: 4567.5,
            },
          ],
          totalProducts: 14500.0,
          totalServices: 0,
          totalDiscounts: 0,
          totalFreight: 0,
          totalInsurance: 0,
          totalOtherExpenses: 0,
          totalTaxableAmount: 14500.0,
          totalICMS: 2610.0,
          totalIPI: 0,
          totalPIS: 94.25,
          totalCOFINS: 435.0,
          totalISS: 0,
          totalWithheldTaxes: 0,
          totalApproximateTaxes: 4567.5,
          netTotal: 14500.0,
          protocolNumber: '135250009182341',
          authorizedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          correctionLetters: [],
          billingDocumentId: 'bill-alfa-01',
          saleId: 'sal-alfa-01',
          additionalInfo: 'Documento fiscal emitido com sucesso em conformidade com o Manual de Orientação do Contribuinte v7.0.',
          createdById: 'usr-001',
          createdByName: 'Carlos Santos',
          createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        },
        {
          id: 'doc-alfa-02',
          companyId: companyAlfa.id,
          model: 'NFSE',
          series: '1',
          number: 501,
          accessKey: 'RPS-1-501-849201',
          issueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          issueTime: '10:15:00',
          type: 'OUTBOUND',
          status: 'AUTHORIZED',
          natureOfOperation: 'Prestação de Serviços de Implantação e Consultoria ERP',
          cfopPrincipal: '5.933',
          partnerId: 'part-alfa-02',
          partnerName: 'Logística Express Brasil S.A.',
          partnerCnpjCpf: '22.333.444/0001-92',
          partnerEmail: 'contabil@logexpress.com.br',
          partnerAddress: {
            street: 'Rua do Porto',
            number: '1200',
            neighborhood: 'Vila Leopoldina',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '05303-000',
            ibgeCode: '3550308',
          },
          items: [
            {
              id: 'fitem-alfa-02',
              itemSequence: 1,
              productCode: 'SRV-001',
              productName: 'Consultoria Especializada e Setup de Infraestrutura Cloud',
              ncm: '0000.00.00',
              cfop: '5.933',
              unit: 'SV',
              quantity: 1,
              unitPrice: 9800.0,
              totalPrice: 9800.0,
              discount: 0,
              netTotal: 9800.0,
              icmsCst: '00',
              icmsBase: 0,
              icmsRate: 0,
              icmsValue: 0,
              ipiCst: '99',
              ipiBase: 0,
              ipiRate: 0,
              ipiValue: 0,
              pisCst: '01',
              pisBase: 9800.0,
              pisRate: 0.65,
              pisValue: 63.7,
              cofinsCst: '01',
              cofinsBase: 9800.0,
              cofinsRate: 3.0,
              cofinsValue: 294.0,
              serviceCode: '01.07',
              issBase: 9800.0,
              issRate: 5.0,
              issValue: 490.0,
              issWithheld: false,
              approximateTaxes: 1318.1,
            },
          ],
          totalProducts: 0,
          totalServices: 9800.0,
          totalDiscounts: 0,
          totalFreight: 0,
          totalInsurance: 0,
          totalOtherExpenses: 0,
          totalTaxableAmount: 0,
          totalICMS: 0,
          totalIPI: 0,
          totalPIS: 63.7,
          totalCOFINS: 294.0,
          totalISS: 490.0,
          totalWithheldTaxes: 0,
          totalApproximateTaxes: 1318.1,
          netTotal: 9800.0,
          protocolNumber: 'NFSE-SP-2025-998811',
          authorizedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          correctionLetters: [],
          additionalInfo: 'NFS-e emitida segundo a legislação municipal do Município de São Paulo/SP. Tributação pelo ISSQN alíquota 5%.',
          createdById: 'usr-001',
          createdByName: 'Carlos Santos',
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
        {
          id: 'doc-alfa-03',
          companyId: companyAlfa.id,
          model: 'NFCE_65',
          series: '1',
          number: 2001,
          accessKey: '35250912345678000195650010000020011928374650',
          issueDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
          issueTime: '16:45:12',
          type: 'OUTBOUND',
          status: 'AUTHORIZED',
          natureOfOperation: 'Venda a Consumidor Final Presencial',
          cfopPrincipal: '5.102',
          partnerName: 'Consumidor Final Não Identificado',
          partnerCnpjCpf: '000.000.000-00',
          partnerAddress: {
            street: 'Av. Paulista',
            number: '1000',
            neighborhood: 'Bela Vista',
            city: 'São Paulo',
            state: 'SP',
            zipCode: '01310-100',
          },
          items: [
            {
              id: 'fitem-alfa-03',
              itemSequence: 1,
              productCode: 'ITM-ACC-01',
              productName: 'Token de Segurança Criptográfico USB FIPS-140',
              ncm: '8523.51.10',
              cfop: '5.102',
              unit: 'UN',
              quantity: 2,
              unitPrice: 190.0,
              totalPrice: 380.0,
              discount: 0,
              netTotal: 380.0,
              icmsCst: '102',
              icmsBase: 380.0,
              icmsRate: 18.0,
              icmsValue: 68.4,
              ipiCst: '99',
              ipiBase: 0,
              ipiRate: 0,
              ipiValue: 0,
              pisCst: '07',
              pisBase: 380.0,
              pisRate: 0.65,
              pisValue: 2.47,
              cofinsCst: '07',
              cofinsBase: 380.0,
              cofinsRate: 3.0,
              cofinsValue: 11.4,
              issBase: 0,
              issRate: 0,
              issValue: 0,
              issWithheld: false,
              approximateTaxes: 119.7,
            },
          ],
          totalProducts: 380.0,
          totalServices: 0,
          totalDiscounts: 0,
          totalFreight: 0,
          totalInsurance: 0,
          totalOtherExpenses: 0,
          totalTaxableAmount: 380.0,
          totalICMS: 68.4,
          totalIPI: 0,
          totalPIS: 2.47,
          totalCOFINS: 11.4,
          totalISS: 0,
          totalWithheldTaxes: 0,
          totalApproximateTaxes: 119.7,
          netTotal: 380.0,
          protocolNumber: '135250009918239',
          authorizedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          correctionLetters: [],
          additionalInfo: 'NFC-e emitida em contingência ou modo online com transmissão imediata ao consumidor.',
          createdById: 'usr-001',
          createdByName: 'Carlos Santos',
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
      ],
      fiscalInutilizations: [
        {
          id: 'inut-alfa-01',
          model: 'NFE_55',
          series: '1',
          startNumber: 995,
          endNumber: 999,
          year: 2025,
          justification: 'Inutilização por quebra de sequência decorrente de instabilidade técnica de rede local.',
          protocolNumber: 'INUT-SEFAZ-SP-2025-139091820',
          registeredAt: new Date(Date.now() - 15 * 86400000).toISOString(),
          registeredByName: 'Carlos Santos',
        },
      ],
      purchaseRequisitions: [
        {
          id: 'rc-alfa-001',
          number: 'RC-000001',
          requestedById: userCarlos.id,
          requestedByName: userCarlos.name,
          department: 'Operações e Manutenção Industrial',
          costCenterId: 'cc-alfa-01',
          costCenterName: 'Operações Industriais',
          priority: 'ALTA',
          status: 'APROVADA',
          neededByDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
          justification: 'Reposição de bobinas de aço galvanizado e fixadores para a linha de corte e montagem de gabinetes.',
          items: [
            {
              id: 'rc-item-01',
              productId: 'prd-alfa-01',
              productCode: 'PRD-ALFA-01',
              productName: 'Aço Laminado Galvanizado 1.2mm (Bobina)',
              quantity: 10,
              unit: 'UN',
              estimatedUnitPrice: 1850.0,
              estimatedTotalPrice: 18500.0,
            },
            {
              id: 'rc-item-02',
              productId: 'prd-alfa-02',
              productCode: 'PRD-ALFA-02',
              productName: 'Kit Fixadores e Parafusos Sextavados Inox',
              quantity: 50,
              unit: 'UN',
              estimatedUnitPrice: 45.0,
              estimatedTotalPrice: 2250.0,
            },
          ],
          totalEstimated: 20750.0,
          approvedById: userCarlos.id,
          approvedByName: userCarlos.name,
          approvedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        },
        {
          id: 'rc-alfa-002',
          number: 'RC-000002',
          requestedById: userCarlos.id,
          requestedByName: userCarlos.name,
          department: 'TI & Infraestrutura Corporativa',
          costCenterId: 'cc-alfa-02',
          costCenterName: 'Administração Geral',
          priority: 'MEDIA',
          status: 'EM_COTACAO',
          neededByDate: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
          justification: 'Aquisição de Monitores Profissionais 27" 4K para a nova equipe de engenharia e projetos.',
          items: [
            {
              id: 'rc-item-03',
              productCode: 'MON-4K-27',
              productName: 'Monitor Profissional 27" IPS 4K HDR',
              quantity: 8,
              unit: 'UN',
              estimatedUnitPrice: 2400.0,
              estimatedTotalPrice: 19200.0,
            },
          ],
          totalEstimated: 19200.0,
          approvedById: userCarlos.id,
          approvedByName: userCarlos.name,
          approvedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
      ],
      purchaseQuotations: [
        {
          id: 'cot-alfa-001',
          number: 'COT-000001',
          title: 'Cotação de Aço Galvanizado e Fixadores Industriais',
          requisitionIds: ['rc-alfa-001'],
          status: 'HOMOLOGADA',
          deadlineDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          items: [
            {
              id: 'cot-item-01',
              productId: 'prd-alfa-01',
              productCode: 'PRD-ALFA-01',
              productName: 'Aço Laminado Galvanizado 1.2mm (Bobina)',
              quantity: 10,
              unit: 'UN',
              targetPrice: 1800.0,
            },
            {
              id: 'cot-item-02',
              productId: 'prd-alfa-02',
              productCode: 'PRD-ALFA-02',
              productName: 'Kit Fixadores e Parafusos Sextavados Inox',
              quantity: 50,
              unit: 'UN',
              targetPrice: 40.0,
            },
          ],
          proposals: [
            {
              id: 'prop-01',
              supplierId: 'ptn-alfa-002',
              supplierName: 'Gerdau Aços Brasil S.A.',
              supplierDocument: '33.611.500/0001-19',
              deliveryDays: 7,
              freightType: 'FOB',
              paymentTerm: '30 dias direto boleto',
              items: [
                {
                  itemId: 'cot-item-01',
                  productName: 'Aço Laminado Galvanizado 1.2mm (Bobina)',
                  unitPrice: 1750.0,
                  quantity: 10,
                  unit: 'UN',
                  discountPercentage: 0,
                  icmsPercentage: 18,
                  ipiPercentage: 5,
                  freightAmount: 300.0,
                  totalPrice: 17500.0,
                  deliveryDays: 7,
                  isWinning: true,
                },
                {
                  itemId: 'cot-item-02',
                  productName: 'Kit Fixadores e Parafusos Sextavados Inox',
                  unitPrice: 38.0,
                  quantity: 50,
                  unit: 'UN',
                  discountPercentage: 0,
                  icmsPercentage: 18,
                  ipiPercentage: 5,
                  freightAmount: 50.0,
                  totalPrice: 1900.0,
                  deliveryDays: 7,
                  isWinning: true,
                },
              ],
              subtotal: 19400.0,
              freightTotal: 350.0,
              discountTotal: 0,
              grandTotal: 19750.0,
              notes: 'Entrega rápida com laudo de qualidade e certificado de conformidade da usina.',
              submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
              isOverallWinner: true,
            },
            {
              id: 'prop-02',
              supplierId: 'ptn-alfa-003-csn',
              supplierName: 'Companhia Siderúrgica Nacional (CSN)',
              supplierDocument: '33.042.730/0001-04',
              deliveryDays: 14,
              freightType: 'FOB',
              paymentTerm: '28 dias DDL',
              items: [
                {
                  itemId: 'cot-item-01',
                  productName: 'Aço Laminado Galvanizado 1.2mm (Bobina)',
                  unitPrice: 1820.0,
                  quantity: 10,
                  unit: 'UN',
                  discountPercentage: 0,
                  icmsPercentage: 18,
                  ipiPercentage: 5,
                  freightAmount: 500.0,
                  totalPrice: 18200.0,
                  deliveryDays: 14,
                  isWinning: false,
                },
                {
                  itemId: 'cot-item-02',
                  productName: 'Kit Fixadores e Parafusos Sextavados Inox',
                  unitPrice: 42.0,
                  quantity: 50,
                  unit: 'UN',
                  discountPercentage: 0,
                  icmsPercentage: 18,
                  ipiPercentage: 5,
                  freightAmount: 100.0,
                  totalPrice: 2100.0,
                  deliveryDays: 14,
                  isWinning: false,
                },
              ],
              subtotal: 20300.0,
              freightTotal: 600.0,
              discountTotal: 0,
              grandTotal: 20900.0,
              notes: 'Prazo estendido em função da escala de laminação.',
              submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
              isOverallWinner: false,
            },
          ],
          winningSupplierId: 'ptn-alfa-002',
          winningSupplierName: 'Gerdau Aços Brasil S.A.',
          totalWinningAmount: 19750.0,
          savingsAmount: 1150.0,
          savingsPercentage: 5.5,
          homologatedById: userCarlos.id,
          homologatedByName: userCarlos.name,
          homologatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          createdById: userCarlos.id,
          createdByName: userCarlos.name,
          createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
      ],
      purchaseOrders: [
        {
          id: 'pc-alfa-001',
          number: 'PC-000001',
          supplierId: 'ptn-alfa-002',
          supplierName: 'Gerdau Aços Brasil S.A.',
          supplierDocument: '33.611.500/0001-19',
          supplierContact: 'vendas.corporativo@gerdau.com.br - (11) 3094-6600',
          quotationId: 'cot-alfa-001',
          requisitionId: 'rc-alfa-001',
          status: 'EMITIDO_AO_FORNECEDOR',
          paymentTerm: '30 dias direto boleto',
          paymentMethod: 'BOLETO',
          expectedDeliveryDate: new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0],
          deliveryAddress: 'Rodovia dos Bandeirantes, km 42 - Distrito Industrial, Jundiaí/SP',
          warehouseId: 'wh-alfa-01',
          warehouseName: 'Almoxarifado Principal - Matriz',
          costCenterId: 'cc-alfa-01',
          costCenterName: 'Operações Industriais',
          subtotal: 19400.0,
          discountTotal: 0,
          freightTotal: 350.0,
          taxesTotal: 970.0,
          grandTotal: 20720.0,
          items: [
            {
              id: 'pc-item-01',
              productId: 'prd-alfa-01',
              productCode: 'PRD-ALFA-01',
              productName: 'Aço Laminado Galvanizado 1.2mm (Bobina)',
              quantity: 10,
              quantityReceived: 0,
              unit: 'UN',
              unitPrice: 1750.0,
              discountAmount: 0,
              aliquotIPI: 5,
              aliquotICMS: 18,
              totalAmount: 17500.0,
            },
            {
              id: 'pc-item-02',
              productId: 'prd-alfa-02',
              productCode: 'PRD-ALFA-02',
              productName: 'Kit Fixadores e Parafusos Sextavados Inox',
              quantity: 50,
              quantityReceived: 0,
              unit: 'UN',
              unitPrice: 38.0,
              discountAmount: 0,
              aliquotIPI: 5,
              aliquotICMS: 18,
              totalAmount: 1900.0,
            },
          ],
          notes: 'Faturar contra CNPJ 12.345.678/0001-95 com menção obrigatória ao Pedido PC-000001.',
          approvedById: userCarlos.id,
          approvedByName: userCarlos.name,
          approvedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          issuedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          createdById: userCarlos.id,
          createdByName: userCarlos.name,
          createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
      ],
      inboundInvoices: [
        {
          id: 'inb-alfa-001',
          accessKey: '35260933611500000119550010000045821098765432',
          number: '4582',
          series: '1',
          issueDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
          entryDate: new Date().toISOString().split('T')[0],
          supplierId: 'ptn-alfa-002',
          supplierName: 'Gerdau Aços Brasil S.A.',
          supplierDocument: '33.611.500/0001-19',
          supplierStateRegistration: '112.345.678.900',
          purchaseOrderId: 'pc-alfa-001',
          purchaseOrderNumber: 'PC-000001',
          warehouseId: 'wh-alfa-01',
          warehouseName: 'Almoxarifado Principal - Matriz',
          totalProducts: 9250.0,
          totalFreight: 0,
          totalInsurance: 0,
          totalDiscount: 0,
          totalIPI: 462.5,
          totalICMS: 1665.0,
          totalPIS: 152.62,
          totalCOFINS: 703.0,
          netTotal: 9712.5,
          status: 'IMPORTADA',
          items: [
            {
              id: 'inb-item-01',
              productCodeSupplier: 'PROD-IND-100',
              productName: 'Aço Laminado Galvanizado 1.2mm x 1200mm (Bobina)',
              internalProductId: 'prd-alfa-01',
              internalProductCode: 'PRD-ALFA-01',
              ncm: '72104910',
              cfop: '1101',
              unit: 'UN',
              quantity: 5,
              unitPrice: 1850.0,
              totalAmount: 9250.0,
              discountAmount: 0,
              icmsAmount: 1665.0,
              ipiAmount: 462.5,
              pisAmount: 152.62,
              cofinsAmount: 703.0,
              batchNumber: 'LOTE-GERDAU-2026-A1',
            },
          ],
          installments: [
            {
              id: 'inb-inst-01',
              number: '001',
              dueDate: new Date(Date.now() + 29 * 86400000).toISOString().split('T')[0],
              amount: 9712.5,
            },
          ],
          xmlRaw: '',
          createdById: userCarlos.id,
          createdByName: userCarlos.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      bankSlips: [
        {
          id: 'bs-alfa-001',
          ourNumber: '00000000001',
          documentNumber: 'REC-000001',
          barcode: '34191100000001250000109000000000010001234500',
          digitableLine: '34191.09008 00000.000104 00012.345005 1 10000000125000',
          bankCode: '341',
          bankName: 'Banco Itaú Unibanco S.A.',
          agency: '1234',
          account: '12345-6',
          wallet: '109',
          payerName: 'Petróleo Brasileiro S.A. - Petrobras',
          payerDocument: '33.000.167/0001-01',
          payerAddress: 'Av. República do Chile, 65 - Centro, Rio de Janeiro - RJ',
          beneficiaryName: companyAlfa.legalName,
          beneficiaryDocument: companyAlfa.cnpj,
          issueDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 25 * 86400000).toISOString().split('T')[0],
          amount: 12500.0,
          finePercent: 2.0,
          interestMonthlyPercent: 1.0,
          status: 'REGISTERED',
          accountReceivableId: 'rec-alfa-001',
          instructions: [
            'NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO.',
            'APÓS O VENCIMENTO COBRAR MULTA DE 2,0% E JUROS DE 1,0% AO MÊS.',
          ],
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
      ],
      pixCharges: [
        {
          id: 'pix-alfa-001',
          txid: 'ALFA20260901PIX001',
          accountReceivableId: 'rec-alfa-001',
          customerName: 'Petróleo Brasileiro S.A. - Petrobras',
          customerDocument: '33.000.167/0001-01',
          description: 'Pagamento Fatura REC-000001',
          amount: 12500.0,
          keyType: 'CNPJ',
          key: companyAlfa.cleanCnpj,
          emvPayload: PixEngine.generatePixPayload({
            key: companyAlfa.cleanCnpj,
            amount: 12500.0,
            merchantName: companyAlfa.legalName,
            merchantCity: 'SAO PAULO',
            txid: 'ALFA20260901PIX001',
            description: 'Fatura REC-000001',
          }),
          qrCodeSvg: PixEngine.generateQrCodeSvg('ALFA20260901PIX001'),
          status: 'ACTIVE',
          expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        },
      ],
      cnabFiles: [],
      dunningRules: [
        {
          id: 'dun-01',
          name: 'Aviso Preventivo de Vencimento',
          triggerDays: -3,
          channel: 'EMAIL',
          templateSubject: 'Lembrete de Vencimento de Fatura - Alfa Soluções',
          templateBody: 'Prezado cliente, lembramos que sua fatura no valor vence em breve. Segue anexa a 2ª via.',
          includePix: true,
          includeBoleto: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'dun-02',
          name: 'Cobrança no Dia do Vencimento',
          triggerDays: 0,
          channel: 'WHATSAPP',
          templateSubject: 'Sua fatura vence hoje!',
          templateBody: 'Olá! Sua fatura vence hoje. Utilize o código Pix Copia e Cola para pagamento imediato.',
          includePix: true,
          includeBoleto: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'dun-03',
          name: 'Aviso de Atraso e Encargos (D+3)',
          triggerDays: 3,
          channel: 'EMAIL',
          templateSubject: 'Aviso de Pendência Financeira - Fatura em Atraso',
          templateBody: 'Constatamos que a sua fatura ainda não foi liquidada. Por favor, regularize para evitar encargos.',
          includePix: true,
          includeBoleto: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    this.provisionTenantSchema(companyBeta.schemaNamespace, {
      settings: {
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
        documentRetentionDays: 1825,
        updatedAt: new Date().toISOString(),
      },
      auditLogs: [],
      modulesConfig: {
        inventory: true,
        sales: true,
        customers: true,
        purchasing: true,
        contracts: false,
        billing: true,
        banking: true,
        collections: true,
      },
      records: [
        {
          id: 'rec-beta-001',
          title: 'Lote de Importação de Componentes - Exclusivo Beta S/A',
          secretData: 'Dados Estratégicos de Margem de Venda da Beta (CNPJ 98.765.432/0001-10)',
          createdAt: new Date().toISOString(),
        },
      ],
      partners: [
        {
          id: 'ptn-beta-001',
          personType: 'PJ',
          document: '47960950000121',
          formattedDocument: '47.960.950/0001-21',
          roles: ['CLIENTE'],
          name: 'Magazine Luiza S.A.',
          tradeName: 'Magalu Empresas',
          stateRegistration: '310.098.765.432',
          email: 'b2b@magazineluiza.com.br',
          phone: '(16) 3711-2000',
          address: {
            zipCode: '14400-660',
            street: 'Rua Arnulfo de Lima',
            number: '2385',
            neighborhood: 'Vila Santa Cruz',
            city: 'Franca',
            state: 'SP',
            ibgeCode: '3516200',
          },
          creditLimit: 300000,
          paymentTermsDays: 45,
          status: 'ATIVO',
          notes: 'Cliente varejista para distribuição de produtos.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'ptn-beta-002',
          personType: 'PJ',
          document: '72381189000110',
          formattedDocument: '72.381.189/0001-10',
          roles: ['FORNECEDOR'],
          name: 'Dell Computadores do Brasil Ltda',
          tradeName: 'Dell Brasil',
          stateRegistration: '096.345.678.901',
          email: 'compras@dell.com.br',
          phone: '(51) 3274-5000',
          address: {
            zipCode: '92990-000',
            street: 'Avenida Industrial Belgraf',
            number: '400',
            neighborhood: 'Parque Eldorado',
            city: 'Eldorado do Sul',
            state: 'RS',
            ibgeCode: '4306932',
          },
          creditLimit: 250000,
          paymentTermsDays: 30,
          status: 'ATIVO',
          notes: 'Fornecedor de servidores e estações de trabalho.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      chartOfAccounts: [
        { id: 'coa-beta-01', code: '1.0.0.00', name: 'ATIVO TOTAL', category: 'ATIVO', type: 'SINTETICA', nature: 'DEVEDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-beta-02', code: '1.1.0.00', name: 'Ativo Circulante', category: 'ATIVO', type: 'SINTETICA', nature: 'DEVEDORA', level: 2, parentId: 'coa-beta-01', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-beta-03', code: '1.1.1.00', name: 'Disponibilidades', category: 'ATIVO', type: 'ANALITICA', nature: 'DEVEDORA', level: 3, parentId: 'coa-beta-02', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-beta-04', code: '1.1.3.00', name: 'Estoques de Mercadorias para Revenda', category: 'ATIVO', type: 'ANALITICA', nature: 'DEVEDORA', level: 3, parentId: 'coa-beta-02', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-beta-05', code: '2.0.0.00', name: 'PASSIVO TOTAL', category: 'PASSIVO', type: 'SINTETICA', nature: 'CREDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'coa-beta-06', code: '4.0.0.00', name: 'RECEITAS DE VENDAS', category: 'RECEITA', type: 'ANALITICA', nature: 'CREDORA', level: 1, status: 'ATIVO', createdAt: new Date().toISOString() },
      ],
      costCenters: [
        { id: 'cc-beta-01', code: '01.00', name: 'Armazém & Centro de Distribuição', responsible: 'Mariana Lima', status: 'ATIVO', createdAt: new Date().toISOString() },
        { id: 'cc-beta-02', code: '02.00', name: 'Vendas & Atendimento Comercial', responsible: 'Lucas Prado', status: 'ATIVO', createdAt: new Date().toISOString() },
      ],
      products: [
        {
          id: 'prd-beta-01',
          code: 'PRD-001',
          name: 'Servidor Rack Dell PowerEdge R650',
          type: 'PRODUCT',
          description: 'Servidor 1U de alta densidade para virtualização e processamento massivo.',
          unit: 'UN',
          unitPrice: 28900.0,
          costPrice: 19500.0,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'srv-beta-01',
          code: 'SRV-001',
          name: 'Instalação, Cabeamento e Montagem de Data Center',
          type: 'SERVICE',
          description: 'Serviço de montagem em rack e certificação de cabeamento Cat6A.',
          unit: 'HORA',
          unitPrice: 200.0,
          costPrice: 90.0,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      quotes: [
        {
          id: 'orc-beta-001',
          number: 'ORC-000001',
          customerId: 'ptn-beta-001',
          customerName: 'Magazine Luiza S.A.',
          customerDocument: '47.960.950/0001-21',
          status: 'DRAFT',
          issueDate: new Date().toISOString().split('T')[0],
          validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          description: 'Fornecimento de infraestrutura de servidores para armazém central',
          subtotal: 57800.0,
          discount: 2000.0,
          surcharge: 0,
          total: 55800.0,
          createdBy: 'Mariana Lima',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-orc-b01',
              quoteId: 'orc-beta-001',
              itemType: 'PRODUCT',
              productId: 'prd-beta-01',
              description: 'Servidor Rack Dell PowerEdge R650 (2 unidades)',
              quantity: 2,
              unitPrice: 28900.0,
              discount: 0,
              surcharge: 0,
              total: 57800.0,
              sortOrder: 1,
            },
          ],
        },
      ],
      sales: [
        {
          id: 'ven-beta-001',
          number: 'VEN-000001',
          customerId: 'ptn-beta-001',
          customerName: 'Magazine Luiza S.A.',
          customerDocument: '47.960.950/0001-21',
          status: 'IN_PROGRESS',
          saleDate: new Date().toISOString().split('T')[0],
          sourceType: 'MANUAL',
          subtotal: 28900.0,
          discount: 0,
          surcharge: 0,
          total: 28900.0,
          createdBy: 'Mariana Lima',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-ven-b01',
              saleId: 'ven-beta-001',
              itemType: 'PRODUCT',
              productId: 'prd-beta-01',
              description: 'Servidor Rack Dell PowerEdge R650',
              quantity: 1,
              unitPrice: 28900.0,
              discount: 0,
              surcharge: 0,
              total: 28900.0,
              sortOrder: 1,
            },
          ],
        },
      ],
      contracts: [
        {
          id: 'ctr-beta-001',
          number: 'CTR-000001',
          customerId: 'ptn-beta-001',
          customerName: 'Magazine Luiza S.A.',
          customerDocument: '47.960.950/0001-21',
          title: 'Contrato de Locação e Manutenção Preventiva de Servidores',
          description: 'SLA de reposição de peças em 4 horas para a matriz Franca/SP.',
          status: 'ACTIVE',
          startDate: '2026-02-01',
          renewalType: 'AUTOMATIC',
          billingFrequency: 'MENSAL',
          value: 12000.0,
          createdBy: 'Mariana Lima',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [],
        },
      ],
      serviceOrders: [
        {
          id: 'os-beta-001',
          number: 'OS-000001',
          customerId: 'ptn-beta-001',
          customerName: 'Magazine Luiza S.A.',
          customerDocument: '47.960.950/0001-21',
          title: 'Entrega Técnica e Instalação em Rack dos Servidores',
          description: 'Instalação física nos racks 04 e 05 do Data Center Franca.',
          status: 'OPEN',
          priority: 'URGENT',
          sourceType: 'SALE',
          sourceId: 'ven-beta-001',
          createdBy: 'Mariana Lima',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [],
          assignments: [],
          events: [
            {
              id: 'evt-b01',
              serviceOrderId: 'os-beta-001',
              eventType: 'OS_CREATED',
              description: 'Ordem de serviço criada com prioridade urgente.',
              createdBy: 'Mariana Lima',
              createdAt: new Date().toISOString(),
            },
          ],
          comments: [],
        },
      ],
      sequentialCounters: {
        quote: 1,
        sale: 1,
        contract: 1,
        serviceOrder: 1,
        receivable: 1,
        payable: 1,
        billing: 0,
        inventoryMovement: 1,
        warehouse: 1,
        fiscalNFe: 0,
        fiscalNFSe: 0,
        fiscalNFCe: 0,
        purchaseRequisition: 0,
        purchaseQuotation: 0,
        purchaseOrder: 0,
        inboundInvoice: 0,
        bankSlip: 0,
        cnabRemessa: 0,
      },
      accountsReceivable: [
        {
          id: 'rec-beta-001',
          number: 'REC-000001',
          customerId: 'ptn-beta-001',
          customerName: 'Magazine Luiza S.A.',
          customerDocument: '47.960.950/0001-21',
          chartOfAccountId: 'coa-beta-04',
          chartOfAccountCode: '1.1.2.01',
          costCenterId: 'cc-beta-01',
          costCenterCode: 'CC-01',
          description: 'Fornecimento de Lotes e Insumos Eletrônicos',
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
          originalValue: 8400.0,
          fineRate: 2.0,
          interestRate: 1.0,
          discountValue: 0,
          fineValue: 0,
          interestValue: 0,
          paidValue: 0,
          balanceValue: 8400.0,
          status: 'OPEN',
          notes: 'Duplicata mercantil Beta S/A.',
          createdBy: 'Mariana Lima',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      accountsPayable: [
        {
          id: 'pag-beta-001',
          number: 'PAG-000001',
          supplierId: 'ptn-beta-002',
          supplierName: 'Gerdau Aços Longos S.A.',
          supplierDocument: '07.358.761/0001-69',
          chartOfAccountId: 'coa-beta-06',
          chartOfAccountCode: '2.1.2.01',
          costCenterId: 'cc-beta-01',
          costCenterCode: 'CC-01',
          description: 'Matéria-prima e Perfis Metálicos Estruturais',
          issueDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 12 * 86400000).toISOString().split('T')[0],
          originalValue: 3200.0,
          discountValue: 0,
          fineValue: 0,
          interestValue: 0,
          paidValue: 0,
          balanceValue: 3200.0,
          status: 'OPEN',
          notes: 'Pedido de compra aprovado por Mariana.',
          createdBy: 'Mariana Lima',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      bankAccounts: [
        {
          id: 'bco-beta-01',
          name: 'Nu Pagamentos S.A. (Nubank PJ Beta)',
          bankCode: '260',
          agency: '0001',
          accountNumber: '11223-4',
          accountType: 'CHECKING',
          currentBalance: 42100.0,
          initialBalance: 30000.0,
          color: '#820ad1',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      bankTransactions: [
        {
          id: 'txn-beta-001',
          bankAccountId: 'bco-beta-01',
          type: 'DEBIT',
          amount: 1200.0,
          date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
          description: 'PAGAMENTO PIX ENERGIA ELETRICA',
          category: 'Despesas Operacionais',
          reconciled: true,
          reconciledAt: new Date(Date.now() - 1 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
      ],
      billingDocuments: [],
      recurringBillings: [],
      billingGenerationLogs: [],
      warehouses: [
        {
          id: 'wh-beta-01',
          companyId: companyBeta.id,
          code: 'DEP-01',
          name: 'Centro de Distribuição Principal Beta',
          description: 'Armazenamento de equipamentos de rede, servidores e peças de reposição',
          location: 'CD Curitiba - Galpão 03',
          isDefault: true,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      stockItems: [
        {
          id: 'stk-beta-01',
          companyId: companyBeta.id,
          warehouseId: 'wh-beta-01',
          warehouseName: 'Centro de Distribuição Principal Beta',
          productId: 'prd-beta-01',
          productCode: 'PRD-001',
          productName: 'Servidor Rack Dell PowerEdge R650',
          productUnit: 'UN',
          quantity: 24,
          reservedQuantity: 2,
          availableQuantity: 22,
          minQuantity: 5,
          maxQuantity: 50,
          averageCost: 19500.0,
          lastCost: 19500.0,
          totalValue: 468000.0,
          locationRack: 'Corredor B / Rack 04',
          updatedAt: new Date().toISOString(),
        },
      ],
      stockMovements: [
        {
          id: 'mov-beta-01',
          companyId: companyBeta.id,
          movementNumber: 'MOV-000001',
          movementType: 'INBOUND_PURCHASE',
          productId: 'prd-beta-01',
          productCode: 'PRD-001',
          productName: 'Servidor Rack Dell PowerEdge R650',
          productUnit: 'UN',
          warehouseId: 'wh-beta-01',
          warehouseName: 'Centro de Distribuição Principal Beta',
          quantity: 24,
          unitCost: 19500.0,
          totalCost: 468000.0,
          previousStock: 0,
          currentStock: 24,
          previousAverageCost: 0,
          newAverageCost: 19500.0,
          referenceType: 'PURCHASE',
          referenceDocument: 'NF-DELL-88910',
          notes: 'Remessa de importação de servidores para estoque do CD Curitiba.',
          createdById: 'usr-002',
          createdByName: 'Mariana Lima',
          createdAt: new Date(Date.now() - 40 * 86400000).toISOString(),
        },
      ],
      fiscalOperations: [],
      fiscalDocuments: [],
      fiscalInutilizations: [],
      purchaseRequisitions: [],
      purchaseQuotations: [],
      purchaseOrders: [],
      inboundInvoices: [],
      bankSlips: [],
      pixCharges: [],
      cnabFiles: [],
      dunningRules: [],
    });

    // 5. Convite inicial de exemplo para demonstração
    const sampleInvite: Invitation = {
      id: 'inv-sample-alfa-001',
      companyId: companyAlfa.id,
      companyName: companyAlfa.tradeName,
      email: 'novo.analista@alfa.com.br',
      role: 'operator',
      invitedByUserId: userCarlos.id,
      invitedByName: userCarlos.name,
      status: 'PENDING',
      token: 'inv-tok-999-sample-test-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.invitations.set(sampleInvite.id, sampleInvite);

    this.isInitialized = true;
    logger.info('[DatabaseEngine] Banco de dados inicializado com sucesso (PRD 01 & 02).');

    // Inicialização da infraestrutura PostgreSQL & Schemas dedicados de Tenant (PRD 01 - Seção 5)
    try {
      const isPgConnected = await PostgresService.initialize();
      if (isPgConnected) {
        for (const company of this.companies.values()) {
          await PostgresService.provisionTenantSchema(company.cleanCnpj);
        }
        await DatabaseSeeder.seed();
        logger.info('[DatabaseEngine] Conexão PostgreSQL ativa. Schemas isolados provisionados no banco de dados.');
      }

      // Inicializa o RepositoryManager oficial
      RepositoryManager.getInstance().initialize({
        users: this.users,
        companies: this.companies,
        memberships: this.memberships,
        sessions: this.sessions,
        refreshTokens: this.refreshTokens,
        securityEvents: this.securityEvents,
        getTenantStorage: (cnpj) => this.getTenantStorage(cnpj),
      });
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production' && process.env.STRICT_PRODUCTION_DB === 'true') {
        logger.error(`[DatabaseEngine] [FATAL] Falha de inicialização PostgreSQL em produção com STRICT_PRODUCTION_DB: ${err.message}`);
        throw err;
      }
      logger.warn(`[DatabaseEngine] Aviso na sincronização PostgreSQL: ${err.message}`);
    }
  }

  /**
   * Retorna o status da conexão PostgreSQL e configuração do Drizzle ORM
   */
  getPostgresStatus() {
    return PostgresService.getStatus();
  }

  // --- MÉTODOS DE USUÁRIOS E IDENTIDADE ---

  getUserByEmail(email: string): StoredUser | undefined {
    const cleanEmail = email.trim().toLowerCase();
    return Array.from(this.users.values()).find((u) => u.email.toLowerCase() === cleanEmail);
  }

  getUserById(id: string): StoredUser | undefined {
    return this.users.get(id);
  }

  getUserPublic(id: string): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;
    const { passwordHash: _, mfaSecret: __, recoveryCodes: ___, ...publicUser } = user;
    return publicUser;
  }

  updateUser(id: string, updates: Partial<StoredUser>): StoredUser | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;

    const updated: StoredUser = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updated);
    return updated;
  }

  recordLoginFailure(userId: string): { failedCount: number; isLocked: boolean } {
    const user = this.users.get(userId);
    if (!user) return { failedCount: 0, isLocked: false };

    user.failedLoginAttempts += 1;
    let isLocked = false;

    // Bloqueia a conta se exceder 5 tentativas consecutivas
    if (user.failedLoginAttempts >= 5) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos
      isLocked = true;
    }

    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
    return { failedCount: user.failedLoginAttempts, isLocked };
  }

  resetLoginFailures(userId: string) {
    const user = this.users.get(userId);
    if (!user) return;
    user.failedLoginAttempts = 0;
    user.lockoutUntil = undefined;
    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
    this.users.set(userId, user);
  }

  // --- MÉTODOS DE SESSÃO (PRD 02 - Seções 12, 13 e 14) ---

  createSession(session: UserSession): UserSession {
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  isSessionRevoked(sessionId: string): boolean {
    if (this.revokedSessionIds.has(sessionId)) return true;
    const session = this.sessions.get(sessionId);
    return session ? session.isRevoked : false;
  }

  listSessionsForUser(userId: string, currentSessionId?: string): UserSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.userId === userId && !s.isRevoked && !this.revokedSessionIds.has(s.id))
      .map((s) => ({
        ...s,
        isCurrent: s.id === currentSessionId,
      }))
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }

  revokeSession(sessionId: string): boolean {
    this.revokedSessionIds.add(sessionId);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isRevoked = true;
      this.sessions.set(sessionId, session);
    }

    // Revoga também refresh tokens atrelados a essa sessão
    for (const [id, rt] of this.refreshTokens.entries()) {
      if (rt.sessionId === sessionId) {
        rt.isRevoked = true;
        this.refreshTokens.set(id, rt);
      }
    }
    return true;
  }

  revokeAllSessionsForUser(userId: string, exceptSessionId?: string): number {
    let count = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.userId === userId && id !== exceptSessionId && !session.isRevoked) {
        session.isRevoked = true;
        this.sessions.set(id, session);
        this.revokedSessionIds.add(id);
        count++;
      }
    }

    // Revoga todos os refresh tokens
    for (const [id, rt] of this.refreshTokens.entries()) {
      if (rt.userId === userId && rt.sessionId !== exceptSessionId) {
        rt.isRevoked = true;
        this.refreshTokens.set(id, rt);
      }
    }

    return count;
  }

  // --- REFRESH TOKENS (PRD 02 - Seção 13) ---

  saveRefreshToken(token: RefreshToken) {
    this.refreshTokens.set(token.tokenHash, token);
  }

  getRefreshToken(tokenHash: string): RefreshToken | undefined {
    return this.refreshTokens.get(tokenHash);
  }

  markRefreshTokenUsed(tokenHash: string, replacedByHash: string) {
    const rt = this.refreshTokens.get(tokenHash);
    if (rt) {
      rt.isUsed = true;
      rt.replacedByTokenHash = replacedByHash;
      this.refreshTokens.set(tokenHash, rt);
    }
  }

  // --- CONVITES (PRD 02 - Seção 40) ---

  createInvitation(invitation: Invitation): Invitation {
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  listInvitationsForCompany(companyId: string): Invitation[] {
    return Array.from(this.invitations.values())
      .filter((inv) => inv.companyId === companyId && inv.status === 'PENDING')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getInvitationByToken(token: string): Invitation | undefined {
    return Array.from(this.invitations.values()).find((inv) => inv.token === token && inv.status === 'PENDING');
  }

  revokeInvitation(inviteId: string): boolean {
    const inv = this.invitations.get(inviteId);
    if (!inv) return false;
    inv.status = 'REVOKED';
    this.invitations.set(inviteId, inv);
    return true;
  }

  acceptInvitation(token: string, user: User): Membership | undefined {
    const inv = this.getInvitationByToken(token);
    if (!inv) return undefined;

    // Atualiza status do convite
    inv.status = 'ACCEPTED';
    this.invitations.set(inv.id, inv);

    // Cria nova membership ativa para a empresa
    const membership: Membership = {
      id: `mem-${crypto.randomUUID()}`,
      userId: user.id,
      companyId: inv.companyId,
      role: inv.role,
      permissions: ROLE_DEFAULT_PERMISSIONS[inv.role] || [],
      status: 'ACTIVE',
      isActive: true,
      invitedAt: inv.createdAt,
      acceptedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.memberships.set(membership.id, membership);
    return membership;
  }

  // --- RECUPERAÇÃO DE SENHA (PRD 02 - Seção 15) ---

  savePasswordReset(reset: PasswordResetToken) {
    this.passwordResets.set(reset.token, reset);
  }

  getPasswordReset(token: string): PasswordResetToken | undefined {
    const pr = this.passwordResets.get(token);
    if (!pr || pr.isUsed || new Date(pr.expiresAt).getTime() < Date.now()) {
      return undefined;
    }
    return pr;
  }

  consumePasswordReset(token: string) {
    const pr = this.passwordResets.get(token);
    if (pr) {
      pr.isUsed = true;
      this.passwordResets.set(token, pr);
    }
  }

  // --- EVENTOS DE SEGURANÇA (PRD 02 - Seção 29) ---

  appendSecurityEvent(event: SecurityEvent) {
    this.securityEvents.unshift(event);
    if (this.securityEvents.length > 500) {
      this.securityEvents.pop();
    }
  }

  listSecurityEvents(companyId?: string): SecurityEvent[] {
    if (companyId) {
      return this.securityEvents.filter((e) => !e.companyId || e.companyId === companyId);
    }
    return this.securityEvents;
  }

  // --- MÉTODOS DE EMPRESAS E MEMBROS ---

  getCompanyById(companyId: string): Company | undefined {
    return this.companies.get(companyId);
  }

  getCompanyByCnpj(cleanCnpj: string): Company | undefined {
    return Array.from(this.companies.values()).find((c) => c.cleanCnpj === cleanCnpj);
  }

  getCompanyBySchemaNamespace(schemaNamespace: string): Company | undefined {
    return Array.from(this.companies.values()).find((c) => c.schemaNamespace === schemaNamespace);
  }

  listCompaniesForUser(userId: string): Array<{ company: Company; membership: Membership }> {
    const userMemberships = Array.from(this.memberships.values()).filter(
      (m) => m.userId === userId && m.isActive && m.status === 'ACTIVE'
    );

    const result: Array<{ company: Company; membership: Membership }> = [];
    for (const mem of userMemberships) {
      const company = this.companies.get(mem.companyId);
      if (company && company.status === 'active') {
        result.push({ company, membership: mem });
      }
    }
    return result;
  }

  listMembersForCompany(companyId: string): Array<{ membership: Membership; user: User }> {
    const members: Array<{ membership: Membership; user: User }> = [];
    for (const mem of this.memberships.values()) {
      if (mem.companyId === companyId && mem.status !== 'REVOKED') {
        const user = this.getUserPublic(mem.userId);
        if (user) {
          members.push({ membership: mem, user });
        }
      }
    }
    return members;
  }

  getMembership(userId: string, companyId: string): Membership | undefined {
    return Array.from(this.memberships.values()).find(
      (m) => m.userId === userId && m.companyId === companyId && m.isActive && m.status === 'ACTIVE'
    );
  }

  getMembershipById(membershipId: string): Membership | undefined {
    return this.memberships.get(membershipId);
  }

  updateMembershipRole(membershipId: string, newRole: UserRole): Membership | undefined {
    const mem = this.memberships.get(membershipId);
    if (!mem) return undefined;

    mem.role = newRole;
    mem.permissions = ROLE_DEFAULT_PERMISSIONS[newRole] || [];
    mem.updatedAt = new Date().toISOString();
    this.memberships.set(membershipId, mem);
    return mem;
  }

  revokeMembership(membershipId: string): Membership | undefined {
    const mem = this.memberships.get(membershipId);
    if (!mem) return undefined;

    mem.status = 'REVOKED';
    mem.isActive = false;
    mem.revokedAt = new Date().toISOString();
    mem.updatedAt = new Date().toISOString();
    this.memberships.set(membershipId, mem);
    return mem;
  }

  // --- MÉTODOS DO TENANT SCHEMA ---

  provisionTenantSchema(schemaNamespace: string, initialData?: Partial<TenantStorage>) {
    if (!this.tenantSchemas.has(schemaNamespace)) {
      const storage: TenantStorage = (initialData as TenantStorage) || {
        settings: {
          timezone: 'America/Sao_Paulo',
          currency: 'BRL',
          documentRetentionDays: 1825,
          updatedAt: new Date().toISOString(),
        },
        auditLogs: [],
        modulesConfig: {},
        records: [],
        partners: [],
        chartOfAccounts: [],
        costCenters: [],
        products: [],
        quotes: [],
        sales: [],
        contracts: [],
        serviceOrders: [],
        sequentialCounters: {
          quote: 0,
          sale: 0,
          contract: 0,
          serviceOrder: 0,
          receivable: 0,
          payable: 0,
          billing: 0,
          inventoryMovement: 0,
          warehouse: 0,
          fiscalNFe: 0,
          fiscalNFSe: 0,
          fiscalNFCe: 0,
          purchaseRequisition: 0,
          purchaseQuotation: 0,
          purchaseOrder: 0,
          inboundInvoice: 0,
          bankSlip: 0,
          cnabRemessa: 0,
        },
        accountsReceivable: [],
        accountsPayable: [],
        bankAccounts: [],
        bankTransactions: [],
        billingDocuments: [],
        recurringBillings: [],
        billingGenerationLogs: [],
        warehouses: [],
        stockItems: [],
        stockMovements: [],
        fiscalDocuments: [],
        fiscalOperations: [],
        fiscalInutilizations: [],
        purchaseRequisitions: [],
        purchaseQuotations: [],
        purchaseOrders: [],
        inboundInvoices: [],
        bankSlips: [],
        pixCharges: [],
        cnabFiles: [],
        dunningRules: [],
        receivablesV2: [],
        collectionsV2: [],
        paymentsV2: [],
        paymentProvidersV2: [],
        webhookEventsV2: [],
      };

      if (!storage.products) storage.products = [];
      if (!storage.quotes) storage.quotes = [];
      if (!storage.sales) storage.sales = [];
      if (!storage.contracts) storage.contracts = [];
      if (!storage.serviceOrders) storage.serviceOrders = [];
      if (!storage.accountsReceivable) storage.accountsReceivable = [];
      if (!storage.accountsPayable) storage.accountsPayable = [];
      if (!storage.bankAccounts) storage.bankAccounts = [];
      if (!storage.bankTransactions) storage.bankTransactions = [];
      if (!storage.billingDocuments) storage.billingDocuments = [];
      if (!storage.recurringBillings) storage.recurringBillings = [];
      if (!storage.billingGenerationLogs) storage.billingGenerationLogs = [];
      if (!storage.warehouses) storage.warehouses = [];
      if (!storage.stockItems) storage.stockItems = [];
      if (!storage.stockMovements) storage.stockMovements = [];
      if (!storage.fiscalDocuments) storage.fiscalDocuments = [];
      if (!storage.fiscalOperations) storage.fiscalOperations = [];
      if (!storage.fiscalInutilizations) storage.fiscalInutilizations = [];
      if (!storage.purchaseRequisitions) storage.purchaseRequisitions = [];
      if (!storage.purchaseQuotations) storage.purchaseQuotations = [];
      if (!storage.purchaseOrders) storage.purchaseOrders = [];
      if (!storage.inboundInvoices) storage.inboundInvoices = [];
      if (!storage.bankSlips) storage.bankSlips = [];
      if (!storage.pixCharges) storage.pixCharges = [];
      if (!storage.cnabFiles) storage.cnabFiles = [];
      if (!storage.dunningRules) storage.dunningRules = [];
      if (!storage.receivablesV2) storage.receivablesV2 = [];
      if (!storage.collectionsV2) storage.collectionsV2 = [];
      if (!storage.paymentsV2) storage.paymentsV2 = [];
      if (!storage.paymentProvidersV2) storage.paymentProvidersV2 = [];
      if (!storage.webhookEventsV2) storage.webhookEventsV2 = [];
      if (!storage.sequentialCounters) {
        storage.sequentialCounters = {
          quote: 0,
          sale: 0,
          contract: 0,
          serviceOrder: 0,
          receivable: 0,
          payable: 0,
          billing: 0,
          inventoryMovement: 0,
          warehouse: 0,
          fiscalNFe: 0,
          fiscalNFSe: 0,
          fiscalNFCe: 0,
          purchaseRequisition: 0,
          purchaseQuotation: 0,
          purchaseOrder: 0,
          inboundInvoice: 0,
          bankSlip: 0,
          cnabRemessa: 0,
        };
      }
      if (storage.sequentialCounters.billing === undefined) {
        storage.sequentialCounters.billing = 0;
      }
      if (storage.sequentialCounters.inventoryMovement === undefined) {
        storage.sequentialCounters.inventoryMovement = 0;
      }
      if (storage.sequentialCounters.warehouse === undefined) {
        storage.sequentialCounters.warehouse = 0;
      }
      if (storage.sequentialCounters.fiscalNFe === undefined) {
        storage.sequentialCounters.fiscalNFe = 0;
      }
      if (storage.sequentialCounters.fiscalNFSe === undefined) {
        storage.sequentialCounters.fiscalNFSe = 0;
      }
      if (storage.sequentialCounters.fiscalNFCe === undefined) {
        storage.sequentialCounters.fiscalNFCe = 0;
      }
      if (storage.sequentialCounters.purchaseRequisition === undefined) {
        storage.sequentialCounters.purchaseRequisition = 0;
      }
      if (storage.sequentialCounters.purchaseQuotation === undefined) {
        storage.sequentialCounters.purchaseQuotation = 0;
      }
      if (storage.sequentialCounters.purchaseOrder === undefined) {
        storage.sequentialCounters.purchaseOrder = 0;
      }
      if (storage.sequentialCounters.inboundInvoice === undefined) {
        storage.sequentialCounters.inboundInvoice = 0;
      }
      if (storage.sequentialCounters.bankSlip === undefined) {
        storage.sequentialCounters.bankSlip = 0;
      }
      if (storage.sequentialCounters.cnabRemessa === undefined) {
        storage.sequentialCounters.cnabRemessa = 0;
      }

      this.tenantSchemas.set(schemaNamespace, storage);
      logger.info(`[DatabaseEngine] Schema [${schemaNamespace}] provisionado com sucesso.`);
    }
  }

  getTenantStorage(schemaNamespace: string): TenantStorage | undefined {
    const key = schemaNamespace.startsWith('tenant_') ? schemaNamespace : `tenant_${schemaNamespace}`;
    const storage = this.tenantSchemas.get(key) || this.tenantSchemas.get(schemaNamespace);
    if (storage) {
      if (!storage.products) storage.products = [];
      if (!storage.quotes) storage.quotes = [];
      if (!storage.sales) storage.sales = [];
      if (!storage.contracts) storage.contracts = [];
      if (!storage.serviceOrders) storage.serviceOrders = [];
      if (!storage.accountsReceivable) storage.accountsReceivable = [];
      if (!storage.accountsPayable) storage.accountsPayable = [];
      if (!storage.bankAccounts) storage.bankAccounts = [];
      if (!storage.bankTransactions) storage.bankTransactions = [];
      if (!storage.billingDocuments) storage.billingDocuments = [];
      if (!storage.recurringBillings) storage.recurringBillings = [];
      if (!storage.billingGenerationLogs) storage.billingGenerationLogs = [];
      if (!storage.warehouses) storage.warehouses = [];
      if (!storage.stockItems) storage.stockItems = [];
      if (!storage.stockMovements) storage.stockMovements = [];
      if (!storage.fiscalDocuments) storage.fiscalDocuments = [];
      if (!storage.fiscalOperations) storage.fiscalOperations = [];
      if (!storage.fiscalInutilizations) storage.fiscalInutilizations = [];
      if (!storage.purchaseRequisitions) storage.purchaseRequisitions = [];
      if (!storage.purchaseQuotations) storage.purchaseQuotations = [];
      if (!storage.purchaseOrders) storage.purchaseOrders = [];
      if (!storage.inboundInvoices) storage.inboundInvoices = [];
      if (!storage.bankSlips) storage.bankSlips = [];
      if (!storage.pixCharges) storage.pixCharges = [];
      if (!storage.cnabFiles) storage.cnabFiles = [];
      if (!storage.dunningRules) storage.dunningRules = [];
      if (!storage.receivablesV2) storage.receivablesV2 = [];
      if (!storage.collectionsV2) storage.collectionsV2 = [];
      if (!storage.paymentsV2) storage.paymentsV2 = [];
      if (!storage.paymentProvidersV2 || storage.paymentProvidersV2.length === 0) {
        storage.paymentProvidersV2 = [
          {
            id: `prov_default_${schemaNamespace}`,
            instanceId: schemaNamespace,
            name: 'Enlace Sandbox Pagamentos',
            providerType: 'ENLACE_SANDBOX',
            environment: 'SANDBOX',
            isActive: true,
            isDefault: true,
            supportedMethods: ['PIX', 'BOLETO', 'PAYMENT_LINK', 'MANUAL'],
            credentials: { apiKey: 'sbx_sec_enlace_2026' },
            maskedCredentials: { apiKey: 'sbx_sec_****_2026' },
            accountInfo: {
              pixKey: '33.000.167/0001-01',
              pixKeyType: 'CNPJ',
              bankCode: '001',
              bankName: 'Banco do Brasil',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      if (!storage.webhookEventsV2) storage.webhookEventsV2 = [];
      if (!storage.sequentialCounters) {
        storage.sequentialCounters = {
          quote: 0,
          sale: 0,
          contract: 0,
          serviceOrder: 0,
          receivable: 0,
          payable: 0,
          billing: 0,
          inventoryMovement: 0,
          warehouse: 0,
          fiscalNFe: 0,
          fiscalNFSe: 0,
          fiscalNFCe: 0,
          purchaseRequisition: 0,
          purchaseQuotation: 0,
          purchaseOrder: 0,
          inboundInvoice: 0,
          bankSlip: 0,
          cnabRemessa: 0,
        };
      }
      if (storage.sequentialCounters.billing === undefined) {
        storage.sequentialCounters.billing = 0;
      }
      if (storage.sequentialCounters.inventoryMovement === undefined) {
        storage.sequentialCounters.inventoryMovement = 0;
      }
      if (storage.sequentialCounters.warehouse === undefined) {
        storage.sequentialCounters.warehouse = 0;
      }
      if (storage.sequentialCounters.fiscalNFe === undefined) {
        storage.sequentialCounters.fiscalNFe = 0;
      }
      if (storage.sequentialCounters.fiscalNFSe === undefined) {
        storage.sequentialCounters.fiscalNFSe = 0;
      }
      if (storage.sequentialCounters.fiscalNFCe === undefined) {
        storage.sequentialCounters.fiscalNFCe = 0;
      }
      if (storage.sequentialCounters.purchaseRequisition === undefined) {
        storage.sequentialCounters.purchaseRequisition = 0;
      }
      if (storage.sequentialCounters.purchaseQuotation === undefined) {
        storage.sequentialCounters.purchaseQuotation = 0;
      }
      if (storage.sequentialCounters.purchaseOrder === undefined) {
        storage.sequentialCounters.purchaseOrder = 0;
      }
      if (storage.sequentialCounters.inboundInvoice === undefined) {
        storage.sequentialCounters.inboundInvoice = 0;
      }
      if (storage.sequentialCounters.bankSlip === undefined) {
        storage.sequentialCounters.bankSlip = 0;
      }
      if (storage.sequentialCounters.cnabRemessa === undefined) {
        storage.sequentialCounters.cnabRemessa = 0;
      }
    }
    return storage;
  }

  appendTenantAuditLog(schemaNamespace: string, entry: AuditLogEntry) {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (tenant) {
      tenant.auditLogs.unshift(entry);
      if (tenant.auditLogs.length > 500) {
        tenant.auditLogs.pop();
      }
    }
  }

  recordTenantAudit(
    schemaNamespace: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, unknown>,
    userId?: string
  ) {
    this.appendTenantAuditLog(schemaNamespace, {
      id: `aud-${crypto.randomUUID().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      userId: userId || null,
      userEmail: null,
      companyId: null,
      companyCnpj: null,
      schemaNamespace,
      action,
      resource,
      resourceId,
      status: 'SUCCESS',
      requestId: `req-${crypto.randomUUID().slice(0, 8)}`,
      details,
    });
  }

  listTenantAudits(schemaNamespace: string): AuditLogEntry[] {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    return tenant ? [...tenant.auditLogs] : [];
  }

  updateCompanyModule(companyId: string, moduleCode: string, isEnabled: boolean) {
    const company = this.companies.get(companyId);
    if (!company) return;

    const tenant = this.tenantSchemas.get(company.schemaNamespace);
    if (tenant) {
      tenant.modulesConfig[moduleCode] = isEnabled;
    }
  }

  // =======================================================
  // PRD 03: MÉTODOS DE PARCEIROS DE NEGÓCIO (ISOLADOS POR SCHEMA)
  // =======================================================

  listPartners(schemaNamespace: string, query?: { search?: string; role?: string; status?: string }): BusinessPartner[] {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return [];
    let list = [...(tenant.partners || [])];
    if (query?.role) {
      list = list.filter((p) => p.roles.includes(query.role as any));
    }
    if (query?.status) {
      list = list.filter((p) => p.status === query.status);
    }
    if (query?.search) {
      const s = query.search.toLowerCase().trim();
      const cleanS = cleanDocument(s);
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.tradeName && p.tradeName.toLowerCase().includes(s)) ||
          p.document.includes(cleanS.length > 0 ? cleanS : s) ||
          p.formattedDocument.toLowerCase().includes(s) ||
          p.email.toLowerCase().includes(s) ||
          p.address.city.toLowerCase().includes(s)
      );
    }
    return list;
  }

  getPartnerById(schemaNamespace: string, partnerId: string): BusinessPartner | undefined {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    return tenant?.partners.find((p) => p.id === partnerId);
  }

  createPartner(
    schemaNamespace: string,
    partnerData: Omit<BusinessPartner, 'id' | 'createdAt' | 'updatedAt' | 'formattedDocument'>
  ): BusinessPartner {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const clean = cleanDocument(partnerData.document);
    const newPartner: BusinessPartner = {
      ...partnerData,
      id: `ptn-${crypto.randomUUID()}`,
      document: clean,
      formattedDocument: formatDocument(clean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tenant.partners.unshift(newPartner);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().partners.create(cleanCnpj, newPartner).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de parceiro: ${err.message}`, {
          cleanCnpj,
          partnerId: newPartner.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return newPartner;
  }

  async createPartnerAsync(
    schemaNamespace: string,
    partnerData: Omit<BusinessPartner, 'id' | 'createdAt' | 'updatedAt' | 'formattedDocument'>
  ): Promise<BusinessPartner> {
    const partner = this.createPartner(schemaNamespace, partnerData);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().partners.create(cleanCnpj, partner);
    }
    return partner;
  }

  updatePartner(
    schemaNamespace: string,
    partnerId: string,
    updates: Partial<Omit<BusinessPartner, 'id' | 'createdAt' | 'updatedAt'>>
  ): BusinessPartner | undefined {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return undefined;

    const index = tenant.partners.findIndex((p) => p.id === partnerId);
    if (index === -1) return undefined;

    const current = tenant.partners[index];
    const clean = updates.document ? cleanDocument(updates.document) : current.document;

    const updated: BusinessPartner = {
      ...current,
      ...updates,
      id: current.id,
      document: clean,
      formattedDocument: formatDocument(clean),
      updatedAt: new Date().toISOString(),
    };

    tenant.partners[index] = updated;
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().partners.update(cleanCnpj, partnerId, updates).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de parceiro: ${err.message}`, {
          cleanCnpj,
          partnerId,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return updated;
  }

  async updatePartnerAsync(
    schemaNamespace: string,
    partnerId: string,
    updates: Partial<Omit<BusinessPartner, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<BusinessPartner | undefined> {
    const updated = this.updatePartner(schemaNamespace, partnerId, updates);
    if (updated && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().partners.update(cleanCnpj, partnerId, updates);
    }
    return updated;
  }

  deletePartner(schemaNamespace: string, partnerId: string): boolean {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return false;

    const index = tenant.partners.findIndex((p) => p.id === partnerId);
    if (index === -1) return false;

    tenant.partners.splice(index, 1);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().partners.delete(cleanCnpj, partnerId).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na exclusão PostgreSQL de parceiro: ${err.message}`, {
          cleanCnpj,
          partnerId,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return true;
  }

  async deletePartnerAsync(schemaNamespace: string, partnerId: string): Promise<boolean> {
    const deleted = this.deletePartner(schemaNamespace, partnerId);
    if (deleted && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().partners.delete(cleanCnpj, partnerId);
    }
    return deleted;
  }

  // =======================================================
  // PRD 03: MÉTODOS DO PLANO DE CONTAS (ISOLADOS POR SCHEMA)
  // =======================================================

  listChartOfAccounts(schemaNamespace: string): ChartOfAccount[] {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return [];
    return [...(tenant.chartOfAccounts || [])].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  }

  getChartOfAccountById(schemaNamespace: string, accountId: string): ChartOfAccount | undefined {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    return tenant?.chartOfAccounts.find((a) => a.id === accountId);
  }

  createChartOfAccount(
    schemaNamespace: string,
    accountData: Omit<ChartOfAccount, 'id' | 'createdAt'>
  ): ChartOfAccount {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const newAccount: ChartOfAccount = {
      ...accountData,
      id: `coa-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    tenant.chartOfAccounts.push(newAccount);
    tenant.chartOfAccounts.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    return newAccount;
  }

  updateChartOfAccount(
    schemaNamespace: string,
    accountId: string,
    updates: Partial<Omit<ChartOfAccount, 'id' | 'createdAt'>>
  ): ChartOfAccount | undefined {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return undefined;

    const index = tenant.chartOfAccounts.findIndex((a) => a.id === accountId);
    if (index === -1) return undefined;

    const current = tenant.chartOfAccounts[index];
    const updated: ChartOfAccount = {
      ...current,
      ...updates,
      id: current.id,
    };
    tenant.chartOfAccounts[index] = updated;
    tenant.chartOfAccounts.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    return updated;
  }

  deleteChartOfAccount(schemaNamespace: string, accountId: string): boolean {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return false;
    const initialLen = tenant.chartOfAccounts.length;
    tenant.chartOfAccounts = tenant.chartOfAccounts.filter((a) => a.id !== accountId);
    return tenant.chartOfAccounts.length < initialLen;
  }

  // =======================================================
  // PRD 03: MÉTODOS DE CENTROS DE CUSTO (ISOLADOS POR SCHEMA)
  // =======================================================

  listCostCenters(schemaNamespace: string): CostCenter[] {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return [];
    return [...(tenant.costCenters || [])].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  }

  createCostCenter(schemaNamespace: string, ccData: Omit<CostCenter, 'id' | 'createdAt'>): CostCenter {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const newCC: CostCenter = {
      ...ccData,
      id: `cc-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    tenant.costCenters.push(newCC);
    tenant.costCenters.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    return newCC;
  }

  updateCostCenter(
    schemaNamespace: string,
    ccId: string,
    updates: Partial<Omit<CostCenter, 'id' | 'createdAt'>>
  ): CostCenter | undefined {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return undefined;

    const index = tenant.costCenters.findIndex((c) => c.id === ccId);
    if (index === -1) return undefined;

    const current = tenant.costCenters[index];
    const updated: CostCenter = {
      ...current,
      ...updates,
      id: current.id,
    };
    tenant.costCenters[index] = updated;
    tenant.costCenters.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    return updated;
  }

  deleteCostCenter(schemaNamespace: string, ccId: string): boolean {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return false;
    const initialLen = tenant.costCenters.length;
    tenant.costCenters = tenant.costCenters.filter((c) => c.id !== ccId);
    return tenant.costCenters.length < initialLen;
  }

  // ==========================================================================
  // PRD 04: MOTOR SEQUENCIAL E OPERAÇÕES COMERCIAIS / OPERACIONAIS
  // ==========================================================================

  /**
   * Gera numeração sequencial atômica formatada por tenant (ORC-000001, VEN-000001, etc)
   */
  getNextSequentialNumber(
    schemaNamespace: string,
    type: 'quote' | 'sale' | 'contract' | 'serviceOrder'
  ): string {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    storage.sequentialCounters[type] += 1;
    const count = storage.sequentialCounters[type];
    const prefixMap = {
      quote: 'ORC',
      sale: 'VEN',
      contract: 'CTR',
      serviceOrder: 'OS',
    };
    return `${prefixMap[type]}-${String(count).padStart(6, '0')}`;
  }

  // --- CATÁLOGO DE PRODUTOS E SERVIÇOS ---

  listProducts(schemaNamespace: string): Product[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return [...storage.products].sort((a, b) => a.name.localeCompare(b.name));
  }

  getProductById(schemaNamespace: string, id: string): Product | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return storage.products.find((p) => p.id === id);
  }

  createProduct(
    schemaNamespace: string,
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Product {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const now = new Date().toISOString();
    const product: Product = {
      ...data,
      id: `prd-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    };
    storage.products.push(product);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().products.create(cleanCnpj, product).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de produto: ${err.message}`, {
          cleanCnpj,
          productId: product.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return product;
  }

  async createProductAsync(
    schemaNamespace: string,
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Product> {
    const product = this.createProduct(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().products.create(cleanCnpj, product);
    }
    return product;
  }

  updateProduct(
    schemaNamespace: string,
    id: string,
    updates: Partial<Omit<Product, 'id' | 'createdAt'>>
  ): Product | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const index = storage.products.findIndex((p) => p.id === id);
    if (index === -1) return undefined;

    const updated: Product = {
      ...storage.products[index],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    storage.products[index] = updated;
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().products.update(cleanCnpj, id, updates).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de produto: ${err.message}`, {
          cleanCnpj,
          id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return updated;
  }

  async updateProductAsync(
    schemaNamespace: string,
    id: string,
    updates: Partial<Omit<Product, 'id' | 'createdAt'>>
  ): Promise<Product | undefined> {
    const updated = this.updateProduct(schemaNamespace, id, updates);
    if (updated && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().products.update(cleanCnpj, id, updates);
    }
    return updated;
  }

  // --- ORÇAMENTOS (QUOTES) ---

  listQuotes(schemaNamespace: string): Quote[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return [...storage.quotes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getQuoteById(schemaNamespace: string, id: string): Quote | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return storage.quotes.find((q) => q.id === id);
  }

  createQuote(
    schemaNamespace: string,
    data: {
      customerId: string;
      description: string;
      issueDate: string;
      validUntil: string;
      discount?: number;
      surcharge?: number;
      notes?: string;
      internalNotes?: string;
      items: Array<{
        itemType: 'PRODUCT' | 'SERVICE';
        productId?: string;
        serviceId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        discountPercent?: number;
        surcharge?: number;
        surchargePercent?: number;
      }>;
      createdBy: string;
    }
  ): Quote {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    // Validação estrita de Tenant: o cliente DEVE existir dentro do schema deste tenant!
    const customer = storage.partners.find((p) => p.id === data.customerId);
    if (!customer) {
      throw new Error(
        `Cliente inválido ou não pertencente ao tenant atual (Segurança Multi-Tenant).`
      );
    }

    const quoteId = `orc-${crypto.randomUUID()}`;
    const quoteNumber = this.getNextSequentialNumber(schemaNamespace, 'quote');

    // Processamento matemático de cada item
    const quoteItems: QuoteItem[] = (data.items || []).map((item, index) => {
      const calc = CommercialMath.calculateItem(
        item.quantity,
        item.unitPrice,
        item.discount,
        item.discountPercent,
        item.surcharge,
        item.surchargePercent
      );
      return {
        id: `item-${crypto.randomUUID()}`,
        quoteId,
        itemType: item.itemType,
        productId: item.productId,
        serviceId: item.serviceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: calc.discount,
        discountPercent: item.discountPercent,
        surcharge: calc.surcharge,
        surchargePercent: item.surchargePercent,
        total: calc.total,
        sortOrder: index + 1,
      };
    });

    // Totais gerais do documento
    const totals = CommercialMath.calculateDocumentTotals(
      quoteItems,
      data.discount || 0,
      data.surcharge || 0
    );

    const now = new Date().toISOString();
    const quote: Quote = {
      id: quoteId,
      customerId: customer.id,
      customerName: customer.name,
      customerDocument: customer.formattedDocument,
      number: quoteNumber,
      status: 'DRAFT',
      issueDate: data.issueDate || now.split('T')[0],
      validUntil: data.validUntil,
      description: data.description,
      subtotal: totals.subtotal,
      discount: totals.discount,
      surcharge: totals.surcharge,
      total: totals.total,
      notes: data.notes,
      internalNotes: data.internalNotes,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
      items: quoteItems,
    };

    storage.quotes.unshift(quote);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().sales.createQuote(cleanCnpj, quote).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de orçamento: ${err.message}`, {
          cleanCnpj,
          quoteId: quote.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return quote;
  }

  async createQuoteAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createQuote']>[1]
  ): Promise<Quote> {
    const quote = this.createQuote(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().sales.createQuote(cleanCnpj, quote);
    }
    return quote;
  }

  updateQuote(
    schemaNamespace: string,
    id: string,
    updates: Partial<Quote>
  ): Quote | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const index = storage.quotes.findIndex((q) => q.id === id);
    if (index === -1) return undefined;

    const current = storage.quotes[index];
    // Se estiver convertida ou cancelada, impede edição de itens
    if (current.convertedSaleId && updates.items) {
      throw new Error('Não é possível modificar itens de um orçamento já convertido em venda.');
    }

    const updated: Quote = {
      ...current,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    storage.quotes[index] = updated;
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().sales.updateQuote(cleanCnpj, id, updates).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de orçamento: ${err.message}`, {
          cleanCnpj,
          id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return updated;
  }

  async updateQuoteAsync(
    schemaNamespace: string,
    id: string,
    updates: Partial<Quote>
  ): Promise<Quote | undefined> {
    const updated = this.updateQuote(schemaNamespace, id, updates);
    if (updated && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().sales.updateQuote(cleanCnpj, id, updates);
    }
    return updated;
  }

  updateQuoteStatus(
    schemaNamespace: string,
    id: string,
    status: QuoteStatus,
    metadata?: {
      approvedBy?: string;
      approvalMethod?: 'USER' | 'CUSTOMER' | 'SYSTEM';
    }
  ): Quote | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const quote = storage.quotes.find((q) => q.id === id);
    if (!quote) return undefined;

    quote.status = status;
    quote.updatedAt = new Date().toISOString();

    if (status === 'APPROVED') {
      quote.approvedAt = new Date().toISOString();
      quote.approvedBy = metadata?.approvedBy || 'Usuário do Sistema';
      quote.approvalMethod = metadata?.approvalMethod || 'USER';
    }

    return quote;
  }

  async updateQuoteStatusAsync(
    schemaNamespace: string,
    id: string,
    status: QuoteStatus,
    metadata?: {
      approvedBy?: string;
      approvalMethod?: 'USER' | 'CUSTOMER' | 'SYSTEM';
    }
  ): Promise<Quote | undefined> {
    const quote = this.updateQuoteStatus(schemaNamespace, id, status, metadata);
    if (quote && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().sales.updateQuote(cleanCnpj, id, {
        status: quote.status,
        approvedAt: quote.approvedAt,
        approvedBy: quote.approvedBy,
        approvalMethod: quote.approvalMethod,
        updatedAt: quote.updatedAt,
      });
    }
    return quote;
  }

  /**
   * Converte Orçamento Aprovado em Venda (PRD 04 - Seção 14, 39 e 46).
   * Possui trava de IDEMPOTÊNCIA: se já foi convertido, retorna a venda existente sem duplicar.
   */
  convertQuoteToSale(
    schemaNamespace: string,
    quoteId: string,
    createdBy: string
  ): { sale: Sale; alreadyConverted: boolean } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const quote = storage.quotes.find((q) => q.id === quoteId);
    if (!quote) {
      throw new Error(`Orçamento não encontrado para conversão.`);
    }

    // Trava de Idempotência: Se já foi convertido, retorna a venda já existente
    if (quote.convertedSaleId) {
      const existingSale = storage.sales.find((s) => s.id === quote.convertedSaleId);
      if (existingSale) {
        return { sale: existingSale, alreadyConverted: true };
      }
    }

    // Validação de Status
    if (quote.status !== 'APPROVED') {
      throw new Error(
        `Apenas orçamentos com status APROVADO podem ser convertidos em Venda. Status atual: ${quote.status}`
      );
    }

    const saleId = `ven-${crypto.randomUUID()}`;
    const saleNumber = this.getNextSequentialNumber(schemaNamespace, 'sale');
    const now = new Date().toISOString();

    const saleItems: SaleItem[] = quote.items.map((item, index) => ({
      id: `item-sale-${crypto.randomUUID()}`,
      saleId,
      itemType: item.itemType,
      productId: item.productId,
      serviceId: item.serviceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      surcharge: item.surcharge,
      total: item.total,
      sortOrder: index + 1,
    }));

    const sale: Sale = {
      id: saleId,
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerDocument: quote.customerDocument,
      number: saleNumber,
      status: 'CONFIRMED',
      saleDate: now.split('T')[0],
      sourceType: 'QUOTE',
      sourceId: quote.id,
      subtotal: quote.subtotal,
      discount: quote.discount,
      surcharge: quote.surcharge,
      total: quote.total,
      notes: quote.notes ? `Convertido do Orçamento ${quote.number}. ${quote.notes}` : `Convertido do Orçamento ${quote.number}`,
      internalNotes: quote.internalNotes,
      confirmedAt: now,
      createdBy,
      createdAt: now,
      updatedAt: now,
      items: saleItems,
    };

    storage.sales.unshift(sale);
    quote.convertedSaleId = sale.id;
    quote.updatedAt = now;

    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().sales.createSale(cleanCnpj, sale).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de venda convertida: ${err.message}`, {
          cleanCnpj,
          saleId: sale.id,
        });
      });
      RepositoryManager.getInstance().getRepositories().sales.updateQuote(cleanCnpj, quote.id, {
        convertedSaleId: sale.id,
        updatedAt: now,
      }).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de orçamento convertido: ${err.message}`, {
          cleanCnpj,
          quoteId: quote.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }

    return { sale, alreadyConverted: false };
  }

  async convertQuoteToSaleAsync(
    schemaNamespace: string,
    quoteId: string,
    createdBy: string
  ): Promise<{ sale: Sale; alreadyConverted: boolean }> {
    const result = this.convertQuoteToSale(schemaNamespace, quoteId, createdBy);
    if (!result.alreadyConverted && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().sales.createSale(cleanCnpj, result.sale);
      await RepositoryManager.getInstance().getRepositories().sales.updateQuote(cleanCnpj, quoteId, {
        convertedSaleId: result.sale.id,
        updatedAt: result.sale.createdAt,
      });
    }
    return result;
  }

  // --- VENDAS (SALES) ---

  listSales(schemaNamespace: string): Sale[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return [...storage.sales].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getSaleById(schemaNamespace: string, id: string): Sale | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return storage.sales.find((s) => s.id === id);
  }

  createSale(
    schemaNamespace: string,
    data: {
      customerId: string;
      sourceType?: 'QUOTE' | 'CONTRACT' | 'MANUAL' | 'OS' | 'OTHER';
      sourceId?: string;
      saleDate?: string;
      discount?: number;
      surcharge?: number;
      notes?: string;
      internalNotes?: string;
      items: Array<{
        itemType: 'PRODUCT' | 'SERVICE';
        productId?: string;
        serviceId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        surcharge?: number;
      }>;
      createdBy: string;
    }
  ): Sale {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const customer = storage.partners.find((p) => p.id === data.customerId);
    if (!customer) {
      throw new Error(`Cliente inválido ou não pertencente ao tenant atual.`);
    }

    const saleId = `ven-${crypto.randomUUID()}`;
    const saleNumber = this.getNextSequentialNumber(schemaNamespace, 'sale');
    const now = new Date().toISOString();

    const saleItems: SaleItem[] = (data.items || []).map((item, index) => {
      const calc = CommercialMath.calculateItem(
        item.quantity,
        item.unitPrice,
        item.discount || 0,
        0,
        item.surcharge || 0,
        0
      );
      return {
        id: `item-sale-${crypto.randomUUID()}`,
        saleId,
        itemType: item.itemType,
        productId: item.productId,
        serviceId: item.serviceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: calc.discount,
        surcharge: calc.surcharge,
        total: calc.total,
        sortOrder: index + 1,
      };
    });

    const totals = CommercialMath.calculateDocumentTotals(
      saleItems,
      data.discount || 0,
      data.surcharge || 0
    );

    const sale: Sale = {
      id: saleId,
      customerId: customer.id,
      customerName: customer.name,
      customerDocument: customer.formattedDocument,
      number: saleNumber,
      status: 'CONFIRMED',
      saleDate: data.saleDate || now.split('T')[0],
      sourceType: data.sourceType || 'MANUAL',
      sourceId: data.sourceId,
      subtotal: totals.subtotal,
      discount: totals.discount,
      surcharge: totals.surcharge,
      total: totals.total,
      notes: data.notes,
      internalNotes: data.internalNotes,
      confirmedAt: now,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
      items: saleItems,
    };

    storage.sales.unshift(sale);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().sales.createSale(cleanCnpj, sale).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de venda: ${err.message}`, {
          cleanCnpj,
          saleId: sale.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return sale;
  }

  async createSaleAsync(
    schemaNamespace: string,
    data: {
      customerId: string;
      sourceType?: 'QUOTE' | 'CONTRACT' | 'MANUAL' | 'OS' | 'OTHER';
      sourceId?: string;
      saleDate?: string;
      discount?: number;
      surcharge?: number;
      notes?: string;
      internalNotes?: string;
      items: Array<{
        itemType: 'PRODUCT' | 'SERVICE';
        productId?: string;
        serviceId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        surcharge?: number;
      }>;
      createdBy: string;
    }
  ): Promise<Sale> {
    const sale = this.createSale(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().sales.createSale(cleanCnpj, sale);
    }
    return sale;
  }

  updateSaleStatus(
    schemaNamespace: string,
    id: string,
    status: SaleStatus
  ): Sale | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const sale = storage.sales.find((s) => s.id === id);
    if (!sale) return undefined;

    sale.status = status;
    sale.updatedAt = new Date().toISOString();
    if (status === 'COMPLETED') {
      sale.completedAt = new Date().toISOString();
    }

    // PRD 05: Integração Vendas -> Contas a Receber
    if (status === 'CONFIRMED' && !storage.accountsReceivable.some((r) => r.saleId === sale.id)) {
      const recCounter = (storage.sequentialCounters.receivable || 0) + 1;
      storage.sequentialCounters.receivable = recCounter;
      const recNumber = `REC-${String(recCounter).padStart(6, '0')}`;
      const recId = `rec-${crypto.randomUUID().slice(0, 8)}`;
      const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const newReceivable: AccountReceivable = {
        id: recId,
        number: recNumber,
        customerId: sale.customerId,
        customerName: sale.customerName || 'Cliente',
        customerDocument: sale.customerDocument || '',
        saleId: sale.id,
        saleNumber: sale.number,
        chartOfAccountId: 'coa-alfa-04',
        chartOfAccountCode: '1.1.2.01',
        description: `Faturamento Venda ${sale.number} - ${sale.customerName || 'Cliente'}`,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate,
        originalValue: sale.total,
        fineRate: 2.0,
        interestRate: 1.0,
        discountValue: 0,
        fineValue: 0,
        interestValue: 0,
        paidValue: 0,
        balanceValue: sale.total,
        status: 'OPEN',
        notes: `Título gerado automaticamente pela confirmação da venda ${sale.number}.`,
        createdBy: sale.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.accountsReceivable.unshift(newReceivable);
    }

    return sale;
  }

  async updateSaleStatusAsync(
    schemaNamespace: string,
    id: string,
    status: SaleStatus
  ): Promise<Sale | undefined> {
    const sale = this.updateSaleStatus(schemaNamespace, id, status);
    if (sale && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().sales.updateSale(cleanCnpj, id, {
        status: sale.status,
        completedAt: sale.completedAt,
        updatedAt: sale.updatedAt,
      });
    }
    return sale;
  }

  // --- CONTRATOS (CONTRACTS) ---

  listContracts(schemaNamespace: string): Contract[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return [...storage.contracts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getContractById(schemaNamespace: string, id: string): Contract | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return storage.contracts.find((c) => c.id === id);
  }

  createContract(
    schemaNamespace: string,
    data: {
      customerId: string;
      title: string;
      description: string;
      startDate: string;
      endDate?: string;
      renewalType: 'MANUAL' | 'AUTOMATIC';
      billingFrequency: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'AVULSO';
      value: number;
      notes?: string;
      items?: Array<{
        itemType: 'PRODUCT' | 'SERVICE';
        productId?: string;
        serviceId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        frequency: 'MENSAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'AVULSO';
        startDate: string;
        endDate?: string;
      }>;
      createdBy: string;
    }
  ): Contract {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const customer = storage.partners.find((p) => p.id === data.customerId);
    if (!customer) {
      throw new Error(`Cliente inválido ou não pertencente ao tenant atual.`);
    }

    const contractId = `ctr-${crypto.randomUUID()}`;
    const contractNumber = this.getNextSequentialNumber(schemaNamespace, 'contract');
    const now = new Date().toISOString();

    const contractItems: ContractItem[] = (data.items || []).map((item) => ({
      id: `item-ctr-${crypto.randomUUID()}`,
      contractId,
      itemType: item.itemType,
      productId: item.productId,
      serviceId: item.serviceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      frequency: item.frequency,
      startDate: item.startDate,
      endDate: item.endDate,
      total: CommercialMath.round(item.quantity * item.unitPrice),
    }));

    const contract: Contract = {
      id: contractId,
      customerId: customer.id,
      customerName: customer.name,
      customerDocument: customer.formattedDocument,
      number: contractNumber,
      title: data.title,
      description: data.description,
      status: 'ACTIVE',
      startDate: data.startDate,
      endDate: data.endDate,
      renewalType: data.renewalType,
      billingFrequency: data.billingFrequency,
      value: data.value,
      notes: data.notes,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
      items: contractItems,
    };

    storage.contracts.unshift(contract);
    return contract;
  }

  updateContractStatus(
    schemaNamespace: string,
    id: string,
    status: ContractStatus
  ): Contract | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const contract = storage.contracts.find((c) => c.id === id);
    if (!contract) return undefined;

    contract.status = status;
    contract.updatedAt = new Date().toISOString();
    return contract;
  }

  async createContractAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createContract']>[1]
  ): Promise<Contract> {
    const contract = this.createContract(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().sales.createContract(cleanCnpj, contract);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de contrato: ${err.message}`, {
          cleanCnpj,
          contractId: contract.id,
        });
      }
    }
    return contract;
  }

  async updateContractStatusAsync(
    schemaNamespace: string,
    id: string,
    status: ContractStatus
  ): Promise<Contract | undefined> {
    const contract = this.updateContractStatus(schemaNamespace, id, status);
    if (contract && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().sales.updateContract(cleanCnpj, id, { status });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de contrato: ${err.message}`, {
          cleanCnpj,
          contractId: id,
        });
      }
    }
    return contract;
  }

  // --- ORDENS DE SERVIÇO (SERVICE ORDERS / OS) ---

  listServiceOrders(schemaNamespace: string): ServiceOrder[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return [...storage.serviceOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getServiceOrderById(schemaNamespace: string, id: string): ServiceOrder | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return storage.serviceOrders.find((os) => os.id === id);
  }

  createServiceOrder(
    schemaNamespace: string,
    data: {
      customerId: string;
      title: string;
      description: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      scheduledStart?: string;
      scheduledEnd?: string;
      assignedUserId?: string;
      assignedUserName?: string;
      sourceType?: 'AVULSA' | 'SALE' | 'CONTRACT' | 'QUOTE';
      sourceId?: string;
      notes?: string;
      internalNotes?: string;
      items?: Array<{
        itemType: 'PRODUCT' | 'SERVICE';
        productId?: string;
        serviceId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
      }>;
      createdBy: string;
    }
  ): ServiceOrder {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const customer = storage.partners.find((p) => p.id === data.customerId);
    if (!customer) {
      throw new Error(`Cliente inválido ou não pertencente ao tenant atual.`);
    }

    const osId = `os-${crypto.randomUUID()}`;
    const osNumber = this.getNextSequentialNumber(schemaNamespace, 'serviceOrder');
    const now = new Date().toISOString();

    const items: ServiceOrderItem[] = (data.items || []).map((item) => ({
      id: `item-os-${crypto.randomUUID()}`,
      serviceOrderId: osId,
      itemType: item.itemType,
      productId: item.productId,
      serviceId: item.serviceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: CommercialMath.round(item.quantity * item.unitPrice),
    }));

    const assignments: ServiceOrderAssignment[] = [];
    if (data.assignedUserId && data.assignedUserName) {
      assignments.push({
        id: `asg-${crypto.randomUUID()}`,
        serviceOrderId: osId,
        userId: data.assignedUserId,
        userName: data.assignedUserName,
        role: 'RESPONSAVEL_PRINCIPAL',
        assignedAt: now,
      });
    }

    const events: ServiceOrderEvent[] = [
      {
        id: `evt-${crypto.randomUUID()}`,
        serviceOrderId: osId,
        eventType: 'OS_CREATED',
        description: `Ordem de Serviço ${osNumber} criada no sistema.`,
        createdBy: data.createdBy,
        createdAt: now,
      },
    ];

    const os: ServiceOrder = {
      id: osId,
      customerId: customer.id,
      customerName: customer.name,
      customerDocument: customer.formattedDocument,
      number: osNumber,
      title: data.title,
      description: data.description,
      status: 'OPEN',
      priority: data.priority || 'NORMAL',
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      assignedUserId: data.assignedUserId,
      assignedUserName: data.assignedUserName,
      sourceType: data.sourceType || 'AVULSA',
      sourceId: data.sourceId,
      notes: data.notes,
      internalNotes: data.internalNotes,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
      items,
      assignments,
      events,
      comments: [],
    };

    storage.serviceOrders.unshift(os);
    return os;
  }

  updateServiceOrderStatus(
    schemaNamespace: string,
    id: string,
    status: ServiceOrderStatus,
    actorName: string
  ): ServiceOrder | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const os = storage.serviceOrders.find((o) => o.id === id);
    if (!os) return undefined;

    const now = new Date().toISOString();
    os.status = status;
    os.updatedAt = now;

    if (status === 'IN_PROGRESS' && !os.startedAt) {
      os.startedAt = now;
    }
    if (status === 'COMPLETED') {
      os.completedAt = now;
      os.finishedAt = now;
    }

    os.events.unshift({
      id: `evt-${crypto.randomUUID()}`,
      serviceOrderId: os.id,
      eventType: 'STATUS_CHANGED',
      description: `Status alterado para [${status}].`,
      createdBy: actorName,
      createdAt: now,
    });

    return os;
  }

  async createServiceOrderAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createServiceOrder']>[1]
  ): Promise<ServiceOrder> {
    const os = this.createServiceOrder(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().sales.createServiceOrder(cleanCnpj, os);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de ordem de serviço: ${err.message}`, {
          cleanCnpj,
          serviceOrderId: os.id,
        });
      }
    }
    return os;
  }

  async updateServiceOrderStatusAsync(
    schemaNamespace: string,
    id: string,
    status: ServiceOrderStatus,
    actorName: string
  ): Promise<ServiceOrder | undefined> {
    const os = this.updateServiceOrderStatus(schemaNamespace, id, status, actorName);
    if (os && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().sales.updateServiceOrder(cleanCnpj, id, { status });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de ordem de serviço: ${err.message}`, {
          cleanCnpj,
          serviceOrderId: id,
        });
      }
    }
    return os;
  }

  assignServiceOrder(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string,
    role: 'RESPONSAVEL_PRINCIPAL' | 'TECNICO' | 'PARTICIPANTE',
    actorName: string
  ): ServiceOrder | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const os = storage.serviceOrders.find((o) => o.id === id);
    if (!os) return undefined;

    const now = new Date().toISOString();
    os.assignedUserId = userId;
    os.assignedUserName = userName;
    os.updatedAt = now;

    os.assignments.push({
      id: `asg-${crypto.randomUUID()}`,
      serviceOrderId: os.id,
      userId,
      userName,
      role,
      assignedAt: now,
    });

    os.events.unshift({
      id: `evt-${crypto.randomUUID()}`,
      serviceOrderId: os.id,
      eventType: 'ASSIGNED',
      description: `Responsável [${userName}] atribuído como ${role}.`,
      createdBy: actorName,
      createdAt: now,
    });

    return os;
  }

  addServiceOrderComment(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string,
    content: string
  ): ServiceOrderComment | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const os = storage.serviceOrders.find((o) => o.id === id);
    if (!os) return undefined;

    const now = new Date().toISOString();
    const comment: ServiceOrderComment = {
      id: `cmt-${crypto.randomUUID()}`,
      serviceOrderId: os.id,
      userId,
      userName,
      content,
      createdAt: now,
      updatedAt: now,
    };

    os.comments.push(comment);
    os.events.unshift({
      id: `evt-${crypto.randomUUID()}`,
      serviceOrderId: os.id,
      eventType: 'COMMENT_ADDED',
      description: `Comentário adicionado por ${userName}.`,
      createdBy: userName,
      createdAt: now,
    });
    os.updatedAt = now;

    return comment;
  }

  async assignServiceOrderAsync(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string,
    role: 'RESPONSAVEL_PRINCIPAL' | 'TECNICO' | 'PARTICIPANTE',
    actorName: string
  ): Promise<ServiceOrder | undefined> {
    const os = this.assignServiceOrder(schemaNamespace, id, userId, userName, role, actorName);
    if (os && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().sales.updateServiceOrder(cleanCnpj, id, {
          assignedUserId: userId,
          assignedUserName: userName,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de atribuição de OS: ${err.message}`, {
          cleanCnpj,
          serviceOrderId: id,
        });
      }
    }
    return os;
  }

  async addServiceOrderCommentAsync(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string,
    content: string
  ): Promise<ServiceOrderComment | undefined> {
    const comment = this.addServiceOrderComment(schemaNamespace, id, userId, userName, content);
    return comment;
  }

  invoiceServiceOrder(
    schemaNamespace: string,
    id: string,
    actorName: string
  ): { os: ServiceOrder; receivable: AccountReceivable } | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const os = storage.serviceOrders.find((o) => o.id === id);
    if (!os) return undefined;

    // Se já houver um título financeiro gerado para esta OS
    const existingRec = storage.accountsReceivable.find(
      (r) => r.contractId === os.id || (r.notes && r.notes.includes(os.number))
    );
    if (existingRec) {
      return { os, receivable: existingRec };
    }

    const recCounter = (storage.sequentialCounters.receivable || 0) + 1;
    storage.sequentialCounters.receivable = recCounter;
    const recNumber = `REC-${String(recCounter).padStart(6, '0')}`;
    const recId = `rec-${crypto.randomUUID().slice(0, 8)}`;
    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const osTotal = (os.items || []).reduce((acc, it) => acc + (it.total || 0), 0);

    const newReceivable: AccountReceivable = {
      id: recId,
      number: recNumber,
      customerId: os.customerId,
      customerName: os.customerName || 'Cliente Homologado',
      customerDocument: os.customerDocument || '',
      chartOfAccountId: 'coa-alfa-04',
      chartOfAccountCode: '1.1.2.01',
      description: `Faturamento OS ${os.number} - ${os.title}`,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate,
      originalValue: osTotal,
      fineRate: 2.0,
      interestRate: 1.0,
      discountValue: 0,
      fineValue: 0,
      interestValue: 0,
      paidValue: 0,
      balanceValue: osTotal,
      status: 'OPEN',
      notes: `Título gerado pelo faturamento da Ordem de Serviço ${os.number}.`,
      createdBy: actorName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.accountsReceivable.unshift(newReceivable);

    os.events.unshift({
      id: `evt-${crypto.randomUUID()}`,
      serviceOrderId: os.id,
      eventType: 'NOTE_ADDED',
      description: `Ordem de Serviço faturada: Título a Receber ${recNumber} (R$ ${osTotal.toFixed(2)}) gerado.`,
      createdBy: actorName,
      createdAt: new Date().toISOString(),
    });

    return { os, receivable: newReceivable };
  }

  async invoiceServiceOrderAsync(
    schemaNamespace: string,
    id: string,
    actorName: string
  ): Promise<{ os: ServiceOrder; receivable: AccountReceivable } | undefined> {
    const res = this.invoiceServiceOrder(schemaNamespace, id, actorName);
    if (!res) return undefined;
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        const recV2: any = {
          id: res.receivable.id,
          instanceId: res.receivable.id,
          customerId: res.receivable.customerId,
          customerName: res.receivable.customerName,
          customerDocument: res.receivable.customerDocument,
          description: res.receivable.description,
          originalAmount: res.receivable.originalValue,
          paidAmount: res.receivable.originalValue - res.receivable.balanceValue,
          remainingAmount: res.receivable.balanceValue,
          status: 'OPEN',
          dueDate: res.receivable.dueDate,
          createdAt: res.receivable.createdAt,
          updatedAt: res.receivable.updatedAt,
        };
        await RepositoryManager.getInstance().getRepositories().receivables.createReceivable(cleanCnpj, recV2);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL do título da OS: ${err.message}`, {
          cleanCnpj,
          receivableId: res.receivable.id,
          osId: id,
        });
      }
    }
    return res;
  }

  // --- MÉTRICAS DO DASHBOARD COMERCIAL (PRD 04 - Seção 8, 30 e 52) ---

  getCommercialDashboardMetrics(schemaNamespace: string): CommercialDashboardMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      return {
        openQuotesCount: 0,
        openQuotesValue: 0,
        approvedQuotesCount: 0,
        approvedQuotesValue: 0,
        confirmedSalesCount: 0,
        confirmedSalesValue: 0,
        activeContractsCount: 0,
        activeContractsValue: 0,
        serviceOrdersByStatus: {
          open: 0,
          scheduled: 0,
          inProgress: 0,
          waiting: 0,
          completed: 0,
          canceled: 0,
        },
      };
    }

    const quotes = storage.quotes || [];
    const sales = storage.sales || [];
    const contracts = storage.contracts || [];
    const oss = storage.serviceOrders || [];

    const openQuotes = quotes.filter((q) => ['DRAFT', 'SENT', 'VIEWED'].includes(q.status));
    const approvedQuotes = quotes.filter((q) => q.status === 'APPROVED');
    const confirmedSales = sales.filter((s) => ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(s.status));
    const activeContracts = contracts.filter((c) => c.status === 'ACTIVE');

    const osStatusCounts = {
      open: oss.filter((o) => o.status === 'OPEN').length,
      scheduled: oss.filter((o) => o.status === 'SCHEDULED').length,
      inProgress: oss.filter((o) => o.status === 'IN_PROGRESS').length,
      waiting: oss.filter((o) => o.status === 'WAITING').length,
      completed: oss.filter((o) => o.status === 'COMPLETED').length,
      canceled: oss.filter((o) => o.status === 'CANCELED').length,
    };

    return {
      openQuotesCount: openQuotes.length,
      openQuotesValue: CommercialMath.round(openQuotes.reduce((acc, q) => acc + q.total, 0)),
      approvedQuotesCount: approvedQuotes.length,
      approvedQuotesValue: CommercialMath.round(approvedQuotes.reduce((acc, q) => acc + q.total, 0)),
      confirmedSalesCount: confirmedSales.length,
      confirmedSalesValue: CommercialMath.round(confirmedSales.reduce((acc, s) => acc + s.total, 0)),
      activeContractsCount: activeContracts.length,
      activeContractsValue: CommercialMath.round(activeContracts.reduce((acc, c) => acc + c.value, 0)),
      serviceOrdersByStatus: osStatusCounts,
    };
  }

  // ============================================================================
  // PRD 05 - MÉTODOS FINANCEIROS, TESOURARIA, FLUXO DE CAIXA E DRE
  // ============================================================================

  // --- CONTAS A RECEBER (ACCOUNTS RECEIVABLE) ---

  listAccountsReceivable(
    schemaNamespace: string,
    filter?: { status?: string; customerId?: string }
  ): AccountReceivable[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Atualiza dinamicamente encargos moratórios e status de títulos vencidos
    storage.accountsReceivable.forEach((title) => {
      if (['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(title.status)) {
        const charges = FinancialMath.calculateLateCharges({
          dueDate: title.dueDate,
          baseAmount: title.originalValue - title.paidValue,
          fineRatePercent: title.fineRate,
          monthlyInterestRatePercent: title.interestRate,
          currentDate: todayStr,
        });

        if (charges.isOverdue) {
          title.status = 'OVERDUE';
          title.fineValue = charges.fineValue;
          title.interestValue = charges.interestValue;
          title.balanceValue = charges.totalPayable;
        }
      }
    });

    let list = [...storage.accountsReceivable];

    if (filter?.status) {
      list = list.filter((r) => r.status === filter.status);
    }
    if (filter?.customerId) {
      list = list.filter((r) => r.customerId === filter.customerId);
    }

    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  getAccountReceivableById(schemaNamespace: string, id: string): AccountReceivable | undefined {
    const list = this.listAccountsReceivable(schemaNamespace);
    return list.find((r) => r.id === id);
  }

  createAccountReceivable(
    schemaNamespace: string,
    data: Partial<AccountReceivable>
  ): AccountReceivable {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      throw new Error(`Schema namespace [${schemaNamespace}] não encontrado.`);
    }

    const recCounter = (storage.sequentialCounters.receivable || 0) + 1;
    storage.sequentialCounters.receivable = recCounter;
    const number = `REC-${String(recCounter).padStart(6, '0')}`;
    const id = `rec-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const originalValue = FinancialMath.round(data.originalValue || 0);

    const title: AccountReceivable = {
      id,
      number,
      customerId: data.customerId || '',
      customerName: data.customerName || '',
      customerDocument: data.customerDocument,
      saleId: data.saleId,
      saleNumber: data.saleNumber,
      contractId: data.contractId,
      contractNumber: data.contractNumber,
      chartOfAccountId: data.chartOfAccountId || 'coa-alfa-04',
      chartOfAccountCode: data.chartOfAccountCode || '1.1.2.01',
      costCenterId: data.costCenterId,
      costCenterCode: data.costCenterCode,
      description: data.description || 'Título de Conta a Receber',
      issueDate: data.issueDate || now.split('T')[0],
      dueDate: data.dueDate || now.split('T')[0],
      originalValue,
      fineRate: data.fineRate !== undefined ? data.fineRate : 2.0,
      interestRate: data.interestRate !== undefined ? data.interestRate : 1.0,
      discountValue: data.discountValue || 0,
      fineValue: data.fineValue || 0,
      interestValue: data.interestValue || 0,
      paidValue: 0,
      balanceValue: originalValue,
      status: 'OPEN',
      notes: data.notes,
      createdBy: data.createdBy || 'Sistema',
      createdAt: now,
      updatedAt: now,
    };

    storage.accountsReceivable.unshift(title);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      const recV2: any = {
        id: title.id,
        instanceId: title.id,
        customer: {
          id: title.customerId,
          name: title.customerName,
          document: title.customerDocument,
        },
        description: title.description,
        originalAmount: title.originalValue,
        paidAmount: title.originalValue - title.balanceValue,
        remainingAmount: title.balanceValue,
        status: title.status === 'PAID' ? 'PAID' : title.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : title.status === 'CANCELED' ? 'CANCELED' : 'OPEN',
        issueDate: title.issueDate,
        dueDate: title.dueDate,
        createdAt: title.createdAt,
        updatedAt: title.updatedAt,
      };
      RepositoryManager.getInstance().getRepositories().receivables.createReceivable(cleanCnpj, recV2).catch((err: any) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de conta a receber: ${err.message}`, {
          cleanCnpj,
          titleId: title.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return title;
  }

  async createAccountReceivableAsync(
    schemaNamespace: string,
    data: Partial<AccountReceivable>
  ): Promise<AccountReceivable> {
    const title = this.createAccountReceivable(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      const recV2: any = {
        id: title.id,
        instanceId: title.id,
        customer: {
          id: title.customerId,
          name: title.customerName,
          document: title.customerDocument,
        },
        description: title.description,
        originalAmount: title.originalValue,
        paidAmount: title.originalValue - title.balanceValue,
        remainingAmount: title.balanceValue,
        status: title.status === 'PAID' ? 'PAID' : title.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : title.status === 'CANCELED' ? 'CANCELED' : 'OPEN',
        issueDate: title.issueDate,
        dueDate: title.dueDate,
        createdAt: title.createdAt,
        updatedAt: title.updatedAt,
      };
      await RepositoryManager.getInstance().getRepositories().receivables.createReceivable(cleanCnpj, recV2);
    }
    return title;
  }

  settleAccountReceivable(
    schemaNamespace: string,
    id: string,
    data: {
      paidAmount: number;
      discountValue?: number;
      fineValue?: number;
      interestValue?: number;
      bankAccountId?: string;
      paymentMethod?: PaymentMethod;
      paidAt?: string;
      notes?: string;
    }
  ): AccountReceivable | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const title = storage.accountsReceivable.find((r) => r.id === id);
    if (!title) return undefined;
    if (title.status === 'CANCELED' || title.status === 'PAID') {
      return title;
    }

    const paidAmount = FinancialMath.round(data.paidAmount);
    const discount = FinancialMath.round(data.discountValue || 0);
    const fine = FinancialMath.round(data.fineValue || 0);
    const interest = FinancialMath.round(data.interestValue || 0);

    const settlement = FinancialMath.calculateSettlement({
      currentBalance: title.balanceValue,
      paidAmount,
      discountValue: discount,
      fineValue: fine,
      interestValue: interest,
    });

    title.paidValue = FinancialMath.round(title.paidValue + settlement.newPaidIncrement);
    title.balanceValue = settlement.newBalance;
    title.status = settlement.newStatus;
    title.discountValue = FinancialMath.round((title.discountValue || 0) + discount);
    title.fineValue = FinancialMath.round((title.fineValue || 0) + fine);
    title.interestValue = FinancialMath.round((title.interestValue || 0) + interest);
    title.paymentMethod = data.paymentMethod || title.paymentMethod || 'PIX';
    title.bankAccountId = data.bankAccountId || title.bankAccountId;
    title.paidAt = data.paidAt || new Date().toISOString();
    title.updatedAt = new Date().toISOString();

    if (data.notes) {
      title.notes = title.notes ? `${title.notes} | ${data.notes}` : data.notes;
    }

    // Movimenta tesouraria se conta bancária foi informada
    if (data.bankAccountId && settlement.newPaidIncrement > 0) {
      const account = storage.bankAccounts.find((b) => b.id === data.bankAccountId);
      if (account) {
        account.currentBalance = FinancialMath.round(account.currentBalance + settlement.newPaidIncrement);
        account.updatedAt = new Date().toISOString();

        const txnId = `txn-${crypto.randomUUID().slice(0, 8)}`;
        const txn: BankTransaction = {
          id: txnId,
          bankAccountId: account.id,
          type: 'CREDIT',
          amount: settlement.newPaidIncrement,
          date: title.paidAt.split('T')[0],
          description: `Recebimento Titulo ${title.number} - ${title.customerName}`,
          category: 'Recebimento de Cliente',
          relatedTitleId: title.id,
          relatedTitleType: 'RECEIVABLE',
          reconciled: true,
          reconciledAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        storage.bankTransactions.unshift(txn);
      }
    }

    return title;
  }

  async settleAccountReceivableAsync(
    schemaNamespace: string,
    id: string,
    data: Parameters<DatabaseEngine['settleAccountReceivable']>[2]
  ): Promise<AccountReceivable | undefined> {
    const title = this.settleAccountReceivable(schemaNamespace, id, data);
    if (title && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.updateReceivable(cleanCnpj, id, {
          remainingAmount: title.balanceValue,
          paidAmount: title.paidValue,
          status: title.status === 'PAID' ? 'PAID' : title.status === 'PARTIALLY_PAID' ? 'PARTIALLY_PAID' : title.status === 'CANCELED' ? 'CANCELED' : 'PENDING',
          updatedAt: title.updatedAt,
        });
        if (data.bankAccountId && title.paidValue > 0) {
          const account = this.getTenantStorage(schemaNamespace)?.bankAccounts.find((b) => b.id === data.bankAccountId);
          if (account) {
            await RepositoryManager.getInstance().getRepositories().financial.updateBankBalance(cleanCnpj, account.id, account.currentBalance);
          }
        }
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL da liquidação de conta a receber: ${err.message}`, {
          cleanCnpj,
          titleId: id,
        });
      }
    }
    return title;
  }

  cancelAccountReceivable(schemaNamespace: string, id: string): AccountReceivable | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const title = storage.accountsReceivable.find((r) => r.id === id);
    if (!title || title.status === 'PAID') return undefined;

    title.status = 'CANCELED';
    title.updatedAt = new Date().toISOString();
    return title;
  }

  async cancelAccountReceivableAsync(schemaNamespace: string, id: string): Promise<AccountReceivable | undefined> {
    const title = this.cancelAccountReceivable(schemaNamespace, id);
    if (title && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.updateReceivable(cleanCnpj, id, {
          status: 'CANCELED',
          updatedAt: title.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de conta a receber: ${err.message}`, {
          cleanCnpj,
          receivableId: id,
        });
      }
    }
    return title;
  }

  // --- CONTAS A PAGAR (ACCOUNTS PAYABLE) ---

  listAccountsPayable(
    schemaNamespace: string,
    filter?: { status?: string; supplierId?: string }
  ): AccountPayable[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Atualiza encargos moratórios e status de títulos vencidos
    storage.accountsPayable.forEach((title) => {
      if (['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(title.status)) {
        const charges = FinancialMath.calculateLateCharges({
          dueDate: title.dueDate,
          baseAmount: title.originalValue - title.paidValue,
          fineRatePercent: 2.0,
          monthlyInterestRatePercent: 1.0,
          currentDate: todayStr,
        });

        if (charges.isOverdue) {
          title.status = 'OVERDUE';
          title.fineValue = charges.fineValue;
          title.interestValue = charges.interestValue;
          title.balanceValue = charges.totalPayable;
        }
      }
    });

    let list = [...storage.accountsPayable];

    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.supplierId) {
      list = list.filter((p) => p.supplierId === filter.supplierId);
    }

    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  getAccountPayableById(schemaNamespace: string, id: string): AccountPayable | undefined {
    const list = this.listAccountsPayable(schemaNamespace);
    return list.find((p) => p.id === id);
  }

  createAccountPayable(
    schemaNamespace: string,
    data: Partial<AccountPayable>
  ): AccountPayable {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      throw new Error(`Schema namespace [${schemaNamespace}] não encontrado.`);
    }

    const pagCounter = (storage.sequentialCounters.payable || 0) + 1;
    storage.sequentialCounters.payable = pagCounter;
    const number = `PAG-${String(pagCounter).padStart(6, '0')}`;
    const id = `pag-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const originalValue = FinancialMath.round(data.originalValue || 0);

    const title: AccountPayable = {
      id,
      number,
      supplierId: data.supplierId || '',
      supplierName: data.supplierName || '',
      supplierDocument: data.supplierDocument,
      chartOfAccountId: data.chartOfAccountId || 'coa-alfa-06',
      chartOfAccountCode: data.chartOfAccountCode || '2.1.2.01',
      costCenterId: data.costCenterId,
      costCenterCode: data.costCenterCode,
      description: data.description || 'Título de Conta a Pagar',
      issueDate: data.issueDate || now.split('T')[0],
      dueDate: data.dueDate || now.split('T')[0],
      originalValue,
      discountValue: data.discountValue || 0,
      fineValue: data.fineValue || 0,
      interestValue: data.interestValue || 0,
      paidValue: 0,
      balanceValue: originalValue,
      status: 'OPEN',
      notes: data.notes,
      createdBy: data.createdBy || 'Sistema',
      createdAt: now,
      updatedAt: now,
    };

    storage.accountsPayable.unshift(title);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().financial.createPayable(cleanCnpj, title).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de conta a pagar: ${err.message}`, {
          cleanCnpj,
          titleId: title.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return title;
  }

  async createAccountPayableAsync(
    schemaNamespace: string,
    data: Partial<AccountPayable>
  ): Promise<AccountPayable> {
    const title = this.createAccountPayable(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().financial.createPayable(cleanCnpj, title);
    }
    return title;
  }

  settleAccountPayable(
    schemaNamespace: string,
    id: string,
    data: {
      paidAmount: number;
      discountValue?: number;
      fineValue?: number;
      interestValue?: number;
      bankAccountId?: string;
      paymentMethod?: PaymentMethod;
      paidAt?: string;
      notes?: string;
    }
  ): AccountPayable | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const title = storage.accountsPayable.find((p) => p.id === id);
    if (!title) return undefined;
    if (title.status === 'CANCELED' || title.status === 'PAID') {
      return title;
    }

    const paidAmount = FinancialMath.round(data.paidAmount);
    const discount = FinancialMath.round(data.discountValue || 0);
    const fine = FinancialMath.round(data.fineValue || 0);
    const interest = FinancialMath.round(data.interestValue || 0);

    const settlement = FinancialMath.calculateSettlement({
      currentBalance: title.balanceValue,
      paidAmount,
      discountValue: discount,
      fineValue: fine,
      interestValue: interest,
    });

    title.paidValue = FinancialMath.round(title.paidValue + settlement.newPaidIncrement);
    title.balanceValue = settlement.newBalance;
    title.status = settlement.newStatus;
    title.discountValue = FinancialMath.round((title.discountValue || 0) + discount);
    title.fineValue = FinancialMath.round((title.fineValue || 0) + fine);
    title.interestValue = FinancialMath.round((title.interestValue || 0) + interest);
    title.paymentMethod = data.paymentMethod || title.paymentMethod || 'BOLETO';
    title.bankAccountId = data.bankAccountId || title.bankAccountId;
    title.paidAt = data.paidAt || new Date().toISOString();
    title.updatedAt = new Date().toISOString();

    if (data.notes) {
      title.notes = title.notes ? `${title.notes} | ${data.notes}` : data.notes;
    }

    // Movimenta débito na conta bancária
    if (data.bankAccountId && settlement.newPaidIncrement > 0) {
      const account = storage.bankAccounts.find((b) => b.id === data.bankAccountId);
      if (account) {
        account.currentBalance = FinancialMath.round(account.currentBalance - settlement.newPaidIncrement);
        account.updatedAt = new Date().toISOString();

        const txnId = `txn-${crypto.randomUUID().slice(0, 8)}`;
        const txn: BankTransaction = {
          id: txnId,
          bankAccountId: account.id,
          type: 'DEBIT',
          amount: settlement.newPaidIncrement,
          date: title.paidAt.split('T')[0],
          description: `Pagamento Titulo ${title.number} - ${title.supplierName}`,
          category: 'Pagamento de Fornecedor',
          relatedTitleId: title.id,
          relatedTitleType: 'PAYABLE',
          reconciled: true,
          reconciledAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        storage.bankTransactions.unshift(txn);
      }
    }

    return title;
  }

  async settleAccountPayableAsync(
    schemaNamespace: string,
    id: string,
    data: Parameters<DatabaseEngine['settleAccountPayable']>[2]
  ): Promise<AccountPayable | undefined> {
    const title = this.settleAccountPayable(schemaNamespace, id, data);
    if (title && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().financial.settlePayableTransaction(
          cleanCnpj,
          id,
          data.paidAmount,
          data.bankAccountId
        );
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL da liquidação de conta a pagar: ${err.message}`, {
          cleanCnpj,
          payableId: id,
        });
      }
    }
    return title;
  }

  cancelAccountPayable(schemaNamespace: string, id: string): AccountPayable | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const title = storage.accountsPayable.find((p) => p.id === id);
    if (!title || title.status === 'PAID') return undefined;

    title.status = 'CANCELED';
    title.updatedAt = new Date().toISOString();
    return title;
  }

  async cancelAccountPayableAsync(schemaNamespace: string, id: string): Promise<AccountPayable | undefined> {
    const title = this.cancelAccountPayable(schemaNamespace, id);
    if (title && PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().financial.updatePayable(cleanCnpj, id, {
          status: 'CANCELED',
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de conta a pagar: ${err.message}`, {
          cleanCnpj,
          payableId: id,
        });
      }
    }
    return title;
  }

  // --- TESOURARIA & CONTAS BANCÁRIAS (TREASURY & BANK ACCOUNTS) ---

  listBankAccounts(schemaNamespace: string): BankAccount[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return [...storage.bankAccounts];
  }

  createBankAccount(schemaNamespace: string, data: Partial<BankAccount>): BankAccount {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      throw new Error(`Schema namespace [${schemaNamespace}] não encontrado.`);
    }

    const id = `bco-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const initialBalance = FinancialMath.round(data.initialBalance || 0);

    const account: BankAccount = {
      id,
      name: data.name || 'Nova Conta Bancária',
      bankCode: data.bankCode || '000',
      agency: data.agency || '0001',
      accountNumber: data.accountNumber || '00000-0',
      accountType: data.accountType || 'CHECKING',
      currentBalance: initialBalance,
      initialBalance,
      color: data.color || '#3b82f6',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    storage.bankAccounts.push(account);
    return account;
  }

  async createBankAccountAsync(
    schemaNamespace: string,
    data: Partial<BankAccount>
  ): Promise<BankAccount> {
    const account = this.createBankAccount(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().financial.createBankAccount(cleanCnpj, account);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de conta bancária: ${err.message}`, {
          cleanCnpj,
          accountId: account.id,
        });
      }
    }
    return account;
  }

  listBankTransactions(schemaNamespace: string, bankAccountId?: string): BankTransaction[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    let list = [...storage.bankTransactions];
    if (bankAccountId) {
      list = list.filter((t) => t.bankAccountId === bankAccountId);
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  createBankTransaction(schemaNamespace: string, data: Partial<BankTransaction>): BankTransaction {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      throw new Error(`Schema namespace [${schemaNamespace}] não encontrado.`);
    }

    const account = storage.bankAccounts.find((b) => b.id === data.bankAccountId);
    if (!account) {
      throw new Error(`Conta bancária informada não existe.`);
    }

    const id = `txn-${crypto.randomUUID().slice(0, 8)}`;
    const amount = FinancialMath.round(data.amount || 0);
    const type = data.type || 'CREDIT';

    if (type === 'CREDIT') {
      account.currentBalance = FinancialMath.round(account.currentBalance + amount);
    } else {
      account.currentBalance = FinancialMath.round(account.currentBalance - amount);
    }
    account.updatedAt = new Date().toISOString();

    const txn: BankTransaction = {
      id,
      bankAccountId: account.id,
      type,
      amount,
      date: data.date || new Date().toISOString().split('T')[0],
      description: data.description || 'Movimentação Bancária Avulsa',
      category: data.category || 'Geral',
      relatedTitleId: data.relatedTitleId,
      relatedTitleType: data.relatedTitleType,
      reconciled: data.reconciled || false,
      reconciledAt: data.reconciled ? new Date().toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };

    storage.bankTransactions.unshift(txn);
    return txn;
  }

  async createBankTransactionAsync(schemaNamespace: string, data: Partial<BankTransaction>): Promise<BankTransaction> {
    const txn = this.createBankTransaction(schemaNamespace, data);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        const storage = this.getTenantStorage(schemaNamespace);
        const account = storage?.bankAccounts.find((b) => b.id === data.bankAccountId);
        if (account) {
          await RepositoryManager.getInstance().getRepositories().financial.updateBankBalance(
            cleanCnpj,
            account.id,
            account.currentBalance
          );
        }
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha ao atualizar saldo bancário no PostgreSQL: ${err.message}`, {
          cleanCnpj,
          bankAccountId: data.bankAccountId,
        });
      }
    }
    return txn;
  }

  reconcileBankTransaction(
    schemaNamespace: string,
    transactionId: string,
    titleId?: string
  ): BankTransaction | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const txn = storage.bankTransactions.find((t) => t.id === transactionId);
    if (!txn) return undefined;

    txn.reconciled = true;
    txn.reconciledAt = new Date().toISOString();
    if (titleId) {
      txn.relatedTitleId = titleId;
    }
    return txn;
  }

  // --- RELATÓRIOS: FLUXO DE CAIXA & DRE GERENCIAL ---

  getCashFlowProjection(schemaNamespace: string, days = 30): CashFlowDay[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    const totalTreasuryBalance = storage.bankAccounts.reduce(
      (sum, b) => sum + (b.isActive ? b.currentBalance : 0),
      0
    );

    return CashFlowEngine.generateProjection({
      initialTreasuryBalance: totalTreasuryBalance,
      receivables: storage.accountsReceivable,
      payables: storage.accountsPayable,
      daysHorizon: days,
    });
  }

  getIncomeStatementReport(schemaNamespace: string): IncomeStatementItem[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    return IncomeStatementEngine.generateReport({
      receivables: storage.accountsReceivable,
      payables: storage.accountsPayable,
    });
  }

  // --- DASHBOARD FINANCEIRO ---

  getFinancialDashboardMetrics(schemaNamespace: string): FinancialDashboardMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      return {
        totalReceivablesBalance: 0,
        overdueReceivablesCount: 0,
        overdueReceivablesValue: 0,
        receivablesDueTodayCount: 0,
        receivablesDueTodayValue: 0,
        totalPayablesBalance: 0,
        overduePayablesCount: 0,
        overduePayablesValue: 0,
        payablesDueTodayCount: 0,
        payablesDueTodayValue: 0,
        treasuryTotalBalance: 0,
        cashFlow30DaysNet: 0,
        defaultRatePercent: 0,
        bankAccountsSummary: [],
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const receivables = this.listAccountsReceivable(schemaNamespace);
    const payables = this.listAccountsPayable(schemaNamespace);
    const bankAccounts = storage.bankAccounts || [];

    const activeRecs = receivables.filter((r) => ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(r.status));
    const overdueRecs = receivables.filter((r) => r.status === 'OVERDUE');
    const todayRecs = receivables.filter(
      (r) => ['OPEN', 'PARTIALLY_PAID'].includes(r.status) && r.dueDate === todayStr
    );

    const activePags = payables.filter((p) => ['OPEN', 'PARTIALLY_PAID', 'OVERDUE'].includes(p.status));
    const overduePags = payables.filter((p) => p.status === 'OVERDUE');
    const todayPags = payables.filter(
      (p) => ['OPEN', 'PARTIALLY_PAID'].includes(p.status) && p.dueDate === todayStr
    );

    const totalReceivablesBalance = FinancialMath.round(
      activeRecs.reduce((sum, r) => sum + r.balanceValue, 0)
    );
    const overdueReceivablesValue = FinancialMath.round(
      overdueRecs.reduce((sum, r) => sum + r.balanceValue, 0)
    );
    const receivablesDueTodayValue = FinancialMath.round(
      todayRecs.reduce((sum, r) => sum + r.balanceValue, 0)
    );

    const totalPayablesBalance = FinancialMath.round(
      activePags.reduce((sum, p) => sum + p.balanceValue, 0)
    );
    const overduePayablesValue = FinancialMath.round(
      overduePags.reduce((sum, p) => sum + p.balanceValue, 0)
    );
    const payablesDueTodayValue = FinancialMath.round(
      todayPags.reduce((sum, p) => sum + p.balanceValue, 0)
    );

    const treasuryTotalBalance = FinancialMath.round(
      bankAccounts.reduce((sum, b) => sum + (b.isActive ? b.currentBalance : 0), 0)
    );

    const defaultRatePercent =
      totalReceivablesBalance > 0
        ? FinancialMath.round((overdueReceivablesValue / totalReceivablesBalance) * 100)
        : 0;

    const cashFlowDays = this.getCashFlowProjection(schemaNamespace, 30);
    const lastDay = cashFlowDays[cashFlowDays.length - 1];
    const cashFlow30DaysNet = lastDay
      ? FinancialMath.round(lastDay.cumulativeBalance - treasuryTotalBalance)
      : 0;

    return {
      totalReceivablesBalance,
      overdueReceivablesCount: overdueRecs.length,
      overdueReceivablesValue,
      receivablesDueTodayCount: todayRecs.length,
      receivablesDueTodayValue,
      totalPayablesBalance,
      overduePayablesCount: overduePags.length,
      overduePayablesValue,
      payablesDueTodayCount: todayPags.length,
      payablesDueTodayValue,
      treasuryTotalBalance,
      cashFlow30DaysNet,
      defaultRatePercent,
      bankAccountsSummary: bankAccounts.map((b) => ({
        id: b.id,
        name: b.name,
        balance: b.currentBalance,
        bankCode: b.bankCode,
        color: b.color,
      })),
    };
  }

  // =======================================================
  // PRD PARTE 05: MÉTODOS DE FATURAMENTO, COMPETÊNCIA E RECORRÊNCIA
  // =======================================================

  // 1. Consulta de Documentos de Faturamento com Filtros
  getBillingDocuments(
    schemaNamespace: string,
    filters?: {
      status?: string;
      customerId?: string;
      sourceType?: string;
      competence?: string;
      search?: string;
    }
  ): BillingDocument[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    return storage.billingDocuments.filter((doc) => {
      if (filters?.status && doc.status !== filters.status) return false;
      if (filters?.customerId && doc.customerId !== filters.customerId) return false;
      if (filters?.sourceType && doc.sourceType !== filters.sourceType) return false;
      if (filters?.competence && doc.competenceLabel !== filters.competence) return false;
      if (filters?.search) {
        const query = filters.search.toLowerCase();
        const matchNumber = doc.number.toLowerCase().includes(query);
        const matchCustomer = doc.customerName?.toLowerCase().includes(query) || false;
        const matchDoc = doc.customerDocument?.toLowerCase().includes(query) || false;
        const matchDesc = doc.description?.toLowerCase().includes(query) || false;
        if (!matchNumber && !matchCustomer && !matchDoc && !matchDesc) return false;
      }
      return true;
    });
  }

  // 2. Obter Documento de Faturamento por ID
  getBillingDocumentById(schemaNamespace: string, id: string): BillingDocument | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    return storage?.billingDocuments.find((doc) => doc.id === id);
  }

  // 3. Criar Documento de Faturamento (Manual ou Direto)
  createBillingDocument(
    schemaNamespace: string,
    data: {
      customerId: string;
      customerName?: string;
      customerDocument?: string;
      sourceType?: BillingSourceType;
      sourceId?: string;
      sourceNumber?: string;
      recurringBillingId?: string;
      issueDate?: string;
      competenceDate?: string;
      dueDate: string;
      description?: string;
      notes?: string;
      items: Array<{
        itemType?: BillingItemType;
        productId?: string;
        serviceId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        surcharge?: number;
      }>;
      status?: BillingDocumentStatus;
    },
    userId: string,
    userName: string
  ): BillingDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    // 1. Contador Sequencial FAT-00000X
    const counter = (storage.sequentialCounters.billing || 0) + 1;
    storage.sequentialCounters.billing = counter;
    const number = `FAT-${String(counter).padStart(6, '0')}`;
    const billingId = `fat-${crypto.randomUUID().slice(0, 8)}`;

    const issueDate = data.issueDate || new Date().toISOString().split('T')[0];
    const comp = CompetenceHelper.getCompetenceForDate(data.competenceDate || issueDate);

    // 2. Itens e Cálculos com Matemática Financeira
    let subtotal = 0;
    let totalDiscount = 0;
    let totalSurcharge = 0;

    const items: BillingItem[] = (data.items || []).map((item, idx) => {
      const calc = BillingMath.calculateItem(
        item.quantity,
        item.unitPrice,
        item.discount || 0,
        item.surcharge || 0
      );
      subtotal = BillingMath.round(subtotal + calc.subtotal);
      totalDiscount = BillingMath.round(totalDiscount + (item.discount || 0));
      totalSurcharge = BillingMath.round(totalSurcharge + (item.surcharge || 0));

      return {
        id: `item-fat-${crypto.randomUUID().slice(0, 8)}`,
        billingId,
        itemType: item.itemType || 'SERVICE',
        productId: item.productId,
        serviceId: item.serviceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: BillingMath.round(item.unitPrice),
        discount: BillingMath.round(item.discount || 0),
        surcharge: BillingMath.round(item.surcharge || 0),
        total: calc.total,
        sortOrder: idx + 1,
        sourceType: data.sourceType || 'MANUAL',
        sourceId: data.sourceId,
      };
    });

    const total = BillingMath.round(subtotal - totalDiscount + totalSurcharge);

    const doc: BillingDocument = {
      id: billingId,
      instanceId: schemaNamespace,
      customerId: data.customerId,
      customerName: data.customerName || 'Cliente',
      customerDocument: data.customerDocument,
      number,
      status: data.status || 'PENDING',
      sourceType: data.sourceType || 'MANUAL',
      sourceId: data.sourceId,
      sourceNumber: data.sourceNumber,
      recurringBillingId: data.recurringBillingId,
      issueDate,
      competenceStart: comp.competenceStart,
      competenceEnd: comp.competenceEnd,
      competenceLabel: comp.competenceLabel,
      dueDate: data.dueDate,
      subtotal,
      discount: totalDiscount,
      surcharge: totalSurcharge,
      total,
      description: data.description,
      notes: data.notes,
      items,
      createdBy: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (doc.status === 'ISSUED') {
      doc.issuedAt = new Date().toISOString();
      doc.issuedBy = userName;

      // Sincronização direta com Contas a Receber (PRD 05)
      try {
        const coa = storage.chartOfAccounts.find((c) => c.code.startsWith('3.') || c.nature === 'CREDORA') || storage.chartOfAccounts[0];
        this.createAccountReceivable(schemaNamespace, {
          customerId: doc.customerId,
          customerName: doc.customerName,
          customerDocument: doc.customerDocument,
          description: `Faturamento ${doc.number} - ${doc.description || 'Operação Comercial/Serviço'}`,
          originalValue: doc.total,
          dueDate: doc.dueDate,
          issueDate: doc.issueDate,
          chartOfAccountId: coa?.id || 'coa-rec-default',
          chartOfAccountCode: coa?.code || '3.1.01',
          saleId: doc.sourceType === 'SALE' ? doc.sourceId : undefined,
          saleNumber: doc.sourceType === 'SALE' ? doc.sourceNumber : undefined,
          contractId: doc.sourceType === 'CONTRACT' ? doc.sourceId : undefined,
          contractNumber: doc.sourceType === 'CONTRACT' ? doc.sourceNumber : undefined,
        });
      } catch {
        // Silencioso
      }
    }

    storage.billingDocuments.unshift(doc);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().billing.createBilling(cleanCnpj, doc).catch((err: any) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de faturamento: ${err.message}`, {
          cleanCnpj,
          billingId: doc.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }

    this.recordTenantAudit(
      schemaNamespace,
      'CREATE_BILLING',
      'BILLING',
      doc.id,
      { number: doc.number, total: doc.total, customerId: doc.customerId },
      userId
    );

    return doc;
  }

  async createBillingDocumentAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createBillingDocument']>[1],
    userId: string,
    userName: string
  ): Promise<BillingDocument> {
    const doc = this.createBillingDocument(schemaNamespace, data, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().billing.createBilling(cleanCnpj, doc);
    }
    return doc;
  }

  // 4. Atualizar Documento de Faturamento (Apenas se PENDING)
  updateBillingDocument(
    schemaNamespace: string,
    id: string,
    data: Partial<BillingDocument> & { competenceDate?: string },
    userId: string,
    userName: string
  ): BillingDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const doc = storage.billingDocuments.find((d) => d.id === id);
    if (!doc) throw new Error(`Documento de faturamento [${id}] não encontrado.`);

    BillingStateMachine.assertEditable(doc);

    if (data.items) {
      let subtotal = 0;
      let totalDiscount = 0;
      let totalSurcharge = 0;

      doc.items = data.items.map((item, idx) => {
        const calc = BillingMath.calculateItem(
          item.quantity,
          item.unitPrice,
          item.discount || 0,
          item.surcharge || 0
        );
        subtotal = BillingMath.round(subtotal + calc.subtotal);
        totalDiscount = BillingMath.round(totalDiscount + (item.discount || 0));
        totalSurcharge = BillingMath.round(totalSurcharge + (item.surcharge || 0));

        return {
          id: item.id || `item-fat-${crypto.randomUUID().slice(0, 8)}`,
          billingId: doc.id,
          itemType: item.itemType || 'SERVICE',
          productId: item.productId,
          serviceId: item.serviceId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: BillingMath.round(item.unitPrice),
          discount: BillingMath.round(item.discount || 0),
          surcharge: BillingMath.round(item.surcharge || 0),
          total: calc.total,
          sortOrder: idx + 1,
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
        };
      });

      doc.subtotal = subtotal;
      doc.discount = totalDiscount;
      doc.surcharge = totalSurcharge;
      doc.total = BillingMath.round(subtotal - totalDiscount + totalSurcharge);
    }

    if (data.dueDate) doc.dueDate = data.dueDate;
    if (data.description !== undefined) doc.description = data.description;
    if (data.notes !== undefined) doc.notes = data.notes;
    if (data.customerName) doc.customerName = data.customerName;
    if (data.customerDocument) doc.customerDocument = data.customerDocument;
    if (data.competenceDate) {
      const comp = CompetenceHelper.getCompetenceForDate(data.competenceDate);
      doc.competenceStart = comp.competenceStart;
      doc.competenceEnd = comp.competenceEnd;
      doc.competenceLabel = comp.competenceLabel;
    }

    doc.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'UPDATE_BILLING',
      'BILLING',
      doc.id,
      { number: doc.number, total: doc.total },
      userId
    );

    return doc;
  }

  // 5. Emitir Documento de Faturamento (Transição para ISSUED)
  issueBillingDocument(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string
  ): BillingDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const doc = storage.billingDocuments.find((d) => d.id === id);
    if (!doc) throw new Error(`Documento de faturamento [${id}] não encontrado.`);

    if (!BillingStateMachine.canTransition(doc.status, 'ISSUED')) {
      throw new Error(`Transição de status inválida de ${doc.status} para ISSUED.`);
    }

    doc.status = 'ISSUED';
    doc.issuedAt = new Date().toISOString();
    doc.issuedBy = userName;
    doc.updatedAt = new Date().toISOString();

    // Sincronização direta com Contas a Receber (PRD 05)
    try {
      const coa = storage.chartOfAccounts.find((c) => c.code.startsWith('3.') || c.nature === 'CREDORA') || storage.chartOfAccounts[0];
      this.createAccountReceivable(schemaNamespace, {
        customerId: doc.customerId,
        customerName: doc.customerName,
        customerDocument: doc.customerDocument,
        description: `Faturamento ${doc.number} - ${doc.description || 'Operação Comercial/Serviço'}`,
        originalValue: doc.total,
        dueDate: doc.dueDate,
        issueDate: doc.issueDate,
        chartOfAccountId: coa?.id || 'coa-rec-default',
        chartOfAccountCode: coa?.code || '3.1.01',
        saleId: doc.sourceType === 'SALE' ? doc.sourceId : undefined,
        saleNumber: doc.sourceType === 'SALE' ? doc.sourceNumber : undefined,
        contractId: doc.sourceType === 'CONTRACT' ? doc.sourceId : undefined,
        contractNumber: doc.sourceType === 'CONTRACT' ? doc.sourceNumber : undefined,
      });
    } catch {
      // Silencioso
    }

    this.recordTenantAudit(
      schemaNamespace,
      'ISSUE_BILLING',
      'BILLING',
      doc.id,
      { number: doc.number, total: doc.total },
      userId
    );

    return doc;
  }

  async issueBillingDocumentAsync(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string
  ): Promise<BillingDocument> {
    const doc = this.issueBillingDocument(schemaNamespace, id, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        const storage = this.getTenantStorage(schemaNamespace);
        const rec = storage?.accountsReceivable.find((r) => r.description?.includes(doc.number));
        if (rec) {
          const recV2: any = {
            id: rec.id,
            instanceId: rec.id,
            customerId: rec.customerId,
            customerName: rec.customerName,
            customerDocument: rec.customerDocument,
            description: rec.description,
            originalAmount: rec.originalValue,
            paidAmount: rec.originalValue - rec.balanceValue,
            remainingAmount: rec.balanceValue,
            status: 'OPEN',
            dueDate: rec.dueDate,
            createdAt: rec.createdAt,
            updatedAt: rec.updatedAt,
          };
          await RepositoryManager.getInstance().getRepositories().receivables.createReceivable(cleanCnpj, recV2);
        }
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de faturamento emitido: ${err.message}`, {
          cleanCnpj,
          docId: doc.id,
        });
      }
    }
    return doc;
  }

  // 6. Cancelar Documento de Faturamento (PRD Seção 38 - Motivo Obrigatório)
  cancelBillingDocument(
    schemaNamespace: string,
    id: string,
    reason: string,
    userId: string,
    userName: string
  ): BillingDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const doc = storage.billingDocuments.find((d) => d.id === id);
    if (!doc) throw new Error(`Documento de faturamento [${id}] não encontrado.`);

    if (!reason || reason.trim().length < 5) {
      throw new Error('Motivo de cancelamento é obrigatório e deve ter no mínimo 5 caracteres.');
    }

    if (!BillingStateMachine.canTransition(doc.status, 'CANCELED')) {
      throw new Error(`Transição de status inválida de ${doc.status} para CANCELED.`);
    }

    doc.status = 'CANCELED';
    doc.cancellationReason = reason.trim();
    doc.canceledAt = new Date().toISOString();
    doc.canceledBy = userName;
    doc.updatedAt = new Date().toISOString();

    // Estorno coordenado de título em contas a receber caso em aberto
    const linkedRec = storage.accountsReceivable.find(
      (r) => r.description.includes(doc.number) && r.status === 'OPEN'
    );
    if (linkedRec) {
      linkedRec.status = 'CANCELED';
    }

    this.recordTenantAudit(
      schemaNamespace,
      'CANCEL_BILLING',
      'BILLING',
      doc.id,
      { number: doc.number, reason: doc.cancellationReason },
      userId
    );

    return doc;
  }

  async updateBillingDocumentAsync(
    schemaNamespace: string,
    id: string,
    data: Parameters<DatabaseEngine['updateBillingDocument']>[2],
    userId: string,
    userName: string
  ): Promise<BillingDocument> {
    const doc = this.updateBillingDocument(schemaNamespace, id, data, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().billing.updateBilling(cleanCnpj, id, doc);
    }
    return doc;
  }

  async cancelBillingDocumentAsync(
    schemaNamespace: string,
    id: string,
    reason: string,
    userId: string,
    userName: string
  ): Promise<BillingDocument> {
    const doc = this.cancelBillingDocument(schemaNamespace, id, reason, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().billing.updateBilling(cleanCnpj, id, {
        status: doc.status,
        cancellationReason: doc.cancellationReason,
        canceledAt: doc.canceledAt,
        canceledBy: doc.canceledBy,
        updatedAt: doc.updatedAt,
      });
    }
    return doc;
  }

  // 7. Faturar Pedido de Venda (Idempotente & Snapshot de Itens)
  createBillingFromSale(
    schemaNamespace: string,
    saleId: string,
    userId: string,
    userName: string
  ): BillingDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const sale = storage.sales.find((s) => s.id === saleId);
    if (!sale) throw new Error(`Pedido de venda [${saleId}] não encontrado.`);

    // Verificação de duplicidade (não faturar duas vezes a mesma venda ativa)
    const existing = storage.billingDocuments.find(
      (b) => b.sourceType === 'SALE' && b.sourceId === saleId && b.status !== 'CANCELED'
    );
    if (existing) {
      throw new Error(`O pedido de venda ${sale.number} já foi faturado no documento ${existing.number}.`);
    }

    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    return this.createBillingDocument(
      schemaNamespace,
      {
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerDocument: sale.customerDocument,
        sourceType: 'SALE',
        sourceId: sale.id,
        sourceNumber: sale.number,
        issueDate: new Date().toISOString().split('T')[0],
        competenceDate: sale.saleDate,
        dueDate,
        description: `Faturamento Pedido de Venda ${sale.number}`,
        items: sale.items.map((it) => ({
          itemType: it.itemType,
          productId: it.productId,
          serviceId: it.serviceId,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          surcharge: it.surcharge,
        })),
        status: 'ISSUED',
      },
      userId,
      userName
    );
  }

  // 8. Faturar Ordem de Serviço (Idempotente & Snapshot de Itens)
  createBillingFromServiceOrder(
    schemaNamespace: string,
    osId: string,
    userId: string,
    userName: string
  ): BillingDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const os = storage.serviceOrders.find((o) => o.id === osId);
    if (!os) throw new Error(`Ordem de serviço [${osId}] não encontrada.`);

    const existing = storage.billingDocuments.find(
      (b) => b.sourceType === 'SERVICE_ORDER' && b.sourceId === osId && b.status !== 'CANCELED'
    );
    if (existing) {
      throw new Error(`A ordem de serviço ${os.number} já foi faturada no documento ${existing.number}.`);
    }

    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const items = (os.items && os.items.length > 0)
      ? os.items.map((it) => ({
          itemType: (it.itemType || 'SERVICE') as BillingItemType,
          productId: undefined,
          serviceId: it.serviceId,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: 0,
          surcharge: 0,
        }))
      : [
          {
            itemType: 'SERVICE' as BillingItemType,
            description: `Execução de OS: ${os.title}`,
            quantity: 1,
            unitPrice: 500.0,
            discount: 0,
            surcharge: 0,
          },
        ];

    return this.createBillingDocument(
      schemaNamespace,
      {
        customerId: os.customerId,
        customerName: os.customerName,
        customerDocument: os.customerDocument,
        sourceType: 'SERVICE_ORDER',
        sourceId: os.id,
        sourceNumber: os.number,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate,
        description: `Faturamento Ordem de Serviço ${os.number} - ${os.title}`,
        items,
        status: 'ISSUED',
      },
      userId,
      userName
    );
  }

  async createBillingFromSaleAsync(
    schemaNamespace: string,
    saleId: string,
    userId: string,
    userName: string
  ): Promise<BillingDocument> {
    const doc = this.createBillingFromSale(schemaNamespace, saleId, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().billing.createBilling(cleanCnpj, doc);
    }
    return doc;
  }

  async createBillingFromServiceOrderAsync(
    schemaNamespace: string,
    osId: string,
    userId: string,
    userName: string
  ): Promise<BillingDocument> {
    const doc = this.createBillingFromServiceOrder(schemaNamespace, osId, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().billing.createBilling(cleanCnpj, doc);
    }
    return doc;
  }

  // 9. Dashboard de Faturamento (Métricas e Agrupamentos)
  getBillingDashboard(schemaNamespace: string): BillingDashboardMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      return {
        totalIssuedValue: 0,
        totalIssuedCount: 0,
        totalCanceledValue: 0,
        totalCanceledCount: 0,
        totalPendingValue: 0,
        totalPendingCount: 0,
        totalDraftCount: 0,
        activeRecurringCount: 0,
        activeRecurringMonthlyValue: 0,
        upcomingDueCount: 0,
        upcomingDueValue: 0,
        byCompetence: [],
        bySource: [],
        totalBilledCurrentMonth: 0,
        totalBilledPreviousMonth: 0,
        pendingCount: 0,
        pendingValue: 0,
        issuedCount: 0,
        issuedValue: 0,
        canceledCount: 0,
        canceledValue: 0,
        monthlyRecurringRevenue: 0,
        byStatus: { PENDING: 0, ISSUED: 0, CANCELED: 0 },
        bySourceType: { SALE: 0, CONTRACT: 0, SERVICE_ORDER: 0, MANUAL: 0 },
      };
    }

    const now = new Date();
    const currentComp = CompetenceHelper.getCompetenceForDate(now.toISOString());
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const prevComp = CompetenceHelper.getCompetenceForDate(prevMonthDate.toISOString());

    let totalBilledCurrentMonth = 0;
    let totalBilledPreviousMonth = 0;
    let pendingCount = 0;
    let pendingValue = 0;
    let issuedCount = 0;
    let issuedValue = 0;
    let canceledCount = 0;
    let canceledValue = 0;

    const byStatus = { PENDING: 0, ISSUED: 0, CANCELED: 0 };
    const bySourceType: Record<string, number> = { SALE: 0, CONTRACT: 0, SERVICE_ORDER: 0, MANUAL: 0 };

    for (const doc of storage.billingDocuments) {
      if (doc.status === 'PENDING') {
        pendingCount++;
        pendingValue = BillingMath.round(pendingValue + doc.total);
        byStatus.PENDING++;
      } else if (doc.status === 'ISSUED') {
        issuedCount++;
        issuedValue = BillingMath.round(issuedValue + doc.total);
        byStatus.ISSUED++;

        if (doc.competenceLabel === currentComp.competenceLabel) {
          totalBilledCurrentMonth = BillingMath.round(totalBilledCurrentMonth + doc.total);
        } else if (doc.competenceLabel === prevComp.competenceLabel) {
          totalBilledPreviousMonth = BillingMath.round(totalBilledPreviousMonth + doc.total);
        }
      } else if (doc.status === 'CANCELED') {
        canceledCount++;
        canceledValue = BillingMath.round(canceledValue + doc.total);
        byStatus.CANCELED++;
      }

      bySourceType[doc.sourceType] = (bySourceType[doc.sourceType] || 0) + 1;
    }

    const activeRecurrings = storage.recurringBillings.filter((r) => r.status === 'ACTIVE');
    const activeRecurringCount = activeRecurrings.length;
    let monthlyRecurringRevenue = 0;

    for (const rec of activeRecurrings) {
      if (rec.frequency === 'MONTHLY') {
        monthlyRecurringRevenue = BillingMath.round(monthlyRecurringRevenue + rec.amount);
      } else if (rec.frequency === 'QUARTERLY') {
        monthlyRecurringRevenue = BillingMath.round(monthlyRecurringRevenue + (rec.amount / 3));
      } else if (rec.frequency === 'SEMIANNUAL') {
        monthlyRecurringRevenue = BillingMath.round(monthlyRecurringRevenue + (rec.amount / 6));
      } else if (rec.frequency === 'YEARLY') {
        monthlyRecurringRevenue = BillingMath.round(monthlyRecurringRevenue + (rec.amount / 12));
      }
    }

    const bySource: Array<{ sourceType: BillingSourceType; total: number; count: number }> = [
      { sourceType: 'SALE', total: 0, count: bySourceType.SALE || 0 },
      { sourceType: 'CONTRACT', total: 0, count: bySourceType.CONTRACT || 0 },
      { sourceType: 'SERVICE_ORDER', total: 0, count: bySourceType.SERVICE_ORDER || 0 },
      { sourceType: 'MANUAL', total: 0, count: bySourceType.MANUAL || 0 },
    ];

    for (const doc of storage.billingDocuments) {
      const src = bySource.find((s) => s.sourceType === doc.sourceType);
      if (src) {
        src.total = BillingMath.round(src.total + doc.total);
      }
    }

    return {
      totalIssuedValue: issuedValue,
      totalIssuedCount: issuedCount,
      totalCanceledValue: canceledValue,
      totalCanceledCount: canceledCount,
      totalPendingValue: pendingValue,
      totalPendingCount: pendingCount,
      totalDraftCount: 0,
      activeRecurringCount,
      activeRecurringMonthlyValue: monthlyRecurringRevenue,
      upcomingDueCount: 0,
      upcomingDueValue: 0,
      byCompetence: [],
      bySource,
      totalBilledCurrentMonth,
      totalBilledPreviousMonth,
      pendingCount,
      pendingValue,
      issuedCount,
      issuedValue,
      canceledCount,
      canceledValue,
      monthlyRecurringRevenue,
      byStatus,
      bySourceType,
    };
  }

  // 10. Consulta de Faturamentos Recorrentes
  getRecurringBillings(
    schemaNamespace: string,
    filters?: { status?: string; customerId?: string; search?: string }
  ): RecurringBilling[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    return storage.recurringBillings.filter((r) => {
      if (filters?.status && r.status !== filters.status) return false;
      if (filters?.customerId && r.customerId !== filters.customerId) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const matchCust = r.customerName?.toLowerCase().includes(q) || false;
        const matchDesc = r.description?.toLowerCase().includes(q) || false;
        const matchContract = r.contractNumber?.toLowerCase().includes(q) || false;
        if (!matchCust && !matchDesc && !matchContract) return false;
      }
      return true;
    });
  }

  // 11. Obter Recorrência por ID
  getRecurringBillingById(schemaNamespace: string, id: string): RecurringBilling | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    return storage?.recurringBillings.find((r) => r.id === id);
  }

  // 12. Criar Faturamento Recorrente
  createRecurringBilling(
    schemaNamespace: string,
    data: {
      customerId: string;
      customerName?: string;
      customerDocument?: string;
      contractId?: string;
      contractNumber?: string;
      frequency: RecurringFrequency;
      startDate: string;
      endDate?: string;
      nextBillingDate?: string;
      dayOfMonth: number;
      dueRule: DueRule;
      dueDays: number;
      amount?: number;
      description: string;
      notes?: string;
      items?: RecurringBillingItem[];
    },
    userId: string,
    userName: string
  ): RecurringBilling {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const id = `rec-bill-${crypto.randomUUID().slice(0, 8)}`;
    const nextBillingDate = data.nextBillingDate || data.startDate;

    const items: RecurringBillingItem[] = (data.items && data.items.length > 0)
      ? data.items
      : [
          {
            description: data.description,
            itemType: 'SERVICE',
            quantity: 1,
            unitPrice: data.amount || 0,
            discount: 0,
            surcharge: 0,
            total: data.amount || 0,
          },
        ];

    const totalFromItems = items.reduce(
      (acc, it) => acc + (it.total || (it.quantity * it.unitPrice - (it.discount || 0) + (it.surcharge || 0))),
      0
    );
    const amount = data.amount !== undefined ? BillingMath.round(data.amount) : BillingMath.round(totalFromItems);

    const recurring: RecurringBilling = {
      id,
      instanceId: schemaNamespace,
      customerId: data.customerId,
      customerName: data.customerName || 'Cliente',
      customerDocument: data.customerDocument,
      contractId: data.contractId,
      contractNumber: data.contractNumber,
      status: 'ACTIVE',
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate,
      nextBillingDate,
      dayOfMonth: data.dayOfMonth || 10,
      dueRule: data.dueRule || 'FIXED_DAY',
      dueDays: data.dueDays || 10,
      amount,
      description: data.description,
      notes: data.notes,
      items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.recurringBillings.unshift(recurring);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().billing.createRecurring(cleanCnpj, recurring).catch((err) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de faturamento recorrente: ${err.message}`, {
          cleanCnpj,
          recurringId: recurring.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }

    this.recordTenantAudit(
      schemaNamespace,
      'CREATE_RECURRING_BILLING',
      'RECURRING_BILLING',
      recurring.id,
      { customerId: recurring.customerId, amount: recurring.amount, frequency: recurring.frequency },
      userId
    );

    return recurring;
  }

  async createRecurringBillingAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createRecurringBilling']>[1],
    userId: string,
    userName: string
  ): Promise<RecurringBilling> {
    const recurring = this.createRecurringBilling(schemaNamespace, data, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().billing.createRecurring(cleanCnpj, recurring);
    }
    return recurring;
  }

  // 13. Atualizar Faturamento Recorrente
  updateRecurringBilling(
    schemaNamespace: string,
    id: string,
    data: Partial<RecurringBilling>,
    userId: string,
    userName: string
  ): RecurringBilling {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const recurring = storage.recurringBillings.find((r) => r.id === id);
    if (!recurring) throw new Error(`Recorrência [${id}] não encontrada.`);

    if (data.frequency) recurring.frequency = data.frequency;
    if (data.startDate) recurring.startDate = data.startDate;
    if (data.endDate !== undefined) recurring.endDate = data.endDate;
    if (data.nextBillingDate) recurring.nextBillingDate = data.nextBillingDate;
    if (data.dayOfMonth !== undefined) recurring.dayOfMonth = data.dayOfMonth;
    if (data.dueRule) recurring.dueRule = data.dueRule;
    if (data.dueDays !== undefined) recurring.dueDays = data.dueDays;
    if (data.amount !== undefined) recurring.amount = BillingMath.round(data.amount);
    if (data.description) recurring.description = data.description;
    if (data.notes !== undefined) recurring.notes = data.notes;
    if (data.items) recurring.items = data.items;
    if (data.customerName) recurring.customerName = data.customerName;
    if (data.customerDocument) recurring.customerDocument = data.customerDocument;

    recurring.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'UPDATE_RECURRING_BILLING',
      'RECURRING_BILLING',
      recurring.id,
      { amount: recurring.amount },
      userId
    );

    return recurring;
  }

  async updateRecurringBillingAsync(
    schemaNamespace: string,
    id: string,
    data: Partial<RecurringBilling>,
    userId: string,
    userName: string
  ): Promise<RecurringBilling> {
    const recurring = this.updateRecurringBilling(schemaNamespace, id, data, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().billing.updateRecurring(cleanCnpj, id, recurring);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de atualização de recorrência: ${err.message}`, {
          cleanCnpj,
          recurringId: id,
        });
      }
    }
    return recurring;
  }

  // 14. Alterar Status de Recorrência (ACTIVE, PAUSED, CANCELED)
  setRecurringBillingStatus(
    schemaNamespace: string,
    id: string,
    status: RecurringStatus,
    userId: string,
    userName: string
  ): RecurringBilling {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const recurring = storage.recurringBillings.find((r) => r.id === id);
    if (!recurring) throw new Error(`Recorrência [${id}] não encontrada.`);

    recurring.status = status;
    recurring.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'SET_RECURRING_STATUS',
      'RECURRING_BILLING',
      recurring.id,
      { status },
      userId
    );

    return recurring;
  }

  async setRecurringBillingStatusAsync(
    schemaNamespace: string,
    id: string,
    status: RecurringStatus,
    userId: string,
    userName: string
  ): Promise<RecurringBilling> {
    const recurring = this.setRecurringBillingStatus(schemaNamespace, id, status, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().billing.updateRecurring(cleanCnpj, id, { status });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de status de recorrência: ${err.message}`, {
          cleanCnpj,
          recurringId: id,
        });
      }
    }
    return recurring;
  }

  // 15. Geração Idempotente de Recorrência (PRD Seção 24 & 26)
  generateRecurringBilling(
    schemaNamespace: string,
    recurringId: string,
    targetDate?: string,
    userId?: string,
    userName?: string,
    force?: boolean
  ): { billing: BillingDocument; log: BillingGenerationLog } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const recurring = storage.recurringBillings.find((r) => r.id === recurringId);
    if (!recurring) throw new Error(`Recorrência [${recurringId}] não encontrada.`);

    if (recurring.status !== 'ACTIVE' && !force) {
      throw new Error(`Recorrência está ${recurring.status}. Apenas recorrências ATIVAS podem ser faturadas.`);
    }

    const execDate = targetDate || recurring.nextBillingDate || new Date().toISOString().split('T')[0];
    const comp = CompetenceHelper.getCompetenceForDate(execDate);

    // Bloqueio de Concorrência & Idempotência
    return RecurringBillingConcurrencyManager.withLockSync(schemaNamespace, recurringId, comp.competenceLabel, () => {
      // 1. Verificação de Idempotência (PRD Seção 24)
      const existingSuccessLog = storage.billingGenerationLogs.find(
        (l) =>
          l.recurringBillingId === recurringId &&
          l.competenceLabel === comp.competenceLabel &&
          l.status === 'SUCCESS'
      );

      const existingDoc = storage.billingDocuments.find(
        (b) =>
          b.recurringBillingId === recurringId &&
          b.competenceLabel === comp.competenceLabel &&
          b.status !== 'CANCELED'
      );

      if ((existingSuccessLog || existingDoc) && !force) {
        throw new Error(
          `Idempotência: Faturamento da recorrência para a competência ${comp.competenceLabel} já foi gerado com sucesso (Documento: ${existingDoc?.number || existingSuccessLog?.billingNumber}).`
        );
      }

      // 2. Cálculo da Data de Vencimento
      const issueDate = new Date().toISOString().split('T')[0];
      const dueDate = CompetenceHelper.calculateDueDate(
        issueDate,
        comp.competenceEnd,
        recurring.dueRule,
        recurring.dueDays,
        recurring.dayOfMonth
      );

      // 3. Itens do faturamento
      const billingItems = recurring.items.map((it) => ({
        itemType: it.itemType || ('SERVICE' as BillingItemType),
        productId: it.productId,
        serviceId: it.serviceId,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: it.discount,
        surcharge: it.surcharge,
      }));

      // 4. Criação do Documento de Faturamento
      const billing = this.createBillingDocument(
        schemaNamespace,
        {
          customerId: recurring.customerId,
          customerName: recurring.customerName,
          customerDocument: recurring.customerDocument,
          sourceType: 'CONTRACT',
          sourceId: recurring.contractId,
          sourceNumber: recurring.contractNumber,
          recurringBillingId: recurring.id,
          issueDate,
          competenceDate: execDate,
          dueDate,
          description: `${recurring.description} - Competência ${comp.competenceLabel}`,
          items: billingItems,
          status: 'ISSUED',
        },
        userId || 'system',
        userName || 'Processamento Automático'
      );

      // 5. Atualização da Recorrência
      recurring.lastGeneratedCompetence = comp.competenceLabel;
      recurring.lastGeneratedAt = new Date().toISOString();
      recurring.lastGeneratedBillingId = billing.id;
      recurring.lastGeneratedBillingNumber = billing.number;
      recurring.lastError = undefined;

      // Avança próxima data de faturamento
      recurring.nextBillingDate = CompetenceHelper.advanceNextBillingDate(
        execDate,
        recurring.frequency,
        recurring.customIntervalMonths || 1,
        recurring.dayOfMonth
      );
      recurring.updatedAt = new Date().toISOString();

      // 6. Registro do Log de Geração
      const log: BillingGenerationLog = {
        id: `log-gen-${crypto.randomUUID().slice(0, 8)}`,
        instanceId: schemaNamespace,
        recurringBillingId: recurring.id,
        competenceStart: comp.competenceStart,
        competenceEnd: comp.competenceEnd,
        competenceLabel: comp.competenceLabel,
        billingId: billing.id,
        billingNumber: billing.number,
        status: 'SUCCESS',
        attemptCount: 1,
        executedAt: new Date().toISOString(),
        workerId: 'worker-engine',
      };
      storage.billingGenerationLogs.unshift(log);

      return { billing, log };
    });
  }

  async generateRecurringBillingAsync(
    schemaNamespace: string,
    recurringId: string,
    targetDate?: string,
    userId?: string,
    userName?: string,
    force?: boolean
  ): Promise<{ billing: BillingDocument; log: BillingGenerationLog }> {
    const res = this.generateRecurringBilling(schemaNamespace, recurringId, targetDate, userId, userName, force);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().billing.createBilling(cleanCnpj, res.billing);
        await RepositoryManager.getInstance().getRepositories().billing.logGeneration(cleanCnpj, res.log);
        await RepositoryManager.getInstance().getRepositories().billing.updateRecurring(cleanCnpj, recurringId, {
          lastGeneratedCompetence: res.log.competenceLabel,
          lastGeneratedAt: res.log.executedAt,
          lastGeneratedBillingId: res.billing.id,
          lastGeneratedBillingNumber: res.billing.number,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de geração de recorrência: ${err.message}`, {
          cleanCnpj,
          recurringId,
          billingId: res.billing.id,
        });
      }
    }
    return res;
  }

  // 16. Processar Recorrências Vencidas em Lote (Batch)
  processDueRecurringBillings(
    schemaNamespace: string,
    userId?: string,
    userName?: string
  ): {
    totalEvaluated: number;
    generatedCount: number;
    failedCount: number;
    results: Array<{ recurringId: string; success: boolean; billingNumber?: string; error?: string }>;
  } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Tenant [${schemaNamespace}] não encontrado.`);

    const todayStr = new Date().toISOString().split('T')[0];
    const dueRecurrings = storage.recurringBillings.filter(
      (r) => r.status === 'ACTIVE' && r.nextBillingDate <= todayStr
    );

    let generatedCount = 0;
    let failedCount = 0;
    const results: Array<{ recurringId: string; success: boolean; billingNumber?: string; error?: string }> = [];

    for (const rec of dueRecurrings) {
      try {
        const { billing } = this.generateRecurringBilling(
          schemaNamespace,
          rec.id,
          rec.nextBillingDate,
          userId,
          userName,
          false
        );
        generatedCount++;
        results.push({ recurringId: rec.id, success: true, billingNumber: billing.number });
      } catch (err: any) {
        failedCount++;
        const errorMessage = err?.message || 'Erro desconhecido ao faturar recorrência.';
        rec.lastError = {
          code: 'GENERATION_ERROR',
          message: errorMessage,
          timestamp: new Date().toISOString(),
        };
        rec.updatedAt = new Date().toISOString();

        const comp = CompetenceHelper.getCompetenceForDate(rec.nextBillingDate || todayStr);
        storage.billingGenerationLogs.unshift({
          id: `log-gen-${crypto.randomUUID().slice(0, 8)}`,
          instanceId: schemaNamespace,
          recurringBillingId: rec.id,
          competenceStart: comp.competenceStart,
          competenceEnd: comp.competenceEnd,
          competenceLabel: comp.competenceLabel,
          status: 'FAILED',
          errorMessage,
          attemptCount: 1,
          executedAt: new Date().toISOString(),
          workerId: 'worker-engine-batch',
        });

        results.push({ recurringId: rec.id, success: false, error: errorMessage });
      }
    }

    return {
      totalEvaluated: dueRecurrings.length,
      generatedCount,
      failedCount,
      results,
    };
  }

  async processDueRecurringBillingsAsync(
    schemaNamespace: string,
    userId?: string,
    userName?: string
  ): Promise<{
    totalEvaluated: number;
    generatedCount: number;
    failedCount: number;
    results: Array<{ recurringId: string; success: boolean; billingNumber?: string; error?: string }>;
  }> {
    const res = this.processDueRecurringBillings(schemaNamespace, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        const storage = this.getTenantStorage(schemaNamespace);
        for (const item of res.results) {
          if (item.success && item.billingNumber) {
            const billDoc = storage?.billingDocuments.find((b) => b.number === item.billingNumber);
            if (billDoc) {
              await RepositoryManager.getInstance().getRepositories().billing.createBilling(cleanCnpj, billDoc);
            }
          }
        }
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na sincronização PostgreSQL de processamento em lote de recorrências: ${err.message}`, {
          cleanCnpj,
        });
      }
    }
    return res;
  }

  // 17. Histórico de Logs de Faturamento Recorrente
  getBillingGenerationLogs(schemaNamespace: string, recurringBillingId?: string): BillingGenerationLog[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    if (recurringBillingId) {
      return storage.billingGenerationLogs.filter((l) => l.recurringBillingId === recurringBillingId);
    }
    return storage.billingGenerationLogs;
  }

  listBillingGenerationLogs(schemaNamespace: string, recurringBillingId?: string): BillingGenerationLog[] {
    return this.getBillingGenerationLogs(schemaNamespace, recurringBillingId);
  }

  listBillingDocuments(
    schemaNamespace: string,
    filters?: {
      status?: string;
      customerId?: string;
      sourceType?: string;
      competence?: string;
      search?: string;
    }
  ): BillingDocument[] {
    return this.getBillingDocuments(schemaNamespace, filters);
  }

  listRecurringBillings(schemaNamespace: string): RecurringBilling[] {
    return this.getRecurringBillings(schemaNamespace);
  }

  // ============================================================================
  // PRD 06 — GESTÃO DE ESTOQUE & ALMOXARIFADO (WMS BÁSICO)
  // ============================================================================

  // 1. Depósitos (Warehouses)
  listWarehouses(schemaNamespace: string): Warehouse[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return storage.warehouses || [];
  }

  getWarehouseById(schemaNamespace: string, id: string): Warehouse | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return (storage.warehouses || []).find((w) => w.id === id);
  }

  createWarehouse(
    schemaNamespace: string,
    data: {
      code?: string;
      name: string;
      description?: string;
      location?: string;
      isDefault?: boolean;
    },
    companyId: string
  ): Warehouse {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não provisionado.`);

    storage.sequentialCounters.warehouse = (storage.sequentialCounters.warehouse || 0) + 1;
    const code = data.code?.trim().toUpperCase() || InventoryEngine.formatWarehouseCode(storage.sequentialCounters.warehouse);

    // Se for marcado como padrão ou for o primeiro, atualiza flags
    if (data.isDefault || storage.warehouses.length === 0) {
      storage.warehouses.forEach((w) => {
        w.isDefault = false;
      });
    }

    const newWarehouse: Warehouse = {
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      companyId,
      code,
      name: data.name.trim(),
      description: data.description?.trim(),
      location: data.location?.trim(),
      isDefault: !!data.isDefault || storage.warehouses.length === 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.warehouses.push(newWarehouse);
    return newWarehouse;
  }

  async createWarehouseAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createWarehouse']>[1],
    companyId: string
  ): Promise<Warehouse> {
    const warehouse = this.createWarehouse(schemaNamespace, data, companyId);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().inventory.createWarehouse(cleanCnpj, warehouse);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de depósito: ${err.message}`, {
          cleanCnpj,
          warehouseId: warehouse.id,
        });
      }
    }
    return warehouse;
  }

  updateWarehouse(
    schemaNamespace: string,
    id: string,
    data: Partial<Warehouse>
  ): Warehouse | null {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return null;

    const warehouse = (storage.warehouses || []).find((w) => w.id === id);
    if (!warehouse) return null;

    if (data.isDefault) {
      storage.warehouses.forEach((w) => {
        if (w.id !== id) w.isDefault = false;
      });
    }

    Object.assign(warehouse, {
      ...data,
      id: warehouse.id,
      companyId: warehouse.companyId,
      createdAt: warehouse.createdAt,
      updatedAt: new Date().toISOString(),
    });

    return warehouse;
  }

  async updateWarehouseAsync(
    schemaNamespace: string,
    id: string,
    data: Partial<Warehouse>
  ): Promise<Warehouse | null> {
    const warehouse = this.updateWarehouse(schemaNamespace, id, data);
    if (!warehouse) return null;
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().inventory.updateWarehouse(cleanCnpj, id, data);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de depósito: ${err.message}`, {
          cleanCnpj,
          warehouseId: id,
        });
      }
    }
    return warehouse;
  }

  deleteWarehouse(schemaNamespace: string, id: string): boolean {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return false;

    const index = (storage.warehouses || []).findIndex((w) => w.id === id);
    if (index === -1) return false;

    const warehouse = storage.warehouses[index];
    if (warehouse.isDefault && storage.warehouses.length > 1) {
      throw new Error('Não é permitido excluir o depósito principal/padrão da empresa.');
    }

    // Verifica se possui itens com saldo
    const hasActiveStock = (storage.stockItems || []).some(
      (item) => item.warehouseId === id && item.quantity > 0
    );
    if (hasActiveStock) {
      throw new Error('Não é possível excluir um depósito com produtos em estoque. Zere ou transfira o saldo antes.');
    }

    storage.warehouses.splice(index, 1);
    return true;
  }

  async deleteWarehouseAsync(schemaNamespace: string, id: string): Promise<boolean> {
    const deleted = this.deleteWarehouse(schemaNamespace, id);
    if (!deleted) return false;
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().inventory.deleteWarehouse(cleanCnpj, id);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na exclusão PostgreSQL de depósito: ${err.message}`, {
          cleanCnpj,
          warehouseId: id,
        });
      }
    }
    return true;
  }

  // 2. Saldos em Estoque (Stock Items)
  listStockItems(
    schemaNamespace: string,
    filters?: {
      warehouseId?: string;
      search?: string;
      lowStockOnly?: boolean;
    }
  ): StockItem[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    let items = storage.stockItems || [];

    if (filters?.warehouseId) {
      items = items.filter((i) => i.warehouseId === filters.warehouseId);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.productCode.toLowerCase().includes(q) ||
          i.productName.toLowerCase().includes(q) ||
          i.warehouseName.toLowerCase().includes(q)
      );
    }

    if (filters?.lowStockOnly) {
      items = items.filter((i) => i.quantity <= i.minQuantity && i.minQuantity > 0);
    }

    return items;
  }

  getStockItem(
    schemaNamespace: string,
    warehouseId: string,
    productId: string
  ): StockItem | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return (storage.stockItems || []).find(
      (i) => i.warehouseId === warehouseId && i.productId === productId
    );
  }

  getStockItemById(schemaNamespace: string, id: string): StockItem | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return (storage.stockItems || []).find((i) => i.id === id);
  }

  updateStockItemLimits(
    schemaNamespace: string,
    stockItemId: string,
    minQuantity: number,
    maxQuantity: number,
    locationRack?: string
  ): StockItem | null {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return null;

    const item = (storage.stockItems || []).find((i) => i.id === stockItemId);
    if (!item) return null;

    item.minQuantity = Math.max(0, minQuantity);
    item.maxQuantity = Math.max(item.minQuantity, maxQuantity);
    if (locationRack !== undefined) {
      item.locationRack = locationRack.trim();
    }
    item.updatedAt = new Date().toISOString();

    return item;
  }

  async updateStockItemLimitsAsync(
    schemaNamespace: string,
    stockItemId: string,
    minQuantity: number,
    maxQuantity: number,
    locationRack?: string
  ): Promise<StockItem | null> {
    const item = this.updateStockItemLimits(schemaNamespace, stockItemId, minQuantity, maxQuantity, locationRack);
    return item;
  }

  // 3. Movimentações de Estoque & Recálculo de CMP (Kardex)
  recordStockMovement(
    schemaNamespace: string,
    input: {
      movementType: StockMovementType;
      productId: string;
      warehouseId: string;
      quantity: number;
      unitCost?: number;
      referenceType?: StockMovementReferenceType;
      referenceId?: string;
      referenceDocument?: string;
      batchNumber?: string;
      expirationDate?: string;
      notes?: string;
      locationRack?: string;
    },
    userContext: { id: string; name: string }
  ): StockMovement {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não provisionado.`);

    const product = (storage.products || []).find((p) => p.id === input.productId);
    if (!product) throw new Error(`Produto [${input.productId}] não encontrado no catálogo.`);

    const warehouse = (storage.warehouses || []).find((w) => w.id === input.warehouseId);
    if (!warehouse) throw new Error(`Depósito [${input.warehouseId}] não encontrado.`);

    const qty = Math.max(0, input.quantity);
    if (qty <= 0) throw new Error('A quantidade da movimentação deve ser maior que zero.');

    // Localiza ou inicializa o StockItem para o par (warehouse, product)
    let stockItem = (storage.stockItems || []).find(
      (i) => i.warehouseId === warehouse.id && i.productId === product.id
    );

    if (!stockItem) {
      stockItem = {
        id: `stk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        companyId: warehouse.companyId,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        productUnit: product.unit,
        quantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        minQuantity: 0,
        maxQuantity: 0,
        averageCost: product.costPrice || 0,
        lastCost: product.costPrice || 0,
        totalValue: 0,
        locationRack: input.locationRack || '',
        updatedAt: new Date().toISOString(),
      };
      storage.stockItems.push(stockItem);
    }

    const previousStock = stockItem.quantity;
    const previousAverageCost = stockItem.averageCost;
    let newQuantity = previousStock;
    let newAverageCost = previousAverageCost;
    let unitCost = input.unitCost !== undefined && input.unitCost >= 0 ? input.unitCost : previousAverageCost;

    const isInbound =
      input.movementType === 'INBOUND_PURCHASE' ||
      input.movementType === 'INBOUND_ADJUSTMENT' ||
      input.movementType === 'TRANSFER_IN' ||
      input.movementType === 'RETURN';

    if (isInbound) {
      // Recalcula CMP conforme a fórmula contábil
      const cmpResult = InventoryMath.calculateCMP(
        previousStock,
        previousAverageCost,
        qty,
        unitCost
      );
      newQuantity = cmpResult.newQuantity;
      newAverageCost = cmpResult.newAverageCost;
      stockItem.lastCost = unitCost;
    } else {
      // Saída (Venda, OS, Perda, Ajuste Negativo, Transferência Saída)
      if (stockItem.availableQuantity < qty && input.movementType !== 'OUTBOUND_ADJUSTMENT') {
        throw new Error(
          `Saldo insuficiente no depósito [${warehouse.name}]. Disponível: ${stockItem.availableQuantity} ${product.unit}. Solicitado: ${qty} ${product.unit}.`
        );
      }
      newQuantity = InventoryMath.round(previousStock - qty, 4);
      // Nas saídas o custo unitário aplicado é o CMP atual
      unitCost = previousAverageCost;
    }

    stockItem.quantity = Math.max(0, newQuantity);
    stockItem.availableQuantity = Math.max(0, stockItem.quantity - stockItem.reservedQuantity);
    stockItem.averageCost = newAverageCost;
    stockItem.totalValue = InventoryMath.round(stockItem.quantity * stockItem.averageCost, 2);
    stockItem.updatedAt = new Date().toISOString();

    storage.sequentialCounters.inventoryMovement = (storage.sequentialCounters.inventoryMovement || 0) + 1;
    const movementNumber = InventoryEngine.formatMovementNumber(storage.sequentialCounters.inventoryMovement);

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      companyId: warehouse.companyId,
      movementNumber,
      movementType: input.movementType,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      productUnit: product.unit,
      warehouseId: warehouse.id,
      warehouseName: warehouse.name,
      quantity: qty,
      unitCost,
      totalCost: InventoryMath.round(qty * unitCost, 2),
      previousStock,
      currentStock: stockItem.quantity,
      previousAverageCost,
      newAverageCost,
      referenceType: input.referenceType || 'MANUAL',
      referenceId: input.referenceId,
      referenceDocument: input.referenceDocument,
      batchNumber: input.batchNumber,
      expirationDate: input.expirationDate,
      notes: input.notes,
      createdById: userContext.id,
      createdByName: userContext.name,
      createdAt: new Date().toISOString(),
    };

    storage.stockMovements.push(movement);
    return movement;
  }

  async recordStockMovementAsync(
    schemaNamespace: string,
    input: Parameters<DatabaseEngine['recordStockMovement']>[1],
    userContext: { id: string; name: string }
  ): Promise<StockMovement> {
    const movement = this.recordStockMovement(schemaNamespace, input, userContext);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().inventory.recordStockMovementTransaction(cleanCnpj, movement);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de movimentação de estoque: ${err.message}`, {
          cleanCnpj,
          movementId: movement.id,
        });
      }
    }
    return movement;
  }

  // 4. Transferência entre Depósitos
  transferStock(
    schemaNamespace: string,
    input: StockTransferInput,
    userContext: { id: string; name: string }
  ): { outboundMovement: StockMovement; inboundMovement: StockMovement } {
    if (input.sourceWarehouseId === input.targetWarehouseId) {
      throw new Error('O depósito de origem e destino não podem ser iguais.');
    }

    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não provisionado.`);

    const sourceWh = (storage.warehouses || []).find((w) => w.id === input.sourceWarehouseId);
    const targetWh = (storage.warehouses || []).find((w) => w.id === input.targetWarehouseId);
    if (!sourceWh || !targetWh) throw new Error('Depósito de origem ou destino inválido.');

    const sourceStock = this.getStockItem(schemaNamespace, input.sourceWarehouseId, input.productId);
    if (!sourceStock || sourceStock.availableQuantity < input.quantity) {
      throw new Error(
        `Saldo insuficiente no depósito de origem [${sourceWh.name}]. Disponível: ${sourceStock?.availableQuantity || 0}. Solicitado: ${input.quantity}.`
      );
    }

    const transferCost = sourceStock.averageCost;

    // Saída da Origem
    const outbound = this.recordStockMovement(
      schemaNamespace,
      {
        movementType: 'TRANSFER_OUT',
        productId: input.productId,
        warehouseId: input.sourceWarehouseId,
        quantity: input.quantity,
        unitCost: transferCost,
        referenceType: 'TRANSFER',
        notes: `Transferência para [${targetWh.name}]. ${input.notes || ''}`.trim(),
      },
      userContext
    );
    outbound.targetWarehouseId = targetWh.id;
    outbound.targetWarehouseName = targetWh.name;

    // Entrada no Destino
    const inbound = this.recordStockMovement(
      schemaNamespace,
      {
        movementType: 'TRANSFER_IN',
        productId: input.productId,
        warehouseId: input.targetWarehouseId,
        quantity: input.quantity,
        unitCost: transferCost,
        referenceType: 'TRANSFER',
        referenceId: outbound.id,
        referenceDocument: outbound.movementNumber,
        notes: `Transferência recebida de [${sourceWh.name}]. ${input.notes || ''}`.trim(),
      },
      userContext
    );
    inbound.targetWarehouseId = sourceWh.id;
    inbound.targetWarehouseName = sourceWh.name;

    return { outboundMovement: outbound, inboundMovement: inbound };
  }

  async transferStockAsync(
    schemaNamespace: string,
    input: StockTransferInput,
    userContext: { id: string; name: string }
  ): Promise<{ outboundMovement: StockMovement; inboundMovement: StockMovement }> {
    const result = this.transferStock(schemaNamespace, input, userContext);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().inventory.recordStockMovementTransaction(cleanCnpj, result.outboundMovement);
        await RepositoryManager.getInstance().getRepositories().inventory.recordStockMovementTransaction(cleanCnpj, result.inboundMovement);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de transferência de estoque: ${err.message}`, {
          cleanCnpj,
          productId: input.productId,
        });
      }
    }
    return result;
  }

  // 5. Histórico de Movimentações (Kardex)
  listStockMovements(
    schemaNamespace: string,
    filters?: {
      warehouseId?: string;
      productId?: string;
      movementType?: string;
      search?: string;
      limit?: number;
    }
  ): StockMovement[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    let list = [...(storage.stockMovements || [])].reverse();

    if (filters?.warehouseId) {
      list = list.filter((m) => m.warehouseId === filters.warehouseId || m.targetWarehouseId === filters.warehouseId);
    }
    if (filters?.productId) {
      list = list.filter((m) => m.productId === filters.productId);
    }
    if (filters?.movementType) {
      list = list.filter((m) => m.movementType === filters.movementType);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.movementNumber.toLowerCase().includes(q) ||
          m.productCode.toLowerCase().includes(q) ||
          m.productName.toLowerCase().includes(q) ||
          (m.referenceDocument && m.referenceDocument.toLowerCase().includes(q))
      );
    }

    if (filters?.limit && filters.limit > 0) {
      list = list.slice(0, filters.limit);
    }

    return list;
  }

  // 6. Métricas Consolidadas de Estoque
  getInventoryMetrics(schemaNamespace: string): InventoryMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      return {
        totalItems: 0,
        totalStockUnits: 0,
        totalInventoryValue: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        movementsCountThisMonth: 0,
        activeWarehousesCount: 0,
      };
    }

    const items = storage.stockItems || [];
    const warehouses = (storage.warehouses || []).filter((w) => w.isActive);
    const movements = storage.stockMovements || [];

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalStockUnits = items.reduce((acc, i) => acc + i.quantity, 0);
    const totalInventoryValue = items.reduce((acc, i) => acc + (i.quantity * i.averageCost), 0);
    const lowStockCount = items.filter((i) => i.quantity <= i.minQuantity && i.minQuantity > 0).length;
    const outOfStockCount = items.filter((i) => i.quantity === 0).length;
    const movementsCountThisMonth = movements.filter((m) => m.createdAt.startsWith(currentYearMonth)).length;

    return {
      totalItems: items.length,
      totalStockUnits: InventoryMath.round(totalStockUnits, 2),
      totalInventoryValue: InventoryMath.round(totalInventoryValue, 2),
      lowStockCount,
      outOfStockCount,
      movementsCountThisMonth,
      activeWarehousesCount: warehouses.length,
    };
  }

  // ============================================================================
  // PRD 07 — MÓDULO FISCAL & TRIBUTÁRIO BRASILEIRO (DF-e, NF-e, NFS-e, SPED)
  // ============================================================================

  // 1. Métricas Consolidadas do Módulo Fiscal
  getFiscalMetrics(schemaNamespace: string): FiscalMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      return {
        totalAuthorizedValue: 0,
        totalAuthorizedCount: 0,
        countNFe: 0,
        countNFSe: 0,
        countNFCe: 0,
        totalICMSPeriod: 0,
        totalISSPeriod: 0,
        totalPISCOFINSPeriod: 0,
        pendingDraftCount: 0,
        canceledCount: 0,
      };
    }

    const docs = storage.fiscalDocuments || [];
    const authorized = docs.filter((d) => d.status === 'AUTHORIZED');
    const drafts = docs.filter((d) => d.status === 'DRAFT');
    const canceled = docs.filter((d) => d.status === 'CANCELED');

    const totalAuthorizedValue = authorized.reduce((acc, d) => acc + d.netTotal, 0);
    const countNFe = authorized.filter((d) => d.model === 'NFE_55').length;
    const countNFSe = authorized.filter((d) => d.model === 'NFSE').length;
    const countNFCe = authorized.filter((d) => d.model === 'NFCE_65').length;

    const totalICMSPeriod = authorized.reduce((acc, d) => acc + d.totalICMS, 0);
    const totalISSPeriod = authorized.reduce((acc, d) => acc + d.totalISS, 0);
    const totalPISCOFINSPeriod = authorized.reduce((acc, d) => acc + (d.totalPIS + d.totalCOFINS), 0);

    return {
      totalAuthorizedValue: FiscalMath.round(totalAuthorizedValue, 2),
      totalAuthorizedCount: authorized.length,
      countNFe,
      countNFSe,
      countNFCe,
      totalICMSPeriod: FiscalMath.round(totalICMSPeriod, 2),
      totalISSPeriod: FiscalMath.round(totalISSPeriod, 2),
      totalPISCOFINSPeriod: FiscalMath.round(totalPISCOFINSPeriod, 2),
      pendingDraftCount: drafts.length,
      canceledCount: canceled.length,
    };
  }

  // 2. Listagem de Documentos Fiscais com Filtros Avançados
  listFiscalDocuments(
    schemaNamespace: string,
    filters?: {
      model?: FiscalDocumentModel;
      status?: FiscalDocumentStatus;
      type?: FiscalDocumentType;
      search?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): FiscalDocument[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    let list = [...(storage.fiscalDocuments || [])];

    // Ordenação decrescente por data/emissão
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.model) {
      list = list.filter((d) => d.model === filters.model);
    }
    if (filters?.status) {
      list = list.filter((d) => d.status === filters.status);
    }
    if (filters?.type) {
      list = list.filter((d) => d.type === filters.type);
    }
    if (filters?.startDate) {
      list = list.filter((d) => d.issueDate >= filters.startDate!);
    }
    if (filters?.endDate) {
      list = list.filter((d) => d.issueDate <= filters.endDate!);
    }
    if (filters?.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.accessKey.toLowerCase().includes(q) ||
          String(d.number).includes(q) ||
          d.partnerName.toLowerCase().includes(q) ||
          d.partnerCnpjCpf.includes(q) ||
          (d.protocolNumber && d.protocolNumber.toLowerCase().includes(q))
      );
    }

    if (filters?.limit && filters.limit > 0) {
      list = list.slice(0, filters.limit);
    }

    return list;
  }

  // 3. Obter Documento Fiscal por ID
  getFiscalDocumentById(schemaNamespace: string, id: string): FiscalDocument | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;
    return (storage.fiscalDocuments || []).find((d) => d.id === id);
  }

  // 4. Criar Documento Fiscal Eletrônico
  createFiscalDocument(
    schemaNamespace: string,
    input: {
      model: FiscalDocumentModel;
      series?: string;
      type: FiscalDocumentType;
      natureOfOperation: string;
      cfopPrincipal: string;
      partnerId?: string;
      partnerName: string;
      partnerCnpjCpf: string;
      partnerStateRegistration?: string;
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
      items: Array<{
        productId?: string;
        productCode: string;
        productName: string;
        ncm: string;
        cest?: string;
        cfop: string;
        unit: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
        isService?: boolean;
        serviceCode?: string;
        icmsRate?: number;
        icmsCst?: string;
        ipiRate?: number;
        pisRate?: number;
        cofinsRate?: number;
        issRate?: number;
        issWithheld?: boolean;
      }>;
      additionalInfo?: string;
      billingDocumentId?: string;
      saleId?: string;
      transmitImmediately?: boolean;
    },
    userId: string,
    userName: string
  ): FiscalDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    const company = this.getCompanyBySchemaNamespace(schemaNamespace);
    const companyRegime: TaxRegime = company?.segment === 'servicos' ? 'SIMPLES_NACIONAL' : 'LUCRO_PRESUMIDO';

    // Incrementar contador sequencial
    const series = input.series || '1';
    let docNumber = 1;
    if (input.model === 'NFE_55') {
      storage.sequentialCounters.fiscalNFe = (storage.sequentialCounters.fiscalNFe || 1000) + 1;
      docNumber = storage.sequentialCounters.fiscalNFe;
    } else if (input.model === 'NFSE') {
      storage.sequentialCounters.fiscalNFSe = (storage.sequentialCounters.fiscalNFSe || 500) + 1;
      docNumber = storage.sequentialCounters.fiscalNFSe;
    } else {
      storage.sequentialCounters.fiscalNFCe = (storage.sequentialCounters.fiscalNFCe || 2000) + 1;
      docNumber = storage.sequentialCounters.fiscalNFCe;
    }

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = now.toTimeString().split(' ')[0];

    // Processar itens e cálculos tributários
    const processedItems: FiscalItem[] = input.items.map((item, index) => {
      const taxes = FiscalMath.calculateItemTaxes(item, companyRegime);
      return {
        id: `fitem-${Date.now()}-${index + 1}`,
        itemSequence: index + 1,
        productId: item.productId,
        productCode: item.productCode || `ITM-${index + 1}`,
        productName: item.productName,
        ncm: item.ncm || '8471.30.12',
        cest: item.cest,
        cfop: item.cfop || input.cfopPrincipal,
        unit: item.unit || (item.isService ? 'SV' : 'UN'),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: taxes.totalPrice,
        discount: taxes.discount,
        netTotal: taxes.netTotal,
        icmsCst: taxes.icmsCst,
        icmsBase: taxes.icmsBase,
        icmsRate: taxes.icmsRate,
        icmsValue: taxes.icmsValue,
        ipiCst: item.ipiRate ? '50' : '99',
        ipiBase: taxes.ipiBase,
        ipiRate: taxes.ipiRate,
        ipiValue: taxes.ipiValue,
        pisCst: taxes.pisRate > 0 ? '01' : '07',
        pisBase: taxes.pisBase,
        pisRate: taxes.pisRate,
        pisValue: taxes.pisValue,
        cofinsCst: taxes.cofinsRate > 0 ? '01' : '07',
        cofinsBase: taxes.cofinsBase,
        cofinsRate: taxes.cofinsRate,
        cofinsValue: taxes.cofinsValue,
        serviceCode: item.serviceCode || (item.isService ? '01.07' : undefined),
        issBase: taxes.issBase,
        issRate: taxes.issRate,
        issValue: taxes.issValue,
        issWithheld: !!item.issWithheld,
        approximateTaxes: taxes.approximateTaxes,
      };
    });

    const isServiceDoc = input.model === 'NFSE';
    const totalProducts = isServiceDoc ? 0 : processedItems.reduce((acc, i) => acc + i.totalPrice, 0);
    const totalServices = isServiceDoc ? processedItems.reduce((acc, i) => acc + i.totalPrice, 0) : 0;
    const totalDiscounts = processedItems.reduce((acc, i) => acc + i.discount, 0);
    const totalICMS = processedItems.reduce((acc, i) => acc + i.icmsValue, 0);
    const totalIPI = processedItems.reduce((acc, i) => acc + i.ipiValue, 0);
    const totalPIS = processedItems.reduce((acc, i) => acc + i.pisValue, 0);
    const totalCOFINS = processedItems.reduce((acc, i) => acc + i.cofinsValue, 0);
    const totalISS = processedItems.reduce((acc, i) => acc + i.issValue, 0);
    const totalApproximateTaxes = processedItems.reduce((acc, i) => acc + i.approximateTaxes, 0);
    const netTotal = processedItems.reduce((acc, i) => acc + i.netTotal, 0);
    const totalTaxableAmount = isServiceDoc ? 0 : netTotal;

    // Gerar Chave de Acesso Oficial (44 dígitos para NF-e/NFC-e ou Código RPS para NFS-e)
    let accessKey = '';
    if (input.model === 'NFSE') {
      accessKey = `RPS-${series}-${docNumber}-${Math.floor(100000 + Math.random() * 900000)}`;
    } else {
      accessKey = FiscalMath.generateAccessKey({
        issueDate,
        cnpj: company?.cleanCnpj || '12345678000195',
        model: input.model,
        series,
        number: docNumber,
      });
    }

    const docId = `fisc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const status: FiscalDocumentStatus = input.transmitImmediately ? 'AUTHORIZED' : 'DRAFT';
    const protocolNumber = input.transmitImmediately
      ? FiscalMath.generateProtocol(input.model, issueDate)
      : undefined;
    const authorizedAt = input.transmitImmediately ? now.toISOString() : undefined;

    const newDoc: FiscalDocument = {
      id: docId,
      companyId: company?.id || 'cmp-default',
      model: input.model,
      series,
      number: docNumber,
      accessKey,
      issueDate,
      issueTime,
      type: input.type,
      status,
      natureOfOperation: input.natureOfOperation,
      cfopPrincipal: input.cfopPrincipal,
      partnerId: input.partnerId,
      partnerName: input.partnerName,
      partnerCnpjCpf: input.partnerCnpjCpf,
      partnerStateRegistration: input.partnerStateRegistration,
      partnerEmail: input.partnerEmail,
      partnerAddress: input.partnerAddress,
      items: processedItems,
      totalProducts: FiscalMath.round(totalProducts, 2),
      totalServices: FiscalMath.round(totalServices, 2),
      totalDiscounts: FiscalMath.round(totalDiscounts, 2),
      totalFreight: 0,
      totalInsurance: 0,
      totalOtherExpenses: 0,
      totalTaxableAmount: FiscalMath.round(totalTaxableAmount, 2),
      totalICMS: FiscalMath.round(totalICMS, 2),
      totalIPI: FiscalMath.round(totalIPI, 2),
      totalPIS: FiscalMath.round(totalPIS, 2),
      totalCOFINS: FiscalMath.round(totalCOFINS, 2),
      totalISS: FiscalMath.round(totalISS, 2),
      totalWithheldTaxes: 0,
      totalApproximateTaxes: FiscalMath.round(totalApproximateTaxes, 2),
      netTotal: FiscalMath.round(netTotal, 2),
      protocolNumber,
      authorizedAt,
      correctionLetters: [],
      billingDocumentId: input.billingDocumentId,
      saleId: input.saleId,
      additionalInfo: input.additionalInfo,
      createdById: userId,
      createdByName: userName,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Gerar XML inicial
    newDoc.xmlPayload = FiscalXmlGenerator.generateNFeXml(newDoc, {
      legalName: company?.legalName || 'Alfa Serviços Empresariais Ltda',
      tradeName: company?.tradeName,
      cnpj: company?.cnpj || '12.345.678/0001-95',
      stateRegistration: '123.456.789.110',
    });

    storage.fiscalDocuments.unshift(newDoc);

    this.recordTenantAudit(
      schemaNamespace,
      'CREATE',
      'FISCAL_DOCUMENT',
      docId,
      {
        model: newDoc.model,
        number: newDoc.number,
        accessKey: newDoc.accessKey,
        status: newDoc.status,
        netTotal: newDoc.netTotal,
      },
      userId
    );

    return newDoc;
  }

  async createFiscalDocumentAsync(
    schemaNamespace: string,
    input: Parameters<DatabaseEngine['createFiscalDocument']>[1],
    userId: string,
    userName: string
  ): Promise<FiscalDocument> {
    const doc = this.createFiscalDocument(schemaNamespace, input, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().fiscal.createFiscalDocument(cleanCnpj, doc);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de documento fiscal: ${err.message}`, {
          cleanCnpj,
          docId: doc.id,
        });
      }
    }
    return doc;
  }

  // 5. Transmitir Documento Fiscal para a SEFAZ / Prefeitura
  transmitFiscalDocument(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string
  ): FiscalDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    const doc = (storage.fiscalDocuments || []).find((d) => d.id === id);
    if (!doc) throw new Error('Documento fiscal não encontrado');

    if (doc.status === 'AUTHORIZED') {
      throw new Error('Este documento já foi autorizado pela SEFAZ/Prefeitura.');
    }
    if (doc.status === 'CANCELED') {
      throw new Error('Não é possível transmitir um documento cancelado.');
    }

    const company = this.getCompanyBySchemaNamespace(schemaNamespace);
    const now = new Date();
    doc.status = 'AUTHORIZED';
    doc.authorizedAt = now.toISOString();
    doc.protocolNumber = FiscalMath.generateProtocol(doc.model, doc.issueDate);
    doc.updatedAt = now.toISOString();

    // Atualizar XML com o protocolo de autorização oficial
    doc.xmlPayload = FiscalXmlGenerator.generateNFeXml(doc, {
      legalName: company?.legalName || 'Alfa Serviços Empresariais Ltda',
      tradeName: company?.tradeName,
      cnpj: company?.cnpj || '12.345.678/0001-95',
      stateRegistration: '123.456.789.110',
    });

    this.recordTenantAudit(
      schemaNamespace,
      'TRANSMIT',
      'FISCAL_DOCUMENT',
      doc.id,
      {
        protocol: doc.protocolNumber,
        authorizedAt: doc.authorizedAt,
      },
      userId
    );

    return doc;
  }

  async transmitFiscalDocumentAsync(
    schemaNamespace: string,
    id: string,
    userId: string,
    userName: string
  ): Promise<FiscalDocument> {
    const doc = this.transmitFiscalDocument(schemaNamespace, id, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().fiscal.updateFiscalDocument(cleanCnpj, id, {
          status: doc.status,
          protocolNumber: doc.protocolNumber,
          authorizedAt: doc.authorizedAt,
          xmlPayload: doc.xmlPayload,
          updatedAt: doc.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na transmissão PostgreSQL de documento fiscal: ${err.message}`, {
          cleanCnpj,
          docId: id,
        });
      }
    }
    return doc;
  }

  // 6. Cancelar Documento Fiscal Autorizado (SEFAZ - Prazo legal e Justificativa)
  cancelFiscalDocument(
    schemaNamespace: string,
    id: string,
    justification: string,
    userId: string,
    userName: string
  ): FiscalDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    const doc = (storage.fiscalDocuments || []).find((d) => d.id === id);
    if (!doc) throw new Error('Documento fiscal não encontrado');

    if (doc.status !== 'AUTHORIZED') {
      throw new Error('Apenas documentos autorizados podem ser cancelados junto à SEFAZ.');
    }

    if (!justification || justification.trim().length < 15) {
      throw new Error('A justificativa de cancelamento da SEFAZ exige no mínimo 15 caracteres.');
    }

    const now = new Date();
    doc.status = 'CANCELED';
    doc.cancellationReason = justification.trim();
    doc.canceledAt = now.toISOString();
    doc.updatedAt = now.toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'CANCEL',
      'FISCAL_DOCUMENT',
      doc.id,
      {
        reason: doc.cancellationReason,
        canceledAt: doc.canceledAt,
      },
      userId
    );

    return doc;
  }

  async cancelFiscalDocumentAsync(
    schemaNamespace: string,
    id: string,
    justification: string,
    userId: string,
    userName: string
  ): Promise<FiscalDocument> {
    const doc = this.cancelFiscalDocument(schemaNamespace, id, justification, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().fiscal.updateFiscalDocument(cleanCnpj, id, {
          status: doc.status,
          cancellationReason: doc.cancellationReason,
          canceledAt: doc.canceledAt,
          updatedAt: doc.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de documento fiscal: ${err.message}`, {
          cleanCnpj,
          docId: id,
        });
      }
    }
    return doc;
  }

  // 7. Emitir Carta de Correção Eletrônica (CC-e)
  addCorrectionLetter(
    schemaNamespace: string,
    id: string,
    correctionText: string,
    userId: string,
    userName: string
  ): FiscalDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    const doc = (storage.fiscalDocuments || []).find((d) => d.id === id);
    if (!doc) throw new Error('Documento fiscal não encontrado');

    if (doc.status !== 'AUTHORIZED') {
      throw new Error('Cartas de Correção só podem ser emitidas para notas já autorizadas.');
    }

    if (!correctionText || correctionText.trim().length < 15) {
      throw new Error('O texto da Carta de Correção exige no mínimo 15 caracteres explicativos.');
    }

    const seq = (doc.correctionLetters || []).length + 1;
    const now = new Date();
    const cceProtocol = `CCE-SEFAZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${Math.floor(10000000 + Math.random() * 90000000)}`;

    const cce: FiscalCorrectionLetter = {
      id: `cce-${Date.now()}-${seq}`,
      sequenceNumber: seq,
      correctionText: correctionText.trim(),
      protocolNumber: cceProtocol,
      issuedAt: now.toISOString(),
      issuedByName: userName,
    };

    if (!doc.correctionLetters) doc.correctionLetters = [];
    doc.correctionLetters.push(cce);
    doc.updatedAt = now.toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'CORRECT',
      'FISCAL_DOCUMENT',
      doc.id,
      {
        sequenceNumber: seq,
        protocol: cceProtocol,
        correctionText: cce.correctionText,
      },
      userId
    );

    return doc;
  }

  async addCorrectionLetterAsync(
    schemaNamespace: string,
    id: string,
    correctionText: string,
    userId: string,
    userName: string
  ): Promise<FiscalDocument> {
    const doc = this.addCorrectionLetter(schemaNamespace, id, correctionText, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().fiscal.updateFiscalDocument(cleanCnpj, id, {
          correctionLetters: doc.correctionLetters,
          updatedAt: doc.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na CC-e PostgreSQL de documento fiscal: ${err.message}`, {
          cleanCnpj,
          docId: id,
        });
      }
    }
    return doc;
  }

  // 8. Listar e Criar Operações Fiscais (CFOPs)
  listFiscalOperations(schemaNamespace: string): FiscalOperation[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    if (!storage.fiscalOperations || storage.fiscalOperations.length === 0) {
      storage.fiscalOperations = [
        {
          id: 'fop-01',
          cfop: '5.102',
          description: 'Venda de mercadoria adquirida ou recebida de terceiros (Operação interna)',
          type: 'OUTBOUND',
          applicableRegime: 'ALL',
          icmsCst: '102',
          icmsRate: 18.0,
          pisCst: '07',
          pisRate: 0.65,
          cofinsCst: '07',
          cofinsRate: 3.0,
          issRate: 0,
          isDefault: true,
        },
        {
          id: 'fop-02',
          cfop: '6.102',
          description: 'Venda de mercadoria adquirida de terceiros para outro Estado (Interestadual)',
          type: 'OUTBOUND',
          applicableRegime: 'ALL',
          icmsCst: '102',
          icmsRate: 12.0,
          pisCst: '07',
          pisRate: 0.65,
          cofinsCst: '07',
          cofinsRate: 3.0,
          issRate: 0,
        },
        {
          id: 'fop-03',
          cfop: '5.933',
          description: 'Prestação de serviço tributado pelo ISSQN (Municipal)',
          type: 'OUTBOUND',
          applicableRegime: 'ALL',
          icmsCst: '00',
          icmsRate: 0,
          pisCst: '01',
          pisRate: 0.65,
          cofinsCst: '01',
          cofinsRate: 3.0,
          issRate: 5.0,
          isDefault: true,
        },
        {
          id: 'fop-04',
          cfop: '1.102',
          description: 'Compra para comercialização (Entrada interna)',
          type: 'INBOUND',
          applicableRegime: 'ALL',
          icmsCst: '102',
          icmsRate: 18.0,
          pisCst: '50',
          pisRate: 0.65,
          cofinsCst: '50',
          cofinsRate: 3.0,
          issRate: 0,
        },
        {
          id: 'fop-05',
          cfop: '5.405',
          description: 'Venda de mercadoria com Substituição Tributária (ICMS-ST retido anteriormente)',
          type: 'OUTBOUND',
          applicableRegime: 'ALL',
          icmsCst: '500',
          icmsRate: 0,
          pisCst: '07',
          pisRate: 0.65,
          cofinsCst: '07',
          cofinsRate: 3.0,
          issRate: 0,
        },
      ];
    }
    return storage.fiscalOperations;
  }

  createFiscalOperation(
    schemaNamespace: string,
    input: Omit<FiscalOperation, 'id'>
  ): FiscalOperation {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    const newOp: FiscalOperation = {
      id: `fop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...input,
    };

    if (!storage.fiscalOperations) storage.fiscalOperations = [];
    storage.fiscalOperations.push(newOp);
    return newOp;
  }

  // 9. Inutilizações de Numeração Fiscal
  listFiscalInutilizations(schemaNamespace: string): FiscalInutilization[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    return storage.fiscalInutilizations || [];
  }

  createFiscalInutilization(
    schemaNamespace: string,
    input: {
      model: FiscalDocumentModel;
      series: string;
      startNumber: number;
      endNumber: number;
      year: number;
      justification: string;
    },
    userId: string,
    userName: string
  ): FiscalInutilization {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    if (!input.justification || input.justification.trim().length < 15) {
      throw new Error('A justificativa de inutilização exige no mínimo 15 caracteres.');
    }

    const now = new Date();
    const protocolNumber = `INUT-SEFAZ-${input.year}-${Math.floor(100000000 + Math.random() * 900000000)}`;

    const inut: FiscalInutilization = {
      id: `inut-${Date.now()}`,
      model: input.model,
      series: input.series,
      startNumber: input.startNumber,
      endNumber: input.endNumber,
      year: input.year,
      justification: input.justification.trim(),
      protocolNumber,
      registeredAt: now.toISOString(),
      registeredByName: userName,
    };

    if (!storage.fiscalInutilizations) storage.fiscalInutilizations = [];
    storage.fiscalInutilizations.unshift(inut);

    this.recordTenantAudit(
      schemaNamespace,
      'INUTILIZE',
      'FISCAL_NUMBER',
      inut.id,
      {
        model: inut.model,
        range: `${inut.startNumber} a ${inut.endNumber}`,
        protocol: inut.protocolNumber,
      },
      userId
    );

    return inut;
  }

  async createFiscalInutilizationAsync(
    schemaNamespace: string,
    input: {
      model: FiscalDocumentModel;
      series: string;
      startNumber: number;
      endNumber: number;
      year: number;
      justification: string;
    },
    userId: string,
    userName: string
  ): Promise<FiscalInutilization> {
    const inut = this.createFiscalInutilization(schemaNamespace, input, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().fiscal.createInutilization(cleanCnpj, inut);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de inutilização fiscal: ${err.message}`, {
          cleanCnpj,
          inutId: inut.id,
        });
      }
    }
    return inut;
  }

  // 10. Geração e Prévia do SPED Fiscal (EFD ICMS/IPI)
  generateSpedPreview(
    schemaNamespace: string,
    month: number,
    year: number
  ): { text: string; summary: SpedBlockSummary[] } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    const company = this.getCompanyBySchemaNamespace(schemaNamespace);
    const docs = storage.fiscalDocuments || [];

    return SpedFiscalEngine.generateSpedEfd(
      month,
      year,
      {
        legalName: company?.legalName || 'Alfa Serviços Empresariais Ltda',
        cnpj: company?.cnpj || '12.345.678/0001-95',
        stateRegistration: '123.456.789.110',
        state: 'SP',
      },
      docs
    );
  }

  // 11. Emissão de Documento Fiscal a partir do Módulo de Faturamento (PRD Parte 05)
  createFiscalFromBilling(
    schemaNamespace: string,
    billingId: string,
    model: FiscalDocumentModel,
    userId: string,
    userName: string
  ): FiscalDocument {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error('Schema do tenant não encontrado');

    const billing = (storage.billingDocuments || []).find((b) => b.id === billingId);
    if (!billing) throw new Error('Documento de faturamento não encontrado');

    // Buscar parceiro para obter dados cadastrais e endereço completo
    const partner = (storage.partners || []).find((p) => p.id === billing.customerId);

    const isService = model === 'NFSE';
    const cfop = isService ? '5.933' : '5.102';
    const nature = isService ? 'Prestação de Serviços em Tecnologia' : 'Venda de Mercadoria Faturada';

    const items = (billing.items || []).map((item, idx) => ({
      productId: item.productId,
      productCode: item.productId || `FAT-ITM-${idx + 1}`,
      productName: item.description,
      ncm: isService ? '0000.00.00' : '8471.30.12',
      cfop,
      unit: isService ? 'SV' : 'UN',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      isService,
      serviceCode: isService ? '01.07' : undefined,
    }));

    const doc = this.createFiscalDocument(
      schemaNamespace,
      {
        model,
        type: 'OUTBOUND',
        natureOfOperation: nature,
        cfopPrincipal: cfop,
        partnerId: billing.customerId,
        partnerName: billing.customerName,
        partnerCnpjCpf: billing.customerDocument || '00.000.000/0001-00',
        partnerAddress: {
          street: partner?.address?.street || 'Avenida das Nações Unidas',
          number: partner?.address?.number || '12901',
          neighborhood: partner?.address?.neighborhood || 'Brooklin Novo',
          city: partner?.address?.city || 'São Paulo',
          state: partner?.address?.state || 'SP',
          zipCode: partner?.address?.zipCode || '04578-000',
        },
        items,
        billingDocumentId: billing.id,
        additionalInfo: `Documento Fiscal gerado automaticamente a partir do Faturamento Nº ${billing.number}.`,
        transmitImmediately: true,
      },
      userId,
      userName
    );

    // Vincular id da nota no documento de faturamento
    billing.fiscalDocumentId = doc.id;
    billing.updatedAt = new Date().toISOString();

    return doc;
  }

  async createFiscalFromBillingAsync(
    schemaNamespace: string,
    billingId: string,
    model: FiscalDocumentModel,
    userId: string,
    userName: string
  ): Promise<FiscalDocument> {
    const doc = this.createFiscalFromBilling(schemaNamespace, billingId, model, userId, userName);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().fiscal.createFiscalDocument(cleanCnpj, doc);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de nota fiscal do faturamento: ${err.message}`, {
          cleanCnpj,
          docId: doc.id,
          billingId,
        });
      }
    }
    return doc;
  }

  // ============================================================================
  // PRD 08 — MÓDULO DE COMPRAS, SUPRIMENTOS & ENTRADA DE MERCADORIAS (PROCUREMENT)
  // ============================================================================

  public listPurchaseRequisitions(
    schemaNamespace: string,
    filter?: { status?: string; department?: string; priority?: string }
  ): PurchaseRequisition[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    let list = [...(storage.purchaseRequisitions || [])];
    if (filter?.status) {
      list = list.filter((r) => r.status === filter.status);
    }
    if (filter?.department) {
      list = list.filter((r) => r.department?.toLowerCase().includes(filter.department!.toLowerCase()));
    }
    if (filter?.priority) {
      list = list.filter((r) => r.priority === filter.priority);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getPurchaseRequisitionById(schemaNamespace: string, id: string): PurchaseRequisition | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    return storage?.purchaseRequisitions?.find((r) => r.id === id);
  }

  public createPurchaseRequisition(
    schemaNamespace: string,
    data: Partial<PurchaseRequisition>,
    user: { id: string; name: string }
  ): PurchaseRequisition {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const counter = (storage.sequentialCounters.purchaseRequisition || 0) + 1;
    storage.sequentialCounters.purchaseRequisition = counter;
    const number = `RC-${String(counter).padStart(6, '0')}`;

    const items: PurchaseRequisitionItem[] = (data.items || []).map((item, index) => {
      const unitPrice = item.estimatedUnitPrice || 0;
      const qty = item.quantity || 1;
      return {
        id: item.id || `rc-item-${Date.now().toString(36)}-${index}`,
        productId: item.productId,
        productCode: item.productCode || 'ITEM',
        productName: item.productName || 'Item Solicitado',
        quantity: qty,
        unit: item.unit || 'UN',
        estimatedUnitPrice: unitPrice,
        estimatedTotalPrice: ProcurementMath.roundBRL(qty * unitPrice),
        notes: item.notes,
      };
    });

    const totalEstimated = items.reduce((acc, it) => acc + it.estimatedTotalPrice, 0);

    const requisition: PurchaseRequisition = {
      id: `rc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      number,
      requestedById: user.id,
      requestedByName: user.name,
      department: data.department || 'Geral',
      priority: data.priority || 'MEDIA',
      status: 'PENDENTE_APROVACAO',
      justification: data.justification || 'Solicitação de suprimentos e materiais operacionais.',
      neededByDate: data.neededByDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      costCenterId: data.costCenterId,
      costCenterName: data.costCenterName,
      items,
      totalEstimated: ProcurementMath.roundBRL(totalEstimated),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.purchaseRequisitions.unshift(requisition);

    this.recordTenantAudit(
      schemaNamespace,
      'CREATE',
      'PURCHASE_REQUISITION',
      requisition.id,
      {
        number: requisition.number,
        totalEstimated: requisition.totalEstimated,
        priority: requisition.priority,
        itemsCount: items.length,
      },
      user.id
    );

    return requisition;
  }

  public async createPurchaseRequisitionAsync(
    schemaNamespace: string,
    data: Partial<PurchaseRequisition>,
    user: { id: string; name: string }
  ): Promise<PurchaseRequisition> {
    const req = this.createPurchaseRequisition(schemaNamespace, data, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.createRequisition(cleanCnpj, req);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de requisição de compra: ${err.message}`, {
          cleanCnpj,
          reqId: req.id,
        });
      }
    }
    return req;
  }

  public approvePurchaseRequisition(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): PurchaseRequisition {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const req = storage.purchaseRequisitions.find((r) => r.id === id);
    if (!req) throw new Error(`Requisição de Compra ID ${id} não encontrada.`);
    if (req.status !== 'PENDENTE_APROVACAO' && req.status !== 'RASCUNHO') {
      throw new Error(`Apenas requisições pendentes ou em rascunho podem ser aprovadas. Status atual: ${req.status}`);
    }

    req.status = 'APROVADA';
    req.approvedById = user.id;
    req.approvedByName = user.name;
    req.approvedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'APPROVE',
      'PURCHASE_REQUISITION',
      req.id,
      { number: req.number, totalEstimated: req.totalEstimated },
      user.id
    );

    return req;
  }

  public async approvePurchaseRequisitionAsync(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): Promise<PurchaseRequisition> {
    const req = this.approvePurchaseRequisition(schemaNamespace, id, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.updateRequisition(cleanCnpj, id, {
          status: req.status,
          updatedAt: req.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na aprovação PostgreSQL de requisição de compra: ${err.message}`, {
          cleanCnpj,
          reqId: id,
        });
      }
    }
    return req;
  }

  public rejectPurchaseRequisition(
    schemaNamespace: string,
    id: string,
    reason: string,
    user: { id: string; name: string }
  ): PurchaseRequisition {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const req = storage.purchaseRequisitions.find((r) => r.id === id);
    if (!req) throw new Error(`Requisição de Compra ID ${id} não encontrada.`);

    req.status = 'REJEITADA';
    req.rejectionReason = reason;
    req.rejectedAt = new Date().toISOString();
    req.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'REJECT',
      'PURCHASE_REQUISITION',
      req.id,
      { number: req.number, reason },
      user.id
    );

    return req;
  }

  public async rejectPurchaseRequisitionAsync(
    schemaNamespace: string,
    id: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<PurchaseRequisition> {
    const req = this.rejectPurchaseRequisition(schemaNamespace, id, reason, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.updateRequisition(cleanCnpj, id, {
          status: req.status,
          rejectionReason: req.rejectionReason,
          rejectedAt: req.rejectedAt,
          updatedAt: req.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na rejeição PostgreSQL de requisição de compra: ${err.message}`, {
          cleanCnpj,
          reqId: id,
        });
      }
    }
    return req;
  }

  public cancelPurchaseRequisition(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): PurchaseRequisition {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const req = storage.purchaseRequisitions.find((r) => r.id === id);
    if (!req) throw new Error(`Requisição de Compra ID ${id} não encontrada.`);

    req.status = 'CANCELADA';
    req.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'CANCEL',
      'PURCHASE_REQUISITION',
      req.id,
      { number: req.number },
      user.id
    );

    return req;
  }

  public async cancelPurchaseRequisitionAsync(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): Promise<PurchaseRequisition> {
    const req = this.cancelPurchaseRequisition(schemaNamespace, id, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.updateRequisition(cleanCnpj, id, {
          status: req.status,
          updatedAt: req.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de requisição de compra: ${err.message}`, {
          cleanCnpj,
          reqId: id,
        });
      }
    }
    return req;
  }

  // COTAÇÕES DE COMPRA (QUOTATIONS)
  public listPurchaseQuotations(schemaNamespace: string, filter?: { status?: string }): PurchaseQuotation[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    let list = [...(storage.purchaseQuotations || [])];
    if (filter?.status) {
      list = list.filter((q) => q.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getPurchaseQuotationById(schemaNamespace: string, id: string): PurchaseQuotation | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    return storage?.purchaseQuotations?.find((q) => q.id === id);
  }

  public createPurchaseQuotation(
    schemaNamespace: string,
    data: Partial<PurchaseQuotation>,
    user: { id: string; name: string }
  ): PurchaseQuotation {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const counter = (storage.sequentialCounters.purchaseQuotation || 0) + 1;
    storage.sequentialCounters.purchaseQuotation = counter;
    const number = `COT-${String(counter).padStart(6, '0')}`;

    // Se vinculada a requisições, atualiza status das requisições
    const reqIds = data.requisitionIds || [];
    if (reqIds.length > 0) {
      for (const reqId of reqIds) {
        const req = storage.purchaseRequisitions.find((r) => r.id === reqId);
        if (req) {
          req.status = 'EM_COTACAO';
          req.updatedAt = new Date().toISOString();
        }
      }
    }

    const items = (data.items || []).map((it, idx) => ({
      id: it.id || `cot-item-${Date.now().toString(36)}-${idx}`,
      productId: it.productId,
      productCode: it.productCode || 'ITEM',
      productName: it.productName || 'Material / Item Cotação',
      quantity: it.quantity || 1,
      unit: it.unit || 'UN',
      targetPrice: it.targetPrice,
    }));

    const quotation: PurchaseQuotation = {
      id: `cot-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      number,
      title: data.title || `Cotação de Materiais ${number}`,
      requisitionIds: reqIds,
      status: 'ABERTA',
      deadlineDate: data.deadlineDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      items,
      proposals: [],
      createdById: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.purchaseQuotations.unshift(quotation);

    this.recordTenantAudit(
      schemaNamespace,
      'CREATE',
      'PURCHASE_QUOTATION',
      quotation.id,
      { number: quotation.number, itemsCount: items.length, deadlineDate: quotation.deadlineDate },
      user.id
    );

    return quotation;
  }

  public addQuotationProposal(
    schemaNamespace: string,
    quotationId: string,
    proposalData: Partial<SupplierQuotationProposal>
  ): PurchaseQuotation {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const cot = storage.purchaseQuotations.find((q) => q.id === quotationId);
    if (!cot) throw new Error(`Cotação ID ${quotationId} não encontrada.`);

    const items: QuotationItemProposal[] = (proposalData.items || []).map((it) => {
      const unitPrice = it.unitPrice || 0;
      const qty = it.quantity || 1;
      const discPerc = it.discountPercentage || 0;
      const gross = ProcurementMath.roundBRL(qty * unitPrice);
      const disc = ProcurementMath.roundBRL(gross * (discPerc / 100));
      return {
        itemId: it.itemId,
        productName: it.productName || 'Item Proposta',
        quantity: qty,
        unit: it.unit || 'UN',
        unitPrice,
        discountPercentage: discPerc,
        icmsPercentage: it.icmsPercentage || 18,
        ipiPercentage: it.ipiPercentage || 0,
        freightAmount: it.freightAmount || 0,
        totalPrice: Math.max(0, gross - disc + (it.freightAmount || 0)),
        deliveryDays: it.deliveryDays || 7,
      };
    });

    const freight = proposalData.freightTotal || 0;
    const totals = ProcurementMath.calculateProposalTotals(items, freight);

    const proposal: SupplierQuotationProposal = {
      id: proposalData.id || `prop-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      supplierId: proposalData.supplierId || 'ptn-unknown',
      supplierName: proposalData.supplierName || 'Fornecedor Cotante',
      supplierDocument: proposalData.supplierDocument || '00.000.000/0000-00',
      supplierContact: proposalData.supplierContact,
      deliveryDays: proposalData.deliveryDays || 7,
      freightType: proposalData.freightType || 'CIF',
      paymentTerm: proposalData.paymentTerm || '30 dias',
      items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      freightTotal: totals.freightTotal,
      grandTotal: totals.grandTotal,
      notes: proposalData.notes,
      submittedAt: new Date().toISOString(),
      isOverallWinner: false,
    };

    // Remove proposta existente do mesmo fornecedor se houver atualização
    cot.proposals = cot.proposals.filter((p) => p.supplierId !== proposal.supplierId);
    cot.proposals.push(proposal);

    // Se tiver mais de 1 proposta, atualiza status para EM_ANALISE
    if (cot.proposals.length > 1 && cot.status === 'ABERTA') {
      cot.status = 'EM_ANALISE';
    }

    const comp = QuotationComparator.compare(cot.proposals);
    cot.savingsAmount = comp.savingsAmount;
    cot.savingsPercentage = comp.savingsPercentage;

    cot.updatedAt = new Date().toISOString();

    return cot;
  }

  public homologateQuotation(
    schemaNamespace: string,
    quotationId: string,
    winningSupplierId: string,
    user: { id: string; name: string },
    createPurchaseOrderFlag: boolean = true
  ): { quotation: PurchaseQuotation; purchaseOrder?: PurchaseOrder } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const cot = storage.purchaseQuotations.find((q) => q.id === quotationId);
    if (!cot) throw new Error(`Cotação ID ${quotationId} não encontrada.`);

    const winningProp = cot.proposals.find((p) => p.supplierId === winningSupplierId);
    if (!winningProp) throw new Error(`Proposta do fornecedor '${winningSupplierId}' não encontrada nesta cotação.`);

    // Marcar proposta vencedora
    cot.proposals.forEach((p) => {
      p.isOverallWinner = p.supplierId === winningSupplierId;
      p.items.forEach((it) => {
        it.isWinning = p.supplierId === winningSupplierId;
      });
    });

    const comp = QuotationComparator.compare(cot.proposals);

    cot.status = 'HOMOLOGADA';
    cot.winningSupplierId = winningProp.supplierId;
    cot.winningSupplierName = winningProp.supplierName;
    cot.totalWinningAmount = winningProp.grandTotal;
    cot.savingsAmount = comp.savingsAmount;
    cot.savingsPercentage = comp.savingsPercentage;
    cot.homologatedById = user.id;
    cot.homologatedByName = user.name;
    cot.homologatedAt = new Date().toISOString();
    cot.updatedAt = new Date().toISOString();

    let order: PurchaseOrder | undefined;

    if (createPurchaseOrderFlag) {
      // Criação automática do Pedido de Compra
      const orderItems: PurchaseOrderItem[] = cot.items.map((it) => {
        const propItem = winningProp.items.find((pi: QuotationItemProposal) => pi.itemId === it.id);
        const unitPrice = propItem ? propItem.unitPrice : 0;
        const gross = ProcurementMath.roundBRL(it.quantity * unitPrice);
        return {
          id: `pc-item-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          quantity: it.quantity,
          quantityReceived: 0,
          unit: it.unit,
          unitPrice,
          discountAmount: 0,
          aliquotIPI: propItem?.ipiPercentage || 0,
          aliquotICMS: propItem?.icmsPercentage || 18,
          totalAmount: gross,
        };
      });

      order = this.createPurchaseOrder(
        schemaNamespace,
        {
          quotationId: cot.id,
          requisitionId: cot.requisitionIds[0],
          supplierId: winningProp.supplierId,
          supplierName: winningProp.supplierName,
          supplierDocument: winningProp.supplierDocument,
          paymentTerm: winningProp.paymentTerm,
          paymentMethod: 'BOLETO',
          freightTotal: winningProp.freightTotal,
          items: orderItems,
          notes: `Pedido originado automaticamente da homologação da Cotação ${cot.number}.`,
        },
        user
      );
    }

    this.recordTenantAudit(
      schemaNamespace,
      'HOMOLOGATE',
      'PURCHASE_QUOTATION',
      cot.id,
      {
        number: cot.number,
        winningSupplierName: winningProp.supplierName,
        totalWinningAmount: winningProp.grandTotal,
        savingsAmount: cot.savingsAmount,
        purchaseOrderId: order?.id,
      },
      user.id
    );

    return { quotation: cot, purchaseOrder: order };
  }

  public async homologateQuotationAsync(
    schemaNamespace: string,
    quotationId: string,
    winningSupplierId: string,
    user: { id: string; name: string },
    createPurchaseOrderFlag: boolean = true
  ): Promise<{ quotation: PurchaseQuotation; purchaseOrder?: PurchaseOrder }> {
    const result = this.homologateQuotation(
      schemaNamespace,
      quotationId,
      winningSupplierId,
      user,
      createPurchaseOrderFlag
    );
    if (PostgresService.isDbConnected() && result.purchaseOrder) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.createOrder(cleanCnpj, result.purchaseOrder);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL do pedido da cotação homologada: ${err.message}`, {
          cleanCnpj,
          orderId: result.purchaseOrder.id,
          quotationId,
        });
      }
    }
    return result;
  }

  // PEDIDOS DE COMPRA (PURCHASE ORDERS)
  public listPurchaseOrders(schemaNamespace: string, filter?: { status?: string; supplierId?: string }): PurchaseOrder[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    let list = [...(storage.purchaseOrders || [])];
    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.supplierId) {
      list = list.filter((p) => p.supplierId === filter.supplierId);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getPurchaseOrderById(schemaNamespace: string, id: string): PurchaseOrder | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    return storage?.purchaseOrders?.find((p) => p.id === id);
  }

  public createPurchaseOrder(
    schemaNamespace: string,
    data: Partial<PurchaseOrder>,
    user: { id: string; name: string }
  ): PurchaseOrder {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const counter = (storage.sequentialCounters.purchaseOrder || 0) + 1;
    storage.sequentialCounters.purchaseOrder = counter;
    const number = `PC-${String(counter).padStart(6, '0')}`;

    const items: PurchaseOrderItem[] = (data.items || []).map((it, idx) => {
      const qty = it.quantity || 1;
      const unitPrice = it.unitPrice || 0;
      const gross = ProcurementMath.roundBRL(qty * unitPrice);
      return {
        id: it.id || `pc-item-${Date.now().toString(36)}-${idx}`,
        productId: it.productId,
        productCode: it.productCode || 'ITEM',
        productName: it.productName || 'Produto / Mercadoria',
        quantity: qty,
        quantityReceived: 0,
        unit: it.unit || 'UN',
        unitPrice,
        discountAmount: it.discountAmount || 0,
        aliquotIPI: it.aliquotIPI || 0,
        aliquotICMS: it.aliquotICMS || 18,
        totalAmount: gross,
      };
    });

    const freight = data.freightTotal || 0;
    const totals = ProcurementMath.calculateOrderTotals(items, freight);

    const partner = storage.partners.find((p) => p.id === data.supplierId);
    const warehouse = storage.warehouses.find((w) => w.id === data.warehouseId) || storage.warehouses[0];

    const order: PurchaseOrder = {
      id: `pc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      number,
      quotationId: data.quotationId,
      requisitionId: data.requisitionId,
      supplierId: data.supplierId || partner?.id || 'ptn-default',
      supplierName: data.supplierName || partner?.name || 'Fornecedor Cadastrado',
      supplierDocument: data.supplierDocument || partner?.formattedDocument || '00.000.000/0000-00',
      supplierContact: data.supplierContact || partner?.phone || partner?.email,
      status: 'RASCUNHO',
      paymentTerm: data.paymentTerm || '30 dias',
      paymentMethod: data.paymentMethod || 'BOLETO',
      expectedDeliveryDate: data.expectedDeliveryDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      deliveryAddress: data.deliveryAddress || 'Almoxarifado Matriz',
      warehouseId: warehouse?.id || 'wh-default',
      warehouseName: warehouse?.name || 'Almoxarifado Principal',
      costCenterId: data.costCenterId,
      costCenterName: data.costCenterName,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      freightTotal: totals.freightTotal,
      taxesTotal: totals.taxesTotal,
      grandTotal: totals.grandTotal,
      items,
      notes: data.notes,
      createdById: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.purchaseOrders.unshift(order);

    this.recordTenantAudit(
      schemaNamespace,
      'CREATE',
      'PURCHASE_ORDER',
      order.id,
      { number: order.number, supplierName: order.supplierName, grandTotal: order.grandTotal },
      user.id
    );

    return order;
  }

  public async createPurchaseOrderAsync(
    schemaNamespace: string,
    data: Partial<PurchaseOrder>,
    user: { id: string; name: string }
  ): Promise<PurchaseOrder> {
    const order = this.createPurchaseOrder(schemaNamespace, data, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.createOrder(cleanCnpj, order);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de pedido de compra: ${err.message}`, {
          cleanCnpj,
          orderId: order.id,
        });
      }
    }
    return order;
  }

  public approvePurchaseOrder(schemaNamespace: string, id: string, user: { id: string; name: string }): PurchaseOrder {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const order = storage.purchaseOrders.find((p) => p.id === id);
    if (!order) throw new Error(`Pedido de Compra ID ${id} não encontrado.`);

    order.status = 'APROVADO';
    order.approvedById = user.id;
    order.approvedByName = user.name;
    order.approvedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'APPROVE',
      'PURCHASE_ORDER',
      order.id,
      { number: order.number, grandTotal: order.grandTotal },
      user.id
    );

    return order;
  }

  public async approvePurchaseOrderAsync(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): Promise<PurchaseOrder> {
    const order = this.approvePurchaseOrder(schemaNamespace, id, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.updateOrder(cleanCnpj, id, {
          status: order.status,
          approvedById: order.approvedById,
          approvedByName: order.approvedByName,
          approvedAt: order.approvedAt,
          updatedAt: order.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na aprovação PostgreSQL de pedido de compra: ${err.message}`, {
          cleanCnpj,
          orderId: id,
        });
      }
    }
    return order;
  }

  public rejectPurchaseOrder(
    schemaNamespace: string,
    id: string,
    reason: string,
    user: { id: string; name: string }
  ): PurchaseOrder {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const order = storage.purchaseOrders.find((p) => p.id === id);
    if (!order) throw new Error(`Pedido de Compra ID ${id} não encontrado.`);

    order.status = 'REJEITADO';
    order.rejectionReason = reason;
    order.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'REJECT',
      'PURCHASE_ORDER',
      order.id,
      { number: order.number, reason },
      user.id
    );

    return order;
  }

  public async rejectPurchaseOrderAsync(
    schemaNamespace: string,
    id: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<PurchaseOrder> {
    const order = this.rejectPurchaseOrder(schemaNamespace, id, reason, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.updateOrder(cleanCnpj, id, {
          status: order.status,
          rejectionReason: order.rejectionReason,
          updatedAt: order.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na rejeição PostgreSQL de pedido de compra: ${err.message}`, {
          cleanCnpj,
          orderId: id,
        });
      }
    }
    return order;
  }

  public issuePurchaseOrder(schemaNamespace: string, id: string, user: { id: string; name: string }): PurchaseOrder {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const order = storage.purchaseOrders.find((p) => p.id === id);
    if (!order) throw new Error(`Pedido de Compra ID ${id} não encontrado.`);

    order.status = 'EMITIDO_AO_FORNECEDOR';
    order.issuedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'ISSUE',
      'PURCHASE_ORDER',
      order.id,
      { number: order.number, supplierName: order.supplierName },
      user.id
    );

    return order;
  }

  public async issuePurchaseOrderAsync(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): Promise<PurchaseOrder> {
    const order = this.issuePurchaseOrder(schemaNamespace, id, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.updateOrder(cleanCnpj, id, {
          status: order.status,
          issuedAt: order.issuedAt,
          updatedAt: order.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na emissão PostgreSQL de pedido de compra: ${err.message}`, {
          cleanCnpj,
          orderId: id,
        });
      }
    }
    return order;
  }

  public cancelPurchaseOrder(schemaNamespace: string, id: string, user: { id: string; name: string }): PurchaseOrder {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const order = storage.purchaseOrders.find((p) => p.id === id);
    if (!order) throw new Error(`Pedido de Compra ID ${id} não encontrado.`);

    order.status = 'CANCELADO';
    order.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'CANCEL',
      'PURCHASE_ORDER',
      order.id,
      { number: order.number },
      user.id
    );

    return order;
  }

  public async cancelPurchaseOrderAsync(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): Promise<PurchaseOrder> {
    const order = this.cancelPurchaseOrder(schemaNamespace, id, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().procurement.updateOrder(cleanCnpj, id, {
          status: order.status,
          updatedAt: order.updatedAt,
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de pedido de compra: ${err.message}`, {
          cleanCnpj,
          orderId: id,
        });
      }
    }
    return order;
  }

  // ENTRADA DE NOTAS FISCAIS (INBOUND INVOICES / DF-e RECEBIMENTO)
  public listInboundInvoices(schemaNamespace: string, filter?: { status?: string }): InboundInvoice[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];
    let list = [...(storage.inboundInvoices || [])];
    if (filter?.status) {
      list = list.filter((i) => i.status === filter.status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getInboundInvoiceById(schemaNamespace: string, id: string): InboundInvoice | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    return storage?.inboundInvoices?.find((i) => i.id === id);
  }

  public importInboundInvoiceXml(
    schemaNamespace: string,
    xmlContent: string,
    warehouseId: string,
    user: { id: string; name: string },
    purchaseOrderId?: string
  ): InboundInvoice {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const parsed = NFeXmlParser.parse(xmlContent);

    // Verifica se a chave já foi importada no tenant
    const existing = storage.inboundInvoices.find((i) => i.accessKey === parsed.accessKey);
    if (existing) {
      throw new Error(`Nota Fiscal com chave de acesso ${parsed.accessKey} já foi importada anteriormente (NF-e ${existing.number}).`);
    }

    const counter = (storage.sequentialCounters.inboundInvoice || 0) + 1;
    storage.sequentialCounters.inboundInvoice = counter;

    // Tentar localizar parceiro de negócio pelo CNPJ ou cadastrar automaticamente
    const cleanCnpj = parsed.supplier.document.replace(/\D/g, '');
    let partner = storage.partners.find((p) => p.document.replace(/\D/g, '') === cleanCnpj);
    if (!partner) {
      partner = {
        id: `ptn-supp-${Date.now().toString(36)}`,
        personType: cleanCnpj.length === 11 ? 'PF' : 'PJ',
        document: cleanCnpj,
        formattedDocument: formatDocument(cleanCnpj),
        roles: ['FORNECEDOR'],
        name: parsed.supplier.name,
        tradeName: parsed.supplier.name.split(' ')[0],
        stateRegistration: parsed.supplier.stateRegistration,
        email: 'contato@fornecedor.com.br',
        phone: '(11) 3000-0000',
        address: {
          zipCode: '01001-000',
          street: 'Praça da Sé',
          number: '100',
          neighborhood: 'Centro',
          city: 'São Paulo',
          state: 'SP',
          ibgeCode: '3550308',
        },
        creditLimit: 50000,
        paymentTermsDays: 30,
        status: 'ATIVO',
        notes: 'Fornecedor cadastrado automaticamente via importação de XML de NF-e.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      storage.partners.push(partner);
    }

    // Tenta associar itens ao catálogo interno
    const mappedItems: InboundInvoiceItem[] = parsed.items.map((it) => {
      const matchProduct = storage.products.find(
        (p) => p.code.toLowerCase() === it.productCodeSupplier.toLowerCase() ||
               p.name.toLowerCase().includes(it.productName.toLowerCase().substring(0, 10))
      );

      return {
        ...it,
        internalProductId: matchProduct?.id,
        internalProductCode: matchProduct?.code,
        internalProductName: matchProduct?.name,
      };
    });

    let po: PurchaseOrder | undefined;
    if (purchaseOrderId) {
      po = storage.purchaseOrders.find((p) => p.id === purchaseOrderId);
    }

    const wh = storage.warehouses.find((w) => w.id === warehouseId) || storage.warehouses[0];

    const invoice: InboundInvoice = {
      id: `inb-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      accessKey: parsed.accessKey,
      number: parsed.number,
      series: parsed.series,
      issueDate: parsed.issueDate,
      entryDate: new Date().toISOString().split('T')[0],
      supplierId: partner.id,
      supplierName: partner.name,
      supplierDocument: partner.formattedDocument,
      supplierStateRegistration: partner.stateRegistration,
      purchaseOrderId: po?.id,
      purchaseOrderNumber: po?.number,
      warehouseId: wh?.id || 'wh-default',
      warehouseName: wh?.name || 'Almoxarifado Principal',
      totalProducts: parsed.totals.products,
      totalFreight: parsed.totals.freight,
      totalInsurance: parsed.totals.insurance,
      totalDiscount: parsed.totals.discount,
      totalIPI: parsed.totals.ipi,
      totalICMS: parsed.totals.icms,
      totalPIS: parsed.totals.pis,
      totalCOFINS: parsed.totals.cofins,
      netTotal: parsed.totals.netTotal,
      status: 'IMPORTADA',
      items: mappedItems,
      installments: parsed.installments,
      xmlRaw: xmlContent,
      createdById: user.id,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.inboundInvoices.unshift(invoice);

    this.recordTenantAudit(
      schemaNamespace,
      'IMPORT',
      'INBOUND_INVOICE',
      invoice.id,
      {
        number: invoice.number,
        series: invoice.series,
        supplierName: invoice.supplierName,
        netTotal: invoice.netTotal,
        accessKey: invoice.accessKey,
      },
      user.id
    );

    return invoice;
  }

  public processInboundInvoice(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): { invoice: InboundInvoice; stockMovementsCount: number; payablesCount: number } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema namespace '${schemaNamespace}' não encontrado.`);

    const invoice = storage.inboundInvoices.find((i) => i.id === id);
    if (!invoice) throw new Error(`Nota Fiscal de Entrada ID ${id} não encontrada.`);
    if (invoice.status === 'PROCESSADA') {
      throw new Error(`Esta NF-e de Entrada já foi processada em ${invoice.processedAt}.`);
    }

    const targetWarehouse = storage.warehouses.find((w) => w.id === invoice.warehouseId) || storage.warehouses[0];
    const targetWarehouseId = targetWarehouse?.id || 'wh-default';
    const targetWarehouseName = targetWarehouse?.name || 'Almoxarifado Principal';
    let stockMovementsCount = 0;
    let payablesCount = 0;

    // 1. INTEGRAÇÃO FÍSICA: Movimentação de Estoque & Recálculo de Custo Médio Ponderado
    for (const item of invoice.items) {
      let product = storage.products.find(
        (p) => p.id === item.internalProductId || p.code.toLowerCase() === item.productCodeSupplier.toLowerCase()
      );

      if (!product) {
        product = {
          id: `prd-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          code: item.productCodeSupplier,
          name: item.productName,
          type: 'PRODUCT',
          unit: item.unit,
          unitPrice: ProcurementMath.roundBRL(item.unitPrice * 1.4),
          costPrice: item.unitPrice,
          status: 'ATIVO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        storage.products.push(product);
        item.internalProductId = product.id;
        item.internalProductCode = product.code;
        item.internalProductName = product.name;
      }

      let stock = storage.stockItems.find(
        (s) => s.productId === product!.id && s.warehouseId === targetWarehouseId
      );

      const currentQty = stock ? stock.quantity : 0;
      const currentAvgCost = stock ? stock.averageCost : product.costPrice || item.unitPrice;
      const incomingQty = item.quantity;
      const incomingPrice = item.unitPrice;

      const newTotalQty = currentQty + incomingQty;
      const newAvgCost = newTotalQty > 0
        ? ProcurementMath.roundBRL((currentQty * currentAvgCost + incomingQty * incomingPrice) / newTotalQty)
        : incomingPrice;

      const company = Array.from(this.companies.values()).find((c) => c.schemaNamespace === schemaNamespace);
      const companyId = company?.id || 'comp-alfa';

      if (!stock) {
        stock = {
          id: `stk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          companyId,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          productUnit: product.unit || 'UN',
          warehouseId: targetWarehouseId,
          warehouseName: targetWarehouseName,
          quantity: incomingQty,
          reservedQuantity: 0,
          availableQuantity: incomingQty,
          averageCost: newAvgCost,
          lastCost: incomingPrice,
          totalValue: ProcurementMath.roundBRL(incomingQty * newAvgCost),
          minQuantity: 10,
          maxQuantity: 1000,
          updatedAt: new Date().toISOString(),
        };
        storage.stockItems.push(stock);
      } else {
        stock.quantity = newTotalQty;
        stock.availableQuantity = Math.max(0, stock.quantity - stock.reservedQuantity);
        stock.averageCost = newAvgCost;
        stock.lastCost = incomingPrice;
        stock.totalValue = ProcurementMath.roundBRL(stock.quantity * newAvgCost);
        stock.updatedAt = new Date().toISOString();
      }

      product.costPrice = newAvgCost;
      product.updatedAt = new Date().toISOString();

      const mvtCounter = (storage.sequentialCounters.inventoryMovement || 0) + 1;
      storage.sequentialCounters.inventoryMovement = mvtCounter;

      const movement: StockMovement = {
        id: `mov-${Date.now().toString(36)}-${mvtCounter}`,
        companyId,
        movementNumber: `MOV-${String(mvtCounter).padStart(6, '0')}`,
        movementType: 'INBOUND_PURCHASE',
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        productUnit: product.unit || 'UN',
        warehouseId: targetWarehouseId,
        warehouseName: targetWarehouseName,
        quantity: incomingQty,
        unitCost: incomingPrice,
        totalCost: ProcurementMath.roundBRL(incomingQty * incomingPrice),
        previousStock: currentQty,
        currentStock: newTotalQty,
        previousAverageCost: currentAvgCost,
        newAverageCost: newAvgCost,
        referenceType: 'PURCHASE',
        referenceId: invoice.id,
        referenceDocument: `NF-${invoice.number}`,
        batchNumber: item.batchNumber || `NF${invoice.number}`,
        notes: `Entrada física da NF-e ${invoice.number} emitida por ${invoice.supplierName}. CFOP: ${item.cfop}.`,
        createdById: user.id,
        createdByName: user.name,
        createdAt: new Date().toISOString(),
      };

      storage.stockMovements.unshift(movement);
      stockMovementsCount++;
    }

    // 2. INTEGRAÇÃO FINANCEIRA: Geração Automática das Contas a Pagar
    const coaAccount = storage.chartOfAccounts.find((c) => c.category === 'PASSIVO' && c.type === 'ANALITICA');
    const costCenter = storage.costCenters[0];

    for (const inst of invoice.installments) {
      const pagCounter = (storage.sequentialCounters.payable || 0) + 1;
      storage.sequentialCounters.payable = pagCounter;

      const payable: AccountPayable = {
        id: `pag-inb-${Date.now().toString(36)}-${pagCounter}`,
        number: `PAG-${String(pagCounter).padStart(6, '0')}`,
        supplierId: invoice.supplierId || 'ptn-default',
        supplierName: invoice.supplierName,
        supplierDocument: invoice.supplierDocument,
        chartOfAccountId: coaAccount?.id || 'coa-alfa-05',
        chartOfAccountCode: coaAccount?.code || '2.1.1.01',
        costCenterId: costCenter?.id || 'cc-alfa-01',
        costCenterCode: costCenter?.code || 'CC-01',
        description: `Entrada NF-e Nº ${invoice.number} (${invoice.supplierName}) - Parc. ${inst.number}`,
        issueDate: invoice.issueDate,
        dueDate: inst.dueDate,
        originalValue: inst.amount,
        discountValue: 0,
        fineValue: 0,
        interestValue: 0,
        paidValue: 0,
        balanceValue: inst.amount,
        status: 'OPEN',
        paymentMethod: 'BOLETO',
        createdBy: user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      storage.accountsPayable.unshift(payable);
      payablesCount++;
    }

    // 3. INTEGRAÇÃO COM PEDIDO DE COMPRA
    if (invoice.purchaseOrderId) {
      const order = storage.purchaseOrders.find((p) => p.id === invoice.purchaseOrderId);
      if (order) {
        for (const item of invoice.items) {
          const poItem = order.items.find(
            (pi) => (item.internalProductId && pi.productId === item.internalProductId) ||
                    (pi.productCode && item.productCodeSupplier && pi.productCode.toLowerCase() === item.productCodeSupplier.toLowerCase())
          );
          if (poItem) {
            poItem.quantityReceived = (poItem.quantityReceived || 0) + item.quantity;
          }
        }

        const allReceived = order.items.every((it) => (it.quantityReceived || 0) >= it.quantity);
        const anyReceived = order.items.some((it) => (it.quantityReceived || 0) > 0);

        if (allReceived) {
          order.status = 'RECEBIDO_TOTAL';
        } else if (anyReceived) {
          order.status = 'RECEBIDO_PARCIAL';
        }
        order.updatedAt = new Date().toISOString();
      }
    }

    // 4. Conclusão do Processamento
    invoice.status = 'PROCESSADA';
    invoice.processedAt = new Date().toISOString();
    invoice.processedByName = user.name;
    invoice.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'PROCESS',
      'INBOUND_INVOICE',
      invoice.id,
      {
        number: invoice.number,
        stockMovementsCount,
        payablesCount,
        netTotal: invoice.netTotal,
      },
      user.id
    );

    return { invoice, stockMovementsCount, payablesCount };
  }

  public async processInboundInvoiceAsync(
    schemaNamespace: string,
    id: string,
    user: { id: string; name: string }
  ): Promise<{ invoice: InboundInvoice; stockMovementsCount: number; payablesCount: number }> {
    const result = this.processInboundInvoice(schemaNamespace, id, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        const storage = this.getTenantStorage(schemaNamespace);
        if (storage?.stockMovements) {
          const movements = storage.stockMovements.filter((m) => m.referenceId === id);
          for (const m of movements) {
            await RepositoryManager.getInstance().getRepositories().inventory.recordStockMovementTransaction(cleanCnpj, m);
          }
        }
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de movimentos da NF de entrada: ${err.message}`, {
          cleanCnpj,
          invoiceId: id,
        });
      }
    }
    return result;
  }

  // MÉTRICAS CONSOLIDADAS DO DASHBOARD DE COMPRAS
  public getPurchasesMetrics(schemaNamespace: string): PurchasesDashboardMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) {
      return {
        totalSpentPeriod: 0,
        activeOrdersCount: 0,
        pendingRequisitionsCount: 0,
        pendingApprovalOrdersCount: 0,
        averageLeadTimeDays: 0,
        totalQuotationsSavings: 0,
        recentOrders: [],
        topSuppliers: [],
      };
    }

    const pendingRequisitionsCount = (storage.purchaseRequisitions || []).filter(
      (r) => r.status === 'PENDENTE_APROVACAO' || r.status === 'RASCUNHO' || r.status === 'EM_COTACAO'
    ).length;

    const pendingApprovalOrdersCount = (storage.purchaseOrders || []).filter(
      (o) => o.status === 'PENDENTE_APROVACAO'
    ).length;

    const activeOrdersCount = (storage.purchaseOrders || []).filter(
      (o) => o.status === 'APROVADO' || o.status === 'EMITIDO_AO_FORNECEDOR' || o.status === 'RECEBIDO_PARCIAL'
    ).length;

    const totalSpentPeriod = (storage.purchaseOrders || [])
      .filter((o) => o.status !== 'CANCELADO' && o.status !== 'REJEITADO')
      .reduce((acc, o) => acc + o.grandTotal, 0);

    const totalQuotationsSavings = (storage.purchaseQuotations || [])
      .reduce((acc, q) => acc + (q.savingsAmount || 0), 0);

    const supplierMap = new Map<string, { totalAmount: number; count: number }>();
    for (const order of storage.purchaseOrders || []) {
      if (order.status !== 'CANCELADO' && order.status !== 'REJEITADO') {
        const curr = supplierMap.get(order.supplierName) || { totalAmount: 0, count: 0 };
        curr.totalAmount += order.grandTotal;
        curr.count += 1;
        supplierMap.set(order.supplierName, curr);
      }
    }

    const topSuppliers = Array.from(supplierMap.entries())
      .map(([supplierName, stats]) => ({
        supplierName,
        totalAmount: ProcurementMath.roundBRL(stats.totalAmount),
        count: stats.count,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    const recentOrders = [...(storage.purchaseOrders || [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      totalSpentPeriod: ProcurementMath.roundBRL(totalSpentPeriod),
      activeOrdersCount,
      pendingRequisitionsCount,
      pendingApprovalOrdersCount,
      averageLeadTimeDays: 7,
      totalQuotationsSavings: ProcurementMath.roundBRL(totalQuotationsSavings),
      recentOrders,
      topSuppliers,
    };
  }

  // ============================================================================
  // PRD 09 — COBRANÇA BANCÁRIA, BOLETOS REGISTRADOS, PIX & CNAB (240/400)
  // ============================================================================

  listBankSlips(schemaNamespace: string, filter?: { status?: string; search?: string }): BankSlip[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    let list = storage.bankSlips || [];
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((b) => b.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (b) =>
          b.ourNumber.includes(q) ||
          b.documentNumber.toLowerCase().includes(q) ||
          b.payerName.toLowerCase().includes(q) ||
          b.payerDocument.includes(q)
      );
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getBankSlipById(schemaNamespace: string, id: string): BankSlip | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);
    return (storage.bankSlips || []).find((b) => b.id === id);
  }

  createBankSlip(
    schemaNamespace: string,
    data: {
      accountReceivableId?: string;
      bankAccountId?: string;
      bankCode?: string;
      wallet?: string;
      payerName: string;
      payerDocument: string;
      payerAddress?: string;
      amount: number;
      dueDate: string;
      instructions?: string[];
      finePercent?: number;
      interestMonthlyPercent?: number;
    },
    user: { id: string; name?: string; email?: string }
  ): BankSlip {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const company = Array.from(this.companies.values()).find((c) => c.schemaNamespace === schemaNamespace);
    if (!company) throw new Error(`Empresa com schema [${schemaNamespace}] não localizada.`);

    // Localiza conta bancária
    const bankAccount = data.bankAccountId
      ? storage.bankAccounts.find((b) => b.id === data.bankAccountId)
      : storage.bankAccounts[0];

    const bankCode = data.bankCode || bankAccount?.bankCode || '341';
    const bankCfg = SUPPORTED_BANKS[bankCode] || SUPPORTED_BANKS['341'];
    const wallet = data.wallet || bankCfg.defaultWallet;
    const agency = bankAccount?.agency || '1234';
    const account = bankAccount?.accountNumber || '12345';

    // Incrementa contador sequencial de Nosso Número
    const slipCounter = (storage.sequentialCounters.bankSlip || 0) + 1;
    storage.sequentialCounters.bankSlip = slipCounter;
    const ourNumber = String(slipCounter).padStart(11, '0');

    // Document Number
    let docNumber = `BOL-${String(slipCounter).padStart(6, '0')}`;
    let rec: AccountReceivable | undefined;
    if (data.accountReceivableId) {
      rec = storage.accountsReceivable.find((r) => r.id === data.accountReceivableId);
      if (rec) {
        docNumber = rec.number;
      }
    }

    // Calcula Campo Livre, Código de Barras e Linha Digitável
    const freeField = BoletoMath.generateFreeField({
      bankCode,
      agency,
      account,
      wallet,
      ourNumber,
    });

    const { barcode } = BoletoMath.buildBarcode({
      bankCode,
      amount: data.amount,
      dueDate: data.dueDate,
      freeField,
    });

    const digitableLine = BoletoMath.buildDigitableLine(barcode);

    const slip: BankSlip = {
      id: `bs-${Date.now().toString(36)}-${slipCounter}`,
      ourNumber,
      documentNumber: docNumber,
      barcode,
      digitableLine,
      bankCode,
      bankName: bankCfg.name,
      agency,
      account,
      wallet,
      payerName: data.payerName,
      payerDocument: cleanDocument(data.payerDocument),
      payerAddress: data.payerAddress || 'Endereço Comercial',
      beneficiaryName: company.legalName,
      beneficiaryDocument: company.cnpj,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      amount: BoletoMath.roundBRL(data.amount),
      finePercent: data.finePercent ?? 2.0,
      interestMonthlyPercent: data.interestMonthlyPercent ?? 1.0,
      status: 'REGISTERED',
      accountReceivableId: data.accountReceivableId,
      instructions: data.instructions || [
        'NÃO RECEBER APÓS 30 DIAS DO VENCIMENTO.',
        'APÓS O VENCIMENTO COBRAR MULTA DE 2,0% E JUROS DE 1,0% AO MÊS.',
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.bankSlips.unshift(slip);

    this.recordTenantAudit(
      schemaNamespace,
      'BANK_SLIP_CREATE',
      'bank_slips',
      slip.id,
      {
        ourNumber: slip.ourNumber,
        amount: slip.amount,
        bankCode: slip.bankCode,
        payer: slip.payerName,
      },
      user.id
    );

    return slip;
  }

  cancelBankSlip(schemaNamespace: string, id: string, reason: string, user: { id: string; name?: string; email?: string }): BankSlip {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const slip = (storage.bankSlips || []).find((b) => b.id === id);
    if (!slip) throw new Error(`Boleto [${id}] não encontrado.`);

    if (slip.status === 'PAID') {
      throw new Error(`Não é possível cancelar um boleto que já foi liquidado.`);
    }

    slip.status = 'CANCELED';
    slip.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'BANK_SLIP_CANCEL',
      'bank_slips',
      slip.id,
      { reason, ourNumber: slip.ourNumber },
      user.id
    );

    return slip;
  }

  async createBankSlipAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createBankSlip']>[1],
    user: { id: string; name?: string; email?: string }
  ): Promise<BankSlip> {
    const slip = this.createBankSlip(schemaNamespace, data, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().financial.createBankSlip(cleanCnpj, slip);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de boleto bancário: ${err.message}`, {
          cleanCnpj,
          slipId: slip.id,
        });
      }
    }
    return slip;
  }

  async cancelBankSlipAsync(
    schemaNamespace: string,
    id: string,
    reason: string,
    user: { id: string; name?: string; email?: string }
  ): Promise<BankSlip> {
    const slip = this.cancelBankSlip(schemaNamespace, id, reason, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().financial.updateBankSlip(cleanCnpj, id, { status: 'CANCELED' });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de boleto: ${err.message}`, {
          cleanCnpj,
          slipId: id,
        });
      }
    }
    return slip;
  }

  listPixCharges(schemaNamespace: string): PixCharge[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);
    return [...(storage.pixCharges || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createPixCharge(
    schemaNamespace: string,
    data: {
      accountReceivableId?: string;
      customerName: string;
      customerDocument: string;
      amount: number;
      description?: string;
      keyType?: PixKeyType;
      key?: string;
    },
    user: { id: string; name?: string; email?: string }
  ): PixCharge {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const company = Array.from(this.companies.values()).find((c) => c.schemaNamespace === schemaNamespace);
    if (!company) throw new Error(`Empresa com schema [${schemaNamespace}] não localizada.`);

    const txid = `TX${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const key = data.key || company.cleanCnpj;
    const keyType = data.keyType || 'CNPJ';

    const emvPayload = PixEngine.generatePixPayload({
      key,
      amount: data.amount,
      merchantName: company.legalName,
      merchantCity: 'SAO PAULO',
      txid,
      description: data.description || 'Cobrança Enlace ERP',
    });

    const qrCodeSvg = PixEngine.generateQrCodeSvg(txid);

    const charge: PixCharge = {
      id: `pix-${Date.now().toString(36)}`,
      txid,
      accountReceivableId: data.accountReceivableId,
      customerName: data.customerName,
      customerDocument: cleanDocument(data.customerDocument),
      description: data.description || `Cobrança Pix - ${company.tradeName || company.legalName}`,
      amount: BoletoMath.roundBRL(data.amount),
      keyType,
      key,
      emvPayload,
      qrCodeSvg,
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.pixCharges.unshift(charge);

    this.recordTenantAudit(
      schemaNamespace,
      'PIX_CHARGE_CREATE',
      'pix_charges',
      charge.id,
      { txid: charge.txid, amount: charge.amount, customer: charge.customerName },
      user.id
    );

    return charge;
  }

  async createPixChargeAsync(
    schemaNamespace: string,
    data: Parameters<DatabaseEngine['createPixCharge']>[1],
    user: { id: string; name?: string; email?: string }
  ): Promise<PixCharge> {
    const charge = this.createPixCharge(schemaNamespace, data, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().financial.createPixCharge(cleanCnpj, charge);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de cobrança Pix: ${err.message}`, {
          cleanCnpj,
          txid: charge.txid,
        });
      }
    }
    return charge;
  }

  simulatePixPayment(schemaNamespace: string, txid: string, user: { id: string; name?: string; email?: string }): { charge: PixCharge; settlementLog: string } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const charge = (storage.pixCharges || []).find((p) => p.txid === txid);
    if (!charge) throw new Error(`Cobrança Pix [${txid}] não localizada.`);

    if (charge.status === 'CONCLUDED') {
      return { charge, settlementLog: 'Esta cobrança já foi liquidada anteriormente.' };
    }

    const endToEndId = `E${Date.now()}BACEN${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    charge.status = 'CONCLUDED';
    charge.paidAt = new Date().toISOString();
    charge.endToEndId = endToEndId;
    charge.updatedAt = new Date().toISOString();

    let settlementLog = `Pix liquidado com sucesso instantaneamente via SPI/Bacen. EndToEndId: ${endToEndId}.`;

    // Baixa automática no Contas a Receber se vinculado
    if (charge.accountReceivableId) {
      const rec = storage.accountsReceivable.find((r) => r.id === charge.accountReceivableId);
      if (rec && rec.status !== 'PAID') {
        rec.status = 'PAID';
        rec.paidValue = rec.originalValue;
        rec.balanceValue = 0;
        rec.paidAt = new Date().toISOString();
        rec.updatedAt = new Date().toISOString();
        settlementLog += ` Baixa automática efetuada no título a receber [${rec.number}].`;
      }
    }

    // Crédito na Tesouraria (independente de haver título vinculado)
    const bankAccount = storage.bankAccounts[0];
    if (bankAccount) {
      bankAccount.currentBalance = BoletoMath.roundBRL(bankAccount.currentBalance + charge.amount);
      storage.bankTransactions.unshift({
        id: `btx-pix-${Date.now().toString(36)}`,
        bankAccountId: bankAccount.id,
        date: new Date().toISOString().split('T')[0],
        type: 'CREDIT',
        amount: charge.amount,
        description: `Liquidação Pix Dinâmico ${charge.txid} - ${charge.customerName}`,
        category: 'RECEBIMENTO_CLIENTES',
        relatedTitleType: charge.accountReceivableId ? 'RECEIVABLE' : undefined,
        relatedTitleId: charge.accountReceivableId,
        reconciled: true,
        createdAt: new Date().toISOString(),
      });
      settlementLog += ` Saldo creditado na conta [${bankAccount.name}].`;
    }

    this.recordTenantAudit(
      schemaNamespace,
      'PIX_PAYMENT_SIMULATED',
      'pix_charges',
      charge.id,
      { txid: charge.txid, endToEndId, amount: charge.amount },
      user.id
    );

    return { charge, settlementLog };
  }

  async simulatePixPaymentAsync(
    schemaNamespace: string,
    txid: string,
    user: { id: string; name?: string; email?: string }
  ): Promise<{ charge: PixCharge; settlementLog: string }> {
    const result = this.simulatePixPayment(schemaNamespace, txid, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().financial.updatePixCharge(cleanCnpj, txid, {
          status: 'CONCLUDED',
          paidAt: result.charge.paidAt || new Date().toISOString(),
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de liquidação Pix: ${err.message}`, {
          cleanCnpj,
          txid,
        });
      }
    }
    return result;
  }

  listCnabFiles(schemaNamespace: string): CnabFile[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);
    return [...(storage.cnabFiles || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  generateCnabRemessa(
    schemaNamespace: string,
    params: {
      bankAccountId: string;
      bankSlipIds?: string[];
      standard?: CnabStandard;
    },
    user: { id: string; name?: string; email?: string }
  ): CnabFile {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const company = Array.from(this.companies.values()).find((c) => c.schemaNamespace === schemaNamespace);
    if (!company) throw new Error(`Empresa com schema [${schemaNamespace}] não localizada.`);

    const bankAccount = storage.bankAccounts.find((b) => b.id === params.bankAccountId);
    if (!bankAccount) throw new Error(`Conta bancária selecionada não encontrada.`);

    let slipsToInclude = storage.bankSlips || [];
    if (params.bankSlipIds && params.bankSlipIds.length > 0) {
      slipsToInclude = slipsToInclude.filter((s) => params.bankSlipIds!.includes(s.id));
    } else {
      slipsToInclude = slipsToInclude.filter((s) => s.status === 'REGISTERED' || s.status === 'DRAFT');
    }

    if (slipsToInclude.length === 0) {
      throw new Error(`Nenhum boleto selecionado ou pendente de remessa para a conta bancária.`);
    }

    const seqCounter = (storage.sequentialCounters.cnabRemessa || 0) + 1;
    storage.sequentialCounters.cnabRemessa = seqCounter;

    const bankCode = bankAccount.bankCode || '001';
    const bankCfg = SUPPORTED_BANKS[bankCode] || SUPPORTED_BANKS['001'];
    const standard = params.standard || 'CNAB400';

    const contentRaw = CnabEngine.generateRemessaCnab400({
      bankCode,
      companyLegalName: company.legalName,
      companyCnpj: company.cnpj,
      bankAccount,
      sequenceNumber: seqCounter,
      slips: slipsToInclude,
    });

    const totalAmount = slipsToInclude.reduce((sum, s) => sum + s.amount, 0);

    const cnabFile: CnabFile = {
      id: `cnab-rem-${Date.now().toString(36)}-${seqCounter}`,
      filename: `CB${bankCode}${String(seqCounter).padStart(4, '0')}.REM`,
      type: 'REMESSA',
      standard,
      bankCode,
      bankName: bankCfg.name,
      bankAccountId: bankAccount.id,
      sequenceNumber: seqCounter,
      generationDate: new Date().toISOString(),
      totalRecords: slipsToInclude.length + 2,
      totalAmount: BoletoMath.roundBRL(totalAmount),
      status: 'GENERATED',
      contentRaw,
      itemsCount: slipsToInclude.length,
      itemsSuccessCount: slipsToInclude.length,
      itemsErrorCount: 0,
      processingLog: [
        `Arquivo de remessa gerado com sucesso contendo ${slipsToInclude.length} títulos.`,
        `Sequencial: ${seqCounter} • Layout: ${standard} • Banco: ${bankCfg.name}.`,
      ],
      createdById: user.id,
      createdByName: user.name || 'Operador Financeiro',
      createdAt: new Date().toISOString(),
    };

    // Marca boletos como transmitidos/registrados
    for (const slip of slipsToInclude) {
      slip.status = 'REGISTERED';
      slip.updatedAt = new Date().toISOString();
    }

    storage.cnabFiles.unshift(cnabFile);

    this.recordTenantAudit(
      schemaNamespace,
      'CNAB_REMESSA_GENERATE',
      'cnab_files',
      cnabFile.id,
      {
        filename: cnabFile.filename,
        itemsCount: slipsToInclude.length,
        totalAmount,
      },
      user.id
    );

    return cnabFile;
  }

  processCnabRetorno(
    schemaNamespace: string,
    params: {
      contentRaw: string;
      bankAccountId: string;
    },
    user: { id: string; name?: string; email?: string }
  ): { cnabFile: CnabFile; settledSlipsCount: number; totalSettledAmount: number } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const bankAccount = storage.bankAccounts.find((b) => b.id === params.bankAccountId);
    if (!bankAccount) throw new Error(`Conta bancária de destino não encontrada.`);

    const parsed = CnabEngine.parseRetornoCnab(params.contentRaw);
    const bankCfg = SUPPORTED_BANKS[parsed.bankCode] || SUPPORTED_BANKS['001'];

    let settledCount = 0;
    let totalSettled = 0;
    const processingLogs: string[] = [
      `Iniciando leitura de arquivo de Retorno ${parsed.standard} do banco ${bankCfg.name}.`,
      `Total de registros lidos: ${parsed.totalRecords}.`,
    ];

    for (const occ of parsed.occurrences) {
      if (occ.isSettlement) {
        // Tenta localizar o boleto por Nosso Número ou Número do Documento
        const cleanOur = occ.ourNumber.replace(/\D/g, '');
        const slip = (storage.bankSlips || []).find((b) => {
          const bClean = b.ourNumber.replace(/\D/g, '');
          return (
            (cleanOur && bClean.endsWith(cleanOur)) ||
            (b.documentNumber && b.documentNumber.includes(occ.documentNumber))
          );
        });

        if (slip) {
          slip.status = 'PAID';
          slip.paidAmount = occ.paidAmount;
          slip.paidDate = occ.paymentDate;
          slip.updatedAt = new Date().toISOString();
          settledCount++;
          totalSettled += occ.paidAmount;
          processingLogs.push(
            `Boleto [${slip.ourNumber}] liquidado com sucesso. Valor: R$ ${occ.paidAmount.toFixed(2)}. Data: ${occ.paymentDate}.`
          );

          // Baixa na Conta a Receber correspondente
          if (slip.accountReceivableId) {
            const rec = storage.accountsReceivable.find((r) => r.id === slip.accountReceivableId);
            if (rec && rec.status !== 'PAID') {
              rec.status = 'PAID';
              rec.paidValue = occ.paidAmount;
              rec.balanceValue = 0;
              rec.paidAt = occ.paymentDate;
              rec.updatedAt = new Date().toISOString();
              processingLogs.push(`Título a receber [${rec.number}] conciliado e baixado.`);
            }
          }
        } else {
          processingLogs.push(
            `Aviso: Boleto com Nosso Número [${occ.ourNumber}] não encontrado no sistema. Pagamento registrado como crédito avulso.`
          );
        }
      }
    }

    // Se houve liquidações, atualiza saldo e gera transação bancária
    if (totalSettled > 0) {
      bankAccount.currentBalance = BoletoMath.roundBRL(bankAccount.currentBalance + totalSettled);
      storage.bankTransactions.unshift({
        id: `btx-cnab-${Date.now().toString(36)}`,
        bankAccountId: bankAccount.id,
        date: new Date().toISOString().split('T')[0],
        type: 'CREDIT',
        amount: BoletoMath.roundBRL(totalSettled),
        description: `Crédito em Lote Arquivo de Retorno CNAB - ${settledCount} títulos liquidados`,
        category: 'RECEBIMENTO_CLIENTES',
        reconciled: true,
        createdAt: new Date().toISOString(),
      });
      processingLogs.push(`Saldo da conta bancária [${bankAccount.name}] atualizado com crédito de R$ ${totalSettled.toFixed(2)}.`);
    }

    const cnabFile: CnabFile = {
      id: `cnab-ret-${Date.now().toString(36)}`,
      filename: `RET_${parsed.bankCode}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}.RET`,
      type: 'RETORNO',
      standard: parsed.standard,
      bankCode: parsed.bankCode,
      bankName: bankCfg.name,
      bankAccountId: bankAccount.id,
      sequenceNumber: 1,
      generationDate: new Date().toISOString(),
      totalRecords: parsed.totalRecords,
      totalAmount: BoletoMath.roundBRL(totalSettled),
      status: 'PROCESSED',
      contentRaw: params.contentRaw,
      itemsCount: parsed.occurrences.length,
      itemsSuccessCount: settledCount,
      itemsErrorCount: parsed.occurrences.length - settledCount,
      processingLog: processingLogs,
      createdById: user.id,
      createdByName: user.name || 'Operador Financeiro',
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };

    storage.cnabFiles.unshift(cnabFile);

    this.recordTenantAudit(
      schemaNamespace,
      'CNAB_RETORNO_PROCESS',
      'cnab_files',
      cnabFile.id,
      {
        settledCount,
        totalSettled,
        totalRecords: parsed.totalRecords,
      },
      user.id
    );

    return {
      cnabFile,
      settledSlipsCount: settledCount,
      totalSettledAmount: BoletoMath.roundBRL(totalSettled),
    };
  }

  async processCnabRetornoAsync(
    schemaNamespace: string,
    params: {
      contentRaw: string;
      bankAccountId: string;
    },
    user: { id: string; name?: string; email?: string }
  ): Promise<{ cnabFile: CnabFile; settledSlipsCount: number; totalSettledAmount: number }> {
    const result = this.processCnabRetorno(schemaNamespace, params, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        const storage = this.getTenantStorage(schemaNamespace);
        if (storage?.accountsReceivable) {
          const paidRecs = storage.accountsReceivable.filter((r) => r.status === 'PAID');
          for (const rec of paidRecs) {
            await RepositoryManager.getInstance().getRepositories().receivables.updateReceivable(
              cleanCnpj,
              rec.id,
              { status: 'PAID', paidAmount: rec.paidValue, remainingAmount: rec.balanceValue }
            );
          }
        }
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL da conciliação CNAB: ${err.message}`, {
          cleanCnpj,
          cnabFileId: result.cnabFile.id,
        });
      }
    }
    return result;
  }

  getBankingDashboardMetrics(schemaNamespace: string): BankingDashboardMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const slips = storage.bankSlips || [];
    const pixList = storage.pixCharges || [];
    const receivables = storage.accountsReceivable || [];

    // Contadores
    const boletosActiveCount = slips.filter((s) => s.status === 'REGISTERED' || s.status === 'DRAFT').length;
    const pixActiveCount = pixList.filter((p) => p.status === 'ACTIVE').length;
    const pendingRemessaCount = slips.filter((s) => s.status === 'DRAFT' || s.status === 'REGISTERED').length;

    // Total a cobrar
    const totalToCollect = receivables
      .filter((r) => r.status === 'OPEN' || r.status === 'PARTIALLY_PAID')
      .reduce((sum, r) => sum + r.balanceValue, 0);

    // Total liquidado no mês
    const slipsPaidMonth = slips
      .filter((s) => s.status === 'PAID' && s.paidDate && s.paidDate.startsWith(currentMonthPrefix))
      .reduce((sum, s) => sum + (s.paidAmount || s.amount), 0);

    const pixPaidMonth = pixList
      .filter((p) => p.status === 'CONCLUDED' && p.paidAt && p.paidAt.startsWith(currentMonthPrefix))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalCollectedMonth = BoletoMath.roundBRL(slipsPaidMonth + pixPaidMonth);

    // Inadimplência
    const todayStr = now.toISOString().split('T')[0];
    let overdueAmount = 0;
    let totalEligibleAmount = 0;

    const aging = {
      upTo30Days: 0,
      from31To60Days: 0,
      from61To90Days: 0,
      above90Days: 0,
      onTime: 0,
    };

    for (const rec of receivables) {
      if (rec.status !== 'CANCELED') {
        totalEligibleAmount += rec.originalValue;

        if (rec.status === 'OPEN' || rec.status === 'PARTIALLY_PAID') {
          if (rec.dueDate < todayStr) {
            overdueAmount += rec.balanceValue;
            const diffDays = Math.floor(
              (new Date(todayStr).getTime() - new Date(rec.dueDate).getTime()) / 86400000
            );
            if (diffDays <= 30) aging.upTo30Days += rec.balanceValue;
            else if (diffDays <= 60) aging.from31To60Days += rec.balanceValue;
            else if (diffDays <= 90) aging.from61To90Days += rec.balanceValue;
            else aging.above90Days += rec.balanceValue;
          } else {
            aging.onTime += rec.balanceValue;
          }
        }
      }
    }

    const defaultRate = totalEligibleAmount > 0
      ? BoletoMath.roundBRL((overdueAmount / totalEligibleAmount) * 100)
      : 0;

    // Volume por canal
    const boletoVol = slips.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + (s.paidAmount || s.amount), 0);
    const pixVol = pixList.filter((p) => p.status === 'CONCLUDED').reduce((sum, p) => sum + p.amount, 0);
    const transferVol = (storage.bankTransactions || [])
      .filter((t) => t.type === 'CREDIT' && t.category === 'RECEBIMENTO_CLIENTES')
      .reduce((sum, t) => sum + t.amount, 0) - (boletoVol + pixVol);

    // Transações recentes
    const recentTransactions: BankingDashboardMetrics['recentTransactions'] = [];
    for (const s of slips.filter((x) => x.status === 'PAID').slice(0, 5)) {
      recentTransactions.push({
        id: s.id,
        titleNumber: s.documentNumber,
        customerName: s.payerName,
        method: 'BOLETO',
        amount: s.paidAmount || s.amount,
        date: s.paidDate || s.issueDate,
        status: 'LIQUIDADO',
      });
    }
    for (const p of pixList.filter((x) => x.status === 'CONCLUDED').slice(0, 5)) {
      recentTransactions.push({
        id: p.id,
        titleNumber: p.txid,
        customerName: p.customerName,
        method: 'PIX',
        amount: p.amount,
        date: p.paidAt ? p.paidAt.split('T')[0] : p.createdAt.split('T')[0],
        status: 'LIQUIDADO_PIX',
      });
    }

    return {
      totalToCollect: BoletoMath.roundBRL(totalToCollect),
      totalCollectedMonth,
      defaultRate,
      boletosActiveCount,
      pixActiveCount,
      pendingRemessaCount,
      agingBreakdown: {
        upTo30Days: BoletoMath.roundBRL(aging.upTo30Days),
        from31To60Days: BoletoMath.roundBRL(aging.from31To60Days),
        from61To90Days: BoletoMath.roundBRL(aging.from61To90Days),
        above90Days: BoletoMath.roundBRL(aging.above90Days),
        onTime: BoletoMath.roundBRL(aging.onTime),
      },
      channelPerformance: {
        boletoVolume: BoletoMath.roundBRL(boletoVol),
        pixVolume: BoletoMath.roundBRL(pixVol),
        transferVolume: BoletoMath.roundBRL(Math.max(0, transferVol)),
      },
      recentTransactions: recentTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
    };
  }

  listDunningRules(schemaNamespace: string): CollectionDunningRule[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);
    return storage.dunningRules || [];
  }

  createDunningRule(
    schemaNamespace: string,
    data: Partial<CollectionDunningRule>,
    user: { id: string; name?: string; email?: string }
  ): CollectionDunningRule {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const rule: CollectionDunningRule = {
      id: `dun-${Date.now().toString(36)}`,
      name: data.name || 'Nova Etapa de Cobrança',
      triggerDays: data.triggerDays ?? 0,
      channel: data.channel || 'EMAIL',
      templateSubject: data.templateSubject || 'Notificação de Cobrança',
      templateBody: data.templateBody || 'Prezado cliente, sua fatura está disponível.',
      includePix: data.includePix ?? true,
      includeBoleto: data.includeBoleto ?? true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.dunningRules.push(rule);

    this.recordTenantAudit(
      schemaNamespace,
      'DUNNING_RULE_CREATE',
      'dunning_rules',
      rule.id,
      { name: rule.name, triggerDays: rule.triggerDays, channel: rule.channel },
      user.id
    );

    return rule;
  }

  toggleDunningRule(
    schemaNamespace: string,
    id: string,
    isActive: boolean,
    user: { id: string; name?: string; email?: string }
  ): CollectionDunningRule {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const rule = (storage.dunningRules || []).find((r) => r.id === id);
    if (!rule) throw new Error(`Regra de cobrança [${id}] não encontrada.`);

    rule.isActive = isActive;
    rule.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'DUNNING_RULE_TOGGLE',
      'dunning_rules',
      rule.id,
      { isActive },
      user.id
    );

    return rule;
  }

  executeDunningRules(
    schemaNamespace: string,
    user: { id: string; name?: string; email?: string }
  ): { dispatchedCount: number; logs: string[] } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const rules = (storage.dunningRules || []).filter((r) => r.isActive);
    const slips = storage.bankSlips || [];
    const now = new Date();

    const logs: string[] = [];
    let dispatchedCount = 0;

    for (const rule of rules) {
      const targetDate = new Date(now.getTime() - rule.triggerDays * 86400000);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const matchingSlips = slips.filter(
        (s) => (s.status === 'REGISTERED' || s.status === 'DRAFT' || s.status === 'OVERDUE') && s.dueDate <= targetDateStr
      );

      if (matchingSlips.length > 0) {
        for (const slip of matchingSlips) {
          dispatchedCount++;
          const channelName = rule.channel === 'EMAIL' ? 'E-mail' : rule.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS';
          logs.push(
            `[${channelName}] Disparo efetuado para ${slip.payerName} (Boleto ${slip.ourNumber}, Venc: ${slip.dueDate}, Valor: R$ ${slip.amount.toFixed(2)}) via regra "${rule.name}"`
          );
        }
      } else {
        logs.push(`Regra "${rule.name}" avaliada: nenhum título pendente elegível para a faixa de corte.`);
      }
    }

    if (dispatchedCount === 0) {
      logs.push(`Processamento concluído. Nenhum disparo foi necessário para a carteira atual.`);
    }

    this.recordTenantAudit(
      schemaNamespace,
      'DUNNING_RULES_EXECUTE',
      'dunning_rules',
      'batch-execution',
      { rulesEvaluated: rules.length, dispatchedCount },
      user.id
    );

    return { dispatchedCount, logs };
  }

  // ==========================================================================
  // PRD PARTE 06: COBRANÇA E CONTAS A RECEBER (Separation & Adapters)
  // ==========================================================================

  createReceivable(
    schemaNamespace: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): Receivable {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    const result = engine.createReceivable(storage.receivablesV2, input, schemaNamespace, {
      id: user?.id || 'usr_system',
      name: user?.name || user?.email || 'Operador',
    });

    storage.auditLogs.unshift(result.audit);
    const cleanCnpj = schemaNamespace.replace('tenant_', '');
    try {
      RepositoryManager.getInstance().getRepositories().receivables.createReceivable(cleanCnpj, result.receivable).catch((err: any) => {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de conta a receber: ${err.message}`, {
          cleanCnpj,
          receivableId: result.receivable.id,
        });
      });
    } catch {
      // Ignora se repositório não inicializado
    }
    return result.receivable;
  }

  async createReceivableAsync(
    schemaNamespace: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): Promise<Receivable> {
    const receivable = this.createReceivable(schemaNamespace, input, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      await RepositoryManager.getInstance().getRepositories().receivables.createReceivable(cleanCnpj, receivable);
    }
    return receivable;
  }

  listReceivables(
    schemaNamespace: string,
    filters?: {
      status?: string;
      customerId?: string;
      startDate?: string;
      endDate?: string;
      isOverdue?: boolean;
    }
  ): Receivable[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    return engine.listReceivables(storage.receivablesV2, filters);
  }

  getReceivable(schemaNamespace: string, id: string): Receivable | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    return engine.getReceivable(storage.receivablesV2, id);
  }

  cancelReceivable(
    schemaNamespace: string,
    id: string,
    reason: string,
    user?: { id: string; name?: string; email?: string }
  ): Receivable {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    const result = engine.cancelReceivable(
      storage.receivablesV2,
      storage.collectionsV2,
      storage.paymentProvidersV2,
      id,
      reason,
      {
        id: user?.id || 'usr_system',
        name: user?.name || user?.email || 'Operador',
      }
    );

    storage.auditLogs.unshift(result.audit);
    return result.receivable;
  }

  async cancelReceivableAsync(
    schemaNamespace: string,
    id: string,
    reason: string,
    user?: { id: string; name?: string; email?: string }
  ): Promise<Receivable> {
    const rec = this.cancelReceivable(schemaNamespace, id, reason, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.updateReceivable(cleanCnpj, id, {
          status: 'CANCELED',
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de recebível: ${err.message}`, {
          cleanCnpj,
          receivableId: id,
        });
      }
    }
    return rec;
  }

  recordReceivablePayment(
    schemaNamespace: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): { receivable: Receivable; payment: PaymentRecord } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    const result = engine.recordPayment(
      storage.receivablesV2,
      storage.collectionsV2,
      storage.paymentsV2,
      input,
      schemaNamespace,
      {
        id: user?.id || 'usr_system',
        name: user?.name || user?.email || 'Operador',
      }
    );

    storage.auditLogs.unshift(result.audit);
    return { receivable: result.receivable, payment: result.payment };
  }

  async recordReceivablePaymentAsync(
    schemaNamespace: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): Promise<{ receivable: Receivable; payment: PaymentRecord }> {
    const res = this.recordReceivablePayment(schemaNamespace, input, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.recordPaymentTransaction(
          cleanCnpj,
          res.payment,
          res.payment.collectionId || '',
          res.receivable.id
        );
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no registro PostgreSQL de liquidação de recebível: ${err.message}`, {
          cleanCnpj,
          receivableId: res.receivable.id,
          paymentId: res.payment.id,
        });
      }
    }
    return res;
  }

  reverseReceivablePayment(
    schemaNamespace: string,
    paymentId: string,
    reason: string,
    user?: { id: string; name?: string; email?: string }
  ): { payment: PaymentRecord; receivable: Receivable } {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    const result = engine.reversePayment(
      storage.receivablesV2,
      storage.paymentsV2,
      paymentId,
      reason,
      {
        id: user?.id || 'usr_system',
        name: user?.name || user?.email || 'Operador',
      }
    );

    storage.auditLogs.unshift(result.audit);
    return { payment: result.payment, receivable: result.receivable };
  }

  async reverseReceivablePaymentAsync(
    schemaNamespace: string,
    paymentId: string,
    reason: string,
    user?: { id: string; name?: string; email?: string }
  ): Promise<{ payment: PaymentRecord; receivable: Receivable }> {
    const result = this.reverseReceivablePayment(schemaNamespace, paymentId, reason, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.updateReceivable(
          cleanCnpj,
          result.receivable.id,
          {
            status: result.receivable.status,
            paidAmount: result.receivable.paidAmount,
            remainingAmount: result.receivable.remainingAmount,
          }
        );
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no estorno PostgreSQL de pagamento de recebível: ${err.message}`, {
          cleanCnpj,
          paymentId,
          receivableId: result.receivable.id,
        });
      }
    }
    return result;
  }

  async createCollection(
    schemaNamespace: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): Promise<Collection> {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    const result = await engine.createCollection(
      storage.receivablesV2,
      storage.collectionsV2,
      storage.paymentProvidersV2,
      input,
      schemaNamespace,
      {
        id: user?.id || 'usr_system',
        name: user?.name || user?.email || 'Operador',
      }
    );

    storage.auditLogs.unshift(result.audit);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.createCollection(cleanCnpj, result.collection);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de cobrança: ${err.message}`, {
          cleanCnpj,
          collectionId: result.collection.id,
        });
      }
    }
    return result.collection;
  }

  listCollections(
    schemaNamespace: string,
    filters?: {
      receivableId?: string;
      method?: string;
      status?: string;
    }
  ): Collection[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    let list = [...storage.collectionsV2];
    if (filters?.receivableId) {
      list = list.filter((c) => c.receivableId === filters.receivableId);
    }
    if (filters?.method) {
      list = list.filter((c) => c.method === filters.method);
    }
    if (filters?.status) {
      list = list.filter((c) => c.status === filters.status);
    }
    return list;
  }

  getCollection(schemaNamespace: string, id: string): Collection | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    return storage.collectionsV2.find((c) => c.id === id);
  }

  async cancelCollection(
    schemaNamespace: string,
    id: string,
    reason: string,
    user?: { id: string; name?: string; email?: string }
  ): Promise<Collection> {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    const result = await engine.cancelCollection(
      storage.collectionsV2,
      storage.paymentProvidersV2,
      id,
      reason,
      {
        id: user?.id || 'usr_system',
        name: user?.name || user?.email || 'Operador',
      }
    );

    storage.auditLogs.unshift(result.audit);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.updateCollection(cleanCnpj, id, {
          status: 'CANCELED',
        });
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha no cancelamento PostgreSQL de cobrança: ${err.message}`, {
          cleanCnpj,
          collectionId: id,
        });
      }
    }
    return result.collection;
  }

  async reissueCollection(
    schemaNamespace: string,
    id: string,
    newDueDate: string,
    user?: { id: string; name?: string; email?: string }
  ): Promise<Collection> {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    const result = await engine.reissueCollection(
      storage.receivablesV2,
      storage.collectionsV2,
      storage.paymentProvidersV2,
      id,
      newDueDate,
      {
        id: user?.id || 'usr_system',
        name: user?.name || user?.email || 'Operador',
      }
    );

    storage.auditLogs.unshift(result.audit);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.createCollection(cleanCnpj, result.newCollection);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL da nova cobrança: ${err.message}`, {
          cleanCnpj,
          collectionId: result.newCollection.id,
        });
      }
    }
    return result.newCollection;
  }

  listPaymentsV2(schemaNamespace: string, filters?: { receivableId?: string }): PaymentRecord[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    let list = [...storage.paymentsV2];
    if (filters?.receivableId) {
      list = list.filter((p) => p.receivableId === filters.receivableId);
    }
    return list;
  }

  listPaymentProviders(schemaNamespace: string): PaymentProviderConfig[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    return storage.paymentProvidersV2;
  }

  getPaymentProvider(schemaNamespace: string, id: string): PaymentProviderConfig | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    return storage.paymentProvidersV2.find((p) => p.id === id);
  }

  createPaymentProvider(
    schemaNamespace: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): PaymentProviderConfig {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const id = `prov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const credentials = input.credentials || {};
    const maskedCredentials: Record<string, string> = {};

    for (const [k, v] of Object.entries(credentials)) {
      const str = String(v);
      maskedCredentials[k] = str.length > 8 ? `${str.slice(0, 4)}****${str.slice(-4)}` : '****';
    }

    const provider: PaymentProviderConfig = {
      id,
      instanceId: schemaNamespace,
      name: input.name,
      providerType: input.providerType,
      environment: input.environment || 'SANDBOX',
      isActive: input.isActive !== false,
      isDefault: input.isDefault === true,
      supportedMethods: input.supportedMethods || ['PIX', 'BOLETO'],
      credentials,
      maskedCredentials,
      accountInfo: input.accountInfo,
      methodOverrides: input.methodOverrides,
      webhookSecret: input.webhookSecret,
      webhookUrl: input.webhookUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (provider.isDefault) {
      storage.paymentProvidersV2.forEach((p) => (p.isDefault = false));
    }

    storage.paymentProvidersV2.unshift(provider);

    this.recordTenantAudit(
      schemaNamespace,
      'PAYMENT_PROVIDER_CREATED',
      'payment_provider',
      provider.id,
      { name: provider.name, type: provider.providerType },
      user?.id
    );

    return provider;
  }

  async createPaymentProviderAsync(
    schemaNamespace: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): Promise<PaymentProviderConfig> {
    const prov = this.createPaymentProvider(schemaNamespace, input, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.savePaymentProvider(cleanCnpj, prov);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na persistência PostgreSQL de provedor de pagamento: ${err.message}`, {
          cleanCnpj,
          providerId: prov.id,
        });
      }
    }
    return prov;
  }

  updatePaymentProvider(
    schemaNamespace: string,
    id: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): PaymentProviderConfig {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const prov = storage.paymentProvidersV2.find((p) => p.id === id);
    if (!prov) throw new Error(`Provedor [${id}] não encontrado.`);

    if (input.name) prov.name = input.name;
    if (input.environment) prov.environment = input.environment;
    if (input.isActive !== undefined) prov.isActive = input.isActive;
    if (input.supportedMethods) prov.supportedMethods = input.supportedMethods;
    if (input.accountInfo) prov.accountInfo = input.accountInfo;
    if (input.methodOverrides) prov.methodOverrides = input.methodOverrides;
    if (input.webhookSecret !== undefined) prov.webhookSecret = input.webhookSecret;
    if (input.webhookUrl !== undefined) prov.webhookUrl = input.webhookUrl;

    if (input.credentials) {
      prov.credentials = { ...prov.credentials, ...input.credentials };
      for (const [k, v] of Object.entries(prov.credentials)) {
        const str = String(v);
        prov.maskedCredentials[k] = str.length > 8 ? `${str.slice(0, 4)}****${str.slice(-4)}` : '****';
      }
    }

    if (input.isDefault) {
      storage.paymentProvidersV2.forEach((p) => (p.isDefault = false));
      prov.isDefault = true;
    }

    prov.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'PAYMENT_PROVIDER_UPDATED',
      'payment_provider',
      prov.id,
      { name: prov.name },
      user?.id
    );

    return prov;
  }

  async updatePaymentProviderAsync(
    schemaNamespace: string,
    id: string,
    input: any,
    user?: { id: string; name?: string; email?: string }
  ): Promise<PaymentProviderConfig> {
    const prov = this.updatePaymentProvider(schemaNamespace, id, input, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.savePaymentProvider(cleanCnpj, prov);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha na atualização PostgreSQL de provedor de pagamento: ${err.message}`, {
          cleanCnpj,
          providerId: prov.id,
        });
      }
    }
    return prov;
  }

  async testPaymentProviderConnection(
    schemaNamespace: string,
    id: string,
    user?: { id: string; name?: string; email?: string }
  ): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const prov = storage.paymentProvidersV2.find((p) => p.id === id);
    if (!prov) throw new Error(`Provedor [${id}] não encontrado.`);

    const registry = PaymentProviderRegistry.getInstance();
    const adapter = registry.getAdapter(prov.providerType);
    const result = await adapter.testConnection(prov);

    prov.lastTestedAt = new Date().toISOString();
    prov.lastTestStatus = result.success ? 'SUCCESS' : 'FAILED';
    prov.lastTestMessage = result.message;

    this.recordTenantAudit(
      schemaNamespace,
      'PAYMENT_PROVIDER_TESTED',
      'payment_provider',
      prov.id,
      { success: result.success, latencyMs: result.latencyMs },
      user?.id
    );

    return result;
  }

  setDefaultPaymentProvider(
    schemaNamespace: string,
    id: string,
    user?: { id: string; name?: string; email?: string }
  ): PaymentProviderConfig {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const prov = storage.paymentProvidersV2.find((p) => p.id === id);
    if (!prov) throw new Error(`Provedor [${id}] não encontrado.`);

    storage.paymentProvidersV2.forEach((p) => (p.isDefault = false));
    prov.isDefault = true;
    prov.updatedAt = new Date().toISOString();

    this.recordTenantAudit(
      schemaNamespace,
      'PAYMENT_PROVIDER_SET_DEFAULT',
      'payment_provider',
      prov.id,
      { name: prov.name },
      user?.id
    );

    return prov;
  }

  async setDefaultPaymentProviderAsync(
    schemaNamespace: string,
    id: string,
    user?: { id: string; name?: string; email?: string }
  ): Promise<PaymentProviderConfig> {
    const prov = this.setDefaultPaymentProvider(schemaNamespace, id, user);
    if (PostgresService.isDbConnected()) {
      const cleanCnpj = schemaNamespace.replace('tenant_', '');
      try {
        await RepositoryManager.getInstance().getRepositories().receivables.savePaymentProvider(cleanCnpj, prov);
      } catch (err: any) {
        logger.error(`[DatabaseEngine] Falha ao definir provedor padrão no PostgreSQL: ${err.message}`, {
          cleanCnpj,
          providerId: prov.id,
        });
      }
    }
    return prov;
  }

  async processWebhookPayment(
    providerName: string,
    payload: any,
    headers?: Record<string, string>
  ): Promise<{ status: string; message: string; details?: any }> {
    const engine = CollectionEngine.getInstance();
    return engine.processWebhook(this.tenantSchemas, providerName, payload, headers);
  }

  getReceivablesDashboardMetrics(schemaNamespace: string): ReceivablesDashboardMetrics {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    return engine.getDashboardMetrics(storage.receivablesV2, storage.collectionsV2);
  }

  getCustomerReceivablesSummary(
    schemaNamespace: string,
    customerId: string
  ): CustomerReceivablesSummary {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) throw new Error(`Schema [${schemaNamespace}] não encontrado.`);

    const engine = CollectionEngine.getInstance();
    return engine.getCustomerSummary(storage.receivablesV2, customerId);
  }

  /**
   * Pesquisa Unificada Spotlight nos registros do Tenant Schema ativo
   * Busca em parceiros, produtos, vendas, orçamentos, OS, contratos, financeiro, estoque, NF-e, compras e cobrança
   */
  searchTenantRecords(
    schemaNamespace: string,
    query: string,
    limit: number = 30
  ): SpotlightRecordResult[] {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return [];

    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const cleanDigits = q.replace(/\D/g, '');
    const results: SpotlightRecordResult[] = [];

    // 1. Parceiros Comerciais (Clientes, Fornecedores, etc)
    if (storage.partners) {
      for (const p of storage.partners) {
        const matches =
          p.name?.toLowerCase().includes(q) ||
          p.tradeName?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          (cleanDigits.length >= 3 && p.document?.includes(cleanDigits)) ||
          p.address?.city?.toLowerCase().includes(q) ||
          p.roles?.some((r) => r.toLowerCase().includes(q));

        if (matches) {
          results.push({
            id: p.id,
            type: 'partner',
            category: 'Parceiros Comerciais',
            title: p.tradeName || p.name,
            subtitle: `${p.name && p.tradeName && p.name !== p.tradeName ? `${p.name} • ` : ''}${formatDocument(p.document)} • ${p.email || p.address?.city || 'Cadastrado'}`,
            badge: p.roles && p.roles.length > 0 ? p.roles.join(', ') : p.status,
            badgeColor: 'indigo',
            targetTab: 'masterdata',
            meta: { document: p.document, email: p.email, status: p.status },
          });
        }
      }
    }

    // 2. Produtos & Serviços
    if (storage.products) {
      for (const prod of storage.products) {
        const matches =
          prod.name?.toLowerCase().includes(q) ||
          prod.code?.toLowerCase().includes(q) ||
          prod.description?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: prod.id,
            type: 'product',
            category: 'Produtos & Serviços',
            title: `[${prod.code}] ${prod.name}`,
            subtitle: `${prod.type === 'SERVICE' ? 'Serviço' : 'Produto'} • R$ ${Number(prod.unitPrice || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / ${prod.unit || 'UN'}`,
            badge: prod.type === 'SERVICE' ? 'SERVIÇO' : 'PRODUTO',
            badgeColor: 'emerald',
            targetTab: 'commercial',
            meta: { code: prod.code, price: prod.unitPrice, type: prod.type },
          });
        }
      }
    }

    // 3. Pedidos de Venda
    if (storage.sales) {
      for (const s of storage.sales) {
        const matches =
          s.number?.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.notes?.toLowerCase().includes(q) ||
          s.items?.some((it) => it.description?.toLowerCase().includes(q));

        if (matches) {
          results.push({
            id: s.id,
            type: 'sale',
            category: 'Vendas & Operações',
            title: `Pedido ${s.number} • ${s.customerName || 'Cliente'}`,
            subtitle: `Total: R$ ${Number(s.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Data: ${s.saleDate || (s.createdAt ? s.createdAt.split('T')[0] : '')}`,
            badge: s.status,
            badgeColor: s.status === 'COMPLETED' ? 'emerald' : s.status === 'CONFIRMED' ? 'blue' : 'amber',
            targetTab: 'commercial',
            meta: { number: s.number, total: s.total, status: s.status },
          });
        }
      }
    }

    // 4. Orçamentos Comerciais
    if (storage.quotes) {
      for (const quote of storage.quotes) {
        const matches =
          quote.number?.toLowerCase().includes(q) ||
          quote.customerName?.toLowerCase().includes(q) ||
          quote.description?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: quote.id,
            type: 'quote',
            category: 'Orçamentos Comerciais',
            title: `Orçamento ${quote.number} • ${quote.customerName || 'Cliente'}`,
            subtitle: `Total: R$ ${Number(quote.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Venc: ${quote.validUntil || '-'}`,
            badge: quote.status,
            badgeColor: quote.status === 'APPROVED' ? 'emerald' : quote.status === 'REJECTED' ? 'rose' : 'blue',
            targetTab: 'commercial',
            meta: { number: quote.number, total: quote.total, status: quote.status },
          });
        }
      }
    }

    // 5. Ordens de Serviço (OS)
    if (storage.serviceOrders) {
      for (const os of storage.serviceOrders) {
        const matches =
          os.number?.toLowerCase().includes(q) ||
          os.title?.toLowerCase().includes(q) ||
          os.customerName?.toLowerCase().includes(q) ||
          os.assignedUserName?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: os.id,
            type: 'serviceOrder',
            category: 'Ordens de Serviço',
            title: `${os.number}: ${os.title}`,
            subtitle: `Cliente: ${os.customerName || 'Cliente'} • Resp: ${os.assignedUserName || 'Equipe Técnica'}`,
            badge: os.status,
            badgeColor: os.status === 'COMPLETED' ? 'emerald' : os.priority === 'URGENT' ? 'rose' : 'purple',
            targetTab: 'commercial',
            meta: { number: os.number, status: os.status, priority: os.priority },
          });
        }
      }
    }

    // 6. Contratos de Faturamento
    if (storage.contracts) {
      for (const c of storage.contracts) {
        const matches =
          c.number?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.customerName?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: c.id,
            type: 'contract',
            category: 'Contratos & Recorrência',
            title: `Contrato ${c.number || c.id} • ${c.title}`,
            subtitle: `Cliente: ${c.customerName || 'Cliente'} • R$ ${Number(c.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / ${c.billingFrequency || 'MÊS'}`,
            badge: c.status,
            badgeColor: c.status === 'ACTIVE' ? 'emerald' : 'slate',
            targetTab: 'billing',
            meta: { number: c.number, value: c.value, status: c.status },
          });
        }
      }
    }

    // 7. Contas a Receber (Financeiro V1 & V2)
    if (storage.accountsReceivable) {
      for (const r of storage.accountsReceivable) {
        const matches =
          r.number?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.customerName?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: r.id,
            type: 'receivable',
            category: 'Contas a Receber',
            title: `A Receber: ${r.number || r.id} - ${r.description}`,
            subtitle: `Cliente: ${r.customerName} • R$ ${Number(r.originalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Venc: ${r.dueDate}`,
            badge: r.status,
            badgeColor: r.status === 'PAID' ? 'emerald' : r.status === 'OVERDUE' ? 'rose' : 'amber',
            targetTab: 'financial',
            meta: { number: r.number, amount: r.originalValue, dueDate: r.dueDate, status: r.status },
          });
        }
      }
    }

    if (storage.receivablesV2) {
      for (const r of storage.receivablesV2) {
        const matches =
          r.id?.toLowerCase().includes(q) ||
          r.customerId?.toLowerCase().includes(q) ||
          r.status?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: r.id,
            type: 'receivable',
            category: 'Contas a Receber (V2)',
            title: `Recebível ${r.id}`,
            subtitle: `Cliente: ${r.customerId} • R$ ${Number(r.originalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Venc: ${r.dueDate}`,
            badge: r.status,
            badgeColor: r.status === 'PAID' ? 'emerald' : r.status === 'OVERDUE' ? 'rose' : 'amber',
            targetTab: 'financial',
            meta: { amount: r.originalAmount, dueDate: r.dueDate, status: r.status },
          });
        }
      }
    }

    // 8. Contas a Pagar
    if (storage.accountsPayable) {
      for (const p of storage.accountsPayable) {
        const matches =
          p.number?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: p.id,
            type: 'payable',
            category: 'Contas a Pagar',
            title: `A Pagar: ${p.number || p.id} - ${p.description}`,
            subtitle: `Favorecido: ${p.supplierName || 'Fornecedor'} • R$ ${Number(p.originalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Venc: ${p.dueDate}`,
            badge: p.status,
            badgeColor: p.status === 'PAID' ? 'emerald' : 'rose',
            targetTab: 'financial',
            meta: { number: p.number, amount: p.originalValue, dueDate: p.dueDate, status: p.status },
          });
        }
      }
    }

    // 9. Depósitos e Almoxarifados (WMS)
    if (storage.warehouses) {
      for (const w of storage.warehouses) {
        const matches =
          w.code?.toLowerCase().includes(q) ||
          w.name?.toLowerCase().includes(q) ||
          w.location?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: w.id,
            type: 'warehouse',
            category: 'Estoque & Depósitos',
            title: `Depósito [${w.code}] ${w.name}`,
            subtitle: `Localização: ${w.location || 'Central'} • ${w.isDefault ? 'Depósito Principal' : 'Almoxarifado'}`,
            badge: w.isActive ? 'ATIVO' : 'INATIVO',
            badgeColor: 'amber',
            targetTab: 'inventory',
            meta: { code: w.code, location: w.location },
          });
        }
      }
    }

    // 10. Notas Fiscais (NF-e Modelo 55 / DF-e)
    if (storage.fiscalDocuments) {
      for (const inv of storage.fiscalDocuments) {
        const matches =
          inv.number?.toString().includes(q) ||
          inv.accessKey?.toLowerCase().includes(q) ||
          inv.partnerName?.toLowerCase().includes(q) ||
          (cleanDigits.length >= 4 && inv.partnerCnpjCpf?.includes(cleanDigits));

        if (matches) {
          results.push({
            id: inv.id,
            type: 'nfe',
            category: 'Notas Fiscais (DF-e / NF-e)',
            title: `NF-e nº ${inv.number} (Série ${inv.series || '1'})`,
            subtitle: `Dest: ${inv.partnerName || 'Consumidor'} • R$ ${Number(inv.netTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            badge: inv.status,
            badgeColor: inv.status === 'AUTHORIZED' ? 'emerald' : inv.status === 'CANCELED' ? 'rose' : 'purple',
            targetTab: 'fiscal',
            meta: { number: inv.number, accessKey: inv.accessKey, total: inv.netTotal },
          });
        }
      }
    }

    // 11. Compras & Pedidos de Suprimentos
    if (storage.purchaseOrders) {
      for (const po of storage.purchaseOrders) {
        const matches =
          po.number?.toLowerCase().includes(q) ||
          po.supplierName?.toLowerCase().includes(q) ||
          po.notes?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: po.id,
            type: 'purchase',
            category: 'Compras & Suprimentos',
            title: `Pedido de Compra ${po.number} • ${po.supplierName || 'Fornecedor'}`,
            subtitle: `Total: R$ ${Number(po.grandTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Previsão: ${po.expectedDeliveryDate || '-'}`,
            badge: po.status,
            badgeColor: po.status === 'APROVADO' ? 'emerald' : 'cyan',
            targetTab: 'procurement',
            meta: { number: po.number, total: po.grandTotal, status: po.status },
          });
        }
      }
    }

    // 12. Cobrança Bancária (Boletos & Pix)
    if (storage.bankSlips) {
      for (const b of storage.bankSlips) {
        const matches =
          b.ourNumber?.toLowerCase().includes(q) ||
          b.payerName?.toLowerCase().includes(q) ||
          b.documentNumber?.toLowerCase().includes(q) ||
          b.digitableLine?.includes(q);

        if (matches) {
          results.push({
            id: b.id,
            type: 'boleto',
            category: 'Cobrança Bancária & Boletos',
            title: `Boleto #${b.ourNumber} • ${b.payerName || 'Sacado'}`,
            subtitle: `R$ ${Number(b.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Venc: ${b.dueDate}`,
            badge: b.status,
            badgeColor: b.status === 'PAID' ? 'emerald' : b.status === 'CANCELED' ? 'rose' : 'blue',
            targetTab: 'banking',
            meta: { ourNumber: b.ourNumber, amount: b.amount, status: b.status },
          });
        }
      }
    }

    if (storage.pixCharges) {
      for (const pix of storage.pixCharges) {
        const matches =
          pix.txid?.toLowerCase().includes(q) ||
          pix.customerName?.toLowerCase().includes(q);

        if (matches) {
          results.push({
            id: pix.id,
            type: 'pix',
            category: 'Cobrança Pix Dinâmico',
            title: `Pix #${pix.txid?.substring(0, 14)}... • ${pix.customerName || 'Pagador'}`,
            subtitle: `R$ ${Number(pix.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Status: ${pix.status}`,
            badge: pix.status,
            badgeColor: pix.status === 'CONCLUDED' ? 'emerald' : 'purple',
            targetTab: 'banking',
            meta: { txid: pix.txid, amount: pix.amount, status: pix.status },
          });
        }
      }
    }

    return results.slice(0, limit);
  }
}

export const dbEngine = new DatabaseEngine();
