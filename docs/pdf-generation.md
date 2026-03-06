# PDF Generation — Tuldio Document System

## Overview

Tuldio generates quotes (devis) and invoices (factures) using its own standardized A4 template.
The artisan uploads one document (quote or invoice) — we extract their company identity via LLM,
then use that identity to generate all future documents with Tuldio's layout.

```
Artisan uploads 1 PDF (quote OR invoice)
        |
        v
  LLM Extraction
        |
        v
  CompanyProfile + LegalInfo --> stored in DB (once)
        |
        +---> Tuldio Quote Template
        +---> Tuldio Invoice Template
```

One upload. Both document types. Same company identity.

## Tech Stack

- **Puppeteer** (singleton browser instance) renders React/HTML to PDF
- **React component** generates the HTML (one component, `type` prop toggles quote/invoice)
- **CSS `@page`** handles A4 format, margins, page breaks
- **LLM (Claude)** extracts company profile from uploaded document

## Puppeteer Architecture

Single browser instance shared across the API process. One page per render, closed after.

```ts
let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  }
  return browser
}

async function renderPdf(html: string): Promise<Buffer> {
  const b = await getBrowser()
  const page = await b.newPage()
  await page.setContent(html, { waitUntil: 'networkidle0' })
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
  })
  await page.close()
  return Buffer.from(pdf)
}
```

## Data Model

### CompanyProfile (extracted once, stored in DB)

```ts
type CompanyProfile = {
  name: string
  logoUrl?: string
  address: string
  phone?: string
  mobile?: string
  email?: string
  website?: string
  siret: string
  apeCode?: string
  tvaNumber?: string
  tvaExempt?: boolean             // auto-entrepreneur (art. 293 B CGI)
  legalForm?: string              // EI, EIRL, SARL, SAS, auto-entrepreneur
  capitalSocial?: number          // euros (if societe)
  rcsCity?: string                // "RCS Dieppe"
  rmCity?: string                 // "RM Dieppe"
  activityDescription?: string    // "Terrassement - Location de materiel"
  insurance?: {
    company: string               // AXA
    city?: string                 // ARQUES LA BATAILLE
    policyNumber?: string
    coverageZone?: string         // France metropolitaine
  }
  paymentTerms?: string           // "30% commande, solde reception facture"
  depositPercent?: number          // 30
  earlyPaymentDiscount?: string   // extracted or --> French default
  latePenaltyRate?: string        // extracted or --> French default
  recoveryFee?: number            // extracted or --> 40 euros
  customClauses?: string[]
}
```

### DocumentData (per document, created by user via chat)

```ts
type DocumentData = {
  type: 'quote' | 'invoice'
  number: string                   // DEV-2025-001, FAC-2025-001
  date: string                     // 14/12/2024
  // Quote-specific
  validityDate?: string            // date de validite
  workStartDate?: string           // date de debut prevue
  workDuration?: string            // "2 semaines"
  // Invoice-specific
  dueDate?: string                 // date d'echeance
  serviceDate?: string             // date de realisation
  servicePeriod?: { from: string; to: string }
  purchaseOrderNumber?: string     // N bon de commande

  company: CompanyProfile

  client: {
    name: string
    address: string
    email?: string
    siret?: string
    tvaNumber?: string             // N TVA intra-UE (if pro)
  }

  prestationType?: string          // "Amenagement, Cloture"

  lines: {
    description: string
    quantity: number
    unit?: string                  // ml, m2, h, forfait
    unitPriceHT?: number           // optional (some artisans don't show it)
    totalHT: number
    tvaRate: number                // 10, 20, 5.5
  }[]

  discount?: {
    type: 'percent' | 'fixed'
    value: number
  }
}
```

## French Legal Compliance

### Mandatory defaults (hardcoded, law requires them)

These are always printed. If the artisan specifies something different, the extracted value
overrides. Otherwise the legal default is used.

```ts
const FRENCH_LEGAL_DEFAULTS = {
  earlyPaymentDiscount: "Pas d'escompte pour paiement anticipe",
  latePenaltyRate: "3 fois le taux d'interet legal en vigueur",
  recoveryFee: 40, // euros -- article L.441-10 Code de commerce
  quoteValidityDays: 30,
}
```

