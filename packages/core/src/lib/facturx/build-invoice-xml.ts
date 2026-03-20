import type { GeneratePdfInput } from '../pdf/generate-pdf.js';
import type { TeamField } from '@tuldio/common';

/**
 * Build CII XML (EN 16931 profile) for Factur-X from invoice data.
 *
 * All amounts are stored as cents (integers) in Tuldio -- converted to EUR (2 decimals) here.
 * TVA rates are stored as basis points (e.g. 2000 = 20%) -- converted to percentage here.
 */
export function buildInvoiceXml(input: GeneratePdfInput): string {
  const typeCode = input.invoiceType === 'avoir' ? '381' : '380';
  const issueDate = formatCiiDate(input.createdAt);
  const dueDate = input.dueDate ? formatCiiDate(input.dueDate) : null;

  const sellerSiret = getFieldValue(input.team.fields, 'siret');
  const sellerAddress = getFieldValue(input.team.fields, 'address');
  const sellerTva = getFieldValue(input.team.fields, 'tva_number');
  const sellerIban = getFieldValue(input.team.fields, 'iban');

  const lines = input.lines.map((line, i) => buildLineXml(line, i + 1));
  const tvaBreakdown = input.tvaGroups.map(buildTvaGroupXml);

  // Total TVA = TTC - HT
  const totalTva = input.totalTtc - input.totalHt;

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${escXml(input.number)}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lines.join('\n')}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escXml(input.team.name)}</ram:Name>
${sellerSiret ? `        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escXml(sellerSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
${sellerAddress ? `          <ram:LineOne>${escXml(sellerAddress)}</ram:LineOne>` : ''}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
${sellerTva ? `        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escXml(sellerTva)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escXml(input.client.name)}</ram:Name>
${input.client.siret ? `        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${escXml(input.client.siret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
${input.client.address ? `          <ram:LineOne>${escXml(input.client.address)}</ram:LineOne>` : ''}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
${input.client.tvaNumber ? `        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${escXml(input.client.tvaNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
${sellerIban ? `      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>30</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${escXml(sellerIban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ''}
${tvaBreakdown.join('\n')}
${dueDate ? `      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dueDate}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>` : ''}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${centsToEur(input.totalHt)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${centsToEur(input.totalHt)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${centsToEur(totalTva)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${centsToEur(input.totalTtc)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${centsToEur(input.totalTtc)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

function buildLineXml(line: GeneratePdfInput['lines'][number], lineNumber: number): string {
  const tvaPercent = basisPointsToPercent(line.tvaRate);
  const categoryCode = vatCategoryCode(line.tvaRate);

  return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${lineNumber}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escXml(line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${centsToEur(line.unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${escXml(mapUnitCode(line.unit))}">${line.quantity}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${tvaPercent}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${centsToEur(line.totalHt)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
}

function buildTvaGroupXml(group: GeneratePdfInput['tvaGroups'][number]): string {
  const tvaPercent = basisPointsToPercent(group.tvaRate);
  const categoryCode = vatCategoryCode(group.tvaRate);

  return `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${centsToEur(group.tvaMontant)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${centsToEur(group.baseHt)}</ram:BasisAmount>
        <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${tvaPercent}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`;
}

/** Map TVA rate (basis points) to EN 16931 VAT category code. */
function vatCategoryCode(tvaRateBasisPoints: number): string {
  // S = Standard rate (> 0%), E = Exempt (0%)
  return tvaRateBasisPoints > 0 ? 'S' : 'E';
}

/** Convert cents (integer) to EUR string with 2 decimals. */
function centsToEur(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Convert basis points (e.g. 2000) to percentage string (e.g. "20.00"). */
function basisPointsToPercent(basisPoints: number): string {
  return (basisPoints / 100).toFixed(2);
}

/** Format date as YYYYMMDD for CII DateTimeString format="102". */
function formatCiiDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Escape XML special characters. */
function escXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Get a field value by key (no visibility filter -- XML needs all data). */
function getFieldValue(fields: TeamField[], key: string): string {
  const field = fields.find((f) => f.key === key);
  return field?.value ?? '';
}

/** Map Tuldio unit names to UN/ECE Recommendation 20 codes. */
function mapUnitCode(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  const map: Record<string, string> = {
    'u': 'C62',
    'unite': 'C62',
    'unité': 'C62',
    'h': 'HUR',
    'heure': 'HUR',
    'heures': 'HUR',
    'j': 'DAY',
    'jour': 'DAY',
    'jours': 'DAY',
    'm': 'MTR',
    'metre': 'MTR',
    'mètre': 'MTR',
    'm2': 'MTK',
    'm²': 'MTK',
    'kg': 'KGM',
    'l': 'LTR',
    'litre': 'LTR',
    'lot': 'C62',
    'forfait': 'C62',
  };
  return map[normalized] ?? 'C62';
}
