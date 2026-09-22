# Guia Completo de Implantação e Deploy em Produção — Enlace ERP

> **Enlace ERP** • Manual de Operações SRE, DevOps & Hardening de Infraestrutura  
> Versão: **1.0 (Setembro de 2026)**

---

## 1. Requisitos de Infraestrutura

- **Node.js**: Versão 22 LTS (ou Node 20 LTS).
- **PostgreSQL**: Versão 16+ com suporte a Schemas dinâmicos.
- **Porta do Servidor**: **3000** (obrigatório para contêineres Cloud Run e proxy reverso).
- **Memória Mínima**: 1 GB RAM por instância (2 GB recomendado para produção).
- **CPU Mínima**: 1 vCPU.

---

## 2. Variáveis de Ambiente (.env)

| Variável | Obrigatória? | Descrição | Exemplo de Produção |
|---|---|---|---|
| `PORT` | Sim | Porta de escuta da aplicação | `3000` |
| `NODE_ENV` | Sim | Ambiente de execução | `production` |
| `DATABASE_URL` | Sim | String de conexão com PostgreSQL | `postgresql://enlace:SENHA_FORTE@pg-primary:5432/enlace_erp` |
| `JWT_SECRET` | Sim | Chave criptográfica para assinatura JWT | `enlace_prod_jwt_super_long_random_entropy_key_2026` |
| `GEMINI_API_KEY` | Opcional | Chave para recursos de IA server-side | `AIzaSy...` |

---

## 3. Estratégias de Deploy

### 3.1 Google Cloud Run (Recomendado)
O Google Cloud Run oferece escalabilidade automática zero-to-N e gerenciamento de certificados SSL/TLS sem necessidade de manutenção manual.

```bash
# 1. Login no Google Cloud
gcloud auth login
gcloud config set project MEU_PROJETO_GCP

# 2. Build da imagem com Cloud Build
gcloud builds submit --tag gcr.io/MEU_PROJETO_GCP/enlace-erp:latest

# 3. Deploy no Cloud Run
gcloud run deploy enlace-erp \
  --image gcr.io/MEU_PROJETO_GCP/enlace-erp:latest \
  --platform managed \
  --region us-east1 \
  --allow-unauthenticated \
  --port 3000 \
  --min-instances 1 \
  --max-instances 10 \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars="NODE_ENV=production,PORT=3000"
```

### 3.2 Docker Compose (VPS / On-Premise)
Para servidores dedicados ou VPS (ex: Ubuntu 24.04 LTS):

```bash
# Clonar repositório e subir stack
docker compose up -d --build

# Verificar logs em tempo real
docker compose logs -f app
```

---

## 4. Procedimentos de Backup & Disaster Recovery

### 4.1 Backup Completo do Banco de Dados
```bash
pg_dump -h localhost -U enlace_user -d enlace_erp -F c -b -v -f /backups/enlace_full_$(date +%Y%m%d_%H%M%S).dump
```

### 4.2 Backup Pontual por Schema de Cliente (CNPJ)
Uma das maiores vantagens da arquitetura do Enlace ERP é a capacidade de realizar backups pontuais por empresa:
```bash
# Exportar apenas os dados da Alfa Tecnologia (CNPJ: 12.345.678/0001-95)
pg_dump -h localhost -U enlace_user -d enlace_erp \
  --schema=tenant_12345678000195 \
  -F c -f /backups/tenant_12345678000195_$(date +%Y%m%d).dump
```

### 4.3 Restauração de Schema de Cliente
```bash
# Restaurar sem afetar nenhum outro CNPJ em produção
pg_restore -h localhost -U enlace_user -d enlace_erp \
  --clean --if-exists \
  --schema=tenant_12345678000195 \
  /backups/tenant_12345678000195_20260921.dump
```

---

## 5. Verificação de Saúde e Monitoramento

- **Healthcheck HTTP**: Configure seu load balancer ou orquestrador para sondar periodicamente:
  `GET /api/health`
  - Resposta esperada: `200 OK` com `status: "ok"`.

---

## 6. Configuração de Gateways de Pagamento & Webhooks (PRD PARTE 06)

### 6.1 Ingestão de Webhooks
Os gateways bancários (Asaas, C6 Bank, Cora, Enlace Sandbox) enviam notificações assíncronas de liquidação de boletos e Pix para:
```
POST https://seu-dominio.com.br/api/webhooks/collections/:provider
```
Onde `:provider` corresponde ao provedor configurado (`asaas`, `c6`, `cora`, `enlace`).

### 6.2 Validação de Assinatura & Idempotência
- Cada requisição de webhook é inspecionada quanto ao cabeçalho `x-webhook-signature` ou `x-webhook-secret`.
- O payload é deduplicado por identificador/hash de evento na tabela `webhook_events_v2` de cada tenant.
- Se o gateway reenviar a notificação devido a timeout de rede, o Enlace ERP responde `200 OK` com status `DUPLICATE` sem efetuar lançamentos repetidos no contas a receber ou na tesouraria.
