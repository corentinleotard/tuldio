import path from 'node:path';

const FILES_DIR = process.env.FILES_DIR || '/var/tuldio/files';

export function getFilePath(fileUrl: string): string {
  const relative = fileUrl.replace(/^\/files\//, '');
  return path.join(FILES_DIR, relative);
}
