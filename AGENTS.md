# AGENTS.md — Diretrizes e Convenções para Agentes Autônomos de IA e Engenheiros

> **Enlace ERP** • Plataforma ERP SaaS Multi-Tenant com Isolamento Estrito por CNPJ  
> Versão Atual: **0.1.3 (Auditoria Profunda: Persistência PostgreSQL Real com Drizzle ORM, Hardening de Segredos, Adapters Fiscais/Bancários e Guardrails da MaIA)**  
> Última Atualização: **Setembro de 2026**

---

## 1. Missão do Projeto & Princípios Inegociáveis

O **Enlace ERP** é uma plataforma horizontal de gestão empresarial (ERP) projetada para alta segurança, confiabilidade fiscal brasileira e isolamento absoluto de dados entre múltiplos clientes corporativos (tenants).

### Princípio Absoluto: Isolamento de Dados por Schema Físico (`tenant_<CNPJ>`)
1. **Separação Fisiológica de Dados**: Cada empresa contratante cadastrada opera em seu próprio Schema no banco de dados PostgreSQL (ex: `tenant_12345678000195`, `tenant_98765432000110`).
2. **Proibição de Coluna `tenant_id` no Data Plane**: É **estritamente proibido** consolidar dados transacionais de múltiplos CNPJs em tabelas compartilhadas usando filtros WHERE `tenant_id = ?`. Cada schema contém suas próprias tabelas físicas independentes.
3. **Prevenção Anti-IDOR e Anti-Vazamento**: Nenhuma rota ou método do Data Plane pode permitir acesso a dados de outro schema. A validação de pertinência do usuário ao CNPJ (`activeMembership`) deve ocorrer antes de qualquer operação no banco.

---

## 2. Arquitetura em Dois Planos e Persistência Real (PostgreSQL + Drizzle ORM)

```
                          ┌────────────────────────┐
                          │     ENLACE CLIENT      │
                          │   (React 19 + Vite)    │
                          └───────────┬────────────┘
                                      │ HTTP / Bearer JWT + X-Tenant-Id
                                      ▼
                          ┌────────────────────────┐
                          │   EXPRESS API GATEWAY  │
                          │      (Porta 3000)      │
                          └───────────┬────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│     CONTROL PLANE (Global)    │               │      DATA PLANE (Por CNPJ)    │
│       (Schema: public)        │               │  (Schemas: tenant_<CNPJ_X>)   │
├───────────────────────────────┤               ├───────────────────────────────┤
│ • cp_users (Identidades)      │               │ • company_settings, audit_logs│
│ • cp_companies (CNPJs)        │               │ • partners, products, cmp     │
│ • cp_memberships & RBAC Roles │               │ • sales, quotes, service_orders│
│ • cp_sessions (Ativas)        │               │ • receivables_v2, collections │
│ • cp_refresh_tokens Anti-Theft│               │ • payments_v2, payment_provs  │
│ • cp_security_events          │               │ • webhook_events_v2, accounts │
└───────────────────────────────┘               └───────────────────────────────┘
```

### Arquitetura de Persistência Real:
- **Drizzle ORM & Driver Node-Postgres**: O arquivo `src/core/database/schema.ts` define rigorosamente as entidades do Control Plane e do Data Plane multi-tenant com tipagem estrita e integridade referencial.
- **PostgresService (`src/core/database/postgres.ts`)**: Gerencia o pool de conexões PostgreSQL (`pg.Pool`), provê verificação contínua de status via `getStatus()` e executa o provisionamento dinâmico de schemas de CNPJ com DDL automatizado (`CREATE SCHEMA IF NOT EXISTS "tenant_<CNPJ>"`).
- **Fallback Gracioso para Homologação/Testes**: Quando a variável `DATABASE_URL` não está configurada no ambiente de CI/CD ou testes isolados, o motor opera com repositórios em memória de alta fidelidade espelhando exatamente os mesmos contratos e isolamento de schemas, emitindo alerta estruturado via logger.

---

