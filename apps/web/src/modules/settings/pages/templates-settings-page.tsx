import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import type { TemplateView } from '@tuldio/types';
import { UploadZone } from '@/modules/onboarding/components/upload-zone';
import { fetchTemplates, uploadTemplate } from '../api/templates.api';

function TemplateCard(input: {
  label: string;
  type: 'quote' | 'invoice';
  template: TemplateView | null;
  onUpload: (file: File) => void;
  isUploading: boolean;
}) {
  if (input.isUploading) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyse du modele...</p>
      </div>
    );
  }

  if (input.template) {
    return (
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium">{input.label}</p>
            <p className="text-xs text-muted-foreground">
              Importe le {new Date(input.template.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <UploadZone
            onFile={input.onUpload}
            label="Remplacer le modele"
            hint="PDF, JPG ou PNG"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[15px] font-medium">{input.label}</p>
      <UploadZone
        onFile={input.onUpload}
        label="Importer un modele"
        hint="PDF, JPG ou PNG"
      />
    </div>
  );
}

export function TemplatesSettingsPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<'quote' | 'invoice' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch(() => setError('Impossible de charger les modeles'))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleUpload(input: { file: File; type: 'quote' | 'invoice' }) {
    setUploadingType(input.type);
    setError(null);
    try {
      const template = await uploadTemplate({ file: input.file, type: input.type });
      setTemplates((prev) => {
        const filtered = prev.filter((t) => t.type !== input.type);
        return [...filtered, template];
      });
    } catch {
      const message = 'Erreur lors de l\u2019analyse du modele. Reessayez.';
      setError(message);
    } finally {
      setUploadingType(null);
    }
  }

  const quoteTemplate = templates.find((t) => t.type === 'quote') ?? null;
  const invoiceTemplate = templates.find((t) => t.type === 'invoice') ?? null;

  return (
    <div className="mx-auto max-w-lg p-4 md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[22px] font-bold tracking-tight text-primary">Mes modeles</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <TemplateCard
            label="Modele de devis"
            type="quote"
            template={quoteTemplate}
            onUpload={(file) => handleUpload({ file, type: 'quote' })}
            isUploading={uploadingType === 'quote'}
          />
          <TemplateCard
            label="Modele de facture"
            type="invoice"
            template={invoiceTemplate}
            onUpload={(file) => handleUpload({ file, type: 'invoice' })}
            isUploading={uploadingType === 'invoice'}
          />
        </div>
      )}
    </div>
  );
}
