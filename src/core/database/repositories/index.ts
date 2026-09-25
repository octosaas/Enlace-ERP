/**
 * Enlace ERP - Repositories Index & Manager
 * PRD 01 & PRD 02: Desacoplamento da Camada de Domínio e Persistência Real
 */

export * from './userRepository.js';
export * from './companyRepository.js';
export * from './membershipRepository.js';
export * from './sessionRepository.js';
export * from './partnerRepository.js';
export * from './productRepository.js';
export * from './salesRepository.js';
export * from './billingRepository.js';
export * from './receivableRepository.js';
export * from './auditRepository.js';
export * from './inventoryRepository.js';
export * from './fiscalRepository.js';
export * from './procurementRepository.js';
export * from './financialRepository.js';

import { IUserRepository, PostgresUserRepository, InMemoryUserRepository } from './userRepository.js';
import { ICompanyRepository, PostgresCompanyRepository, InMemoryCompanyRepository } from './companyRepository.js';
import { IMembershipRepository, PostgresMembershipRepository, InMemoryMembershipRepository } from './membershipRepository.js';
import { ISessionRepository, PostgresSessionRepository, InMemorySessionRepository } from './sessionRepository.js';
import { IPartnerRepository, PostgresPartnerRepository, InMemoryPartnerRepository } from './partnerRepository.js';
import { IProductRepository, PostgresProductRepository, InMemoryProductRepository } from './productRepository.js';
import { ISalesRepository, PostgresSalesRepository, InMemorySalesRepository } from './salesRepository.js';
import { IBillingRepository, PostgresBillingRepository, InMemoryBillingRepository } from './billingRepository.js';
import { IReceivableRepository, PostgresReceivableRepository, InMemoryReceivableRepository } from './receivableRepository.js';
import { IAuditRepository, PostgresAuditRepository, InMemoryAuditRepository } from './auditRepository.js';
import { IInventoryRepository, PostgresInventoryRepository, InMemoryInventoryRepository } from './inventoryRepository.js';
import { IFiscalRepository, PostgresFiscalRepository, InMemoryFiscalRepository } from './fiscalRepository.js';
import { IProcurementRepository, PostgresProcurementRepository, InMemoryProcurementRepository } from './procurementRepository.js';
import { IFinancialRepository, PostgresFinancialRepository, InMemoryFinancialRepository } from './financialRepository.js';
import { PostgresService } from '../postgres.js';
import { logger } from '../../logger/index.js';

export interface AppRepositories {
  users: IUserRepository;
  companies: ICompanyRepository;
  memberships: IMembershipRepository;
  sessions: ISessionRepository;
  partners: IPartnerRepository;
  products: IProductRepository;
  sales: ISalesRepository;
  billing: IBillingRepository;
  receivables: IReceivableRepository;
  audit: IAuditRepository;
  inventory: IInventoryRepository;
  fiscal: IFiscalRepository;
  procurement: IProcurementRepository;
  financial: IFinancialRepository;
}

export class RepositoryManager {
  private static instance: RepositoryManager | null = null;
  private repos: AppRepositories | null = null;

  private constructor() {}

  static getInstance(): RepositoryManager {
    if (!this.instance) {
      this.instance = new RepositoryManager();
    }
    return this.instance;
  }

