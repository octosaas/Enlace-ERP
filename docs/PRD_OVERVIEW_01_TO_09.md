# Visão Geral dos PRDs (PRD 01 a 09 & PRD PARTE 06) — Enlace ERP

> **Enlace ERP** • Especificação Funcional e Técnica dos Módulos Homologados  
> Status: **100% Homologado e Testado (60/60 Testes Verdes)**

---

## 1. PRD 01: Fundação Multi-Tenant & Isolamento de Dados
- **Objetivo**: Garantir a segregação total de dados entre clientes corporativos (CNPJs).
- **Estrutura**:
  - Namespace dinâmico no PostgreSQL: `tenant_<CNPJ>` (14 dígitos sem formatação).
  - Provisionamento automatizado do schema na criação de nova empresa.
  - Alternância rápida de contexto sem necessidade de reautenticação.
  - Bloqueio estrito de parâmetros cruzados em Headers, Body, Query e URLs.

---

## 2. PRD 02: Identidade, RBAC, Sessões & Cofre Criptográfico
- **Objetivo**: Controle de acesso corporativo com autenticação segura, autorização baseada em papéis e proteção de segredos.
- **Estrutura**:
  - Matriz de 5 papéis: `owner`, `admin`, `manager`, `operator`, `viewer`.
  - Imunidade institucional do Owner (Seção 21).
  - Autenticação em dois fatores (MFA TOTP RFC 6238).
  - Rotação de Refresh Token com detecção de reúso (anti-theft).
  - Cofre criptográfico AES-256-GCM para certificados digitais e credenciais bancárias.
  - Registro centralizado de incidentes de segurança (`SecurityEvent`).

---

## 3. PRD 03: Cadastros Gerais & Plano de Contas Hierárquico
- **Objetivo**: Gestão de entidades mestras e estrutura contábil.
- **Estrutura**:
  - Parceiros de Negócios (Clientes, Fornecedores e Transportadoras).
  - Algoritmo de validação fiscal de CPF e CNPJ via Módulo 11 da Receita Federal.
  - Catálogo unificado de Produtos e Serviços com NCM e parâmetros tributários.
  - Plano de Contas Contábil com estrutura em árvore de 4 níveis (Ativo, Passivo, Patrimônio Líquido, DRE).
  - Centros de Custo para custeio gerencial e apropriação.

---

## 4. PRD 04: Comercial, Vendas & Ordens de Serviço (OS)
- **Objetivo**: Ciclo completo de vendas e prestação de serviços.
- **Estrutura**:
  - Propostas e Orçamentos com cálculo de itens e impostos.
  - Controle de alçadas de aprovação de desconto comercial (Vendedor até 5%, Gestor até 15%, Diretor acima).
  - Conversão de Orçamento em Pedido de Venda com chave de idempotência.
  - Ordens de Serviço (OS) com apontamento de horas técnicas e consumo de peças.
  - Trilha de status da OS: `RASCUNHO -> EM_EXECUCAO -> AGUARDANDO_PECAS -> CONCLUIDA -> FATURADA`.

---

## 5. PRD 05: Financeiro, Faturamento & Recorrência
- **Objetivo**: Gestão do fluxo financeiro, duplicatas e receitas contínuas.
- **Estrutura**:
  - Contas a Receber e Contas a Pagar com controle de prazos e centros de custo.
  - Cálculo automático de encargos moratórios: juros *pro-rata die* + multa contratual por atraso.
  - Liquidação financeira com crédito/débito instantâneo em contas correntes de tesouraria.
  - Faturamento direto de pedidos de venda com competência fiscal MM/AAAA.
  - Contratos de faturamento recorrente (mensal, trimestral, anual) com motor de lote idempotente.
  - DRE Gerencial consolidado e fluxo de caixa projetado.

---

## 6. PRD 06: Estoque, Almoxarifados & WMS
- **Objetivo**: Controle físico e financeiro de mercadorias em múltiplos depósitos.
- **Estrutura**:
  - Gestão de múltiplos depósitos físicos (ex: Matriz, Quarentena, Filial).
  - Recálculo contínuo do Custo Médio Ponderado (CMP) a cada movimentação de entrada.
  - Trava estrita contra saldo negativo de estoque físico.
  - Transferência entre depósitos com conferência de recebimento.
  - Trilha Kardex de movimentações físicas e contábeis por produto.

---

