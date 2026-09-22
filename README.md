# Enlace ERP — Plataforma ERP SaaS Multi-Tenant com Isolamento por CNPJ

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45+-C5F74F.svg)](https://orm.drizzle.team/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Testes](https://img.shields.io/badge/Testes-66%2F66%20Aprovados-emerald.svg)](./tests/isolation.test.ts)
[![Segurança](https://img.shields.io/badge/Isolamento-Schema%20por%20CNPJ-success.svg)](./docs/ARCHITECTURE.md)

O **Enlace ERP** é uma plataforma horizontal de gestão empresarial (Enterprise Resource Planning) desenvolvida para o mercado brasileiro, combinando alta segurança, conformidade fiscal estrita, persistência real em PostgreSQL com Drizzle ORM e isolamento físico/lógico de dados corporativos entre múltiplos CNPJs contratantes.

---

## 🚀 Módulos Implementados e Homologados (PRD 01 a 09 & PRD PARTE 06)

| PRD | Módulo / Domínio | Principais Recursos Implementados |
|---|---|---|
| **PRD 01** | **Fundação & Multi-Tenant** | Isolamento estrito por schemas físicos PostgreSQL (`tenant_<CNPJ>`), sem tabelas compartilhadas, alternância dinâmica de contexto de empresa, proteção anti-IDOR. |
| **PRD 02** | **Identidade, RBAC & Cofre** | Matriz de 5 papéis (Owner, Admin, Manager, Operator, Viewer), imunidade do Owner (Seção 21), MFA TOTP RFC 6238, rotação de Refresh Token anti-theft, cofre AES-256-GCM. |
| **PRD 03** | **Cadastros Gerais & Contábil** | Parceiros de negócios com validação de CPF/CNPJ via algoritmo Módulo 11 da Receita Federal, catálogo de produtos e Plano de Contas contábil hierárquico em 4 níveis. |
| **PRD 04** | **Comercial & Ordens de Serviço** | Orçamentos comerciais, alçadas de aprovação de desconto, conversão idempotente para Pedido de Venda, Ordens de Serviço (OS) com ciclo de vida e materiais. |
| **PRD 05** | **Financeiro, Faturamento & Recorrência** | Contas a Receber e Pagar, encargos moratórios pró-rata die, faturamento de vendas/OS com MM/AAAA, contratos de recorrência com processamento em lote idempotente e DRE gerencial. |
| **PRD 06** | **Estoque & Almoxarifados (WMS)** | Multi-depósitos isolados por schema, movimentações físicas com trilha Kardex, recálculo contínuo do Custo Médio Ponderado (CMP), trava estrita contra saldo negativo e transferências. |
| **PRD 07** | **Fiscal, NF-e & SEFAZ** | Emissor de NF-e (Modelo 55) v4.00, motor tributário (ICMS, IPI, PIS, COFINS), assinatura digital padrão XMLDSig, desacoplamento formal de provedores (Focus NFe API v2 para Produção e SEFAZ Sandbox para homologação). |
| **PRD 08** | **Compras & Suprimentos** | Requisições de compra com alçadas de aprovação e centro de custos, cotações com mapa comparativo de fornecedores e cálculo de saving, e conferência 3-Way Matching com importação de XML. |
| **PRD 09** | **Cobrança Bancária, CNAB & Pix** | Emissão de boletos FEBRABAN com código de barras de 44 dígitos e linha digitável, remessa e retorno CNAB 400 com baixa automática de títulos, Pix dinâmico com payload EMV e QR Code vetorial, simulador Bacen SPI e régua de cobrança (*dunning*). |
| **PRD P06** | **Cobrança & Contas a Receber** | Desacoplamento fisiológico (Receivables x Collections), motor de cálculo de juros diários/multa/desconto, gateways plugáveis (Asaas, C6, Cora, Enlace Sandbox), webhooks idempotentes com conciliação e baixa em tempo real. |
| **UX & Produtividade** | **Busca Spotlight & Paleta (`Cmd+K`)** | Paleta de comandos global via teclado (`⌘K`/`Ctrl+K`), busca em tempo real com isolamento estrito de schema e navegação instantânea. |
| **IA & Governança** | **MaIA & Guardrails de Segurança** | AI Principal delegada com verificação prévia de RBAC, bloqueio de prompt injection/jailbreak e isolamento estrito de contexto para o schema do tenant ativo. |

---

## 🛠️ Arquitetura do Sistema e Persistência Real

O Enlace ERP é estruturado segundo uma rigorosa separação de planos com suporte nativo ao PostgreSQL:

```
                  ┌─────────────────────────────────────────┐
                  │          ENLACE WEB INTERFACE           │
                  │        (React 19 + Tailwind CSS)        │
                  └────────────────────┬────────────────────┘
                                       │ HTTP / Bearer JWT + X-Tenant-Id
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │           NODE.JS EXPRESS API           │
                  │             (Porta 3000)                │
                  └────────────────────┬────────────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
┌───────────────────────────────┐             ┌───────────────────────────────┐
│     CONTROL PLANE (Global)    │             │      DATA PLANE (Por CNPJ)    │
│     (Schema PostgreSQL: public)│             │ (Schemas: tenant_<CNPJ_X>)    │
├───────────────────────────────┤             ├───────────────────────────────┤
│ • cp_users & Hashes de Senha  │             │ • company_settings, audit_logs│
│ • cp_companies Cadastradas    │             │ • partners, products, cmp     │
│ • cp_memberships & RBAC Roles │             │ • sales, quotes, service_orders│
│ • cp_sessions Ativas & Devices│             │ • receivables_v2, collections │
│ • cp_refresh_tokens Anti-Theft│             │ • payments_v2, payment_provs  │
│ • cp_security_events          │             │ • webhook_events_v2, accounts │
└───────────────────────────────┘             └───────────────────────────────┘
```

- **Drizzle ORM & PostgreSQL Pooling**: Pool de conexões robusto gerenciado por `PostgresService` (`src/core/database/postgres.ts`), executando DDL de schemas físicos (`CREATE SCHEMA IF NOT EXISTS "tenant_<CNPJ>"`).
- **Fallback Gracioso para Testes**: Na ausência de `DATABASE_URL` em testes automatizados, o motor chaveia automaticamente para repositórios em memória com a mesma semântica de isolamento por schema.

---

## 💻 Começando Rápido (Desenvolvimento Local)

### Pré-requisitos:
- Node.js 20+ ou 22+
- npm 10+ ou bun
- PostgreSQL 16+ (opcional para persistência real durável em disco)

### Instalação e Execução:
```bash
# 1. Clonar o repositório
git clone https://github.com/octosaas/Enlace-ERP.git
cd Enlace-ERP

# 2. Instalar as dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env

# 4. Iniciar o ambiente de desenvolvimento na porta 3000
npm run dev
```

Acesse a aplicação no navegador em: `http://localhost:3000`.

---

## 🧪 Bateria de Testes Automatizados (66/66 Aprovados)

O Enlace ERP conta com **66 testes automatizados de ponta a ponta** que garantem conformidade com todas as regras de negócio dos PRDs 01 a 09, persistência real, segurança de segredos e guardrails de IA:

```bash
# Executar a bateria de testes de isolamento e regras de negócio
npm test
# ou: npx tsx tests/isolation.test.ts

# Executar o linter estático TypeScript
npm run lint

# Compilar para produção (Vite + esbuild CJS server)
npm run build
```

---

## 🔒 Segurança e Credenciais de Produção

1. **Cofre Criptográfico (`CredentialVault`)**: Criptografia autenticada AES-256-GCM. Em `NODE_ENV=production`, rejeita chaves default ou fracas com menos de 32 caracteres.
2. **Autenticação & JWT (`AuthService`)**: Rotação contínua de refresh tokens, detecção anti-reúso que invalida imediatamente todas as sessões em caso de replay, e tokens temporários de recuperação de senha de uso único.
3. **Guardrails da MaIA (`AIPrincipalManager`)**: Bloqueio de injeção de prompt, jailbreaks, comandos destrutivos e sanitização de contexto para impedir exfiltração cross-tenant.
4. **Deploy Parametrizado**: `docker-compose.yml` e scripts de deploy utilizam variáveis interpoladas seguras (`${JWT_SECRET}`, `${ENLACE_VAULT_KEY}`).
