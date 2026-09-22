/**
 * Enlace ERP - Command Palette & Spotlight Search (PRD 01 a 09)
 * Navegação rápida entre módulos e busca instantânea de registros do Tenant Schema ativo
 * Acessível via Cmd + K (Mac) / Ctrl + K (Windows/Linux) ou clique no cabeçalho
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { SpotlightRecordResult } from '../../shared/types.js';
import {
  Search,
  X,
  CornerDownLeft,
  LayoutDashboard,
  FolderTree,
  ShoppingCart,
  DollarSign,
  Receipt,
  Boxes,
  Landmark,
  Truck,
  Banknote,
  Users,
  Shield,
  Laptop,
  KeyRound,
  ShieldAlert,
  CheckCircle2,
  Layers,
  FileText,
  Sliders,
  HelpCircle,
  Rocket,
  RefreshCw,
  PlusCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  Building2,
  Tag,
} from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  onSwitchCompany: () => void;
}

interface PaletteItem {
  id: string;
  type: 'module' | 'action' | 'record';
  category: string;
  title: string;
  subtitle: string;
  targetTab: string;
  badge?: string;
  badgeColor?: 'emerald' | 'indigo' | 'amber' | 'blue' | 'rose' | 'purple' | 'cyan' | 'slate';
  icon: React.ComponentType<{ className?: string }>;
  action?: () => void;
  meta?: Record<string, any>;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onSwitchCompany,
}) => {
  const { activeCompany, activeSchema, apiFetch } = useAuth();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recordResults, setRecordResults] = useState<SpotlightRecordResult[]>([]);
  const [isSearchingRecords, setIsSearchingRecords] = useState(false);
  const [feedbackNotification, setFeedbackNotification] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Detecta SO para exibir o glifo apropriado no atalho (⌘ vs Ctrl)
  const isMac = useMemo(() => {
    if (typeof window === 'undefined' || !window.navigator) return true;
    return /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
  }, []);

  // 1. Catálogo Estático dos Módulos Oficiais do Enlace ERP
  const moduleItems: PaletteItem[] = useMemo(
    () => [
      {
        id: 'mod-dashboard',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Visão Geral & Indicadores',
        subtitle: 'Métricas de governança, saúde da empresa, alarmes e status dos módulos',
        targetTab: 'dashboard',
        badge: 'Painel',
        badgeColor: 'emerald',
        icon: LayoutDashboard,
      },
      {
        id: 'mod-masterdata',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Cadastros & Contábil (PRD 03)',
        subtitle: 'Gestão de parceiros, plano de contas hierárquico, centros de custo e validador fiscal',
        targetTab: 'masterdata',
        badge: 'PRD 03',
        badgeColor: 'indigo',
        icon: FolderTree,
      },
      {
        id: 'mod-commercial',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Comercial & Operações (PRD 04)',
        subtitle: 'Catálogo de produtos, orçamentos, vendas e ordens de serviço (OS)',
        targetTab: 'commercial',
        badge: 'PRD 04',
        badgeColor: 'emerald',
        icon: ShoppingCart,
      },
      {
        id: 'mod-financial',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Financeiro & Tesouraria (PRD 05)',
        subtitle: 'Contas a receber, pagar, conciliação em tempo real, fluxo de caixa e DRE',
        targetTab: 'financial',
        badge: 'PRD 05',
        badgeColor: 'blue',
        icon: DollarSign,
      },
      {
        id: 'mod-billing',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Faturamento & Recorrência (PRD PARTE 05)',
        subtitle: 'Emissão de faturas de vendas/OS, contratos recorrentes e processamento em lote',
        targetTab: 'billing',
        badge: 'PRD P05',
        badgeColor: 'emerald',
        icon: Receipt,
      },
      {
        id: 'mod-inventory',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Estoque & Almoxarifados WMS (PRD 06)',
        subtitle: 'Depósitos múltiplos, Custo Médio Ponderado (CMP), inventário e transferências',
        targetTab: 'inventory',
        badge: 'PRD 06',
        badgeColor: 'amber',
        icon: Boxes,
      },
      {
        id: 'mod-fiscal',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Fiscal & NF-e SEFAZ (PRD 07)',
        subtitle: 'Emissão Modelo 55, assinatura digital XMLDSig A1, transmissão e inutilização',
        targetTab: 'fiscal',
        badge: 'PRD 07',
        badgeColor: 'purple',
        icon: Landmark,
      },
      {
        id: 'mod-procurement',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Compras & Suprimentos (PRD 08)',
        subtitle: 'Requisições, cotações, 3-Way Matching e entrada de mercadorias via XML',
        targetTab: 'procurement',
        badge: 'PRD 08',
        badgeColor: 'cyan',
        icon: Truck,
      },
      {
        id: 'mod-banking',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Cobrança Bancária & Pix (PRD 09 & PARTE 06)',
        subtitle: 'Boletos FEBRABAN, CNAB 400, Pix Dinâmico EMV, gateways e régua de cobrança',
        targetTab: 'banking',
        badge: 'PRD 09 / P06',
        badgeColor: 'emerald',
        icon: Banknote,
      },
      {
        id: 'mod-users',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Membros & Convites (PRD 02)',
        subtitle: 'Controle de usuários autorizados na empresa ativa e envio de novos convites',
        targetTab: 'users',
        badge: 'Governança',
        badgeColor: 'slate',
        icon: Users,
      },
      {
        id: 'mod-roles',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Matriz RBAC & Imunidade do Owner',
        subtitle: 'Papéis institucionais (Owner, Admin, Manager, Operator, Viewer) e privilégios',
        targetTab: 'roles',
        badge: 'Segurança',
        badgeColor: 'indigo',
        icon: Shield,
      },
      {
        id: 'mod-sessions',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Sessões Ativas & Anti-Theft',
        subtitle: 'Dispositivos conectados, tokens de sessão e revogação remota de acessos',
        targetTab: 'sessions',
        badge: 'Segurança',
        badgeColor: 'slate',
        icon: Laptop,
      },
      {
        id: 'mod-security-profile',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Segurança da Conta & MFA TOTP',
        subtitle: 'Autenticação em dois fatores, rotação de senhas e credenciais criptografadas',
        targetTab: 'security-profile',
        badge: 'MFA',
        badgeColor: 'amber',
        icon: KeyRound,
      },
      {
        id: 'mod-security-events',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Alarmes & Eventos de Segurança',
        subtitle: 'Detecção de reúso de token, tentativas de bypass e eventos críticos de telemetria',
        targetTab: 'security-events',
        badge: 'Monitoramento',
        badgeColor: 'rose',
        icon: ShieldAlert,
      },
      {
        id: 'mod-security-test',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Suíte de Testes Automatizada (60/60)',
        subtitle: 'Execução e conferência dos 60 testes de ponta a ponta e isolamento estrito',
        targetTab: 'security-test',
        badge: 'Testes',
        badgeColor: 'emerald',
        icon: CheckCircle2,
      },
      {
        id: 'mod-modules',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Gestão de Módulos Contratados',
        subtitle: 'Ativação, desativação e limites de subscrição por empresa',
        targetTab: 'modules',
        badge: 'Configuração',
        badgeColor: 'slate',
        icon: Layers,
      },
      {
        id: 'mod-audit',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Trilha de Auditoria do Schema',
        subtitle: 'Histórico imutável de todas as mutações e eventos realizados no tenant',
        targetTab: 'audit',
        badge: 'Auditoria',
        badgeColor: 'slate',
        icon: FileText,
      },
      {
        id: 'mod-help',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Central de Ajuda & Manuais PRD',
        subtitle: 'Documentação operacional completa de todos os módulos do Enlace ERP',
        targetTab: 'help',
        badge: 'Suporte',
        badgeColor: 'emerald',
        icon: HelpCircle,
      },
      {
        id: 'mod-deploy',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Painel de Deploy & SRE',
        subtitle: 'Arquitetura de contêineres, Dockerfile, scripts de saúde e orquestração Cloud',
        targetTab: 'deploy',
        badge: 'DevOps',
        badgeColor: 'indigo',
        icon: Rocket,
      },
      {
        id: 'mod-settings',
        type: 'module',
        category: 'Módulos & Navegação',
        title: 'Configurações Gerais do Tenant',
        subtitle: 'Parâmetros de moeda, fuso horário e dados fiscais cadastrais da empresa',
        targetTab: 'settings',
        badge: 'Ajustes',
        badgeColor: 'slate',
        icon: Sliders,
      },
    ],
    []
  );

  // 2. Ações Rápidas Corporativas
  const actionItems: PaletteItem[] = useMemo(
    () => [
      {
        id: 'act-switch-company',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Alternar Empresa / Trocar CNPJ Ativo',
        subtitle: `Trocar do contexto atual (${activeCompany?.tradeName || activeCompany?.legalName}) para outro CNPJ autorizado`,
        targetTab: '',
        badge: 'Contexto',
        badgeColor: 'amber',
        icon: RefreshCw,
        action: onSwitchCompany,
      },
      {
        id: 'act-new-sale',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Novo Pedido de Venda',
        subtitle: 'Abrir módulo comercial para lançar nova proposta ou faturar venda',
        targetTab: 'commercial',
        badge: 'Vendas',
        badgeColor: 'emerald',
        icon: PlusCircle,
      },
      {
        id: 'act-new-receivable',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Lançar Conta a Receber / Pagar',
        subtitle: 'Navegar para tesouraria para cadastrar título de crédito ou débito',
        targetTab: 'financial',
        badge: 'Financeiro',
        badgeColor: 'blue',
        icon: PlusCircle,
      },
      {
        id: 'act-issue-boleto',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Emitir Boleto Bancário ou Cobrança Pix',
        subtitle: 'Acessar módulo de cobrança bancária com linha digitável e QR Code EMV',
        targetTab: 'banking',
        badge: 'Cobrança',
        badgeColor: 'emerald',
        icon: Banknote,
      },
      {
        id: 'act-new-os',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Nova Ordem de Serviço (OS)',
        subtitle: 'Abrir tela operacional para cadastro e atribuição técnica de OS',
        targetTab: 'commercial',
        badge: 'Operações',
        badgeColor: 'purple',
        icon: PlusCircle,
      },
      {
        id: 'act-new-purchase',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Nova Requisição de Compras',
        subtitle: 'Lançar requisição de materiais ou serviços com aprovação por centro de custo',
        targetTab: 'procurement',
        badge: 'Suprimentos',
        badgeColor: 'cyan',
        icon: PlusCircle,
      },
      {
        id: 'act-fiscal-validator',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Validar CPF / CNPJ via Módulo 11',
        subtitle: 'Testar dígitos verificadores e formatação de documentos fiscais',
        targetTab: 'masterdata',
        badge: 'Validação',
        badgeColor: 'indigo',
        icon: Sparkles,
      },
      {
        id: 'act-run-tests',
        type: 'action',
        category: 'Ações Rápidas',
        title: 'Verificar Suíte de Testes (60/60)',
        subtitle: 'Auditar aprovação das regras de isolamento estrito de schemas',
        targetTab: 'security-test',
        badge: 'Auditoria',
        badgeColor: 'emerald',
        icon: CheckCircle2,
      },
    ],
    [activeCompany, onSwitchCompany]
  );

  // 3. Mapeador de Ícones para Registros Retornados do Servidor
  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'partner':
        return Users;
      case 'product':
        return Tag;
      case 'sale':
      case 'quote':
        return ShoppingCart;
      case 'serviceOrder':
        return Layers;
      case 'contract':
        return Receipt;
      case 'receivable':
      case 'payable':
        return DollarSign;
      case 'warehouse':
        return Boxes;
      case 'nfe':
        return Landmark;
      case 'purchase':
        return Truck;
      case 'boleto':
      case 'pix':
        return Banknote;
      default:
        return Database;
    }
  };

  // 4. Busca Assíncrona no Endpoint /api/v1/search com Debounce
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRecordResults([]);
      setIsSearchingRecords(false);
      return;
    }

    setIsSearchingRecords(true);
    const handler = setTimeout(async () => {
      try {
        const res = await apiFetch<SpotlightRecordResult[]>(
          `/api/v1/search?q=${encodeURIComponent(trimmed)}&limit=30`
        );
        if (res.success && res.data) {
          setRecordResults(res.data);
        } else {
          setRecordResults([]);
        }
      } catch (err) {
        console.error('Erro na pesquisa Spotlight:', err);
        setRecordResults([]);
      } finally {
        setIsSearchingRecords(false);
      }
    }, 180);

    return () => clearTimeout(handler);
  }, [query, isOpen, apiFetch]);

  // 5. Conversão dos Registros em PaletteItems
  const recordItems: PaletteItem[] = useMemo(() => {
    return recordResults.map((rec) => ({
      id: `rec-${rec.type}-${rec.id}`,
      type: 'record',
      category: rec.category,
      title: rec.title,
      subtitle: rec.subtitle,
      targetTab: rec.targetTab,
      badge: rec.badge,
      badgeColor: rec.badgeColor || 'slate',
      icon: getRecordIcon(rec.type),
      meta: rec.meta,
    }));
  }, [recordResults]);

  // 6. Filtragem de Módulos e Ações Rápidas pelo termo digitado
  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return moduleItems;
    return moduleItems.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.subtitle.toLowerCase().includes(q) ||
        m.targetTab.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [moduleItems, query]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actionItems;
    return actionItems.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }, [actionItems, query]);

  // 7. Agregação e Filtro por Categoria Selecionada
  const allFilteredItems = useMemo(() => {
    let list: PaletteItem[] = [];

    if (activeCategory === 'all') {
      list = [...filteredModules, ...filteredActions, ...recordItems];
    } else if (activeCategory === 'modules') {
      list = filteredModules;
    } else if (activeCategory === 'actions') {
      list = filteredActions;
    } else if (activeCategory === 'partners') {
      list = recordItems.filter((i) => i.category.includes('Parceiros'));
    } else if (activeCategory === 'commercial') {
      list = recordItems.filter(
        (i) =>
          i.category.includes('Vendas') ||
          i.category.includes('Orçamentos') ||
          i.category.includes('Ordens de Serviço') ||
          i.category.includes('Produtos')
      );
    } else if (activeCategory === 'financial') {
      list = recordItems.filter(
        (i) =>
          i.category.includes('Contas a Receber') ||
          i.category.includes('Contas a Pagar') ||
          i.category.includes('Cobrança') ||
          i.category.includes('Boleto') ||
          i.category.includes('Pix')
      );
    } else if (activeCategory === 'inventory_fiscal') {
      list = recordItems.filter(
        (i) =>
          i.category.includes('Estoque') ||
          i.category.includes('Notas Fiscais') ||
          i.category.includes('Compras')
      );
    }

    return list;
  }, [activeCategory, filteredModules, filteredActions, recordItems]);

  // Reset de seleção ao mudar itens ou abrir
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Focar input ao abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setRecordResults([]);
      setActiveCategory('all');
      setFeedbackNotification(null);
    }
  }, [isOpen]);

  // 8. Rolar item ativo para a visualização
  useEffect(() => {
    if (!isOpen) return;
    const el = itemRefs.current.get(selectedIndex);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, isOpen]);

  // 9. Execução da Seleção
  const handleSelectItem = useCallback(
    (item: PaletteItem) => {
      if (item.action) {
        item.action();
        onClose();
        return;
      }

      if (item.targetTab) {
        onNavigateTab(item.targetTab);
        setFeedbackNotification(`Navegando para: ${item.title}`);
        setTimeout(() => {
          onClose();
        }, 150);
      }
    },
    [onNavigateTab, onClose]
  );

  // 10. Manipulador de Teclado no Input / Modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (allFilteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 >= allFilteredItems.length ? 0 : prev + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 < 0 ? allFilteredItems.length - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const currentItem = allFilteredItems[selectedIndex];
      if (currentItem) {
        handleSelectItem(currentItem);
      }
    }
  };

  // Se o modal estiver fechado, não renderiza
  if (!isOpen) return null;

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70';
      case 'indigo':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/70';
      case 'blue':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/70';
      case 'amber':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/70';
      case 'rose':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/70';
      case 'purple':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/70';
      case 'cyan':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/70';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      id="command-palette-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:pt-[10vh] animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de Comandos e Busca Spotlight"
    >
      <div
        id="command-palette-card"
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-emerald-950/30 text-slate-100 max-h-[82vh]"
      >
        {/* Barra Superior de Busca */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3.5 bg-slate-950/60">
          <Search className="h-5 w-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            id="command-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar módulos, clientes, vendas, títulos, NF-e ou ações... (ex: 'venda', '33.000', 'licença')"
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            autoComplete="off"
            spellCheck="false"
          />

          {isSearchingRecords && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Buscando...</span>
            </div>
          )}

          {query && (
            <button
              onClick={() => {
                setQuery('');
                setRecordResults([]);
                inputRef.current?.focus();
              }}
              className="rounded p-1 text-slate-500 hover:text-slate-300 transition-colors"
              title="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-950 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Barra de Filtros por Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800/80 bg-slate-950/30 px-4 py-2 text-xs scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-emerald-600 text-slate-950 font-semibold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Tudo ({filteredModules.length + filteredActions.length + recordItems.length})
          </button>
          <button
            onClick={() => setActiveCategory('modules')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              activeCategory === 'modules'
                ? 'bg-emerald-600 text-slate-950 font-semibold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Módulos ({filteredModules.length})
          </button>
          <button
            onClick={() => setActiveCategory('actions')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              activeCategory === 'actions'
                ? 'bg-emerald-600 text-slate-950 font-semibold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Ações Rápidas ({filteredActions.length})
          </button>
          {recordItems.length > 0 && (
            <>
              <button
                onClick={() => setActiveCategory('partners')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === 'partners'
                    ? 'bg-emerald-600 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Clientes & Fornecedores
              </button>
              <button
                onClick={() => setActiveCategory('commercial')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === 'commercial'
                    ? 'bg-emerald-600 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Comercial & Vendas
              </button>
              <button
                onClick={() => setActiveCategory('financial')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === 'financial'
                    ? 'bg-emerald-600 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Financeiro & Cobrança
              </button>
              <button
                onClick={() => setActiveCategory('inventory_fiscal')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeCategory === 'inventory_fiscal'
                    ? 'bg-emerald-600 text-slate-950 font-semibold shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                Estoque, Fiscal & Compras
              </button>
            </>
          )}
        </div>

        {/* Lista de Resultados */}
        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          className="flex-1 overflow-y-auto p-2 space-y-1 focus:outline-none divide-y divide-slate-800/30"
        >
          {allFilteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-slate-500 mb-3">
                <Search className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">
                Nenhum resultado encontrado para &quot;{query}&quot;
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Tente buscar pelo nome da empresa, código do produto, número de pedido (PED-), ordem de serviço (OS-), NF-e ou CNPJ.
              </p>
            </div>
          ) : (
            allFilteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const IconComp = item.icon;

              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(index, el);
                    else itemRefs.current.delete(index);
                  }}
                  id={`command-item-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`group relative flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700/80'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 transition-colors ${
                        isSelected
                          ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-400'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 group-hover:text-slate-300'
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm truncate">
                          {item.title}
                        </span>

                        {item.badge && (
                          <span
                            className={`rounded border px-1.5 py-0.2 text-[10px] font-bold tracking-wide uppercase shrink-0 ${getBadgeStyle(
                              item.badgeColor
                            )}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider hidden sm:inline-block">
                      {item.category}
                    </span>

                    {isSelected && (
                      <div className="flex items-center gap-1 rounded bg-emerald-950 border border-emerald-800/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 animate-in fade-in">
                        <span>Acessar</span>
                        <CornerDownLeft className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/80 px-4 py-2.5 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <span className="rounded bg-slate-800 border border-slate-700 px-1 py-0.2 text-[10px] font-bold">
                ↑
              </span>
              <span className="rounded bg-slate-800 border border-slate-700 px-1 py-0.2 text-[10px] font-bold">
                ↓
              </span>
              <span>Navegar</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
                ↵
              </span>
              <span>Selecionar</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <span className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </span>
              <span>Atalho</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate max-w-[280px]">
            <Building2 className="h-3 w-3 text-emerald-400 shrink-0" />
            <span className="truncate">{activeCompany?.tradeName || activeCompany?.legalName}</span>
            <span className="text-slate-600 font-mono">•</span>
            <span className="font-mono text-emerald-400/80 truncate">{activeSchema}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
