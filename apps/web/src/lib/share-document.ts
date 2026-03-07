import { API_URL } from './api-fetch';

async function fetchPdfBlob(pdfUrl: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${pdfUrl}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Impossible de telecharger le PDF');
  return res.blob();
}

function buildMailtoUrl(input: {
  email: string;
  subject: string;
  body: string;
}): string {
  const subject = encodeURIComponent(input.subject);
  const body = encodeURIComponent(input.body);
  return `mailto:${encodeURIComponent(input.email)}?subject=${subject}&body=${body}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareDocument(input: {
  pdfUrl: string;
  fileName: string;
  clientEmail: string;
  subject: string;
  body: string;
}): Promise<void> {
  const blob = await fetchPdfBlob(input.pdfUrl);
  downloadBlob(blob, input.fileName);
  window.location.href = buildMailtoUrl({
    email: input.clientEmail,
    subject: input.subject,
    body: input.body,
  });
}

export function viewDocument(input: { pdfUrl: string }): void {
  window.open(`${API_URL}${input.pdfUrl}`, '_blank');
}

export async function downloadDocument(input: {
  pdfUrl: string;
  fileName: string;
}): Promise<void> {
  const blob = await fetchPdfBlob(input.pdfUrl);
  downloadBlob(blob, input.fileName);
}
