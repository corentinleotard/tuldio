import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

const FILES_DIR = process.env.FILES_DIR || '/var/tuldio/files';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createStorage(subdir: string) {
  const dir = path.join(FILES_DIR, subdir);
  ensureDir(dir);

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const name = `${crypto.randomUUID()}${ext}`;
      cb(null, name);
    },
  });
}

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé'));
  }
};

const MB = 1024 * 1024;

export const uploadDocument: Middleware = multer({
  storage: createStorage('documents'),
  fileFilter,
  limits: { fileSize: 5 * MB },
}).single('file') as unknown as Middleware;

export const uploadReceipt: Middleware = multer({
  storage: createStorage('receipts'),
  fileFilter,
  limits: { fileSize: 10 * MB },
}).single('file') as unknown as Middleware;

const logoFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers PNG, JPG et WebP sont autorises'));
  }
};

export const uploadLogo: Middleware = multer({
  storage: createStorage('logos'),
  fileFilter: logoFilter,
  limits: { fileSize: 2 * MB },
}).single('file') as unknown as Middleware;

const audioFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format audio non autorisé'));
  }
};

export const uploadAudio: Middleware = multer({
  storage: createStorage('audio'),
  fileFilter: audioFilter,
  limits: { fileSize: 10 * MB },
}).single('file') as unknown as Middleware;
