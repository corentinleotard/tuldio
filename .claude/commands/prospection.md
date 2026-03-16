# Prospection praticiens santé

Génère un fichier Excel de prospection de praticiens de santé libéraux en France.

## Pipeline

1. **Télécharger les données RPPS** depuis data.gouv.fr (Répertoire Partagé des Professionnels de Santé)
2. **Filtrer** par profession cible (ostéopathes en priorité, puis autres professions libérales de santé, puis petit artisans)
3. **Enrichir** : à partir du nom + ville du cabinet, chercher le site web → extraire l'email pro publique (contact@...)
4. **Dédupliquer** : chaque personne ne doit apparaître qu'UNE SEULE fois (dédup sur nom normalisé + email)
5. **Générer un fichier Excel (.xlsx)** avec les colonnes :
   - Profession
   - Nom
   - Email
   - Statut envoyé (oui/non — défaut : non)

## Contraintes

- **Pas de doublons** — unicité stricte par personne
- **Sources légales uniquement** : données publiques RPPS, annuaires des ordres, sites web de cabinets
- **Emails professionnels uniquement** (contact@cabinet-x.fr) — jamais d'emails personnels (gmail, hotmail...)
- **Interdit** : scraping Doctolib, collecte d'emails personnels
- Si le fichier Excel existe déjà d'une précédente exécution, **fusionner** les nouvelles données sans écraser les statuts "envoyé" existants

## Output

Fichier généré dans : `/Users/corentin/private/tuldio/prospection.xlsx`
