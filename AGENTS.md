# AGENTS.md — Diretrizes e Convenções para Agentes Autônomos de IA e Engenheiros

> **Enlace ERP** • Plataforma ERP SaaS Multi-Tenant com Isolamento Estrito por CNPJ  
> Versão Atual: **0.1.0 (PRD 01 ao PRD 09 Homologados)**  
> Última Atualização: **Setembro de 2026**

---

## 1. Missão do Projeto & Princípios Inegociáveis

O **Enlace ERP** é uma plataforma horizontal de gestão empresarial (ERP) projetada para alta segurança, confiabilidade fiscal brasileira e isolamento absoluto de dados entre múltiplos clientes corporativos (tenants).

### Princípio Absoluto: Isolamento de Dados por Schema (`tenant_<CNPJ>`)
1. **Separação Fisiológica de Dados**: Cada empresa contratante cadastrada opera em seu próprio Schema no banco de dados PostgreSQL (ex: `tenant_12345678000195`, `tenant_98765432000110`).
2. **Proibição de Coluna `tenant_id` no Data Plane**: É **estritamente proibido** consolidar dados transacionais de múltiplos CNPJs em tabelas compartilhadas usando filtros WHERE `tenant_id = ?`. Cada schema contém suas próprias tabelas físicas independentes.
3. **Prevenção Anti-IDOR e Anti-Vazamento**: Nenhuma rota ou método do Data Plane pode permitir acesso a dados de outro schema. A validação de pertinência do usuário ao CNPJ (`activeMembership`) deve ocorrer antes de qualquer operação no banco.

---

## 2. Arquitetura em Dois Planos

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
├───────────────────────────────┤               ├───────────────────────────────┤
│ • Users (Identidades Globais) │               │ • Schema: tenant_<CNPJ_A>     │
│ • Companies (CNPJs Cadastros) │               │   - Produtos, Estoque (CMP)   │
│ • Memberships & RBAC Roles    │               │   - Vendas, Orçamentos, OS    │
│ • Active User Sessions        │               │   - Contas a Receber/Pagar    │
│ • Refresh Tokens Anti-Theft   │               │   - NF-e, Protocolos SEFAZ    │
│ • Security Events / Alarmes   │               │   - Boletos, Remessa/Retorno  │
└───────────────────────────────┘               │ • Schema: tenant_<CNPJ_B>...  │
                                                └───────────────────────────────┘
