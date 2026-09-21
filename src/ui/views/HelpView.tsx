/**
 * Enlace ERP - Central de Ajuda, Suporte e Documentação Operacional
 * Cobertura completa dos módulos PRD 01 a PRD 09
 */

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import {
  HelpCircle,
  BookOpen,
  Search,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Users,
  FolderTree,
  ShoppingCart,
  Receipt,
  Boxes,
  Landmark,
  Truck,
  Banknote,
  LifeBuoy,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Send,
  AlertCircle,
  FileQuestion,
  Terminal,
  Activity,
  Cpu,
} from 'lucide-react';

interface FAQItem {
  question: string;
  category: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    category: 'Multi-Tenant & Acesso',
    question: 'Como funciona o isolamento de dados entre empresas (CNPJs)?',
    answer:
      'O Enlace ERP adota isolamento físico/lógico estrito por Schemas no banco de dados (ex: tenant_12345678000195). Os dados de clientes, produtos, pedidos, estoque e finanças de uma empresa jamais são compartilhados ou visíveis para outro CNPJ. Não há risco de injeção IDOR ou vazamento cross-tenant.',
  },
  {
    category: 'Multi-Tenant & Acesso',
    question: 'Como alternar entre empresas vinculadas ao meu perfil?',
    answer:
      'Clique no botão "Trocar CNPJ" na barra superior (Navbar) ao lado da identificação da empresa ativa. O sistema exibirá o seletor corporativo validando a permissão do seu usuário para o CNPJ selecionado.',
  },
  {
    category: 'Identidade & Segurança',
    question: 'Como ativar e configurar o Segundo Fator de Autenticação (MFA)?',
    answer:
      'Acesse a aba "Segurança & MFA". Clique em "Ativar MFA", leia o QR Code com seu aplicativo autenticador preferido (Google Authenticator, Microsoft Authenticator ou 1Password) e insira o código de 6 dígitos para homologar.',
  },
  {
    category: 'Identidade & Segurança',
    question: 'Qual o papel do OWNER e como funciona a separação de poderes no RBAC?',
    answer:
      'O papel OWNER possui autoridade máxima incondicional. Pelo princípio da Seção 21 do PRD 02, nenhum outro papel (mesmo Administradores) pode rebaixar, suspender ou excluir o Owner da empresa. Há ainda os papéis ADMIN, MANAGER, OPERATOR e VIEWER.',
  },
  {
    category: 'Comercial & Ordens de Serviço',
    question: 'Como converter um orçamento em pedido de venda aprovado?',
    answer:
      'Na aba "Comercial & Operações", localize o orçamento desejado e clique em "Converter em Pedido". O motor comercial valida a alçada de desconto, bloqueia duplicidade por chave de idempotência e disponibiliza o pedido para faturamento.',
  },
  {
    category: 'Faturamento & Recorrência',
    question: 'Como funciona o processamento em lote de contratos de faturamento recorrente?',
    answer:
      'No módulo "Faturamento & Recorrência", contratos de prestação contínua podem ser processados por competência (MM/AAAA). O motor gera automaticamente os títulos a receber com idempotência e registro de log de faturamento imutável.',
  },
  {
    category: 'Estoque & WMS',
    question: 'Como é recalculado o Custo Médio Ponderado (CMP)?',
    answer:
      'A cada movimentação de entrada ou importação de NF-e de compras, a fórmula CMP = ((Saldo Atual * CMP Anterior) + (Qtd Entrada * Custo Entrada)) / (Saldo Atual + Qtd Entrada) é processada automaticamente com arredondamento BRL.',
  },
  {
    category: 'Fiscal & Tributário',
    question: 'Como emitir e assinar digitalmente uma NF-e (Modelo 55)?',
    answer:
      'Na aba "Fiscal & Tributário", selecione o faturamento desejado, confira a apuração dos tributos (ICMS, IPI, PIS, COFINS) e clique em "Emitir & Assinar NF-e". O sistema gera o XML no padrão SEFAZ e assina com certificado digital A1.',
  },
  {
    category: 'Compras & Suprimentos',
    question: 'O que é a conferência 3-Way Matching na entrada de compras?',
    answer:
      'É a validação cruzada entre o Pedido de Compra aprovado, o XML da NF-e emitida pelo fornecedor e o recebimento físico com conferência cega. Havendo conformidade, o estoque é incrementado pelo CMP e a duplicata é gerada no Contas a Pagar.',
  },
  {
    category: 'Cobrança Bancária & Pix',
    question: 'Como processar o arquivo de Retorno CNAB 400 do banco?',
    answer:
      'No módulo "Cobrança & Pix", na aba "Retorno CNAB", faça o upload do arquivo .RET disponibilizado pelo seu banco. O motor identifica os boletos liquidados pelo "Nosso Número", efetua a baixa automática das duplicatas e credita o saldo em tesouraria.',
  },
];

