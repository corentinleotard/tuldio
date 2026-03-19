import { findAllProspects } from '../repository/find-all-prospects.js';
import { getDailyCount } from '../repository/god-send-log.js';

const DEFAULT_DAILY_LIMIT = 10;

export interface ProspectView {
  id: string;
  profession: string;
  firstName: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
}

export interface ProspectListResult {
  prospects: ProspectView[];
  professions: string[];
  totalWithEmail: number;
  totalSent: number;
  totalUnsent: number;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
}

export async function listProspects(): Promise<ProspectListResult> {
  const [rows, dailyUsed] = await Promise.all([findAllProspects(), getDailyCount({ channel: 'email' })]);

  const dailyLimit = Number(process.env.PROSPECTION_DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  const totalWithEmail = rows.length;
  const totalSent = rows.filter((p) => p.status === 'sent').length;
  const totalUnsent = rows.filter((p) => p.status === 'new').length;

  const unsent = rows.filter((p) => p.status === 'new');
  const professions = [...new Set(unsent.map((p) => p.profession))].sort();

  return {
    prospects: rows.map((r) => ({
      id: r.id,
      profession: r.profession,
      firstName: r.firstName,
      fullName: r.fullName,
      email: r.email,
      phone: r.phone,
      status: r.status,
    })),
    professions,
    totalWithEmail,
    totalSent,
    totalUnsent,
    dailyLimit,
    dailyUsed,
    dailyRemaining: Math.max(0, dailyLimit - dailyUsed),
  };
}
