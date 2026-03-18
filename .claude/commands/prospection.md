# Prospection praticiens santé + artisans + événementiel + coaches

Alimente la table PostgreSQL `god_prospects` avec des prospects qualifiés en France.

## Pipeline

1. **Sources de données** :
   - RPPS (data.gouv.fr) → praticiens de santé libéraux
   - Annuaire des Entreprises API (INSEE/SIRENE) → artisans < 10 salariés
   - Mariages.net → prestataires événementiels (photographes, traiteurs, DJ, wedding planners...)
   - Annuaire des Entreprises API → coaches, formateurs, consultants
2. **Enrichissement** : DDG search + Playwright (artisans/santé) ou puppeteer-extra+stealth (événementiel) → site web → extraire email pro + téléphone
3. **Qualification AI** : Claude CLI (`claude -p --model haiku`) évalue chaque prospect (score ICP 1-10). Utilise le Max subscription, pas l'API key.
4. **Déduplication** : `ON CONFLICT (email) DO NOTHING` — unicité stricte, **jamais d'override**
5. **Stockage** : PostgreSQL `god_prospects` table

## Scripts

### Artisans + Santé (script original)
```bash
node scripts/prospection.mjs                  # Full pipeline (RPPS + artisans + enrichment + AI scoring + DB)
node scripts/prospection.mjs --skip-enrich    # Sources only, no web scraping
node scripts/prospection.mjs --artisans-only  # Skip RPPS, only artisans
node scripts/prospection.mjs --import-excel   # One-time: import existing Excel to DB
```

### Événementiel + Coaches (nouveau)
```bash
node scripts/prospection-events-coaches.mjs                    # Full pipeline
node scripts/prospection-events-coaches.mjs --skip-enrich      # Sources only
node scripts/prospection-events-coaches.mjs --enrich-only      # Just enrich existing
node scripts/prospection-events-coaches.mjs --mariages-only    # Skip coaches
node scripts/prospection-events-coaches.mjs --coaches-only     # Skip mariages.net
```

Les deux scripts sont **resumable** — l'état de scraping est persisté dans `data/scrape-state.json` et `data/scrape-state-events-coaches.json`. Chaque exécution reprend là où la précédente s'est arrêtée.

**Limit** : `WEB_SCRAPE_DAILY_LIMIT` dans chaque script (actuellement 10 pour test, monter à 100-500 pour production).

## Professions ciblées

**Santé (RPPS):** Ostéopathe, Chiropracteur, Diététicien

**Artisans (NAF):** Maçon, Terrassier, Électricien, Plombier, Chauffagiste, Plâtrier, Menuisier, Serrurier-Métallier, Carreleur, Peintre, Charpentier, Couvreur, Étanchéiste, Isolation, Paysagiste, Démolition, Finition, Construction

**Événementiel (Mariages.net):** Photographe mariage, Vidéaste mariage, DJ/Musicien mariage, Traiteur mariage, Décorateur mariage, Wedding planner, Fleuriste mariage, Pâtissier mariage

**Coaches/Formateurs (NAF):** Consultant (70.22Z), Formateur (85.59A), Coach (85.59B), Photographe (74.20Z), Organisateur événementiel (82.30Z)

## Mariages.net — Details techniques

**Anti-bot** : Mariages.net bloque Playwright headless ("Access Denied"). Le script utilise puppeteer-extra + stealth plugin + profil Chrome réel (même setup que fill-forms.mjs). **Copier le profil Chrome avant de lancer** (voir Etape 1 du form fill).

**URL slugs confirmés** (testés 2026-03-18) :
```
photo-mariage          → Photographe mariage (~61 résultats page 1)
video-mariage          → Vidéaste mariage (~36)
musique-mariage        → DJ / Musicien mariage (~36)
traiteur-mariage       → Traiteur mariage (~36)
decoration-mariage     → Décorateur mariage (~36)
organisation-mariage   → Wedding planner (~34)
fleurs-mariage         → Fleuriste mariage (~36)
wedding-cake           → Pâtissier mariage (~36)
```

