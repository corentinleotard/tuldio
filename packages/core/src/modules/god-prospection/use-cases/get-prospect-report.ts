import { findProspectStats, findRecentProspects } from '../repository/find-prospect-stats.js';

export interface ProspectReport {
  byProfession: Array<{
    profession: string;
    total: number;
    newCount: number;
    sent: number;
    error: number;
    formContacted: number;
    avgScore: number | null;
  }>;
  total: number;
  totalNew: number;
  totalSent: number;
  totalError: number;
  totalFormContacted: number;
  recentProspects: Array<{
    id: string;
    profession: string;
    fullName: string;
    email: string;
    website: string | null;
    status: string;
    contactedVia: string | null;
    icpScore: number | null;
    icpReason: string | null;
    sentAt: string | null;
    createdAt: string;
  }>;
}

export async function getProspectReport(): Promise<ProspectReport> {
  const [stats, recent] = await Promise.all([
    findProspectStats(),
    findRecentProspects({ limit: 50 }),
  ]);

  return {
    ...stats,
    recentProspects: recent.map((r) => ({
      ...r,
      sentAt: r.sentAt ? r.sentAt.toISOString().slice(0, 10) : null,
      createdAt: r.createdAt.toISOString().slice(0, 10),
    })),
  };
}
