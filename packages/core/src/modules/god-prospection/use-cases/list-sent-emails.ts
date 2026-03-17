import { findSentProspects } from '../repository/find-sent-prospects.js';

export interface SentEmailView {
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  profession: string;
  sentAt: string;
  sentSubject: string | null;
  sentBodyHtml: string | null;
}

export async function listSentEmails(input: {
  limit: number;
  offset: number;
}): Promise<{ emails: SentEmailView[]; total: number }> {
  const { rows, total } = await findSentProspects({
    limit: input.limit,
    offset: input.offset,
  });

  return {
    emails: rows.map((r) => ({
      prenom: r.firstName,
      nom: r.fullName,
      email: r.email,
      telephone: r.phone,
      profession: r.profession,
      sentAt: r.sentAt ? r.sentAt.toISOString().slice(0, 10) : 'Date inconnue',
      sentSubject: r.sentSubject,
      sentBodyHtml: r.sentBodyHtml,
    })),
    total,
  };
}
