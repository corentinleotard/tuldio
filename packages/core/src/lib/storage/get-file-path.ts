import path from 'node:path';

const FILES_DIR = process.env.FILES_DIR || '/var/tuldio/files';

export function getFilePath(fileUrl: string): string {
  const relative = fileUrl.replace(/^\/files\//, '');
  const fullPath = path.resolve(FILES_DIR, relative);
  if (!fullPath.startsWith(path.resolve(FILES_DIR))) {
    throw new Error('Invalid file path');
  }
  return fullPath;
}
