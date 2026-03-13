import {
  CSS,
  esc,
  formatCurrency,
  formatDate,
  formatSiret,
  isSameDay,
  getField,
  getBooleanField,
  getCustomFields,
  renderLegalMentions,
  type PdfTeam,
  type PdfClient,
  type PdfLine,
  type PdfTvaGroup,
} from './shared.js';

function formatTvaRate(basisPoints: number): string {
  const percent = basisPoints / 100;
  return Number.isInteger(percent) ? `${percent}` : percent.toFixed(1);
}

export function renderInvoiceHtml(input: {
  team: PdfTeam;
  client: PdfClient;
  number: string;
  lines: PdfLine[];
  totalHt: number;
  totalTtc: number;
  tvaGroups: PdfTvaGroup[];
  createdAt: Date;
  dueDate: Date | null;
  prestationDate: Date | null;
  invoiceType?: string;
  sourceInvoiceNumber?: string | null;
  situationNumber?: number | null;
}): string {
  const { team, client, number, lines, totalHt, totalTtc, tvaGroups, createdAt, dueDate, prestationDate } = input;
  const f = team.fields;
  const dt = 'invoice' as const;
  const legal = renderLegalMentions(f, dt);

  const siret = getField(f, 'siret', dt);
  const address = getField(f, 'address', dt);
  const phone = getField(f, 'phone', dt);
  const mobile = getField(f, 'mobile', dt);
  const email = getField(f, 'email', dt);
  const website = getField(f, 'website', dt);
  const tvaNumber = getField(f, 'tva_number', dt);
  const tvaExempt = getBooleanField(f, 'tva_exempt', dt);
  const logoUrl = team.logoUrl;
  const paymentTerms = getField(f, 'payment_terms', dt);
  const iban = getField(f, 'iban', dt);

  const hasMixedTva = tvaGroups.length > 1;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>${CSS}</style>
</head>
<body>

  <!-- Top row -->
  <div class="top-row">
    <div class="company-col">
      ${logoUrl ? `<div class="logo-box"><img src="${esc(logoUrl)}" alt="Logo"></div>` : ''}
      <div class="company-name">${esc(team.name)}</div>
      <div class="company-info">
        ${siret ? `SIRET ${formatSiret(siret)}<br>` : ''}
        ${address ? `${esc(address)}<br>` : ''}
        ${phone ? `${esc(phone)}` : ''}${mobile ? `${phone ? ' / ' : ''}${esc(mobile)}` : ''}${phone || mobile ? '<br>' : ''}
        ${email ? `${esc(email)}<br>` : ''}
        ${website ? `${esc(website)}<br>` : ''}
        ${tvaNumber ? `TVA ${esc(tvaNumber)}` : tvaExempt ? 'TVA non applicable, art. 293 B du CGI' : ''}
        ${getCustomFields(f, 'identity', dt).map((cf) => `<br>${esc(cf.value)}`).join('')}
      </div>
    </div>

    <div class="doc-col">
      <div class="doc-title">${(() => {
        switch (input.invoiceType) {
          case 'acompte': return "FACTURE D'ACOMPTE";
          case 'solde': return 'FACTURE DE SOLDE';
          case 'avoir': return 'AVOIR';
          case 'situation': return `FACTURE DE SITUATION N°${input.situationNumber ?? ''}`;
          default: return 'FACTURE';
        }
      })()}</div>
      ${input.invoiceType === 'avoir' && input.sourceInvoiceNumber ? `<div class="doc-meta">Avoir sur facture N° ${esc(input.sourceInvoiceNumber)}</div>` : ''}
      <div class="doc-meta">N\u00B0 ${esc(number)}</div>
      <div class="doc-meta">Date : ${formatDate(createdAt)}</div>
      ${prestationDate && !isSameDay(prestationDate, createdAt) ? `<div class="doc-meta">Date de prestation : ${formatDate(prestationDate)}</div>` : ''}
      ${dueDate ? `<div class="doc-meta">\u00C9ch\u00E9ance : ${formatDate(dueDate)}</div>` : ''}

      <div class="client-block">
        <div class="client-label">Client</div>
        <div class="client-name">${esc(client.name)}</div>
        <div class="client-info">
          ${client.address ? `${esc(client.address)}<br>` : ''}
          ${client.siret ? `SIRET : ${esc(formatSiret(client.siret))}<br>` : ''}
          ${client.tvaNumber ? `TVA : ${esc(client.tvaNumber)}<br>` : ''}
          ${client.phone ? `${esc(client.phone)}<br>` : ''}
          ${client.email ? esc(client.email) : ''}
        </div>
      </div>
    </div>
  </div>

  <!-- Lines -->
  <table class="lines-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="r">Qt\u00E9</th>
        <th class="r">Unit\u00E9</th>
        <th class="r">P.U. HT</th>
        ${hasMixedTva ? '<th class="r">TVA</th>' : ''}
        <th class="r">Total HT</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map((l) => `<tr>
        <td>${esc(l.description)}</td>
        <td class="r">${l.quantity}</td>
        <td class="r">${esc(l.unit)}</td>
        <td class="r">${formatCurrency(l.unitPrice)}</td>
        ${hasMixedTva ? `<td class="r">${formatTvaRate(l.tvaRate)} %</td>` : ''}
        <td class="r">${formatCurrency(l.totalHt)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-row">
    <table class="totals-table">
      <tr>
        <td>Total HT</td>
        <td class="r">${formatCurrency(totalHt)}</td>
      </tr>
      ${tvaGroups.map((g) => g.tvaRate > 0 ? `<tr>
        <td>TVA ${formatTvaRate(g.tvaRate)} %</td>
        <td class="r">${formatCurrency(g.tvaMontant)}</td>
      </tr>` : '').join('')}
      ${tvaExempt ? `<tr>
        <td colspan="2" style="font-size:7.5pt;color:#999;">TVA non applicable, art. 293 B du CGI</td>
      </tr>` : ''}
      <tr class="ttc">
        <td>Total TTC</td>
        <td class="r">${formatCurrency(totalTtc)}</td>
      </tr>
    </table>
  </div>

  <!-- Payment -->
  ${(() => {
    const customPayment = getCustomFields(f, 'payment', dt);
    const hasPayment = paymentTerms || dueDate || iban || customPayment.length > 0;
    if (!hasPayment) return '';
    return `<div class="payment-box">
    ${paymentTerms ? `<strong>R\u00E8glement :</strong> ${esc(paymentTerms)}` : ''}
    ${paymentTerms && dueDate ? '<br>' : ''}
    ${dueDate ? `<strong>Date limite :</strong> ${formatDate(dueDate)}` : ''}
    ${iban ? `${paymentTerms || dueDate ? '<br>' : ''}<strong>IBAN :</strong> ${esc(iban)}` : ''}
    ${customPayment.map((cf) => `${paymentTerms || dueDate || iban ? '<br>' : ''}${esc(cf.value)}`).join('')}
  </div>`;
  })()}

  <!-- Bottom: legal only (no signature on invoices) -->
  <div class="bottom-row">
    <div class="legal-col" style="max-width:100%;">
      ${legal || ''}
    </div>
  </div>

  <div class="page-number"></div>

</body>
</html>`;
}
