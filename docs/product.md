# Tuldio — Product

> "Tu lui dis, c'est fait."

## Vision

A chat-based app (web + mobile) that handles all the admin work for French artisans and very small businesses. No menus, no forms, no computer skills required. They talk, the app does. Available as a web app and on App Store / Play Store via Capacitor.

## Target Users

French TPE: plumbers, electricians, bakers, hairdressers, carpenters, painters...
- 1-5 employees (often solo)
- Revenue: 30k-200k€/year
- Current tools: paper, a notebook, maybe EBP, Excel, or nothing
- Tech literacy: low — smartphone is their only computer
- Pain: they spend evenings doing paperwork instead of living

## Core Insight

These users don't need a better invoicing tool. They need someone who handles it for them. Tuldio is that someone — an employee that never sleeps, never forgets, and always answers.

## Onboarding (< 2 minutes)

1. Open web app or download from App Store / Play Store
2. Enter email → receive 6-digit code → verify (no password ever)
3. Enter SIRET → auto-fetch company name + address from INSEE API
4. Upload an existing quote template (photo or PDF) — can skip
5. Upload an existing invoice template (photo or PDF) — can skip
6. Chat is open. First quote in 30 seconds.

Steps 4 and 5 can be skipped and done later from Settings > Mes modèles. But the app pushes to do it during onboarding for the best first experience.

## V1 Features

### Templates (upload once)
- User uploads their existing quote and invoice templates (photo/PDF)
- Claude Vision extracts: layout, logo position, company info, legal mentions, line item structure
- Stored as structured template data → used for all future document generation
- User is responsible for legal compliance of their templates — we are a document tool, not a legal service

### Chat (the product)
- One continuous conversation per user — never resets, never expires
- Open the app → history is there, scroll up to see older messages
- AI remembers context from recent messages (last 20-30)
- AI doesn't need old messages to access data — it queries the database directly
- Rich content inline: quote/invoice cards with actions, stats summaries, expense confirmations
- Photos (receipts, templates) visible in the conversation as thumbnails
- Proactive AI messages appear as new messages (push notification + badge on Chat tab)

### Quotes (via chat)
- "Devis pour Martin Jean, 25m² de parquet à 50€/m²"
- AI generates complete PDF matching their template
- Sends via email or SMS to the client
- Tracks status: sent, accepted, refused
- Learns pricing over time: "La dernière fois tu as facturé 62€/m² pour du carrelage"

### Invoices (via chat)
- "Martin Jean a accepté le devis" → converts quote to invoice
- "Facture pour Mme Dupont, 3h de plomberie" → standalone invoice
- Tracks payment status: sent, paid, overdue
- "Qui me doit de l'argent ?" → instant list of unpaid invoices

### Expenses (camera)
- Snap a photo of a receipt → AI extracts amount, vendor, date, category
- "Combien j'ai dépensé chez Métro ce mois-ci ?" → instant answer
- Categorized automatically (materials, fuel, food, tools...)

### Client Management (natural)
- Clients are created automatically from quotes/invoices
- "Martin Jean a un chien méchant, faut sonner 2 fois" → stored as client note
- "Je retourne chez Martin demain" → AI surfaces relevant notes + history

### Stats (via chat)
- "Combien ce mois-ci ?" → revenue, expenses, result
- "Compare avec l'an dernier" → year-over-year comparison
- "Mon meilleur client ?" → ranked by revenue
- "Taux d'acceptation de mes devis ?" → conversion rate
- All derived from generated documents — no manual data entry

### Proactive Alerts (push notifications)
- Monthly summary: revenue, expenses, result, unpaid invoices
- Payment reminders: "Mme Dupont doit 1 200€ depuis 30 jours, tu veux que je relance ?"
- Weekly digest: quotes sent, invoices paid, cash position

## V2 Features (Future)

- Visual charts in-app ("Montre-moi mon CA par mois" → bar chart)
- Custom reports (build their own dashboards)
- Accountant export (FEC format, PDF package)
- Payment reminders (automated email/SMS to clients)
- Bank sync via Bridge API / Powens (auto-match payments to invoices)
- Multi-user (boss + employee access)
- RAG on document contents (search across all documents and notes)

## Business Model

- **Free trial**: 3 months, full features, no credit card
- **Paid**: 100€/month after trial
- **Dedup**: by SIRET (one free trial per company, ever)
- **Payments**: Stripe
- **No freemium tier**: full product or nothing

## Key Principles

1. **No migration** — start empty, fill naturally through usage
2. **No forms** — everything through chat or camera
3. **No learning curve** — if you can text, you can use Tuldio
4. **Their template, their responsibility** — we generate documents from their model, legal compliance is theirs
5. **Data builds itself** — every interaction adds to their business intelligence
6. **Privacy first** — data hosted in France (OVH), RGPD compliant
7. **Data quality above all** — the AI never guesses silently. Ambiguous matches are surfaced. Duplicates are flagged. Amounts are always confirmed. Bad data is worse than no data.
