import { logger } from './logger.js';

interface SiretResult {
  siret: string;
  name: string;
  address: string;
}

export async function lookupSiret(siret: string): Promise<SiretResult | null> {
  const token = process.env.SIRENE_API_TOKEN;
  if (!token) {
    logger.warn('SIRENE_API_TOKEN not configured, SIRET lookup disabled');
    return null;
  }

  const cleaned = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(cleaned)) {
    return null;
  }

  try {
    const res = await fetch(
      `https://api.insee.fr/entreprises/sirene/V3.11/siret/${cleaned}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      logger.error(`SIRENE API error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const etablissement = data.etablissement;
    const unite = etablissement.uniteLegale;
    const adresse = etablissement.adresseEtablissement;

    const name =
      unite.denominationUniteLegale ??
      `${unite.prenomUsuelUniteLegale ?? ''} ${unite.nomUniteLegale ?? ''}`.trim();

    const addressParts = [
      adresse.numeroVoieEtablissement,
      adresse.typeVoieEtablissement,
      adresse.libelleVoieEtablissement,
      adresse.codePostalEtablissement,
      adresse.libelleCommuneEtablissement,
    ].filter(Boolean);

    return {
      siret: cleaned,
      name,
      address: addressParts.join(' '),
    };
  } catch (err) {
    logger.error('SIRENE API call failed', { error: err });
    return null;
  }
}
