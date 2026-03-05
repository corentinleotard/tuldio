import fs from 'node:fs';
import path from 'node:path';
import { generateId } from '../infra/id.js';

const FILES_DIR = process.env.FILES_DIR || '/var/tuldio/files';

export async function storeFile(input: {
  subdir: string;
  buffer: Buffer;
  extension: string;
}): Promise<string> {
  const dir = path.join(FILES_DIR, input.subdir);
  fs.mkdirSync(dir, { recursive: true });

  const filename = `${generateId()}${input.extension}`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, input.buffer);

  return `/files/${input.subdir}/${filename}`;
}