```

---

## 3. Matriz de Governança RBAC e Regras de Segurança (PRD 02)

O sistema implementa 5 papéis corporativos padronizados:

| Papel | Descrição | Regras e Limitações Críticas |
|---|---|---|
| `owner` | Proprietário Titular | **Imunidade Institucional (Seção 21)**: Nenhum outro papel (inclusive `admin`) pode rebaixar, suspender ou excluir o Owner. |
| `admin` | Administrador Operacional | Gestão de equipe, convites, instâncias e módulos. Não pode alterar o Owner. |
| `manager` | Gestor de Departamento | Gestão de vendas, compras, faturamento e relatórios gerenciais. |
| `operator` | Operador do Dia a Dia | Lançamentos de estoque, pedidos, ordens de serviço e emissões diárias. |
| `viewer` | Auditor / Somente Leitura | Consulta irrestrita a relatórios e trilha de auditoria; sem privilégios de escrita. |

### Regras do Agente de Inteligência Artificial (MaIA):
- A MaIA atua como **AI Principal** sob delegação do usuário logado.
- Ela herda estritamente o `activeMembership` e as permissões do usuário em sessão.
- É **proibido** qualquer bypass de autorização ou execução de ações restritas quando o operador não possuir o perfil necessário.

---

## 4. Regras Matemáticas e de Negócio por Módulo

### A. Comercial & Faturamento (PRD 04 & 05)
- Todos os cálculos monetários devem utilizar `BoletoMath.roundBRL` ou método equivalente de duas casas decimais com arredondamento padrão `Math.round((val + Number.EPSILON) * 100) / 100`.
- É expressamente proibido expor números com dízimas flutuantes na interface ou nos registros contábeis.
- Conversão de Orçamento para Venda requer **chave de idempotência** para impedir duplicidade de faturamento.

### B. Estoque & Almoxarifados WMS (PRD 06)
- **Recálculo Contínuo de CMP**:
  $$\text{Novo CMP} = \frac{(\text{Saldo Anterior} \times \text{CMP Anterior}) + (\text{Qtd Entrada} \times \text{Custo Unitário Entrada})}{\text{Saldo Anterior} + \text{Qtd Entrada}}$$
- **Trava de Saldo Negativo**: Saídas de mercadorias que resultem em saldo negativo devem ser barradas com erro operacional explícito.

### C. Fiscal & NF-e (PRD 07)
- Layout da NF-e segue o padrão oficial da SEFAZ v4.00 (Modelo 55).
- Notas autorizadas possuem **XML imutável** assinado digitalmente com certificado A1 via padrão XMLDSig.
- Inutilização de faixa fiscal exige justificativa mínima de 15 caracteres.

### D. Compras & 3-Way Matching (PRD 08)
- Requisições de compra acima de R$ 5.000,00 exigem aprovação de Gestor ou Administrador.
- Entrada de mercadorias via XML exige conferência tripartite: Pedido de Compra $\times$ XML da NF-e $\times$ Recebimento Físico no Depósito.

### E. Cobrança Bancária & Pix (PRD 09)
- Código de barras FEBRABAN: 44 dígitos numéricos com Módulo 11 (fator 2 a 9).
- Linha digitável: 47 dígitos organizados em 3 campos com Módulo 10 + DV geral Módulo 11 + Fator de Vencimento e Valor.
- Arquivos de Remessa e Retorno CNAB 400 em formato posicional com registros Header, Detalhe (Segmentos) e Trailer.
- Pix Dinâmico: Payload EMV "Copia e Cola" iniciando em `000201`, cálculo de CRC16-CCITT (`6304XXXX`) e QR Code vetorial SVG.

---

## 5. Protocolo de Verificação e Testes Obrigatório

O repositório possui uma suíte completa de **55 testes automatizados de ponta a ponta** localizada em `tests/isolation.test.ts`.

### Comandos de Validação:
```bash
# Executar a bateria de testes completa (55/55 testes devem passar)
npm test
# ou: npx tsx tests/isolation.test.ts

# Validador estático de tipagem TypeScript (zero erros aceitos)
npm run lint

# Compilação e build de produção (Vite + esbuild CJS server)
npm run build
```

> ⚠️ **REGRA DE OURO**: Qualquer modificação no código-fonte DEVE manter todos os 55 testes verdes. Não altere os testes para mascarar quebras de contrato de negócio.

---

## 6. Padrões de Interface (UI/UX) & Tailwind CSS

- **Paleta de Cores**: Base em `slate-950` para plano de fundo, `slate-900` para superfícies de cartões e contêineres, `slate-800` para bordas de alta definição, `emerald-400`/`emerald-500` para ações de sucesso/primárias e `rose-400` para erros ou revogações.
- **Proibição de AI Slop**: Não crie gradientes roxos extravagantes, botões sem ação vinculada, sombras difusas não-funcionais ou layouts genéricos sem alinhamento de alta densidade corporativa.
- **Tipografia**: Legibilidade de relatórios corporativos com suporte a formatação monetária padrão brasileiro (`pt-BR`, `R$ 1.250,00`).
- **Ícones**: Utilizar exclusivamente ícones da biblioteca `lucide-react`.

---

## 7. Instruções para Implantação e Contêineres

- A aplicação DEVE rodar obrigatoriamente na porta **3000** vinculada a `0.0.0.0`.
- O servidor Express orquestra tanto os endpoints de API `/api/*` quanto o serving dos assets estáticos via Vite middleware em desenvolvimento e `dist/index.html` em produção.
- Artefatos de deploy disponíveis: `Dockerfile` (multi-stage) e `docker-compose.yml`.