## 3. Gestão Segura de Segredos e Hardening de Produção

### Diretrizes de Segurança Invioláveis:
1. **Zero Hardcoded Secrets**: Nenhum segredo ou chave criptográfica real reside no código-fonte.
2. **Cofre de Credenciais (`CredentialVault`)**: Criptografia autenticada AES-256-GCM. Em ambiente `NODE_ENV=production`, o cofre rejeita obrigatoriamente a inicialização caso `ENLACE_VAULT_KEY` seja omitida, vazia ou utilize chaves de desenvolvimento. A chave DEVE possuir no mínimo 32 caracteres criptograficamente fortes.
3. **Serviço de Autenticação (`AuthService`)**: Assinatura e verificação de tokens JWT. Em ambiente `NODE_ENV=production`, o serviço bloqueia imediatamente caso `JWT_SECRET` utilize o padrão de teste ou possua menos de 32 caracteres.
4. **Artefatos de Deploy Parametrizados**: O arquivo `docker-compose.yml` e o módulo de deploy na interface utilizam interpolação segura `${JWT_SECRET:-...}` e `${ENLACE_VAULT_KEY:-...}`, sem expor senhas fixas de produção.

---

## 4. Matriz de Governança RBAC e Regras da IA MaIA (PRD 02)

O sistema implementa 5 papéis corporativos padronizados:

| Papel | Descrição | Regras e Limitações Críticas |
|---|---|---|
| `owner` | Proprietário Titular | **Imunidade Institucional (Seção 21)**: Nenhum outro papel (inclusive `admin`) pode rebaixar, suspender ou excluir o Owner. |
| `admin` | Administrador Operacional | Gestão de equipe, convites, instâncias e módulos. Não pode alterar o Owner. |
| `manager` | Gestor de Departamento | Gestão de vendas, compras, faturamento e relatórios gerenciais. |
| `operator` | Operador do Dia a Dia | Lançamentos de estoque, pedidos, ordens de serviço e emissões diárias. |
| `viewer` | Auditor / Somente Leitura | Consulta irrestrita a relatórios e trilha de auditoria; sem privilégios de escrita. |

### Regras e Guardrails do Agente de IA (MaIA):
1. **AI Principal Delegada**: A MaIA atua exclusivamente sob delegação do usuário logado e herda seu `activeMembership`.
2. **Impossibilidade de Bypass**: É **estritamente proibido** qualquer bypass de autorização. O método `AIPrincipalManager.assertPermission` é invocado antes de qualquer tool call.
3. **Guardrails contra Prompt Injection**: O método `validatePromptSafety` analisa comandos em busca de jailbreaks, tentativas de revelação de system prompt, comandos destrutivos (`drop table`) ou injeção de schemas de terceiros, gerando alertas com severidade `HIGH` no `AuditService`.
4. **Isolamento de Contexto**: O método `filterContextForActiveTenant` garante que a MaIA receba unicamente informações pertencentes ao schema do CNPJ ativo.

---

## 5. Regras Matemáticas e de Negócio por Módulo

### A. Comercial & Faturamento (PRD 04 & 05)
- Todos os cálculos monetários devem utilizar `BoletoMath.roundBRL` com arredondamento padrão `Math.round((val + Number.EPSILON) * 100) / 100`.
- Conversão de Orçamento para Venda requer **chave de idempotência** para impedir duplicidade de faturamento.

### B. Estoque & Almoxarifados WMS (PRD 06)
- **Recálculo Contínuo de CMP**:
  $$\text{Novo CMP} = \frac{(\text{Saldo Anterior} \times \text{CMP Anterior}) + (\text{Qtd Entrada} \times \text{Custo Unitário Entrada})}{\text{Saldo Anterior} + \text{Qtd Entrada}}$$
- **Trava de Saldo Negativo**: Saídas de mercadorias que resultem em saldo negativo são bloqueadas.