### Mentions obligatoires -- Devis

| Mention | Source | Required by |
|---------|--------|-------------|
| Date du devis | `date` | Art. L.111-1 Code conso |
| N du devis | `number` | Art. L.111-1 |
| Duree de validite | `validityDate` or default 30j | Art. L.111-1 |
| Entreprise: nom, adresse, SIRET | `company.*` | Art. R.123-237 Code commerce |
| N TVA intracommunautaire | `company.tvaNumber` | Art. 242 nonies A CGI |
| Forme juridique + capital | `company.legalForm`, `capitalSocial` | Art. R.123-237 |
| RCS ou RM + ville | `company.rcsCity`, `rmCity` | Art. R.123-237 |
| APE | `company.apeCode` | Art. R.123-237 |
| Client: nom, adresse | `client.*` | Art. L.111-1 |
| Detail prestations | `lines[]` | Art. L.111-1 |
| Taux TVA applicable | `lines[].tvaRate` | Art. 242 nonies A CGI |
| Total HT, TVA, TTC | computed | Art. L.111-1 |
| Conditions de paiement | `paymentTerms` | Art. L.441-10 Code commerce |
| Assurance decennale (BTP) | `legal.insurance` | Loi Spinetta |
| Signature "Lu et approuve, bon pour accord" | hardcoded | Art. 1119 Code civil |
| Date debut / duree travaux | `workStartDate`, `workDuration` | Art. L.111-1 |
| TVA non applicable art. 293 B | if `tvaExempt` | Art. 293 B CGI |

### Mentions obligatoires -- Facture (additional)

| Mention | Source | Required by |
|---------|--------|-------------|
| Date d'echeance | `dueDate` | Art. L.441-10 Code commerce |
| Date prestation / periode | `serviceDate` or `servicePeriod` | Art. 242 nonies A CGI |
| Conditions d'escompte | `earlyPaymentDiscount` or default | Art. L.441-10 |
| Penalites de retard | `latePenaltyRate` or default | Art. L.441-10 |
| Indemnite de recouvrement | `recoveryFee` or 40 euros | Art. L.441-10 |
| N bon de commande | `purchaseOrderNumber` (if applicable) | Decret 2019-1344 |
| N TVA client | `client.tvaNumber` (if pro + intra-UE) | Art. 242 nonies A CGI |

### What we always print (non-negotiable)

- Penalites de retard: value from extraction or "3 fois le taux d'interet legal"
- Indemnite de recouvrement: value from extraction or 40 euros
- Escompte: value from extraction or "Pas d'escompte pour paiement anticipe"
- Page numbering: "Page X/Y" on every page
- Signature block (quote only): "Lu et approuve, bon pour accord" + Date + Signature
- TVA non applicable art. 293 B (if `company.tvaExempt === true`)

## Quote vs Invoice -- Template Differences

Same React component, `type` prop toggles these differences:

| | Quote (Devis) | Invoice (Facture) |
|---|---|---|
| Title | "DEVIS N ..." | "FACTURE N ..." |
| Date fields | Date + Validite | Date + Echeance |
| Work dates | Debut + duree estimee | Date/periode realisation |
| Signature block | Yes | No |
| Payment status | -- | "PAYEE" stamp if paid |
| Legal block | Assurance + paiement | Assurance + paiement + escompte + penalites |
| Numbering prefix | DEV- | FAC- |

## Template Layout (A4)

### Page 1

