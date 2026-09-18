# Enlace ERP - PRD 02: Arquitetura de Identidade, Governança RBAC, Sessões e Cofre Criptográfico

Este documento detalha as decisões técnicas, camadas de defesa em profundidade e regras de negócio implementadas para atender integralmente às 41 seções do **PRD 02** do **Enlace ERP**.

---

## 1. Separação de Planos (Control Plane vs. Data Plane)

- **Control Plane Global**:
  - `User`: Identidade única do indivíduo (e-mail, hash de senha bcrypt, status de conta `ACTIVE | SUSPENDED | PENDING_RESET`, configuração MFA).
  - `Company`: Cadastro de entidades jurídicas (CNPJ, Razão Social, Namespace de isolamento `tenant_<CNPJ>`).
  - `Membership`: Relação corporativa estrita entre Usuário e Empresa com papel atribuído (`owner`, `admin`, `manager`, `operator`, `viewer`) e permissões granulares no formato `module.resource.action`.
  - `UserSession`: Rastreio em tempo real de sessões ativas, endereço IP, user-agent e revogação instantânea.
  - `RefreshToken`: Rotação segura de tokens com identificador de família e mecanismo anti-reúso.
  - `SecurityEvent`: Log centralizado de incidentes de segurança com Request ID e severidade (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).

- **Data Plane (Schemas Isolados por CNPJ)**:
  - Cada requisição é validada por `authMiddleware` (validade do token + sessão não revogada) e por `tenantMiddleware` (pertencimento comprovado ao CNPJ solicitado).
  - O acesso a dados operacionais é rigorosamente restrito ao schema correspondente ao CNPJ ativo (`tenant_12345678000195`, `tenant_98765432000110`), eliminando qualquer possibilidade de vazamento cross-tenant ou IDOR.

---

## 2. Matriz Granular de RBAC & Separação de Poderes (Seções 18 a 22)

### Perfis Corporativos Padronizados:
1. **OWNER (Proprietário Titular)**:
   - Autoridade institucional incondicional sobre a empresa e módulos.
   - **Regra da Seção 21**: Nenhum outro papel (inclusive `ADMIN`) pode rebaixar, suspender ou revogar o papel do OWNER. O servidor rejeita qualquer tentativa via HTTP 403 Forbidden.
2. **ADMIN (Administrador Operacional)**:
   - Gestão de equipe, convites, configuração de instâncias e rotinas corporativas.
3. **MANAGER (Gestor de Departamento)**:
   - Gestão de processos operacionais e relatórios gerenciais.
4. **OPERATOR (Operador do Dia a Dia)**:
   - Execução de cadastros e lançamentos permitidos.
5. **VIEWER (Auditor / Somente Leitura)**:
   - Acesso estritamente analítico e de auditoria, sem poderes de mutação.

---

## 3. Mecanismos de Autenticação, Rotação e Defesa Anti-Theft (Seções 10 a 14)

- **JWT de Curta Duração**: Tokens de acesso expiram rapidamente (15m).
- **Refresh Token de Uso Único**: A cada renovação, um novo par de tokens é emitido e o anterior é marcado como consumido.
- **Detecção de Reúso (Anti-Theft)**: Se um token consumido for apresentado novamente (evidência de furto de credencial por invasor), o sistema aciona imediatamente o alarme `SECURITY_TOKEN_REUSE_DETECTED` (severidade `CRITICAL`) e revoga todas as sessões ativas do usuário.
- **Revogação Instantânea**:
  - `POST /api/v1/auth/logout`: encerra a sessão ativa.
  - `POST /api/v1/auth/logout-all`: invalida todas as sessões ativas do usuário simultaneamente.

---

## 4. Segundo Fator de Autenticação (MFA TOTP RFC 6238) (Seção 17)

- Baseado em HMAC-SHA1 com janelas de tempo de 30 segundos e códigos de 6 dígitos.
- Emissão de segredo em formato Base32 e URI compatível com Google Authenticator, Microsoft Authenticator e 1Password (`otpauth://totp/...`).
- Geração de 8 códigos de recuperação alfanuméricos descartáveis protegidos por hash.
- Fluxo de login condicional: caso o usuário possua MFA ativo, o servidor responde `mfaRequired: true`, liberando o JWT somente após a validação temporal do código.

---

## 5. Proteção contra Brute Force & Rate Limiting (Seção 8 e 25)

- Rate Limiter in-memory com penalidade progressiva por IP e por e-mail.
- Exceder 5 tentativas inválidas de autenticação aciona bloqueio temporário (15 minutos) e o alarme `SECURITY_BRUTE_FORCE`.

---

## 6. Cofre Criptográfico de Credenciais (AES-256-GCM) (Seções 32 e 33)

- Criptografia autenticada para dados ultra-sensíveis (chaves PIX, certificados digitais e tokens de terceiros).
- Chave derivada via **HKDF (HMAC-based Key Derivation Function)** a partir de `MASTER_VAULT_KEY` ou segredo corporativo.
- Inicialização com IV aleatório de 12 bytes por payload e tag de autenticação GCM de 16 bytes, prevenindo ataques de adulteração de texto cifrado.

---

## 7. Governança e Contenção do AI Principal (MaIA) (Seções 35 e 36)

- A MaIA nunca opera como superusuário ou entidade onipotente.
- Toda invocação recebe um contexto explícito de delegação (`DelegatedContext`) amarrado ao `userId`, `companyId` e `membership` do usuário solicitante.
- O `AIPrincipalManager.assertPermission` impede que a MaIA execute ferramentas que o próprio usuário não possua autorização para disparar.

---

## 8. Bateria Automatizada de Testes (13/13 Aprovados)

1. **Separação física/lógica de schemas por CNPJ** (PASS)
2. **Isolamento de dados: registros não se misturam entre schemas** (PASS)
3. **Autenticação segura de usuário com JWT e Refresh Token** (PASS)
4. **Proteção contra IDOR: bloqueio de acesso a CNPJ não autorizado** (PASS)
5. **Usuário multiempresa com perfis e permissões distintos por CNPJ** (PASS)
6. **RBAC granular: operador bloqueado de alterar configurações institucionais** (PASS)
7. **Bloqueio de usuário suspenso (status SUSPENDED)** (PASS)
8. **Rotação segura de Refresh Token** (PASS)
9. **Detecção de reúso de token e invalidação preventiva em cascata** (PASS)
10. **Revogação de sessão em tempo real no servidor** (PASS)
11. **Validação temporal de MFA TOTP RFC 6238** (PASS)
12. **Criptografia AES-256-GCM com tag de integridade no Credential Vault** (PASS)
13. **Contenção do AI Principal (MaIA bloqueada de exceder escopo do usuário)** (PASS)
