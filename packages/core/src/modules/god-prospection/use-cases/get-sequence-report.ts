import { findSequenceStats } from '../repository/find-sequence-stats.js';
import { findSequenceActivity } from '../repository/find-sequence-activity.js';
import { findSequenceFunnel } from '../repository/find-sequence-funnel.js';
import { findSequenceById } from '../repository/find-sequence-by-id.js';

export interface SequenceReportView {
  sequenceId: string;
  sequenceName: string;
  funnel: Array<{
    stepOrder: number;
    channel: string;
    sent: number;
    pending: number;
  }>;
  replyRate: number;
  totalAssigned: number;
  completed: number;
  errors: number;
  recentActivity: Array<{
    prospectName: string;
    channel: string;
    stepOrder: number;
    sentAt: string;
  }>;
}

export async function getSequenceReport(input: {
  sequenceId: string;
}): Promise<SequenceReportView> {
  const sequence = await findSequenceById({ id: input.sequenceId });
  if (!sequence) {
    throw new Error('Sequence introuvable');
  }

  const [stats, funnel, activity] = await Promise.all([
    findSequenceStats({ sequenceId: input.sequenceId }),
    findSequenceFunnel({ sequenceId: input.sequenceId }),
    findSequenceActivity({ sequenceId: input.sequenceId, limit: 20 }),
  ]);

  const replyRate = stats.totalAssigned > 0
    ? stats.replied / stats.totalAssigned
    : 0;

  return {
    sequenceId: input.sequenceId,
    sequenceName: sequence.name,
    funnel,
    replyRate,
    totalAssigned: stats.totalAssigned,
    completed: stats.completed,
    errors: stats.error,
    recentActivity: activity.map((a) => ({
      prospectName: a.prospectName,
      channel: a.channel,
      stepOrder: a.stepOrder,
      sentAt: a.sentAt,
    })),
  };
}
