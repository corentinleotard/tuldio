-- =============================================================================
-- Migration 013: Units table with aliases for AI resolution
-- =============================================================================

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id),
  label VARCHAR(50) NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, label)
);

-- Allow fuzzy matching on label and aliases
CREATE INDEX idx_units_team ON units(team_id);
CREATE INDEX idx_units_label_trgm ON units USING gin(label gin_trgm_ops);

-- Seed global units (team_id = NULL)
-- Generous aliases so the AI resolves correctly even with typos/variants
INSERT INTO units (team_id, label, aliases) VALUES
  -- Unité / pièce
  (NULL, 'u',         ARRAY['unité', 'unités', 'unite', 'unites', 'pièce', 'pièces', 'piece', 'pieces', 'pce', 'pcs', 'unité(s)', 'pièce(s)']),
  -- Surface
  (NULL, 'm²',        ARRAY['m2', 'M2', 'mètre carré', 'mètres carrés', 'metre carre', 'metres carres', 'metre carré', 'mètres carré', 'mètre carrés', 'metre carre', 'mcarré', 'mcarre']),
  -- Longueur
  (NULL, 'm',         ARRAY['mètre', 'mètres', 'metre', 'metres', 'mètre linéaire', 'mètres linéaires', 'metre lineaire', 'metres lineaires', 'ml']),
  (NULL, 'cm',        ARRAY['centimètre', 'centimètres', 'centimetre', 'centimetres']),
  (NULL, 'mm',        ARRAY['millimètre', 'millimètres', 'millimetre', 'millimetres']),
  (NULL, 'km',        ARRAY['kilomètre', 'kilomètres', 'kilometre', 'kilometres']),
  -- Volume
  (NULL, 'm³',        ARRAY['m3', 'M3', 'mètre cube', 'mètres cubes', 'metre cube', 'metres cubes', 'mcube']),
  (NULL, 'L',         ARRAY['l', 'litre', 'litres']),
  -- Temps
  (NULL, 'h',         ARRAY['heure', 'heures', 'hr', 'hrs']),
  (NULL, 'j',         ARRAY['jour', 'jours', 'journée', 'journées', 'journee', 'journees']),
  (NULL, 'j/h',       ARRAY['jour/homme', 'jours/homme', 'jour homme', 'jours homme', 'j/H', 'JH', 'jh', 'man-day', 'man-days']),
  (NULL, 'min',       ARRAY['minute', 'minutes']),
  (NULL, 'mois',      ARRAY['mois']),
  (NULL, 'an',        ARRAY['ans', 'année', 'années', 'annee', 'annees']),
  -- Masse
  (NULL, 'kg',        ARRAY['kilo', 'kilos', 'kilogramme', 'kilogrammes']),
  (NULL, 'g',         ARRAY['gramme', 'grammes']),
  (NULL, 't',         ARRAY['tonne', 'tonnes', 'T']),
  -- Forfait / lot
  (NULL, 'forfait',   ARRAY['fft', 'ft', 'forfaits', 'forfaitaire']),
  (NULL, 'lot',       ARRAY['lots']),
  (NULL, 'ensemble',  ARRAY['ens', 'ensembles']),
  -- Conditionnement
  (NULL, 'sac',       ARRAY['sacs']),
  (NULL, 'palette',   ARRAY['palettes', 'pal']),
  (NULL, 'rouleau',   ARRAY['rouleaux', 'rlx']),
  (NULL, 'plaque',    ARRAY['plaques']),
  (NULL, 'panneau',   ARRAY['panneaux']),
  (NULL, 'bobine',    ARRAY['bobines']),
  (NULL, 'carton',    ARRAY['cartons', 'ctn']),
  (NULL, 'bidon',     ARRAY['bidons']),
  (NULL, 'seau',      ARRAY['seaux']),
  (NULL, 'pot',       ARRAY['pots']),
  (NULL, 'tube',      ARRAY['tubes']),
  (NULL, 'barre',     ARRAY['barres']),
  (NULL, 'fût',       ARRAY['fûts', 'fut', 'futs']),
  (NULL, 'boîte',     ARRAY['boîtes', 'boite', 'boites', 'bte']),
  (NULL, 'barquette', ARRAY['barquettes']),
  (NULL, 'sachet',    ARRAY['sachets']),
  (NULL, 'paquet',    ARRAY['paquets']),
  (NULL, 'caisse',    ARRAY['caisses']),
  -- BTP spécifique
  (NULL, 'benne',     ARRAY['bennes']),
  (NULL, 'camion',    ARRAY['camions']),
  (NULL, 'voyage',    ARRAY['voyages']),
  (NULL, 'stère',     ARRAY['stères', 'stere', 'steres']);