  /**
   * Inicializa ou reconfigura os repositórios baseando-se no estado da conexão PostgreSQL
   * REGRA CRÍTICA: Em NODE_ENV=production, fallback para memória é TERMINANTEMENTE PROIBIDO (Fail-Closed).
   */
  initialize(inMemoryFallbackMaps?: {
    users: Map<string, any>;
    companies: Map<string, any>;
    memberships: Map<string, any>;
    sessions: Map<string, any>;
    refreshTokens: Map<string, any>;
    securityEvents: any[];
    getTenantStorage: (cleanCnpj: string) => any;
  }): AppRepositories {
    const isAiStudioSandbox = !!(process.env.APPLET_ID || process.env.K_SERVICE?.startsWith('ais-'));
    const isProduction = process.env.NODE_ENV === 'production' && !isAiStudioSandbox;
    const isPgActive = PostgresService.isDbConnected();

    if (isPgActive) {
      logger.info('[RepositoryManager] Inicializando repositórios oficiais com PostgreSQL real e Drizzle ORM.');
      this.repos = {
        users: new PostgresUserRepository(),
        companies: new PostgresCompanyRepository(),
        memberships: new PostgresMembershipRepository(),
        sessions: new PostgresSessionRepository(),
        partners: new PostgresPartnerRepository(),
        products: new PostgresProductRepository(),
        sales: new PostgresSalesRepository(),
        billing: new PostgresBillingRepository(),
        receivables: new PostgresReceivableRepository(),
        audit: new PostgresAuditRepository(),
        inventory: new PostgresInventoryRepository(),
        fiscal: new PostgresFiscalRepository(),
        procurement: new PostgresProcurementRepository(),
        financial: new PostgresFinancialRepository(),
      };
      return this.repos;
    }

    if (isProduction) {
      const errorMsg =
        '[FATAL] Tentativa de inicializar repositórios em memória em ambiente de produção (NODE_ENV=production). Persistência PostgreSQL é obrigatória e inegociável. Fail-closed acionado.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    if (!inMemoryFallbackMaps) {
      throw new Error('[RepositoryManager] Mapas em memória não fornecidos para modo de operação.');
    }

    logger.info('[RepositoryManager] Inicializando repositórios de alta fidelidade em memória com isolamento estrito por schema.');
    const maps = inMemoryFallbackMaps;
    this.repos = {
      users: new InMemoryUserRepository(maps.users),
      companies: new InMemoryCompanyRepository(maps.companies),
      memberships: new InMemoryMembershipRepository(maps.memberships),
      sessions: new InMemorySessionRepository(maps.sessions, maps.refreshTokens),
      partners: new InMemoryPartnerRepository((cnpj) => maps.getTenantStorage(cnpj).partners),
      products: new InMemoryProductRepository((cnpj) => maps.getTenantStorage(cnpj).products),
      sales: new InMemorySalesRepository(
        (cnpj) => maps.getTenantStorage(cnpj).quotes,
        (cnpj) => maps.getTenantStorage(cnpj).sales,
        (cnpj) => maps.getTenantStorage(cnpj).serviceOrders || [],
        (cnpj) => maps.getTenantStorage(cnpj).contracts || []
      ),
      billing: new InMemoryBillingRepository(
        (cnpj) => maps.getTenantStorage(cnpj).billingDocuments,
        (cnpj) => maps.getTenantStorage(cnpj).recurringBillings,
        (cnpj) => maps.getTenantStorage(cnpj).billingGenerationLogs
      ),
      receivables: new InMemoryReceivableRepository(
        (cnpj) => maps.getTenantStorage(cnpj).receivablesV2,
        (cnpj) => maps.getTenantStorage(cnpj).collectionsV2,
        (cnpj) => maps.getTenantStorage(cnpj).paymentsV2,
        (cnpj) => maps.getTenantStorage(cnpj).paymentProvidersV2,
        (cnpj) => maps.getTenantStorage(cnpj).webhookEventsV2
      ),
      audit: new InMemoryAuditRepository(
        (cnpj) => maps.getTenantStorage(cnpj).auditLogs,
        maps.securityEvents
      ),
      inventory: new InMemoryInventoryRepository(
        (cnpj) => maps.getTenantStorage(cnpj).warehouses || [],
        (cnpj) => maps.getTenantStorage(cnpj).stockItems || [],
        (cnpj) => maps.getTenantStorage(cnpj).stockMovements || []
      ),
      fiscal: new InMemoryFiscalRepository(
        (cnpj) => maps.getTenantStorage(cnpj).fiscalDocuments || [],
        (cnpj) => maps.getTenantStorage(cnpj).fiscalInutilizations || []
      ),
      procurement: new InMemoryProcurementRepository(
        (cnpj) => maps.getTenantStorage(cnpj).purchaseRequisitions || [],
        (cnpj) => maps.getTenantStorage(cnpj).purchaseOrders || []
      ),
      financial: new InMemoryFinancialRepository(
        (cnpj) => maps.getTenantStorage(cnpj).accountsPayable || [],
        (cnpj) => maps.getTenantStorage(cnpj).bankAccounts || [],
        (cnpj) => maps.getTenantStorage(cnpj).bankSlips || [],
        (cnpj) => maps.getTenantStorage(cnpj).pixCharges || []
      ),
    };

    return this.repos!;
  }

  getRepositories(): AppRepositories {
    if (!this.repos) {
      throw new Error('[RepositoryManager] Repositórios não foram inicializados.');
    }
    return this.repos;
  }
}