**Structure des listings** : liens avec pattern `a[href*="--e"]` → `/category/nom--eID`. Pas de contact direct visible sur les listings (tout passe par leur plateforme). On extrait le nom + ville, puis on cherche leur vrai site via DDG.

**Rendement attendu** : ~311 prospects uniques sur une passe (80 max par catégorie, dédupliqués). Augmenter `MARIAGES_PER_CATEGORY` pour plus (pagination fonctionne via `?page=N`).

**Pagination** : `https://www.mariages.net/{slug}?page={N}`. ~36 résultats par page. Max 20 pages par catégorie par défaut.

## Rendement attendu par source

| Source | Prospects par run | Avec email pro | Notes |
|--------|-------------------|----------------|-------|
| RPPS (santé) | ~3000 uniques | ~200 (après SFDO + DDG) | Ostéos = meilleur taux |
| Annuaire Entreprises (artisans) | ~1800 (100/NAF) | ~100-200 (DDG+scrape) | Petites villes = meilleur taux |
| Mariages.net | ~311 (80/catégorie) | À valider | Prestataires ont quasi tous un site |
| Annuaire Entreprises (coaches) | ~500 (100/NAF) | À valider | Consultants souvent sans site perso |

**Priorité contact form > email.** Les prestataires événementiels lisent leurs formulaires de contact (c'est comme ça que les clients les contactent). Les artisans aussi. Les coaches sont plus variables.

## Deduplication & Safety

- **UNIQUE(email)** en DB — jamais de doublon
- **ON CONFLICT DO NOTHING** — jamais d'override des lignes existantes
- **Status** : `new` → `sent` | `error` — jamais de retour en arrière
- **`contacted_via`** : `email` | `form` | `null` — track quel canal a été utilisé
- **`icp_score`** : 1-10, évalué par Claude. Score < 6 = prospect disqualifié (pas inséré)
- **`website`** : hostname normalisé (pas de sous-pages) pour éviter de contacter 2x le même site

## Database

Table `god_prospects` (migrations `030`, `031`, `032`) :
- `email TEXT UNIQUE NOT NULL`
- `status TEXT` : new | sent | error
- `icp_score INTEGER` : 1-10 AI qualification
- `icp_reason TEXT` : explication du score
- `website TEXT` : hostname du site trouvé
- `page_text TEXT` : contenu du site pour analyse
- `contacted_via TEXT` : email | form
- `sent_at TIMESTAMPTZ` : date d'envoi

## Queries utiles

```sql
-- Résumé par profession
SELECT profession || ': ' || count(*) || ' total (' || count(*) FILTER (WHERE status = 'new') || ' new, ' || count(*) FILTER (WHERE status = 'sent') || ' sent)' AS summary
FROM god_prospects GROUP BY profession ORDER BY count(*) DESC;

-- Prospects qualifiés prêts à contacter
SELECT full_name, email, profession, icp_score, icp_reason
FROM god_prospects WHERE status = 'new' AND icp_score >= 7 ORDER BY icp_score DESC;

-- Prospects contactés par formulaire
SELECT full_name, website, profession FROM god_prospects WHERE contacted_via = 'form';
```

## Contact Form Fill — Flow complet (copier-coller)

### FLOW COMPLET — de A a Z

Quand l'utilisateur demande "fill N forms" (artisans, événementiel, ou coaches), voici le flow exact :

**Etape 1 — Copier le profil Chrome (OBLIGATOIRE, 1 fois par session)**

Ferme Chrome, copie le profil, relance Chrome. L'utilisateur peut continuer a bosser apres.

```bash
pkill -9 -f "Google Chrome" 2>/dev/null; sleep 2; rm -rf /tmp/chrome-debug-profile; cp -r "$HOME/Library/Application Support/Google/Chrome" /tmp/chrome-debug-profile 2>/dev/null; rm -f /tmp/chrome-debug-profile/Singleton*; open -a "Google Chrome"
```

NE PAS REFAIRE SI DEJA FAIT DANS LA SESSION. Verifier : `ls /tmp/chrome-debug-profile/Default/Cookies`

**Etape 2 — Trouver des cibles**

1. Utiliser l'API Annuaire des Entreprises pour trouver des vrais noms d'entreprise :
   `https://recherche-entreprises.api.gouv.fr/search?activite_principale=[NAF]&departement=[dept]&per_page=25`
2. Utiliser WebSearch pour trouver leurs sites web (bloquer les plateformes connues)
3. Scanner les sites avec Playwright pour detecter les formulaires et le type de captcha
4. Privilegier les sites SANS captcha ou avec reCAPTCHA v3 (bypass via profil Chrome)
5. EVITER les sites avec reCAPTCHA v2 (image challenge) ou Securimage

**Etape 3 — Mettre a jour le script**

Editer le tableau `SITES` dans `scripts/fill-forms.mjs` avec les nouvelles cibles :

```javascript
const SITES = [
  { url: 'https://example.fr/contact/', name: 'Example', profession: 'Plombier' },
];
```

**Etape 4 — Lancer le fill (headless, invisible)**

```bash
node scripts/fill-forms.mjs
```

**Etape 5 — Inserer les resultats en DB**

Pour chaque site avec resultat `mail_sent` ou page reload (= envoye) :
```sql
INSERT INTO god_prospects (id, profession, full_name, email, website, contacted_via, status, sent_at, icp_score, icp_reason, source, scraped)
VALUES (gen_random_uuid(), $profession, $name, 'contact@' || $website, $website, 'form', 'sent', now(), $score, $reason, 'web', true)
ON CONFLICT (email) DO UPDATE SET contacted_via = 'form', status = 'sent', sent_at = now();
```

**Etape 6 — Rapport**

Montrer le total et la liste mise a jour :
```sql
SELECT full_name, profession, website, contacted_via, status FROM god_prospects WHERE contacted_via = 'form' ORDER BY sent_at DESC;
```

### Script : `scripts/fill-forms.mjs`

```bash
node scripts/fill-forms.mjs                              # Remplir tous les sites dans SITES[]
node scripts/fill-forms.mjs --url "https://example.fr"   # Un site specifique
node scripts/fill-forms.mjs --dry-run                    # Remplir sans soumettre
```

### Comment ca marche (ne pas refaire le setup a chaque session)

Le script utilise puppeteer-extra + stealth plugin + copie du profil Chrome de l'utilisateur.
Les cookies Google du vrai Chrome donnent un score reCAPTCHA v3 eleve = bypass.
Chrome headless tourne en arriere-plan, invisible, ne derange pas l'utilisateur.

### Ce qui marche / ne marche pas

| Type de captcha | Bypass | Methode |
|----------------|--------|---------|
| Aucun captcha | ✅ 100% | Direct submit |
| reCAPTCHA v3 (invisible, CF7/Elementor) | ✅ ~80% | Profil Chrome + stealth + comportement humain |
| Divi math captcha (addition) | ✅ 100% | Resolution automatique |
| reCAPTCHA v2 (image challenge) | ❌ 0% | Impossible en headless, skip |
| Divi anti-bot sans captcha | ❌ ~20% | Parfois detecte malgre stealth |
| Securimage / captcha image | ❌ 0% | Skip |

### Comment le script fonctionne

1. Lance Chrome headless avec `/tmp/chrome-debug-profile` (copie du vrai profil)
2. Pour chaque site : navigue, dismiss cookies, detecte le type de formulaire
3. Genere des mouvements de souris, scroll, delais aleatoires (simule humain pour reCAPTCHA v3)
4. Rempli chaque champ avec `humanType()` (frappe caractere par caractere, delais aleatoires)
5. Detecte automatiquement les champs (nom, prenom, email, tel, message, etc.) par nom/id/placeholder/label
6. Coche les checkboxes RGPD/CGU automatiquement
7. Resout les captchas Divi (addition) automatiquement
8. Submit et capture la reponse CF7/Divi/Elementor
9. Screenshot avant/apres dans `data/screenshots/`

### Ajouter des cibles

Modifier le tableau `SITES` dans `scripts/fill-forms.mjs` :

```javascript
const SITES = [
  { url: 'https://example.fr/contact/', name: 'Example', profession: 'Plombier' },
];
```

Professions supportees : Plombier, Electricien, Menuisier, Macon, Carreleur, Charpentier, Peintre, Couvreur, Paysagiste, Terrassier, Photographe mariage, Videaste mariage, DJ / Musicien mariage, Traiteur mariage, Decorateur mariage, Wedding planner, Fleuriste mariage, Patissier mariage, Coach, Formateur, Consultant, Photographe, Organisateur evenementiel.

### Trouver de nouvelles cibles

**Artisans BTP :**
1. **Annuaire des Entreprises API** : `https://recherche-entreprises.api.gouv.fr/search?activite_principale=[NAF]&departement=[dept]&per_page=25`
2. **WebSearch** : chercher "[nom entreprise] [profession] [ville] contact" (bloquer les plateformes)
3. **Verifier** : nom du gerant dans le domaine, adresse physique, SIRET, photos de chantiers
4. **Scanner le formulaire** : page contact, type de captcha

**Événementiel (mariages) :**
1. Le script `prospection-events-coaches.mjs` scrape mariages.net automatiquement (nom + ville)
2. **WebSearch** : chercher "[nom prestataire] [profession] [ville] site" — ils ont quasi tous un site perso
3. **Verifier** : portfolio, tarifs, formulaire de contact ou email pro
4. Aussi cherchable via : Google Maps "[photographe/traiteur/DJ] mariage [ville]"

**Coaches / Formateurs :**
1. **Annuaire des Entreprises API** avec NAF 70.22Z (consultant), 85.59A (formateur), 85.59B (coach)
2. **WebSearch** : chercher "[nom] [coach/formateur/consultant] [ville] site"
3. **Verifier** : page "à propos", offres/tarifs, formulaire de contact
4. Aussi trouvables via LinkedIn (mais on contacte via leur site, pas LinkedIn)

### Infos a utiliser pour remplir les formulaires

- Prenom : Corentin
- Nom : Tuldio
- Societe : Tuldio
- Email : corentin@try-tuldio.fr
- Telephone : 06 31 86 33 77 (uniquement dans le champ telephone si requis, JAMAIS dans le message)

### Messages type

IMPORTANT : pas de caracteres speciaux. Adapter au domaine du prospect. Rester simple et direct. Ne PAS mettre le telephone dans le message.

**Artisans BTP :**
```
Bonjour,

Je me permets de vous contacter car j ai cree Tuldio, un outil simple pour les [plombiers/electriciens/macons...].

Vous envoyez un message, votre devis ou facture est pret en 30 secondes. C est tout. Pas de logiciel, pas de formation, pas de prise de tete.

Jetez un oeil ici : https://tuldio.fr

Bonne journee,
Corentin
```

**Événementiel (photographes, traiteurs, DJ, wedding planners...) :**
```
Bonjour,

Je me permets de vous contacter car j ai cree Tuldio, un outil simple pour les [photographes/traiteurs/wedding planners...].

Vous envoyez un message, votre devis est pret en 30 secondes. Depuis votre telephone, entre deux prestations. Pas de logiciel, pas de formation.

Jetez un oeil ici : https://tuldio.fr

Bonne journee,
Corentin
```

**Coaches / Formateurs / Consultants :**
```
Bonjour,

Je me permets de vous contacter car j ai cree Tuldio, un outil simple pour les [coachs et formateurs/consultants independants/formateurs independants].

Vous envoyez un message, votre devis ou facture est pret en 30 secondes. Pas de logiciel complique, pas de formation. Tout se fait par message.

Jetez un oeil ici : https://tuldio.fr

Bonne journee,
Corentin
```

### Apres soumission (fait automatiquement par le script, mais a verifier)

Inserer/update en DB :
```sql
INSERT INTO god_prospects (id, profession, full_name, email, website, contacted_via, status, sent_at, icp_score, icp_reason, source, scraped)
VALUES (gen_random_uuid(), $profession, $name, 'contact@' || $website, $website, 'form', 'sent', now(), $score, $reason, 'web', true)
ON CONFLICT (email) DO UPDATE SET contacted_via = 'form', status = 'sent', sent_at = now(), website = EXCLUDED.website;
```

### Strategie de recherche (lessons learned)

**Cibler les petites villes (< 10K habitants).** En grande ville, les resultats sont pollues par des plateformes.

**Partir de vrais noms d'entreprise.** Utiliser l'Annuaire des Entreprises API pour obtenir le nom exact + ville, puis chercher ce nom via WebSearch.

**DDG est rate-limite et souvent bloque en headless.** Utiliser WebSearch (outil Claude) a la place.

### Sites a BLOQUER (lead-gen / plateformes)

Pattern de hostname a rejeter :
- `[profession]-[ville].fr`, `mission-[profession].fr`, `artisan-[profession].fr`, `depannage-[profession].fr`
- Sites avec "nos artisans", "comparer", "trouver un artisan", "devis gratuit en ligne"

Sites connus a bloquer :
```
habitatpresto.com, allovoisins.com, houzz.fr, starofservice.com, travaux.com,
ootravaux.fr, keltravo.com, quotatis.fr, trouveartisan.fr, bonjour-artisan.net,
depanneurs.com, 123devis.com, etienne-services.fr, contact-plombier.fr,
plombier.com, electricien.com, consuel.com, pvfs.fr, previrisques.fr,
artisan-plombier.fr, artisan-electricien.fr, plombier-paris.fr,
mission-plomberie.fr, missionelectricien.fr, plomberie-toulouse.fr,
plombierstoulouse.com, plombierthononlesbains.fr, bons-artisans.fr
```

### Sites a BLOQUER (événementiel / coaches)

```
mariages.net, zankyou.fr, mariee.fr, lamarieeencolere.com, theknot.com,
weddingwire.com, fearlessphotographers.com, malt.fr, superprof.fr,
doctolib.fr, pinterest.com, pinterest.fr
```

### Comment reconnaitre un VRAI site de prestataire

**Vrai** : nom du gerant/entreprise dans le domaine, adresse physique, tel, portfolio/photos de realisations, SIRET visible, formulaire de contact.
**Faux** : domaine generique, plateforme/annuaire, formulaire qui dispatche a plusieurs prestataires, pas de SIRET.

## Progress & state

Requeter la DB pour l'etat actuel :
```sql
SELECT full_name, profession, website, contacted_via, status FROM god_prospects WHERE contacted_via = 'form' ORDER BY sent_at DESC;
```

### Prochaines etapes
1. Continuer form fill artisans (ajouter des URLs dans SITES, relancer le script)
2. Lancer `prospection-events-coaches.mjs` pour scraper mariages.net + coaches
3. Form fill sur les prestataires événementiels et coaches avec site web
4. Augmenter WEB_SCRAPE_DAILY_LIMIT a 100+ pour enrichir plus de prospects
5. Lancer envoi email sur les prospects qualifies (icp_score >= 7)
6. Nettoyer les emails junk dans la DB

## Frontend

Page `/prospection` avec 2 onglets :
- **Prospection** : contrôles d'envoi email + listes envoyés/reçus (existant)
- **Rapports** : stats par profession, score ICP moyen, derniers prospects ajoutés, canal de contact (email/form)
