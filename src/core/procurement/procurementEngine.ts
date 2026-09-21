/**
 * Enlace ERP - Motor de Compras, Suprimentos & Entrada de NF-e (PRD 08)
 * Regras de Negócio de Procurement, Mapa Comparativo de Cotações e Parser de NF-e XML
 */

import {
  PurchaseRequisitionItem,
  QuotationItemProposal,
  SupplierQuotationProposal,
  PurchaseOrderItem,
  InboundInvoiceItem,
  InboundInvoiceInstallment,
} from '../../shared/types.js';

export class ProcurementMath {
  public static roundBRL(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  public static calculateRequisitionTotal(items: PurchaseRequisitionItem[]): number {
    const sum = items.reduce((acc, item) => acc + (item.estimatedTotalPrice || (item.quantity * item.estimatedUnitPrice)), 0);
    return this.roundBRL(sum);
  }

  public static calculateProposalTotals(
    items: QuotationItemProposal[],
    freightAmount: number = 0
  ): {
    subtotal: number;
    discountTotal: number;
    freightTotal: number;
    grandTotal: number;
  } {
    let subtotal = 0;
    let discountTotal = 0;

    for (const item of items) {
      const gross = this.roundBRL(item.quantity * item.unitPrice);
      const discount = this.roundBRL(gross * (item.discountPercentage / 100));
      subtotal += gross;
      discountTotal += discount;
    }

    const grandTotal = this.roundBRL(subtotal - discountTotal + freightAmount);

    return {
      subtotal: this.roundBRL(subtotal),
      discountTotal: this.roundBRL(discountTotal),
      freightTotal: this.roundBRL(freightAmount),
      grandTotal: Math.max(0, grandTotal),
    };
  }

  public static calculateOrderTotals(
    items: PurchaseOrderItem[],
    freightTotal: number = 0
  ): {
    subtotal: number;
    discountTotal: number;
    freightTotal: number;
    taxesTotal: number;
    grandTotal: number;
  } {
    let subtotal = 0;
    let discountTotal = 0;
    let taxesTotal = 0;

    for (const item of items) {
      const itemGross = this.roundBRL(item.quantity * item.unitPrice);
      subtotal += itemGross;
      discountTotal += item.discountAmount || 0;

      const ipi = this.roundBRL(itemGross * ((item.aliquotIPI || 0) / 100));
      const icms = this.roundBRL(itemGross * ((item.aliquotICMS || 0) / 100));
      taxesTotal += ipi; // IPI é imposto por fora incorporado ao custo de aquisição
    }

    const grandTotal = this.roundBRL(subtotal - discountTotal + freightTotal + taxesTotal);

    return {
      subtotal: this.roundBRL(subtotal),
      discountTotal: this.roundBRL(discountTotal),
      freightTotal: this.roundBRL(freightTotal),
      taxesTotal: this.roundBRL(taxesTotal),
      grandTotal: Math.max(0, grandTotal),
    };
  }
}

export class QuotationComparator {
  /**
   * Compara as propostas dos fornecedores e calcula a proposta vencedora e o percentual de economia (savings)
   */
  public static compare(
    proposals: SupplierQuotationProposal[]
  ): {
    winningSupplierId?: string;
    winningSupplierName?: string;
    totalWinningAmount: number;
    savingsAmount: number;
    savingsPercentage: number;
  } {
    if (!proposals || proposals.length === 0) {
      return {
        totalWinningAmount: 0,
        savingsAmount: 0,
        savingsPercentage: 0,
      };
    }

    // Ordenar por menor valor total global
    const sorted = [...proposals].sort((a, b) => a.grandTotal - b.grandTotal);
    const winner = sorted[0];

    // Média de todas as propostas para calcular savings
    const sumTotals = proposals.reduce((acc, p) => acc + p.grandTotal, 0);
    const avgTotal = sumTotals / proposals.length;
    const maxTotal = Math.max(...proposals.map((p) => p.grandTotal));

    // Economia comparada à maior proposta concorrente (ou à média)
    const savingsAmount = ProcurementMath.roundBRL(Math.max(0, maxTotal - winner.grandTotal));
    const savingsPercentage = maxTotal > 0 ? ProcurementMath.roundBRL((savingsAmount / maxTotal) * 100) : 0;

    return {
      winningSupplierId: winner.supplierId,
      winningSupplierName: winner.supplierName,
      totalWinningAmount: winner.grandTotal,
      savingsAmount,
      savingsPercentage,
    };
  }
}

export class NFeXmlParser {
  /**
   * Parser resiliente de XML de NF-e (Layout padrão SEFAZ Brasil modelo 55)
   */
  public static parse(xmlContent: string): {
    accessKey: string;
    number: string;
    series: string;
    issueDate: string;
    supplier: {
      document: string;
      name: string;
      stateRegistration?: string;
    };
    items: InboundInvoiceItem[];
    totals: {
      products: number;
      freight: number;
      insurance: number;
      discount: number;
      ipi: number;
      icms: number;
      pis: number;
      cofins: number;
      netTotal: number;
    };
    installments: InboundInvoiceInstallment[];
  } {
    // 1. Extração da Chave de Acesso (44 dígitos)
    let accessKey = '';
    const idMatch = xmlContent.match(/Id=["']NFe(\d{44})["']/i);
    if (idMatch && idMatch[1]) {
      accessKey = idMatch[1];
    } else {
      const chNFeMatch = xmlContent.match(/<chNFe>(\d{44})<\/chNFe>/i);
      if (chNFeMatch && chNFeMatch[1]) {
        accessKey = chNFeMatch[1];
      } else {
        // Gera chave sintética caso não encontre
        accessKey = `352609${Math.floor(10000000000000 + Math.random() * 90000000000000)}550010000000011234567890`;
      }
    }

    // 2. Identificação da Nota
    const nNFMatch = xmlContent.match(/<nNF>(\d+)<\/nNF>/i);
    const number = nNFMatch ? nNFMatch[1] : '1';

    const serieMatch = xmlContent.match(/<serie>(\d+)<\/serie>/i);
    const series = serieMatch ? serieMatch[1] : '1';

    const dhEmiMatch = xmlContent.match(/<(?:dhEmi|dEmi)>([^<]+)<\/(?:dhEmi|dEmi)>/i);
    const issueDate = dhEmiMatch ? dhEmiMatch[1].substring(0, 10) : new Date().toISOString().substring(0, 10);

    // 3. Emitente (Fornecedor)
    let supplierDocument = '';
    const cnpjMatch = xmlContent.match(/<emit>[\s\S]*?<CNPJ>(\d+)<\/CNPJ>[\s\S]*?<\/emit>/i);
    if (cnpjMatch && cnpjMatch[1]) {
      supplierDocument = cnpjMatch[1];
    } else {
      const cpfMatch = xmlContent.match(/<emit>[\s\S]*?<CPF>(\d+)<\/CPF>[\s\S]*?<\/emit>/i);
      supplierDocument = cpfMatch ? cpfMatch[1] : '00000000000000';
    }

    const xNomeMatch = xmlContent.match(/<emit>[\s\S]*?<xNome>([^<]+)<\/xNome>[\s\S]*?<\/emit>/i);
    const supplierName = xNomeMatch ? xNomeMatch[1].trim() : 'Fornecedor XML';

    const ieMatch = xmlContent.match(/<emit>[\s\S]*?<IE>([^<]+)<\/IE>[\s\S]*?<\/emit>/i);
    const supplierStateRegistration = ieMatch ? ieMatch[1].trim() : undefined;

    // 4. Itens da NF-e (<det nItem="...">...</det>)
    const items: InboundInvoiceItem[] = [];
    const detRegex = /<det\s+nItem=["']\d+["']>([\s\S]*?)<\/det>/gi;
    let detMatch: RegExpExecArray | null;

    let itemCount = 0;
    while ((detMatch = detRegex.exec(xmlContent)) !== null) {
      itemCount++;
      const detBlock = detMatch[1];

      const cProdMatch = detBlock.match(/<cProd>([^<]+)<\/cProd>/i);
      const xProdMatch = detBlock.match(/<xProd>([^<]+)<\/xProd>/i);
      const ncmMatch = detBlock.match(/<NCM>([^<]+)<\/NCM>/i);
      const cfopMatch = detBlock.match(/<CFOP>([^<]+)<\/CFOP>/i);
      const uComMatch = detBlock.match(/<uCom>([^<]+)<\/uCom>/i);
      const qComMatch = detBlock.match(/<qCom>([^<]+)<\/qCom>/i);
      const vUnComMatch = detBlock.match(/<vUnCom>([^<]+)<\/vUnCom>/i);
      const vProdMatch = detBlock.match(/<vProd>([^<]+)<\/vProd>/i);
      const vDescMatch = detBlock.match(/<vDesc>([^<]+)<\/vDesc>/i);

      // Tributos do item
      const vICMSMatch = detBlock.match(/<vICMS>([^<]+)<\/vICMS>/i);
      const vIPIMatch = detBlock.match(/<vIPI>([^<]+)<\/vIPI>/i);
      const vPISMatch = detBlock.match(/<vPIS>([^<]+)<\/vPIS>/i);
      const vCOFINSMatch = detBlock.match(/<vCOFINS>([^<]+)<\/vCOFINS>/i);

      // Rastro / Lote
      const nLoteMatch = detBlock.match(/<nLote>([^<]+)<\/nLote>/i);
      const dValMatch = detBlock.match(/<dVal>([^<]+)<\/dVal>/i);

      const qty = qComMatch ? parseFloat(qComMatch[1]) : 1;
      const unitPrice = vUnComMatch ? parseFloat(vUnComMatch[1]) : 0;
      const totalAmount = vProdMatch ? parseFloat(vProdMatch[1]) : qty * unitPrice;

      items.push({
        id: `inbound-item-${itemCount}-${Date.now().toString(36)}`,
        productCodeSupplier: cProdMatch ? cProdMatch[1].trim() : `ITEM-${itemCount}`,
        productName: xProdMatch ? xProdMatch[1].trim() : `Item NF-e ${itemCount}`,
        ncm: ncmMatch ? ncmMatch[1].trim() : '84713012',
        cfop: cfopMatch ? cfopMatch[1].trim() : '1102', // CFOP de compra para comercialização
        unit: uComMatch ? uComMatch[1].trim().toUpperCase() : 'UN',
        quantity: qty,
        unitPrice,
        totalAmount,
        discountAmount: vDescMatch ? parseFloat(vDescMatch[1]) : 0,
        icmsAmount: vICMSMatch ? parseFloat(vICMSMatch[1]) : 0,
        ipiAmount: vIPIMatch ? parseFloat(vIPIMatch[1]) : 0,
        pisAmount: vPISMatch ? parseFloat(vPISMatch[1]) : 0,
        cofinsAmount: vCOFINSMatch ? parseFloat(vCOFINSMatch[1]) : 0,
        batchNumber: nLoteMatch ? nLoteMatch[1].trim() : `LOTE-${new Date().getFullYear()}${String(itemCount).padStart(3, '0')}`,
        expirationDate: dValMatch ? dValMatch[1].trim() : undefined,
      });
    }

    // Se nenhum item foi encontrado via det (por exemplo, XML simplificado), cria um item padrão
    if (items.length === 0) {
      items.push({
        id: `inbound-item-default-${Date.now().toString(36)}`,
        productCodeSupplier: 'MAT-GEN-01',
        productName: 'Mercadoria para Industrialização / Comercialização',
        ncm: '84713012',
        cfop: '1102',
        unit: 'UN',
        quantity: 10,
        unitPrice: 150.0,
        totalAmount: 1500.0,
        discountAmount: 0,
        icmsAmount: 270.0,
        ipiAmount: 0,
        pisAmount: 24.75,
        cofinsAmount: 114.0,
        batchNumber: `LOTE-${new Date().getFullYear()}001`,
      });
    }

    // 5. Totais Consolidados (<ICMSTot>)
    const vNFMatch = xmlContent.match(/<vNF>([^<]+)<\/vNF>/i);
    const vProdTotMatch = xmlContent.match(/<ICMSTot>[\s\S]*?<vProd>([^<]+)<\/vProd>[\s\S]*?<\/ICMSTot>/i);
    const vFreteMatch = xmlContent.match(/<ICMSTot>[\s\S]*?<vFrete>([^<]+)<\/vFrete>[\s\S]*?<\/ICMSTot>/i);
    const vSegMatch = xmlContent.match(/<ICMSTot>[\s\S]*?<vSeg>([^<]+)<\/vSeg>[\s\S]*?<\/ICMSTot>/i);
    const vDescTotMatch = xmlContent.match(/<ICMSTot>[\s\S]*?<vDesc>([^<]+)<\/vDesc>[\s\S]*?<\/ICMSTot>/i);
    const vIPITotMatch = xmlContent.match(/<vIPITot>([^<]+)<\/vIPITot>/i) || xmlContent.match(/<vIPI>([^<]+)<\/vIPI>/i);
    const vICMSTotMatch = xmlContent.match(/<ICMSTot>[\s\S]*?<vICMS>([^<]+)<\/vICMS>[\s\S]*?<\/ICMSTot>/i);
    const vPISTotMatch = xmlContent.match(/<ICMSTot>[\s\S]*?<vPIS>([^<]+)<\/vPIS>[\s\S]*?<\/ICMSTot>/i);
    const vCOFINSTotMatch = xmlContent.match(/<ICMSTot>[\s\S]*?<vCOFINS>([^<]+)<\/vCOFINS>[\s\S]*?<\/ICMSTot>/i);

    const netTotal = vNFMatch
      ? parseFloat(vNFMatch[1])
      : items.reduce((acc, it) => acc + it.totalAmount - it.discountAmount, 0);

    const totals = {
      products: vProdTotMatch ? parseFloat(vProdTotMatch[1]) : items.reduce((acc, it) => acc + it.totalAmount, 0),
      freight: vFreteMatch ? parseFloat(vFreteMatch[1]) : 0,
      insurance: vSegMatch ? parseFloat(vSegMatch[1]) : 0,
      discount: vDescTotMatch ? parseFloat(vDescTotMatch[1]) : items.reduce((acc, it) => acc + it.discountAmount, 0),
      ipi: vIPITotMatch ? parseFloat(vIPITotMatch[1]) : items.reduce((acc, it) => acc + it.ipiAmount, 0),
      icms: vICMSTotMatch ? parseFloat(vICMSTotMatch[1]) : items.reduce((acc, it) => acc + it.icmsAmount, 0),
      pis: vPISTotMatch ? parseFloat(vPISTotMatch[1]) : items.reduce((acc, it) => acc + it.pisAmount, 0),
      cofins: vCOFINSTotMatch ? parseFloat(vCOFINSTotMatch[1]) : items.reduce((acc, it) => acc + it.cofinsAmount, 0),
      netTotal,
    };

    // 6. Duplicatas / Faturas (<dup>)
    const installments: InboundInvoiceInstallment[] = [];
    const dupRegex = /<dup>([\s\S]*?)<\/dup>/gi;
    let dupMatch: RegExpExecArray | null;
    let dupCount = 0;

    while ((dupMatch = dupRegex.exec(xmlContent)) !== null) {
      dupCount++;
      const dupBlock = dupMatch[1];
      const nDupMatch = dupBlock.match(/<nDup>([^<]+)<\/nDup>/i);
      const dVencMatch = dupBlock.match(/<dVenc>([^<]+)<\/dVenc>/i);
      const vDupMatch = dupBlock.match(/<vDup>([^<]+)<\/vDup>/i);

      installments.push({
        id: `inst-${dupCount}-${Date.now().toString(36)}`,
        number: nDupMatch ? nDupMatch[1].trim() : String(dupCount).padStart(3, '0'),
        dueDate: dVencMatch ? dVencMatch[1].trim() : issueDate,
        amount: vDupMatch ? parseFloat(vDupMatch[1]) : netTotal,
      });
    }

    // Se nenhuma duplicata declarada, cria 1 parcela com vencimento para 30 dias
    if (installments.length === 0) {
      const defaultDue = new Date();
      defaultDue.setDate(defaultDue.getDate() + 30);
      installments.push({
        id: `inst-1-${Date.now().toString(36)}`,
        number: '001',
        dueDate: defaultDue.toISOString().substring(0, 10),
        amount: netTotal,
      });
    }

    return {
      accessKey,
      number,
      series,
      issueDate,
      supplier: {
        document: supplierDocument,
        name: supplierName,
        stateRegistration: supplierStateRegistration,
      },
      items,
      totals,
      installments,
    };
  }

  /**
   * Gera XML sintético oficial para testes rápidos e demonstração
   */
  public static generateSampleNFeXml(params: {
    supplierName: string;
    supplierCnpj: string;
    supplierIe?: string;
    orderNumber?: string;
    items?: Array<{
      code: string;
      name: string;
      qty: number;
      price: number;
      ncm: string;
      cfop: string;
      batch?: string;
    }>;
  }): string {
    const accessKey = `352609${params.supplierCnpj.replace(/\D/g, '').padEnd(14, '0')}550010000045821098765432`;
    const today = new Date().toISOString().substring(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10);

    const items = params.items && params.items.length > 0 ? params.items : [
      {
        code: 'PROD-IND-100',
        name: 'Aço Laminado Galvanizado 1.2mm x 1200mm (Bobina)',
        qty: 5,
        price: 1850.0,
        ncm: '72104910',
        cfop: '1101',
        batch: 'LOTE-GERDAU-2026-A1',
      },
      {
        code: 'PARAF-INOX-M8',
        name: 'Fixadores e Parafusos Sextavados Inox 316 M8x50mm',
        qty: 200,
        price: 4.80,
        ncm: '73181500',
        cfop: '1101',
        batch: 'LOTE-INOX-994',
      },
    ];

    const totalProd = items.reduce((acc, it) => acc + (it.qty * it.price), 0);
    const totalIpi = totalProd * 0.05;
    const totalIcms = totalProd * 0.18;
    const totalPis = totalProd * 0.0165;
    const totalCofins = totalProd * 0.076;
    const netTotal = totalProd + totalIpi;

    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe versao="4.00" Id="NFe${accessKey}">
      <ide>
        <cUF>35</cUF>
        <cNF>09876543</cNF>
        <natOp>Venda de Mercadoria Producao do Estabelecimento</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>4582</nNF>
        <dhEmi>${today}T08:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>2</cDV>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>${params.supplierCnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${params.supplierName}</xNome>
        <xFant>${params.supplierName.split(' ')[0]}</xFant>
        <enderEmit>
          <xLgr>Avenida das Indústrias Metalúrgicas</xLgr>
          <nro>4500</nro>
          <xBairro>Distrito Industrial</xBairro>
          <cMun>3550308</cMun>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
          <CEP>04571010</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderEmit>
        <IE>${params.supplierIe || '109876543110'}</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>12345678000195</CNPJ>
        <xNome>Empresa Alfa Logistica e Tecnologia Ltda</xNome>
        <enderDest>
          <xLgr>Av Paulista</xLgr>
          <nro>1000</nro>
          <xBairro>Bela Vista</xBairro>
          <cMun>3550308</cMun>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
          <CEP>01310100</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderDest>
        <indIEDest>1</indIEDest>
        <IE>112233445566</IE>
      </dest>
      ${items.map((it, idx) => `
      <det nItem="${idx + 1}">
        <prod>
          <cProd>${it.code}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${it.name}</xProd>
          <NCM>${it.ncm}</NCM>
          <CFOP>${it.cfop}</CFOP>
          <uCom>UN</uCom>
          <qCom>${it.qty.toFixed(4)}</qCom>
          <vUnCom>${it.price.toFixed(4)}</vUnCom>
          <vProd>${(it.qty * it.price).toFixed(2)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>${it.qty.toFixed(4)}</qTrib>
          <vUnTrib>${it.price.toFixed(4)}</vUnTrib>
          <indTot>1</indTot>
          <rastro>
            <nLote>${it.batch || `LOTE-${idx + 1}`}</nLote>
            <qLote>${it.qty.toFixed(3)}</qLote>
            <dFab>${today}</dFab>
            <dVal>${new Date(Date.now() + 365 * 86400000).toISOString().substring(0, 10)}</dVal>
          </rastro>
        </prod>
        <imposto>
          <vTotTrib>${(it.qty * it.price * 0.31).toFixed(2)}</vTotTrib>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <modBC>3</modBC>
              <vBC>${(it.qty * it.price).toFixed(2)}</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>${(it.qty * it.price * 0.18).toFixed(2)}</vICMS>
            </ICMS00>
          </ICMS>
          <IPI>
            <cEnq>999</cEnq>
            <IPITrib>
              <CST>50</CST>
              <vBC>${(it.qty * it.price).toFixed(2)}</vBC>
              <pIPI>5.00</pIPI>
              <vIPI>${(it.qty * it.price * 0.05).toFixed(2)}</vIPI>
            </IPITrib>
          </IPI>
          <PIS>
            <PISAliq>
              <CST>01</CST>
              <vBC>${(it.qty * it.price).toFixed(2)}</vBC>
              <pPIS>1.65</pPIS>
              <vPIS>${(it.qty * it.price * 0.0165).toFixed(2)}</vPIS>
            </PISAliq>
          </PIS>
          <COFINS>
            <COFINSAliq>
              <CST>01</CST>
              <vBC>${(it.qty * it.price).toFixed(2)}</vBC>
              <pCOFINS>7.60</pCOFINS>
              <vCOFINS>${(it.qty * it.price * 0.076).toFixed(2)}</vCOFINS>
            </COFINSAliq>
          </COFINS>
        </imposto>
      </det>`).join('')}
      <total>
        <ICMSTot>
          <vBC>${totalProd.toFixed(2)}</vBC>
          <vICMS>${totalIcms.toFixed(2)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>${totalProd.toFixed(2)}</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>${totalIpi.toFixed(2)}</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>${totalPis.toFixed(2)}</vPIS>
          <vCOFINS>${totalCofins.toFixed(2)}</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>${netTotal.toFixed(2)}</vNF>
          <vTotTrib>${(totalProd * 0.31).toFixed(2)}</vTotTrib>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>0</modFrete>
      </transp>
      <cobr>
        <fat>
          <nFat>4582</nFat>
          <vOrig>${netTotal.toFixed(2)}</vOrig>
          <vDesc>0.00</vDesc>
          <vLiq>${netTotal.toFixed(2)}</vLiq>
        </fat>
        <dup>
          <nDup>001</nDup>
          <dVenc>${nextMonth}</dVenc>
          <vDup>${netTotal.toFixed(2)}</vDup>
        </dup>
      </cobr>
      <infAdic>
        <infCpl>Pedido de Compra Ref: ${params.orderNumber || 'PC-0001'}. Mercadoria entregue com seguro e garantia de procedência.</infCpl>
      </infAdic>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SP_NFE_PL_009_V4</verAplic>
      <chNFe>${accessKey}</chNFe>
      <dhRecbto>${today}T08:35:12-03:00</dhRecbto>
      <nProt>135260000124875</nProt>
      <digVal>j8+Zc6hF4D9aVw1Q2rTYUi3O9v8=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
  }
}
