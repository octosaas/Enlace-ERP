# Enlace ERP — Plataforma ERP SaaS Multi-Tenant com Isolamento por CNPJ

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-v4-38bdf8.svg)](https://tailwindcss.com/)
[![Testes](https://img.shields.io/badge/Testes-55%2F55%20Aprovados-emerald.svg)](./tests/isolation.test.ts)
[![Segurança](https://img.shields.io/badge/Isolamento-Schema%20por%20CNPJ-success.svg)](./docs/ARCHITECTURE.md)

O **Enlace ERP** é uma plataforma horizontal de gestão empresarial (Enterprise Resource Planning) desenvolvida para o mercado brasileiro, combinando alta segurança, conformidade fiscal estrita e isolamento físico/lógico de dados corporativos entre múltiplos CNPJs contratantes.

---

## 🚀 Módulos Implementados e Homologados (PRD 01 a 09)

| PRD | Módulo / Domínio | Principais Recursos Implementados |
|---|---|---|
| **PRD 01** | **Fundação & Multi-Tenant** | Isolamento estrito por schemas (`tenant_<CNPJ>`), sem tabelas compartilhadas, alternância dinâmica de contexto de empresa, proteção anti-IDOR. |
| **PRD 02** | **Identidade, RBAC & Cofre** | Matriz de 5 papéis (Owner, Admin, Manager, Operator, Viewer), imunidade do Owner (Seção 21), MFA TOTP RFC 6238, rotação de Refresh Token anti-theft, cofre AES-256-GCM. |
| **PRD 03** | **Cadastros Gerais & Contábil** | Parceiros de negócios com validação de CPF/CNPJ via algoritmo Módulo 11 da Receita Federal, catálogo de produtos e Plano de Contas contábil hierárquico em 4 níveis. |
| **PRD 04** | **Comercial & Ordens de Serviço** | Orçamentos comerciais, alçadas de aprovação de desconto, conversão idempotente para Pedido de Venda, Ordens de Serviço (OS) com ciclo de vida e materiais. |
| **PRD 05** | **Financeiro, Faturamento & Recorrência** | Contas a Receber e Pagar, encargos moratórios pró-rata die, faturamento de vendas/OS com MM/AAAA, contratos de recorrência com processamento em lote idempotente e DRE gerencial. |
| **PRD 06** | **Estoque & Almoxarifados (WMS)** | Multi-depósitos isolados por schema, movimentações físicas com trilha Kardex, recálculo contínuo do Custo Médio Ponderado (CMP), trava estrita contra saldo negativo e transferências. |
| **PRD 07** | **Fiscal, NF-e & SEFAZ** | Emissor de NF-e (Modelo 55) v4.00, motor tributário (ICMS, IPI, PIS, COFINS), assinatura digital padrão XMLDSig, transmissão e protocolo SEFAZ imutável e inutilização de faixas. |
| **PRD 08** | **Compras & Suprimentos** | Requisições de compra com alçadas de aprovação e centro de custos, cotações com mapa comparativo de fornecedores e cálculo de saving, e conferência 3-Way Matching com importação de XML. |
| **PRD 09** | **Cobrança Bancária, CNAB & Pix** | Emissão de boletos FEBRABAN com código de barras de 44 dígitos e linha digitável, remessa e retorno CNAB 400 com baixa automática de títulos, Pix dinâmico com payload EMV e QR Code vetorial, simulador Bacen SPI e régua de cobrança (*dunning*). |

---

## 🛠️ Arquitetura do Sistema

O Enlace ERP é estruturado segundo uma rigorosa separação de planos:

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
├───────────────────────────────┤             ├───────────────────────────────┤
│ • Users & Hashes de Senha     │             │ • Schema: tenant_12345678...  │
│ • Companies Cadastradas       │             │   - Cadastros & Contabilidade │
│ • Memberships & RBAC Roles    │             │   - Vendas, OS & Faturamento  │
│ • Sessões Ativas & Device Info│             │   - Estoque (CMP) & Kardex    │
│ • Famílias de Refresh Tokens  │             │   - NF-e e Protocolos SEFAZ   │
│ • Incidentes de Segurança     │             │   - Compras & 3-Way Matching  │
└───────────────────────────────┘             │   - Boletos, CNAB 400 & Pix   │
                                              │ • Schema: tenant_98765432...  │
                                              └───────────────────────────────┘
```

Para aprofundamento técnico, consulte o [Manual de Arquitetura (docs/ARCHITECTURE.md)](./docs/ARCHITECTURE.md).

---

## 💻 Começando Rápido (Desenvolvimento Local)

### Pré-requisitos:
- Node.js 20+ ou 22+
- npm 10+ ou bun

### Instalação e Execução:
```bash
# 1. Clonar o repositório
git clone https://github.com/empresa/enlace-erp.git
cd enlace-erp

# 2. Instalar as dependências
npm install

# 3. Iniciar o ambiente de desenvolvimento na porta 3000
npm run dev
```

Acesse a aplicação no navegador em: `http://localhost:3000`.

---

## 🧪 Bateria de Testes Automatizados (55/55 Aprovados)

O Enlace ERP conta com **55 testes automatizados de ponta a ponta** que garantem conformidade com todas as regras de negócio dos PRDs 01 a 09:

```bash
# Executar a bateria de testes de isolamento e regras de negócio
npm test
# ou: npx tsx tests/isolation.test.ts

# Executar checagem estática de tipos TypeScript
npm run lint

# Executar compilação completa para produção
npm run build
```

---

## 🚢 Implantação e Deploy em Produção

O projeto foi projetado para execução em contêineres e arquiteturas serverless como **Google Cloud Run**, **Docker** e **Kubernetes**.

### Execução via Docker Compose (App + PostgreSQL 16):
```bash
docker compose up -d --build
```

### Deploy no Google Cloud Run:
```bash
gcloud builds submit --tag gcr.io/SEU_PROJETO/enlace-erp:latest
gcloud run deploy enlace-erp \
  --image gcr.io/SEU_PROJETO/enlace-erp:latest \
  --port 3000 \
  --allow-unauthenticated \
  --region us-east1
```

Consulte o [Guia Completo de Deploy (docs/DEPLOYMENT_GUIDE.md)](./docs/DEPLOYMENT_GUIDE.md) para procedimentos de configuração de variáveis de ambiente, TLS/HTTPS e rotinas de backup por schema.

---

## 📚 Documentação do Sistema

- 📘 [Diretrizes para Agentes de IA (AGENTS.md)](./AGENTS.md)
- 📗 [Guia de Arquitetura do Sistema (docs/ARCHITECTURE.md)](./docs/ARCHITECTURE.md)
- 📙 [Detalhamento Funcional dos PRDs 01 a 09 (docs/PRD_OVERVIEW_01_TO_09.md)](./docs/PRD_OVERVIEW_01_TO_09.md)
- 📕 [Referência de APIs REST (docs/API_REFERENCE.md)](./docs/API_REFERENCE.md)
- 📓 [Guia de Deploy & Operações SRE (docs/DEPLOYMENT_GUIDE.md)](./docs/DEPLOYMENT_GUIDE.md)

---

## 📄 Licença
Propriedade de Enlace ERP Tecnologia S.A. Todos os direitos reservados.
