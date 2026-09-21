/**
 * Enlace ERP - Motor Fiscal & Tributário Brasileiro
 * PRD 07 - Gestão Fiscal, Tributação Brasileira, Emissão Eletrônica (NF-e, NFS-e, NFC-e) e SPED
 */

import {
  FiscalDocument,
  FiscalItem,
  FiscalDocumentModel,
  FiscalOperation,
  TaxRegime,
  SpedBlockSummary,
} from '../../shared/types.js';

export class FiscalMath {
  static round(val: number, decimals: number = 2): number {
    if (isNaN(val) || !isFinite(val)) return 0.0;
    const factor = Math.pow(10, decimals);
    return Math.round((val + Number.EPSILON) * factor) / factor;
  }

  /**
   * Cálculo de impostos de um item com base na operação e regime
   */
  static calculateItemTaxes(
    item: {
      quantity: number;
      unitPrice: number;
      discount?: number;
      ncm: string;
      cfop: string;
      isService?: boolean;
      icmsRate?: number;
      icmsCst?: string;
      ipiRate?: number;
      pisRate?: number;
      cofinsRate?: number;
      issRate?: number;
      issWithheld?: boolean;
    },
    companyRegime: TaxRegime = 'SIMPLES_NACIONAL'
  ): {
    totalPrice: number;
    discount: number;
    netTotal: number;
    icmsBase: number;
    icmsRate: number;
    icmsValue: number;
    icmsCst: string;
    ipiBase: number;
    ipiRate: number;
    ipiValue: number;
    pisBase: number;
    pisRate: number;
    pisValue: number;
    cofinsBase: number;
    cofinsRate: number;
    cofinsValue: number;
    issBase: number;
    issRate: number;
    issValue: number;
    approximateTaxes: number;
  } {
    const qty = Math.max(0, item.quantity);
    const price = Math.max(0, item.unitPrice);
    const totalPrice = this.round(qty * price, 2);
    const discount = this.round(Math.min(item.discount || 0, totalPrice), 2);
    const netTotal = this.round(totalPrice - discount, 2);

    if (item.isService) {
      // Serviços (NFS-e): foco em ISS e retenções
      const issRate = item.issRate !== undefined ? item.issRate : 5.0; // 5% padrão municipal
      const issBase = netTotal;
      const issValue = this.round(issBase * (issRate / 100), 2);
      // PIS/COFINS em serviços para Lucro Presumido/Real
      let pisRate = 0;
      let cofinsRate = 0;
      if (companyRegime === 'LUCRO_PRESUMIDO') {
        pisRate = 0.65;
        cofinsRate = 3.0;
      } else if (companyRegime === 'LUCRO_REAL') {
        pisRate = 1.65;
        cofinsRate = 7.6;
      }
      const pisBase = pisRate > 0 ? netTotal : 0;
      const pisValue = this.round(pisBase * (pisRate / 100), 2);
      const cofinsBase = cofinsRate > 0 ? netTotal : 0;
      const cofinsValue = this.round(cofinsBase * (cofinsRate / 100), 2);
      const approximateTaxes = this.round(netTotal * 0.1345, 2); // ~13.45% IBPT médio

      return {
        totalPrice,
        discount,
        netTotal,
        icmsBase: 0,
        icmsRate: 0,
        icmsValue: 0,
        icmsCst: '00',
        ipiBase: 0,
        ipiRate: 0,
        ipiValue: 0,
        pisBase,
        pisRate,
        pisValue,
        cofinsBase,
        cofinsRate,
        cofinsValue,
        issBase,
        issRate,
        issValue,
        approximateTaxes,
      };
    }

    // Mercadorias / Produtos (NF-e 55 / NFC-e 65)
    let icmsRate = item.icmsRate !== undefined ? item.icmsRate : 18.0; // Alíquota padrão interna SP
    let icmsCst = item.icmsCst || (companyRegime === 'SIMPLES_NACIONAL' ? '102' : '00');
    let icmsBase = netTotal;
    let icmsValue = 0;

    if (companyRegime === 'SIMPLES_NACIONAL') {
      // Simples Nacional: ICMS embutido no DAS, não gera débito normal no item (CSOSN 102/500)
      icmsValue = 0;
      icmsRate = 0;
    } else {
      icmsValue = this.round(icmsBase * (icmsRate / 100), 2);
    }

    // IPI
    const ipiRate = item.ipiRate || 0;
    const ipiBase = ipiRate > 0 ? netTotal : 0;
    const ipiValue = this.round(ipiBase * (ipiRate / 100), 2);

    // PIS & COFINS
    let pisRate = item.pisRate !== undefined ? item.pisRate : 0;
    let cofinsRate = item.cofinsRate !== undefined ? item.cofinsRate : 0;
    if (companyRegime === 'LUCRO_PRESUMIDO') {
      pisRate = 0.65;
      cofinsRate = 3.0;
    } else if (companyRegime === 'LUCRO_REAL') {
      pisRate = 1.65;
      cofinsRate = 7.6;
    }
    const pisBase = pisRate > 0 ? netTotal : 0;
    const pisValue = this.round(pisBase * (pisRate / 100), 2);
    const cofinsBase = cofinsRate > 0 ? netTotal : 0;
    const cofinsValue = this.round(cofinsBase * (cofinsRate / 100), 2);

    // Transparência Fiscal (IBPT Lei 12.741/2012)
    const approximateTaxes = this.round(netTotal * 0.224, 2); // ~22.4% carga tributária estimada

    return {
      totalPrice,
      discount,
      netTotal,
      icmsBase,
      icmsRate,
      icmsValue,
      icmsCst,
      ipiBase,
      ipiRate,
      ipiValue,
      pisBase,
      pisRate,
      pisValue,
      cofinsBase,
      cofinsRate,
      cofinsValue,
      issBase: 0,
      issRate: 0,
      issValue: 0,
      approximateTaxes,
    };
  }

