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
