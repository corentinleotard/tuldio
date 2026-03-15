import { expireTrials as expireTrialsRepo } from '../repository/expire-trials.js';

export async function expireTrials(): Promise<number> {
  return expireTrialsRepo();
}
