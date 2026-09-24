# Diretrizes para Agentes de IA — Enlace ERP

> Este arquivo é um alias em português para o documento principal [AGENTS.md](./AGENTS.md).  
> Todas as diretrizes, regras de arquitetura multi-tenant, convenções de código, restrições de segurança e protocolos de teste estão formalmente documentados em [AGENTS.md](./AGENTS.md).

Consulte o documento completo em:
👉 **[AGENTS.md](./AGENTS.md)**

---

### Resumo Executivo das Diretrizes:
1. **Isolamento de Schemas por CNPJ**: Cada tenant opera em `tenant_<CNPJ>` no PostgreSQL. Proibido misturar dados em tabelas com coluna `tenant_id`.
2. **Governança RBAC**: Matriz de 5 papéis (`owner`, `admin`, `manager`, `operator`, `viewer`) com imunidade institucional do `owner` (PRD 02 - Seção 21).
3. **Precisão BRL**: Arredondamento monetário estrito de duas casas decimais com `BoletoMath.roundBRL`.
4. **Bateria de Testes**: 66/66 testes automatizados em `tests/isolation.test.ts` devem ser mantidos 100% aprovados em qualquer alteração.
5. **Porta do Servidor**: Obrigatoriamente porta `3000` (`0.0.0.0:3000`).
6. **Cobrança Desacoplada & Webhooks (PRD PARTE 06)**: Desacoplamento fisiológico (Receivables x Collections), gateways plugáveis e webhooks idempotentes.
7. **Busca Spotlight & Paleta de Comandos (Cmd+K)**: Navegação global por teclado e busca indexada em tempo real com isolamento estrito de schema (`tenant_<CNPJ>`).