## 7. PRD 07: Fiscal, Tributário & Emissão de NF-e (Modelo 55)
- **Objetivo**: Emissão de documentos fiscais eletrônicos em conformidade com a SEFAZ.
- **Estrutura**:
  - Cálculo de impostos estaduais e federais: ICMS, IPI, PIS e COFINS.
  - Geração de XML no layout oficial da NF-e v4.00 (Modelo 55).
  - Assinatura digital padrão XMLDSig com certificado digital A1.
  - Simulação de homologação SEFAZ com protocolo de autorização de 15 dígitos.
  - Processo de inutilização homologada de faixas fiscais com justificativa obrigatória.

---

## 8. PRD 08: Compras, Cotações & Suprimentos
- **Objetivo**: Abastecimento corporativo com governança e controle de custos.
- **Estrutura**:
  - Requisição de compras com justificativa, centro de custo e alçadas de aprovação.
  - Cotações com mapa comparativo de fornecedores e cálculo automático de economia (*saving*).
  - Emissão e aprovação de Pedidos de Compra.
  - Importação de XML de NF-e de fornecedor.
  - Conferência 3-Way Matching (Pedido $\times$ NF-e $\times$ Estoque) alimentando CMP e Contas a Pagar.

---

## 9. PRD 09: Cobrança Bancária, CNAB 400 & Pix Dinâmico
- **Objetivo**: Automação de recebimentos via boleto bancário e arranjo instantâneo Pix.
- **Estrutura**:
  - Emissão de boletos padrão FEBRABAN com código de barras de 44 dígitos e linha digitável de 47 dígitos.
  - Geração de arquivos de Remessa CNAB 400 homologados para bancos brasileiros.
  - Processamento e leitura de arquivos de Retorno CNAB 400 com baixa automática de títulos e crédito em conta.
  - Cobrança Pix Dinâmica com payload EMV padrão Bacen (iniciando em `000201`), CRC16 e QR Code SVG vetorial.
  - Liquidação instantânea via simulador SPI do Banco Central com atualização de saldo em tesouraria.
  - Régua de Cobrança (*dunning*) automatizada preventiva e reativa com notificações.

---

## 10. PRD PARTE 06: Cobrança & Contas a Receber (Desacoplamento Fisiológico & Gateways)
- **Objetivo**: Arquitetura desacoplada e robusta para gestão de títulos a receber, motor de juros/multas/descontos pro-rata die, múltiplos gateways de pagamento plugáveis e webhooks idempotentes em tempo real.
- **Estrutura**:
  - **Desacoplamento Fisiológico**: O Título a Receber (`Receivable`) mantém a integridade do direito de crédito contratual. A Cobrança (`Collection`) é o artefato efêmero de liquidação. Cancelar ou reemitir cobranças (Boleto/Pix) não viola nem altera o saldo contratual original.
  - **Motor Matemático de Encargos**: Juros de mora diários simples/compostos calculados pro-rata die, multa percentual/fixa e desconto por antecipação com verificação estrita de data limite.
  - **Multi-Gateway Plugável**: Padrão Adapter com suporte a múltiplos provedores bancários (Asaas, C6 Bank, Cora, Enlace Sandbox), isolando chaves e credenciais criptografadas por schema de CNPJ (`payment_providers_v2`).
  - **Webhooks Idempotentes com Baixa Automática**:
    - Recepção centralizada em `/api/webhooks/collections/:provider`.
    - Deduplicação por hash de evento (`webhook_events_v2`) respondendo `DUPLICATE` em retentativas.
    - Liquidação automática em lote ou unitária reconciliando Cobrança (`PAID`), Título (`PAID`) e Tesouraria (`payments_v2`).
  - **Isolamento Estrito Multi-Tenant**: Dados financeiros e credenciais de provedores estritamente isolados no schema `tenant_<CNPJ>`.

---

## 11. Produtividade & UX: Busca Global Spotlight & Paleta de Comandos (`Cmd+K`)
- **Objetivo**: Acesso instantâneo e universal a todos os módulos e registros da aplicação via teclado, com isolamento estrito de schema.
- **Estrutura**:
  - Atalho global de teclado (`⌘K` no macOS / `Ctrl+K` no Windows/Linux) com navegação completa via setas, Enter e Esc.
  - Endpoint protegido: `GET /api/v1/search?q=<termo>` com validação de tenant (`activeMembership`).
  - Indexação em tempo real de clientes, fornecedores, vendas, orçamentos, ordens de serviço, notas fiscais, títulos a receber/pagar, boletos e cobranças Pix.
  - Normalização automática de termos e documentos com ou sem máscara.