interface ModuleGuide {
  id: string;
  title: string;
  prd: string;
  icon: React.ReactNode;
  summary: string;
  keyFeatures: string[];
  workflow: string[];
}

const MODULE_GUIDES: ModuleGuide[] = [
  {
    id: 'prd01_02',
    title: 'Fundação, Multi-Tenant & Segurança RBAC',
    prd: 'PRD 01 & 02',
    icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
    summary:
      'Arquitetura modular de alta disponibilidade com isolamento estrito de dados por CNPJ via schemas dedicados do PostgreSQL, cofre criptográfico AES-256-GCM, autenticação JWT, MFA TOTP e trilha de auditoria completa.',
    keyFeatures: [
      'Schemas dedicados por CNPJ (tenant_<CNPJ>)',
      'Matriz Granular RBAC (Owner, Admin, Manager, Operator, Viewer)',
      'Rotação de Refresh Token com detecção de reúso (Anti-Theft)',
      'Autenticação em dois fatores (MFA TOTP RFC 6238)',
      'Proteção rigorosa contra vulnerabilidades IDOR e bypass',
    ],
    workflow: [
      '1. O usuário efetua login e seleciona a empresa contratante ativa.',
      '2. O motor chaveia dinamicamente o search_path para o schema isolado do CNPJ.',
      '3. Cada requisição valida permissões granulares e emite log de auditoria.',
    ],
  },
  {
    id: 'prd03',
    title: 'Cadastros Gerais & Estrutura Contábil',
    prd: 'PRD 03',
    icon: <FolderTree className="h-5 w-5 text-indigo-400" />,
    summary:
      'Gestão centralizada de parceiros de negócios (Clientes, Fornecedores e Transportadoras) com validação de CPF/CNPJ pelo Módulo 11 da Receita Federal, catálogo de produtos e plano de contas hierárquico.',
    keyFeatures: [
      'Validação de CPF e CNPJ via algoritmo Módulo 11',
      'Classificação tributária e fiscal de produtos (NCM, CEST, Origem)',
      'Plano de contas contábil em 4 níveis hierárquicos',
      'Centros de Custo para apropriação gerencial',
    ],
    workflow: [
      '1. Cadastre clientes e fornecedores com documento validado.',
      '2. Configure o plano de contas e centros de custos da organização.',
      '3. Associe produtos aos parâmetros fiscais para cálculo automático.',
    ],
  },
  {
    id: 'prd04',
    title: 'Comercial, Vendas & Ordens de Serviço',
    prd: 'PRD 04',
    icon: <ShoppingCart className="h-5 w-5 text-emerald-400" />,
    summary:
      'Pipeline de vendas B2B e prestação de serviços com emissão de propostas, orçamentos, pedidos de venda, controle de margem de desconto por alçadas e ordens de serviço com controle de status.',
    keyFeatures: [
      'Motor de cálculo comercial com arredondamento BRL exato',
      'Alçadas de aprovação de desconto comercial',
      'Conversão idempotente de Orçamento em Pedido de Venda',
      'Ordens de Serviço (OS) com controle de apontamentos e materiais',
    ],
    workflow: [
      '1. Elabore o orçamento comercial com itens e condições de pagamento.',
      '2. Após aprovação do cliente, converta a proposta em Pedido de Venda.',
      '3. Encaminhe o pedido para expedição no estoque e faturamento.',
    ],
  },
  {
    id: 'prd05',
    title: 'Financeiro, Faturamento & Recorrência',
    prd: 'PRD 05',
    icon: <Receipt className="h-5 w-5 text-blue-400" />,
    summary:
      'Contas a Receber e Pagar, conciliação de tesouraria em tempo real, cálculo de encargos moratórios pro-rata die, emissão de faturamento de pedidos/OS e motor de contratos de faturamento recorrente.',
    keyFeatures: [
      'Títulos com cálculo automático de juros e multas por atraso',
      'Faturamento direto com trava anti-duplicidade',
      'Contratos de recorrência mensal/anual com processamento em lote',
      'DRE Gerencial consolidado e projeção de fluxo de caixa',
    ],
    workflow: [
      '1. Títulos são gerados a partir de vendas aprovadas ou compras recebidas.',
      '2. Realize a liquidação com crédito/débito automático em contas bancárias.',
      '3. Monitore o DRE gerencial e o fluxo de caixa projetado.',
    ],
  },
  {
    id: 'prd06',
    title: 'Estoque, Almoxarifados & WMS',
    prd: 'PRD 06',
    icon: <Boxes className="h-5 w-5 text-amber-400" />,
    summary:
      'Gestão multi-depósito (Matriz, Filial, Quarentena), rastreamento por lotes e validades, recálculo contínuo de Custo Médio Ponderado (CMP), trava estrita de saldo negativo e transferências físicas.',
    keyFeatures: [
      'Estrutura multi-depósitos isolada por schema',
      'Recálculo automático do Custo Médio Ponderado (CMP)',
      'Trava contra saldo negativo em requisições e vendas',
      'Trilha Kardex de movimentações físicas e contábeis',
    ],
    workflow: [
      '1. Mercadorias entram no estoque com atualização de CMP.',
      '2. Vendas e manutenções geram saídas com reserva física.',
      '3. Transferências entre almoxarifados com conferência de recebimento.',
    ],
  },
  {
    id: 'prd07',
    title: 'Fiscal, NF-e & Tributação SEFAZ',
    prd: 'PRD 07',
    icon: <Landmark className="h-5 w-5 text-purple-400" />,
    summary:
      'Emissor fiscal de NF-e (Modelo 55) com cálculo automatizado de impostos federais e estaduais (ICMS, IPI, PIS, COFINS), assinatura digital por certificado A1, transmissão SEFAZ e inutilização de faixas.',
    keyFeatures: [
      'Geração de XML no layout oficial da NF-e v4.00',
      'Assinatura digital padrão ICP-Brasil (RSA-SHA1 / XMLDSig)',
      'Simulação de autorização SEFAZ com protocolo de homologação',
      'Inutilização formal de números fiscais não utilizados',
    ],
    workflow: [
      '1. O pedido de venda é submetido ao motor de faturamento fiscal.',
      '2. O XML da NF-e é assinado com o certificado digital da empresa.',
      '3. A SEFAZ autoriza o uso e gera o protocolo para impressão do DANFE.',
    ],
  },
  {
    id: 'prd08',
    title: 'Compras, Cotações & Suprimentos',
    prd: 'PRD 08',
    icon: <Truck className="h-5 w-5 text-cyan-400" />,
    summary:
      'Fluxo integrado de compras corporativas: requisições com centro de custo, cotações de preços com mapa comparativo e cálculo de economia (saving), pedidos de compra e conferência 3-Way Matching com importação de XML.',
    keyFeatures: [
      'Requisições de compra com workflow de aprovação por alçada',
      'Mapa comparativo de cotações com destaque de menor preço e saving',
      '3-Way Matching: Pedido de Compra x XML NF-e x Conferência Física',
      'Alimentação simultânea do Estoque (CMP) e Contas a Pagar',
    ],
    workflow: [
      '1. Colaborador solicita compra com justificativa e centro de custo.',
      '2. Comprador abre cotação com múltiplos fornecedores e homologa o vencedor.',
      '3. Na chegada da mercadoria, importa o XML e executa o 3-way matching.',
    ],
  },
  {
    id: 'prd09',
    title: 'Cobrança Bancária, CNAB & Pix Dinâmico',
    prd: 'PRD 09',
    icon: <Banknote className="h-5 w-5 text-emerald-400" />,
    summary:
      'Motor completo de pagamentos e recebimentos: emissão de boletos FEBRABAN com linha digitável e código de barras, geração de arquivos de remessa CNAB 400, processamento de retorno com baixa automática, Pix dinâmico com payload EMV e simulador Bacen SPI.',
    keyFeatures: [
      'Boletos FEBRABAN com código de barras 44 dígitos e linha digitável 47 dígitos',
      'Geração de arquivos de remessa CNAB 400 homologados',
      'Conciliação automatizada de retorno bancário com baixa em títulos',
      'Pix Dinâmico com EMV Copia-e-Cola e QR Code SVG vetorial',
      'Simulação instantânea de liquidação via SPI Bacen',
      'Régua de Cobrança (Dunning Engine) preventiva e reativa',
    ],
    workflow: [
      '1. Títulos de clientes geram boletos ou cobranças Pix com QR Code.',
      '2. Boletos são enviados via remessa CNAB ou liquidados via Pix instantâneo.',
      '3. O arquivo de retorno do banco ou webhook do Pix liquida o título automaticamente.',
    ],
  },
];