  /**
   * Cálculo de Módulo 11 para o Dígito Verificador (DV) da Chave de Acesso da NF-e
   * Pesos de 2 a 9 da direita para a esquerda
   */
  static calculateModulo11(digits43: string): number {
    let sum = 0;
    let weight = 2;

    for (let i = digits43.length - 1; i >= 0; i--) {
      sum += parseInt(digits43[i], 10) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }

    const remainder = sum % 11;
    const dv = 11 - remainder;
    return dv >= 10 ? 0 : dv;
  }

  /**
   * Gerador Oficial de Chave de Acesso NF-e (44 dígitos numéricos)
   * Estrutura:
   * cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + serie (3) + nNF (9) + tpEmis (1) + cNF (8) + cDV (1)
   */
  static generateAccessKey(params: {
    ufCode?: string; // padrão 35 (SP)
    issueDate: string; // YYYY-MM-DD
    cnpj: string;
    model: FiscalDocumentModel;
    series: string;
    number: number;
    numericCode?: string; // 8 dígitos
  }): string {
    const uf = (params.ufCode || '35').padStart(2, '0');
    const parts = params.issueDate.split('-');
    const aamm = parts.length >= 2 ? `${parts[0].slice(2, 4)}${parts[1]}` : '2609';
    const cleanCnpj = params.cnpj.replace(/\D/g, '').padStart(14, '0');
    const mod = params.model === 'NFCE_65' ? '65' : '55';
    const serie = String(params.series || '1').padStart(3, '0');
    const nNF = String(params.number).padStart(9, '0');
    const tpEmis = '1'; // 1 = Normal
    const cNF = (params.numericCode || String(Math.floor(10000000 + Math.random() * 90000000))).padStart(8, '0');

    const first43 = `${uf}${aamm}${cleanCnpj}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    const dv = this.calculateModulo11(first43);
    return `${first43}${dv}`;
  }

  /**
   * Gerador de Protocolo SEFAZ / Prefeitura simulado
   */
  static generateProtocol(model: FiscalDocumentModel, issueDate: string): string {
    const cleanDate = issueDate.replace(/-/g, '');
    const prefix = model === 'NFSE' ? 'RPS-PREF' : 'SEFAZ-AUT';
    const randomSeq = Math.floor(100000000 + Math.random() * 900000000);
    return `${prefix}-${cleanDate}-${randomSeq}`;
  }
}

export class FiscalXmlGenerator {
  /**
   * Gera XML estruturado compatível com o layout oficial da SEFAZ (v4.00)
   */
  static generateNFeXml(doc: FiscalDocument, company: { legalName: string; tradeName?: string; cnpj: string; stateRegistration?: string }): string {
    const isProduct = doc.model === 'NFE_55' || doc.model === 'NFCE_65';

    if (!isProduct) {
      // NFS-e (RPS XML)
      return `<?xml version="1.0" encoding="UTF-8"?>
<RPS xmlns="http://www.prefeitura.sp.gov.br/nfse">
  <IdentificacaoRps>
    <Numero>${doc.number}</Numero>
    <Serie>${doc.series}</Serie>
    <Tipo>1</Tipo>
  </IdentificacaoRps>
  <DataEmissao>${doc.issueDate}T${doc.issueTime}</DataEmissao>
  <NaturezaOperacao>${doc.natureOfOperation}</NaturezaOperacao>
  <RegimeEspecialTributacao>1</RegimeEspecialTributacao>
  <OptanteSimplesNacional>1</OptanteSimplesNacional>
  <Prestador>
    <CpfCnpj><Cnpj>${company.cnpj.replace(/\D/g, '')}</Cnpj></CpfCnpj>
    <RazaoSocial>${company.legalName}</RazaoSocial>
  </Prestador>
  <Tomador>
    <CpfCnpj><Cnpj>${doc.partnerCnpjCpf.replace(/\D/g, '')}</Cnpj></CpfCnpj>
    <RazaoSocial>${doc.partnerName}</RazaoSocial>
  </Tomador>
  <Servico>
    <Valores>
      <ValorServicos>${doc.totalServices.toFixed(2)}</ValorServicos>
      <ValorDeducoes>0.00</ValorDeducoes>
      <ValorPis>${doc.totalPIS.toFixed(2)}</ValorPis>
      <ValorCofins>${doc.totalCOFINS.toFixed(2)}</ValorCofins>
      <ValorIss>${doc.totalISS.toFixed(2)}</ValorIss>
      <Aliquota>${(doc.items[0]?.issRate || 5).toFixed(2)}</Aliquota>
      <ValorLiquidoNfse>${doc.netTotal.toFixed(2)}</ValorLiquidoNfse>
    </Valores>
    <ItemListaServico>${doc.items[0]?.serviceCode || '01.07'}</ItemListaServico>
    <Discriminacao>${doc.items.map(i => `${i.productName}: R$ ${i.netTotal.toFixed(2)}`).join('; ')}</Discriminacao>
  </Servico>
</RPS>`;
    }

    // NF-e Produto v4.00
    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe${doc.accessKey}" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>${doc.accessKey.slice(35, 43)}</cNF>
        <natOp>${doc.natureOfOperation}</natOp>
        <mod>${doc.model === 'NFCE_65' ? '65' : '55'}</mod>
        <serie>${doc.series}</serie>
        <nNF>${doc.number}</nNF>
        <dhEmi>${doc.issueDate}T${doc.issueTime}-03:00</dhEmi>
        <tpNF>${doc.type === 'OUTBOUND' ? '1' : '0'}</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>${doc.accessKey.slice(43, 44)}</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>EnlaceERP-v2.6</verProc>
      </ide>
      <emit>
        <CNPJ>${company.cnpj.replace(/\D/g, '')}</CNPJ>
        <xNome>${company.legalName}</xNome>
        <xFant>${company.tradeName || company.legalName}</xFant>
        <enderEmit>
          <xLgr>Avenida Paulista</xLgr>
          <nro>1000</nro>
          <xBairro>Bela Vista</xBairro>
          <cMun>3550308</cMun>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
          <CEP>01310100</CEP>
        </enderEmit>
        <IE>${company.stateRegistration || 'ISENTO'}</IE>
        <CRT>1</CRT>
      </emit>
      <dest>
        <CNPJ>${doc.partnerCnpjCpf.replace(/\D/g, '')}</CNPJ>
        <xNome>${doc.partnerName}</xNome>
        <enderDest>
          <xLgr>${doc.partnerAddress.street}</xLgr>
          <nro>${doc.partnerAddress.number}</nro>
          <xBairro>${doc.partnerAddress.neighborhood}</xBairro>
          <cMun>3550308</cMun>
          <xMun>${doc.partnerAddress.city}</xMun>
          <UF>${doc.partnerAddress.state}</UF>
          <CEP>${doc.partnerAddress.zipCode.replace(/\D/g, '')}</CEP>
        </enderDest>
        <indIEDest>9</indIEDest>
      </dest>
      <det>
${doc.items
  .map(
    (item, index) => `        <det nItem="${index + 1}">
          <prod>
            <cProd>${item.productCode}</cProd>
            <cEAN>SEM GTIN</cEAN>
            <xProd>${item.productName}</xProd>
            <NCM>${item.ncm.replace(/\D/g, '')}</NCM>
            <CFOP>${item.cfop.replace(/\D/g, '')}</CFOP>
            <uCom>${item.unit}</uCom>
            <qCom>${item.quantity.toFixed(4)}</qCom>
            <vUnCom>${item.unitPrice.toFixed(4)}</vUnCom>
            <vProd>${item.totalPrice.toFixed(2)}</vProd>
            <vDesc>${item.discount.toFixed(2)}</vDesc>
            <uTrib>${item.unit}</uTrib>
            <qTrib>${item.quantity.toFixed(4)}</qTrib>
            <vUnTrib>${item.unitPrice.toFixed(4)}</vUnTrib>
            <indTot>1</indTot>
          </prod>
          <imposto>
            <vTotTrib>${item.approximateTaxes.toFixed(2)}</vTotTrib>
            <ICMS>
              <ICMSSN102>
                <orig>0</orig>
                <CSOSN>102</CSOSN>
              </ICMSSN102>
            </ICMS>
            <PIS>
              <PISNT>
                <CST>07</CST>
              </PISNT>
            </PIS>
            <COFINS>
              <COFINSNT>
                <CST>07</CST>
              </COFINSNT>
            </COFINS>
          </imposto>
        </det>`
  )
  .join('\n')}
      </det>
      <total>
        <ICMSTot>
          <vBC>${doc.totalTaxableAmount.toFixed(2)}</vBC>
          <vICMS>${doc.totalICMS.toFixed(2)}</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vProd>${doc.totalProducts.toFixed(2)}</vProd>
          <vFrete>${doc.totalFreight.toFixed(2)}</vFrete>
          <vSeg>${doc.totalInsurance.toFixed(2)}</vSeg>
          <vDesc>${doc.totalDiscounts.toFixed(2)}</vDesc>
          <vII>0.00</vII>
          <vIPI>${doc.totalIPI.toFixed(2)}</vIPI>
          <vPIS>${doc.totalPIS.toFixed(2)}</vPIS>
          <vCOFINS>${doc.totalCOFINS.toFixed(2)}</vCOFINS>
          <vOutro>${doc.totalOtherExpenses.toFixed(2)}</vOutro>
          <vNF>${doc.netTotal.toFixed(2)}</vNF>
          <vTotTrib>${doc.totalApproximateTaxes.toFixed(2)}</vTotTrib>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>SP_NFE_PL_009_V4</verAplic>
      <chNFe>${doc.accessKey}</chNFe>
      <dhRecbto>${doc.authorizedAt || doc.issueDate + 'T' + doc.issueTime + '-03:00'}</dhRecbto>
      <nProt>${doc.protocolNumber || '135260000000000'}</nProt>
      <digVal>EnlaceERP/HashSHA1Valid==</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
  }
}

export class SpedFiscalEngine {
  /**
   * Gera o arquivo de EFD ICMS/IPI (SPED Fiscal) formatado em pipe delimiter (|)
   */
  static generateSpedEfd(
    month: number,
    year: number,
    company: { legalName: string; cnpj: string; stateRegistration?: string; state?: string },
    documents: FiscalDocument[]
  ): { text: string; summary: SpedBlockSummary[] } {
    const padMonth = String(month).padStart(2, '0');
    const dtIni = `01${padMonth}${year}`;
    const lastDay = new Date(year, month, 0).getDate();
    const dtFin = `${String(lastDay).padStart(2, '0')}${padMonth}${year}`;
    const cleanCnpj = company.cnpj.replace(/\D/g, '');

    const lines: string[] = [];

    // BLOCO 0: Abertura, Identificação e Referências
    lines.push(`|0000|018|0|${dtIni}|${dtFin}|${company.legalName}|${cleanCnpj}|${company.state || 'SP'}|${company.stateRegistration || 'ISENTO'}|3550308|||A|1|`);
    lines.push(`|0001|0|`);
    lines.push(`|0005|ENLACE ERP|01310100|AVENIDA PAULISTA|1000||BELA VISTA|1130000000||CONTATO@ENLACE.COM.BR|`);
    lines.push(`|0100|ANA SILVA CONTABILIDADE|00000000000|CRC123456/SP|00000000000100|01310100|RUA BOA VISTA|200||CENTRO|1131110000||CONTADOR@ENLACE.COM.BR|3550308|`);

    // Participantes (Clientes/Parceiros)
    const partnersMap = new Map<string, FiscalDocument>();
    documents.forEach((d) => {
      if (!partnersMap.has(d.partnerCnpjCpf)) {
        partnersMap.set(d.partnerCnpjCpf, d);
      }
    });

    partnersMap.forEach((doc, cnpjCpf) => {
      lines.push(`|0150|PART_${cnpjCpf.replace(/\D/g, '')}|${doc.partnerName}|1058|${cnpjCpf.replace(/\D/g, '')}||${doc.partnerAddress.state}|3550308||${doc.partnerAddress.street}|${doc.partnerAddress.number}||${doc.partnerAddress.neighborhood}|`);
    });

    lines.push(`|0990|${lines.length + 1}|`);
    const countBloco0 = lines.length;

    // BLOCO C: Documentos Fiscais I - Mercadorias (ICMS/IPI)
    const blocoCStartIndex = lines.length;
    lines.push(`|C001|0|`);

    const authorizedNFe = documents.filter((d) => d.status === 'AUTHORIZED' && (d.model === 'NFE_55' || d.model === 'NFCE_65'));
    authorizedNFe.forEach((doc) => {
      const dtEmi = doc.issueDate.replace(/-/g, '');
      const indOper = doc.type === 'OUTBOUND' ? '1' : '0';
      const codPart = `PART_${doc.partnerCnpjCpf.replace(/\D/g, '')}`;
      // C100: Registro de NF-e
      lines.push(`|C100|${indOper}|0|${codPart}|55|00|${doc.series}|${doc.number}|${doc.accessKey}|${dtEmi}|${dtEmi}|${doc.netTotal.toFixed(2)}|1|0.00|${doc.totalDiscounts.toFixed(2)}|0.00|${doc.totalProducts.toFixed(2)}|9|${doc.totalFreight.toFixed(2)}|${doc.totalInsurance.toFixed(2)}|${doc.totalOtherExpenses.toFixed(2)}|${doc.totalTaxableAmount.toFixed(2)}|${doc.totalICMS.toFixed(2)}|0.00|0.00|${doc.totalIPI.toFixed(2)}|${doc.totalPIS.toFixed(2)}|${doc.totalCOFINS.toFixed(2)}|0.00|0.00|`);
      // C190: Registro Analítico do Documento (por CFOP e Alíquota)
      lines.push(`|C190|102|${doc.cfopPrincipal.replace(/\D/g, '')}|18.00|${doc.totalTaxableAmount.toFixed(2)}|${doc.totalTaxableAmount.toFixed(2)}|${doc.totalICMS.toFixed(2)}|0.00|0.00|0.00|0.00||`);
    });

    lines.push(`|C990|${lines.length - blocoCStartIndex + 1}|`);
    const countBlocoC = lines.length - blocoCStartIndex;

    // BLOCO E: Apuração do ICMS e do IPI
    const blocoEStartIndex = lines.length;
    lines.push(`|E001|0|`);
    lines.push(`|E100|${dtIni}|${dtFin}|`);
    const totalIcms = authorizedNFe.reduce((acc, d) => acc + d.totalICMS, 0);
    lines.push(`|E110|${totalIcms.toFixed(2)}|0.00|${totalIcms.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${totalIcms.toFixed(2)}|0.00|0.00|`);
    lines.push(`|E990|${lines.length - blocoEStartIndex + 1}|`);
    const countBlocoE = lines.length - blocoEStartIndex;

    // BLOCO 9: Controle e Encerramento do Arquivo Digital
    const bloco9StartIndex = lines.length;
    lines.push(`|9001|0|`);
    lines.push(`|9900|0000|1|`);
    lines.push(`|9900|0001|1|`);
    lines.push(`|9900|C001|1|`);
    lines.push(`|9900|C100|${authorizedNFe.length}|`);
    lines.push(`|9900|E001|1|`);
    lines.push(`|9900|9001|1|`);
    lines.push(`|9990|${lines.length - bloco9StartIndex + 2}|`);
    lines.push(`|9999|${lines.length + 1}|`);
    const countBloco9 = lines.length - bloco9StartIndex;

    const summary: SpedBlockSummary[] = [
      {
        block: 'Bloco 0',
        name: 'Abertura, Identificação e Cadastros',
        recordCount: countBloco0,
        description: 'Dados da entidade jurídica, contabilista responsável e cadastro de participantes (clientes e fornecedores).',
      },
      {
        block: 'Bloco C',
        name: 'Documentos Fiscais I - Mercadorias',
        recordCount: countBlocoC,
        description: 'Notas fiscais de produtos (NF-e mod. 55 e NFC-e mod. 65), registros analíticos C100 e C190.',
      },
      {
        block: 'Bloco E',
        name: 'Apuração do ICMS e IPI',
        recordCount: countBlocoE,
        description: 'Consolidação mensal de débitos, créditos, ajustes e saldo devedor/credor do imposto estadual.',
      },
      {
        block: 'Bloco 9',
        name: 'Controle e Encerramento Digital',
        recordCount: countBloco9,
        description: 'Contador de integridade de registros conforme o Guia Prático da EFD Fiscal RFB.',
      },
    ];

    return {
      text: lines.join('\r\n'),
      summary,
    };
  }
}
