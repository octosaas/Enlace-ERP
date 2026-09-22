# Referência de APIs REST — Enlace ERP

> **Enlace ERP** • Manual de Endpoints da API HTTP / REST  
> Padrão: **JSON / RESTful sobre HTTPS**  
> Porta Padrão: **3000**

---

## 1. Padrões de Autenticação & Cabeçalhos

### 1.1 Cabeçalhos Obrigatórios
- `Authorization: Bearer <JWT_ACCESS_TOKEN>`: Token JWT emitido no endpoint `/api/v1/auth/login`.
- `X-Tenant-Id: <CNPJ_DA_EMPRESA>`: CNPJ (14 dígitos) da empresa em cujo schema a operação será executada.
- `Content-Type: application/json`

### 1.2 Formato de Erros Padronizado
Em caso de falha de validação ou segurança, a API retorna um objeto estruturado:
```json
{
  "error": "SECURITY_PERMISSION_DENIED",
  "message": "Operação bloqueada na camada de autorização do RBAC.",
  "requestId": "req-98f7a8b1",
  "statusCode": 403
}
```

---

## 2. Endpoints do Control Plane (Autenticação e Empresas)

### `POST /api/v1/auth/login`
Efetua a autenticação com e-mail e senha. Se o usuário possuir MFA ativo, retorna `mfaRequired: true`.
- **Payload**:
  ```json
  {
    "email": "carlos@alfa.com.br",
    "password": "SenhaSeguraAlfa@2026",
    "mfaCode": "123456"
  }
  ```
- **Resposta**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "ref_8f3d...",
    "user": { "id": "usr-01", "name": "Carlos Santos", "email": "carlos@alfa.com.br" },
    "companies": [ ... ]
  }
  ```

### `POST /api/v1/auth/refresh-token`
Realiza a rotação do refresh token emitindo um novo par de tokens e invalidando o anterior.

### `POST /api/v1/auth/logout`
Encerra a sessão ativa no servidor.

### `POST /api/v1/auth/logout-all`
Invalida simultaneamente todas as sessões ativas do usuário em todos os dispositivos.

---

## 3. Endpoints de Monitoramento e Saúde

### `GET /api/health`
Retorna o estado operacional do servidor e dos schemas.
- **Resposta**:
  ```json
  {
    "status": "ok",
    "uptime": 86420,
    "timestamp": "2026-09-21T09:45:00.000Z",
    "activeTenantsCount": 2,
    "version": "0.1.0"
  }
  ```

---

## 4. Auditoria e Governança

### `GET /api/v1/tenants/:cnpj/audit-logs`
Consulta a trilha de auditoria do schema ativo (requer permissão de `admin`, `owner` ou `viewer`).

---

## 5. Cobrança e Contas a Receber (PRD PARTE 06)

### `POST /api/webhooks/collections/:provider`
Endpoint unificado de ingestão de webhooks dos gateways integrados (`asaas`, `c6`, `cora`, `enlace`).
- **Cabeçalhos Suportados**:
  - `x-webhook-signature`: Assinatura HMAC ou hash do evento para validação de autenticidade.
  - `x-webhook-secret`: Segredo compartilhado pré-configurado no portal do gateway.
- **Respostas**:
  - `200 OK` com `status: "PROCESSED"` quando o evento liquida a cobrança e o título pela primeira vez.
  - `200 OK` com `status: "DUPLICATE"` em caso de retentativa do gateway (chave de idempotência impede duplicidade).
  - `400 Bad Request` se a carga útil for malformada ou o gateway for desconhecido.

### `POST /api/v1/collections/receivables`
Cria um Título a Receber (`Receivable`) no schema da empresa com parâmetros de juros, multa e desconto.
- **Cabeçalho**: `X-Tenant-Id: <CNPJ>`, `Authorization: Bearer <JWT>`
- **Payload**:
  ```json
  {
    "partnerId": "part-01",
    "description": "Prestação de Serviços Especializados",
    "totalAmount": 1250.00,
    "dueDate": "2026-10-15",
    "interestRateMonth": 1.0,
    "finePercent": 2.0,
    "discountValue": 50.00,
    "discountLimitDate": "2026-10-10"
  }
  ```

### `POST /api/v1/collections/issue`
Emite uma Cobrança (`Collection`) para um Título a Receber existente, utilizando o gateway ativo (`asaas`, `c6`, `cora` ou `enlace_sandbox`).
- **Payload**:
  ```json
  {
    "receivableId": "rec-123456",
    "paymentMethod": "BOLETO", // ou "PIX"
    "provider": "enlace_sandbox"
  }
  ```
- **Resposta**: Retorna o identificador da cobrança, status `ISSUED`, código de barras de 44 dígitos, linha digitável de 47 dígitos ou payload Pix Copia-e-Cola / QR Code.

### `GET /api/v1/collections/receivables/:id/amount`
Retorna o cálculo dinâmico pro-rata die do saldo atualizado do título, decompondo valor original, juros acumulados, multa e desconto por antecipação.
