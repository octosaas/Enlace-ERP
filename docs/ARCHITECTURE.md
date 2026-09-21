# Arquitetura do Sistema — Enlace ERP

> **Enlace ERP** • Documento de Arquitetura Técnica e Engenharia de Software  
> Versão: **1.0 (Setembro de 2026)**  
> Conformidade: **PRD 01 ao PRD 09**

---

## 1. Visão Geral & Modelo Multi-Tenant

O Enlace ERP foi concebido a partir de um requisito não-funcional primordial: **garantir o isolamento absoluto de dados entre múltiplos clientes corporativos sem a complexidade e o custo financeiro de gerenciar instâncias de banco de dados separadas para cada empresa**.

### 1.1 Por que Schemas do PostgreSQL (`tenant_<CNPJ>`)?
- **Desempenho & Densidade**: Permite consolidar centenas de empresas em um único cluster ou réplica PostgreSQL de alta disponibilidade, compartilhando o pool de conexões e cache do banco.
- **Isolamento de Espaço de Nomes**: O comando `SET search_path = tenant_12345678000195, public;` garante que toda query SQL (`SELECT * FROM products`) execute estritamente sobre a tabela do tenant ativo.
- **Segurança Anti-IDOR**: Impossibilita o erro humano clássico de esquecer uma cláusula `WHERE tenant_id = ?` em queries relacionais complexas, joins ou subselects.
- **Backup Granular**: Permite a extração ou restauração pontual de um único CNPJ com `pg_dump -n tenant_<CNPJ>` sem travar ou afetar outros clientes.

---

## 2. Separação Estrita de Planos (Control Plane vs. Data Plane)

### 2.1 Control Plane (Governança Global)
Armazena apenas metadados necessários para identificar o usuário e determinar quais empresas ele tem autorização para acessar:
1. **User**: `id`, `name`, `email`, `passwordHash` (bcrypt), `status` (`ACTIVE | SUSPENDED | PENDING_RESET`), `mfaEnabled`, `mfaSecret`.
2. **Company**: `id`, `cnpj` (14 dígitos sem máscara), `legalName`, `tradeName`, `schemaNamespace` (`tenant_<CNPJ>`).
3. **Membership**: Relação estrita `(userId, companyId)` contendo o papel (`owner | admin | manager | operator | viewer`) e permissões customizadas.
4. **UserSession**: Registro de cada dispositivo conectado com IP, user-agent, data de expiração e flag de revogação.
5. **RefreshToken**: Rotação com hash de família e detecção de reúso (invalidação total de sessões do usuário em caso de roubo de token).
6. **SecurityEvent**: Auditoria centralizada de eventos de segurança com severidade e request ID.

### 2.2 Data Plane (Operações por CNPJ)
Reside integralmente dentro do schema do CNPJ (`tenant_<CNPJ>`):
- **Cadastros**: Parceiros de Negócios (Clientes, Fornecedores, Transportadoras) e Catálogo de Produtos.
- **Contabilidade**: Plano de Contas Hierárquico em árvore e Centros de Custo.
- **Vendas & Operações**: Orçamentos, Pedidos de Venda, Alçadas de Desconto e Ordens de Serviço (OS).
- **Financeiro & Faturamento**: Contas a Receber, Contas a Pagar, Contratos de Faturamento Recorrente, Notas Faturadas e DRE Gerencial.
- **Estoque & WMS**: Depósitos Múltiplos, Movimentações Kardex, Trava de Saldo Negativo e Custo Médio Ponderado (CMP).
- **Fiscal & NF-e**: Emissões de NF-e Modelo 55, Assinaturas Digitais A1, Protocolos SEFAZ e Inutilização de Faixas.
- **Compras & Suprimentos**: Requisições de Compra, Cotações de Preço, Mapas Comparativos com Saving e 3-Way Matching.
- **Serviços Bancários**: Boletos FEBRABAN com código de barras de 44 dígitos, Remessa/Retorno CNAB 400, Pix Dinâmico EMV e Régua de Cobrança (*dunning*).

---

## 3. Camada de Segurança & Criptografia (Vault)

### 3.1 Criptografia Simétrica AES-256-GCM
Para armazenar dados ultra-sensíveis (ex: certificados digitais fiscais A1/A3, senhas de emissão SEFAZ e chaves privadas de bancos):
- Algoritmo: `AES-256-GCM` (Galois/Counter Mode).
- Vetor de Inicialização (IV): Gerado randomicamente com 12 a 16 bytes a cada operação de escrita.
- Tag de Autenticação (Auth Tag): 16 bytes garantem que qualquer adulteração nos dados criptografados seja detectada antes da descriptografia.

### 3.2 Governança RBAC & Princípio da Seção 21
O papel `owner` possui imunidade institucional codificada no motor:
```typescript
if (targetMembership.role === 'owner' && operatorRole !== 'owner') {
  throw new ForbiddenError('Apenas o próprio Proprietário pode alterar seu perfil corporativo.');
}
```

---

## 4. Motor de Precisão Decimal e Arredondamento Financeiro BRL

Cálculos financeiros jamais operam com floats não normalizados. Toda operação de adição, multiplicação ou rateio utiliza a fórmula padrão:
```typescript
export function roundBRL(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```
Isso impede divergências de centavos em duplicatas de boletos, partilhas de impostos ou recálculo do Custo Médio Ponderado.

---

## 5. Trilha de Auditoria e Imutabilidade

Todas as operações de escrita no sistema geram um registro de auditoria no schema do tenant com:
- `id`: Identificador único da auditoria.
- `timestamp`: Data e hora ISO 8601 UTC.
- `userId`: Identificador do operador.
- `userName`: Nome legível do operador.
- `action`: Ação executada (ex: `NFE_AUTHORIZED`, `PURCHASE_3WAY_MATCHED`, `SLIP_GENERATED`, `PIX_SETTLED`).
- `entity`: Entidade impactada (ex: `Invoice`, `StockMovement`, `BankSlip`).
- `details`: Resumo estruturado da transação.
- `ipAddress`: IP de origem da requisição.

Registros fiscais e contábeis são imutáveis; estornos operacionais são registrados como novas transações compensatórias.
