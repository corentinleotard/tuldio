import OpenAI from 'openai';
import fs from 'node:fs';
import { query } from '../database/db.js';
import { logger } from '../infra/logger.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2 });
  }
  return client;
}

const MODEL = 'whisper-1';

// $0.006 per minute = 0.6 cents/min
const COST_CENTS_PER_SECOND = 0.6 / 60;

// Domain vocabulary hint — improves accuracy on trade-specific French terms
// Covers: business, building trades, medical/osteopathy
const PROMPT_HINT = [
  'devis, facture, avoir, acompte, solde',
  'carrelage, faïence, enduit, placo, plâtre, parquet, stratifié',
  'plomberie, électricité, VMC, chaudière, cumulus, ballon',
  'ostéopathie, kinésithérapie, rachis cervical, dorsales, lombaires',
  'manipulation structurelle, fascia, viscéral, crânien, musculo-squelettique',
  'consultation, bilan, séance, patient, ordonnance',
  'HT, TTC, TVA, SIRET, SIREN',
  'mètre carré, mètre linéaire, forfait, unité',
].join(', ');

export interface TranscriptionResult {
  text: string;
  durationSeconds: number;
  costCents: number;
}

export async function transcribeAudio(input: {
  filePath: string;
  teamId: string;
  userId: string;
}): Promise<TranscriptionResult> {
  const openai = getClient();
  const start = Date.now();

  const fileStream = fs.createReadStream(input.filePath);

  // verbose_json returns duration — needed for accurate cost tracking
  const response = await openai.audio.transcriptions.create({
    model: MODEL,
    file: fileStream,
    language: 'fr',
    prompt: PROMPT_HINT,
    response_format: 'verbose_json',
  });

  const durationMs = Date.now() - start;
  const durationSeconds = Math.max(1, Math.round(response.duration ?? 1));
  const costCents = durationSeconds * COST_CENTS_PER_SECOND;

  logger.info('whisper.transcription', {
    model: MODEL,
    textLength: response.text.length,
    durationSeconds,
    costCents: costCents.toFixed(4),
    apiDurationMs: durationMs,
  });

  // Log to ai_calls table (same table as Claude calls)
  const isProd = process.env.NODE_ENV === 'production';
  query(
    `INSERT INTO ai_calls (team_id, user_id, model, purpose, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_cents, prompt_text, response_text, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      input.teamId,
      input.userId,
      MODEL,
      'voice-transcription',
      0,
      0,
      0,
      0,
      costCents,
      isProd ? null : `[audio: ${durationSeconds}s]`,
      isProd ? null : response.text.slice(0, 10000),
      durationMs,
    ],
  ).catch((err) => logger.error('Failed to log Whisper call', { error: err }));

  return {
    text: response.text,
    durationSeconds,
    costCents,
  };
}