### C. Fiscal & NF-e (PRD 07 - Adapters Desacoplados)
- **Contrato Formal `FiscalProvider` (`src/core/fiscal/fiscalProvider.interface.ts`)**:
  - `SefazSandboxAdapter`: Simulador homologado para ambiente de testes e contingência local sem dependência de indisponibilidade da SEFAZ.
  - `FocusNFeAdapter`: Integração de nuvem para produção e homologação via Focus NFe API v2, com autenticação segura via CredentialVault e fallback auditado.
  - `FiscalProviderRegistry`: Fábrica desacoplada que resolve o adapter correto por configuração de tenant.

### D. Cobrança Bancária, Pix & Gateways (PRD 09 & PARTE 06)
- **Desacoplamento Fisiológico**: O Título a Receber (`Receivable`) representa o direito creditório contratual. A Cobrança (`Collection`) representa o meio efêmero de liquidação.
- **Multi-Gateway Plugável**: Padrão Adapter com suporte a múltiplos provedores (`AsaasAdapter`, `C6BankAdapter`, `CoraAdapter`, `EnlaceSandboxAdapter`).
- **Webhook Idempotente**: Deduplicação estrita via assinatura/hash de evento (`webhook_events_v2`), conciliando pagamentos e efetuando baixa automática em tempo real.

---

## 6. Protocolo de Verificação e Testes Obrigatório

O repositório possui uma suíte completa de **66 testes automatizados de ponta a ponta** localizada em `tests/isolation.test.ts`.

### Comandos de Validação:
```bash
# Executar a bateria de testes completa (66/66 testes devem passar)
npm test
# ou: npx tsx tests/isolation.test.ts

# Validador estático de tipagem TypeScript (zero erros aceitos)
npm run lint

# Compilação e build de produção (Vite + esbuild CJS server)
npm run build
```

> ⚠️ **REGRA DE OURO**: Qualquer modificação no código-fonte DEVE manter todos os 66 testes verdes. Não altere os testes para mascarar quebras de contrato de negócio.

---

## 7. Instruções para Implantação e Contêineres

- A aplicação DEVE rodar obrigatoriamente na porta **3000** vinculada a `0.0.0.0`.
- O servidor Express orquestra tanto os endpoints de API `/api/*` quanto o serving dos assets estáticos via Vite middleware em desenvolvimento e `dist/index.html` em produção.
- **Ingestão de Webhooks de Pagamento**: Endpoint centralizado `/api/webhooks/collections/:provider` recebendo notificações assíncronas dos gateways com verificação de assinatura e idempotência nativa por tenant.
- Artefatos de deploy disponíveis: `Dockerfile` (multi-stage) e `docker-compose.yml`.

---

## 8. Busca Rápida Spotlight & Paleta de Comandos (`Cmd+K` / `Ctrl+K`)

- **Acessibilidade Universal**: Acionável via atalho global de teclado (`⌘K` no macOS e `Ctrl+K` no Windows/Linux) ou por botões dedicados na barra de navegação superior (`Navbar`) e rodapé.
- **Isolamento Estrito na Busca**:
  - Endpoint: `GET /api/v1/search?q=<termo>&limit=30` protegido por `authMiddleware` e `tenantMiddleware`.
  - A varredura consulta **exclusivamente o schema da empresa ativa** (`tenant_<CNPJ>`).
  - Cobertura de entidades: Parceiros, Estoque, Vendas, Orçamentos, Ordens de Serviço, Contratos, Títulos, NF-e, Compras, Boletos e Cobranças Pix.

---

## 9. Checklist de Homologação e Critérios de Aceite

Para submissão a ambientes de Staging ou Produção:
1. `npm test` aprovando **66/66 testes** sem exceções.
2. `npm run lint` retornando **0 erros de tipagem estrita**.
3. `npm run build` gerando bundle `dist/` e `dist/server.cjs` com sourcemaps.
4. Isolamento comprovado por teste IDOR: nenhuma rota responde a dados de schema divergente do `activeMembership`.
5. Imunidade institucional do Owner incondicionalmente preservada.
6. Credenciais de produção protegidas com rejeição imediata de chaves inseguras.