```
+--------------------------------------------------------------+
|                                                        Page 1/N |
|  +----------+                         DEVIS N DEV-2025-042   |
|  |  [LOGO]  |                         Date : 14/12/2024      |
|  |          |                         Validite : 12/02/2025  |
|  +----------+                                                |
|                                                               |
|  BONTE Jean Marc                      Client :                |
|  1 bis Chemin de la Garenne           Mr Leotard Corentin     |
|  76630 Envermeu                       52 rue des Canadiens    |
|  Tel : 02 35 85 49 25                 76630 Envermeu          |
|  jeanmarc-bonte@hotmail.com                                   |
|  SIRET : 398 174 938 00025                                    |
|                                                               |
|  Prestation : Terrassement                                    |
|  Debut travaux : 15/01/2025 -- Duree estimee : 3 jours       |
|                                                               |
| +------------------+------+------+--------+--------+----+     |
| | Description      |  Qte |Unite | P.U. HT|Mont. HT|TVA |    |
| +------------------+------+------+--------+--------+----+     |
| | Terrassement     | 1,00 |      | 500,00 | 500,00 | 10%|    |
| | ...              |      |      |        |        |    |     |
| | (table grows and paginates as needed)             |    |     |
| +------------------+------+------+--------+--------+----+     |
+--------------------------------------------------------------+
```

### Last Page (after table ends)

```
+--------------------------------------------------------------+
|                                                               |
|                    +------------------------------+           |
|                    | Total HT          500,00 EUR |           |
|                    | TVA 10%            50,00 EUR |           |
|                    | Total TTC         550,00 EUR |           |
|                    +------------------------------+           |
|                    | NET A PAYER       550,00 EUR |           |
|                    +------------------------------+           |
|                                                               |
|  Conditions : 30% a la commande, solde a reception            |
|                                                               |
|  +----------------------------------------------------------+ |
|  | Pour le client (signature precedee de la mention :        | |
|  | Lu et approuve, bon pour accord)                          | |
|  |                                                           | |
|  | Date : ___/___/______       Signature :                   | |
|  |                                                           | |
|  +----------------------------------------------------------+ |
|                                                               |
|  Mentions legales :                                           |
|  Assurance decennale : AXA, Arques la Bataille               |
|  Contrat N 10485947804 -- France metropolitaine              |
|  Penalites de retard : 3x taux interet legal                 |
|  Indemnite de recouvrement : 40 EUR                          |
|  Pas d'escompte pour paiement anticipe                       |
|                                                               |
|  ----------------------------------------------------------- |
|  SIRET 398 174 938 00025 - APE 4312A - RM DIEPPE             |
|  TVA FR90398174938                                            |
+--------------------------------------------------------------+
```

### Page 2+ (continuation pages)

Compact header repeats: logo (small) + company name + document ref + page number.
Table header row repeats. Totals/signature/legals only on last page.

```
+--------------------------------------------------------------+
| [logo] BONTE Jean Marc    DEVIS DEV-2025-042          Page 2/3|
| +------------------+------+------+--------+--------+----+     |
| | Description      |  Qte |Unite | P.U. HT|Mont. HT|TVA |    |
| +------------------+------+------+--------+--------+----+     |
| | ... continued ...                                      |     |
+--------------------------------------------------------------+
```

## Adaptive Table Columns

Columns shown depend on the data. The template inspects `lines[]` and decides:

| Condition | Columns shown |
|-----------|---------------|
| All lines have `unit` + `unitPriceHT` | Description, Qte, Unite, P.U. HT, Montant HT, TVA |
| No `unit`, no `unitPriceHT` | Designation, Quantite, Prix HT |
| Mixed | Show all columns, leave empty cells where data is missing |
| Single TVA rate across all lines | Hide TVA column, show single rate in totals |
| Multiple TVA rates | Show TVA column per line, group by rate in totals |

## LLM Extraction Prompt

When the artisan uploads a document, Claude extracts:

1. **Company identity**: name, address, SIRET, APE, TVA, phones, email, legal form
2. **Legal info**: insurance details, payment terms, deposit, penalties, custom clauses
3. **Logo detection**: position and presence (logo file extracted separately or uploaded by user)

The extraction does NOT care about document content (client name, line items, amounts).
It only extracts the **reusable company identity**.

## File Structure

```
packages/core/src/lib/pdf/
  document-template.tsx    # React component (quote + invoice)
  render-pdf.ts            # Puppeteer singleton + renderPdf()
  french-legal-defaults.ts # FRENCH_LEGAL_DEFAULTS constant
  types.ts                 # CompanyProfile, DocumentData types
```