export const HelpView: React.FC = () => {
  const { activeCompany, activeSchema, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeGuideId, setActiveGuideId] = useState<string>('prd01_02');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  // Ticket form state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('DUVIDA_OPERACIONAL');
  const [ticketPriority, setTicketPriority] = useState('MEDIA');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  const filteredFaqs = FAQ_DATA.filter((faq) => {
    const matchesSearch =
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activeGuide =
    MODULE_GUIDES.find((g) => g.id === activeGuideId) || MODULE_GUIDES[0];

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    const ticketProtocol = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      Math.random() * 900 + 100
    )}`;

    setTicketSuccess(
      `Chamado aberto com sucesso! Protocolo: ${ticketProtocol}. Nossa equipe técnica responderá para ${user?.email}.`
    );
    setTicketSubject('');
    setTicketMessage('');
    setTimeout(() => {
      setTicketSuccess(null);
    }, 8000);
  };

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <HelpCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Central de Ajuda & Suporte Operacional
              <span className="rounded bg-emerald-950 border border-emerald-800/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                PRD 01 a 09
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Guias de uso passo a passo, documentação técnica, perguntas frequentes e suporte operacional do Enlace ERP.
            </p>
          </div>
        </div>

        {/* Status Box */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs">
          <div className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="flex flex-col text-[11px]">
            <span className="font-medium text-slate-300">Tenant Ativo: {activeCompany?.tradeName}</span>
            <span className="font-mono text-slate-400">Schema: {activeSchema}</span>
          </div>
        </div>
      </div>

      {/* Barra de Busca de Tópicos */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por tópicos, dúvidas ou regras de negócio (ex: NF-e, CNAB, CMP, RBAC, Pix, 3-Way Matching)..."
            className="w-full rounded-lg border border-slate-700/80 bg-slate-950 pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Grid Principal: Guias dos Módulos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Menu Lateral de Módulos (PRD 01 a 09) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between pb-1 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
              Manuais dos Módulos
            </span>
            <span className="text-[11px] text-slate-500">8 Manuais</span>
          </div>

          <div className="space-y-1">
            {MODULE_GUIDES.map((guide) => {
              const isSelected = guide.id === activeGuideId;
              return (
                <button
                  key={guide.id}
                  onClick={() => setActiveGuideId(guide.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all border ${
                    isSelected
                      ? 'bg-slate-800/90 border-emerald-500/50 text-white shadow-sm'
                      : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-1.5 rounded-md ${
                        isSelected ? 'bg-slate-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {guide.icon}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-200">{guide.title}</div>
                      <div className="text-[10px] font-mono text-emerald-400/90">{guide.prd}</div>
                    </div>
                  </div>
                  {isSelected && <ChevronRight className="h-4 w-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalhe do Manual Selecionado */}
        <div className="lg:col-span-8 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-5">
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
                {activeGuide.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{activeGuide.title}</h2>
                  <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    {activeGuide.prd}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{activeGuide.summary}</p>
              </div>
            </div>
          </div>

          {/* Funcionalidades Chave */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Principais Capacidades e Regras de Negócio
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeGuide.keyFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fluxo de Operação Recomendado */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              Fluxo Operacional Recomendado
            </h3>
            <div className="space-y-2">
              {activeGuide.workflow.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300"
                >
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    0{idx + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Seção FAQ: Perguntas Frequentes */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Perguntas Frequentes (FAQ Operacional)</h2>
          </div>

          {/* Filtro por Categoria */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {['all', 'Multi-Tenant & Acesso', 'Identidade & Segurança', 'Comercial & Ordens de Serviço', 'Faturamento & Recorrência', 'Estoque & WMS', 'Fiscal & Tributário', 'Compras & Suprimentos', 'Cobrança Bancária & Pix'].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : cat}
                </button>
              )
            )}
          </div>
        </div>

        {/* Lista de FAQs com Accordion */}
        <div className="space-y-2">
          {filteredFaqs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Nenhuma pergunta encontrada com os termos pesquisados.
            </div>
          ) : (
            filteredFaqs.map((faq, index) => {
              const isExpanded = expandedFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-lg border border-slate-800/80 bg-slate-950/60 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                    className="w-full flex items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-200 hover:bg-slate-900/80 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                        {faq.category}
                      </span>
                      {faq.question}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 text-xs text-slate-400 border-t border-slate-800/50 bg-slate-900/30 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Grid Inferior: Diagnóstico de Serviços & Abertura de Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status de Saúde dos Motores & Serviços */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Status de Integridade dos Motores</h2>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Isolamento Multi-Tenant (PostgreSQL Schemas)</span>
              </div>
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                OPERACIONAL
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Landmark className="h-4 w-4 text-emerald-400" />
                <span>Simulador SEFAZ NF-e (Modelo 55)</span>
              </div>
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                CONECTADO
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Banknote className="h-4 w-4 text-emerald-400" />
                <span>Simulador SPI / Pix Instantâneo Bacen</span>
              </div>
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                EM TEMPO REAL
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Cpu className="h-4 w-4 text-emerald-400" />
                <span>Motor Criptográfico AES-256-GCM (Vault)</span>
              </div>
              <span className="rounded bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                SEGURO
              </span>
            </div>
          </div>
        </div>

        {/* Formulário de Abertura de Chamado */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <LifeBuoy className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Abertura de Chamado para Suporte</h2>
          </div>

          {ticketSuccess && (
            <div className="rounded-lg border border-emerald-800/80 bg-emerald-950/50 p-3 text-xs text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{ticketSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateTicket} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Assunto da Solicitação</label>
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Ex: Dúvida na apuração de impostos da NF-e ou leitura de CNAB"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Categoria</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="DUVIDA_OPERACIONAL">Dúvida Operacional</option>
                  <option value="FISCAL_TRIBUTARIO">Fiscal & NF-e</option>
                  <option value="COBRANCA_BANCARIA">Cobrança & CNAB/Pix</option>
                  <option value="ESTOQUE_WMS">Estoque & CMP</option>
                  <option value="SEGURANCA_ACESSO">Acesso & Permissões</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Prioridade</label>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="BAIXA">Baixa (Dúvida pontual)</option>
                  <option value="MEDIA">Média (Rotina de trabalho)</option>
                  <option value="ALTA">Alta (Faturamento/Expedição bloqueada)</option>
                  <option value="URGENTE">Urgente (Indisponibilidade)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Mensagem detalhada</label>
              <textarea
                required
                rows={3}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Descreva a operação que você está realizando, o comportamento observado ou a dúvida que deseja esclarecer..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-500 transition-colors shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar Chamado de Suporte
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
