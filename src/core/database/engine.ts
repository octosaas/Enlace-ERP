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
} from '../../shared/types.js';
import { ROLE_DEFAULT_PERMISSIONS } from '../../shared/permissions.js';
import { cleanDocument, formatDocument } from '../../shared/validators.js';
import { logger } from '../logger/index.js';
import { CommercialMath } from '../commercial/commercialEngine.js';
import { FinancialMath, CashFlowEngine, IncomeStatementEngine } from '../financial/financialEngine.js';

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
  };

  // PRD 05 - Financeiro e Tesouraria
  accountsReceivable: AccountReceivable[];
  accountsPayable: AccountPayable[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
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
        inventory: false,
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

  listSessionsForUser(userId: string, currentSessionId?: string): UserSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.userId === userId && !s.isRevoked)
      .map((s) => ({
        ...s,
        isCurrent: s.id === currentSessionId,
      }))
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }

  revokeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.isRevoked = true;
    this.sessions.set(sessionId, session);

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

  provisionTenantSchema(schemaNamespace: string, initialData?: TenantStorage) {
    if (!this.tenantSchemas.has(schemaNamespace)) {
      const storage: TenantStorage = initialData || {
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
        },
        accountsReceivable: [],
        accountsPayable: [],
        bankAccounts: [],
        bankTransactions: [],
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
      if (!storage.sequentialCounters) {
        storage.sequentialCounters = { quote: 0, sale: 0, contract: 0, serviceOrder: 0, receivable: 0, payable: 0 };
      }

      this.tenantSchemas.set(schemaNamespace, storage);
      logger.info(`[DatabaseEngine] Schema [${schemaNamespace}] provisionado com sucesso.`);
    }
  }

  getTenantStorage(schemaNamespace: string): TenantStorage | undefined {
    const storage = this.tenantSchemas.get(schemaNamespace);
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
      if (!storage.sequentialCounters) {
        storage.sequentialCounters = { quote: 0, sale: 0, contract: 0, serviceOrder: 0, receivable: 0, payable: 0 };
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
    return newPartner;
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
    return updated;
  }

  deletePartner(schemaNamespace: string, partnerId: string): boolean {
    const tenant = this.tenantSchemas.get(schemaNamespace);
    if (!tenant) return false;

    const index = tenant.partners.findIndex((p) => p.id === partnerId);
    if (index === -1) return false;

    tenant.partners.splice(index, 1);
    return true;
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

    return { sale, alreadyConverted: false };
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

  cancelAccountReceivable(schemaNamespace: string, id: string): AccountReceivable | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const title = storage.accountsReceivable.find((r) => r.id === id);
    if (!title || title.status === 'PAID') return undefined;

    title.status = 'CANCELED';
    title.updatedAt = new Date().toISOString();
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

  cancelAccountPayable(schemaNamespace: string, id: string): AccountPayable | undefined {
    const storage = this.getTenantStorage(schemaNamespace);
    if (!storage) return undefined;

    const title = storage.accountsPayable.find((p) => p.id === id);
    if (!title || title.status === 'PAID') return undefined;

    title.status = 'CANCELED';
    title.updatedAt = new Date().toISOString();
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
}

export const dbEngine = new DatabaseEngine();
