import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadZone } from '../components/upload-zone';
import { uploadTemplate } from '../api/onboarding.api';

type Step = 'quote' | 'invoice';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('quote');
  const [quoteFile, setQuoteFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (step === 'quote') {
      setQuoteFile(file);
    } else {
      setInvoiceFile(file);
    }
  }

  async function handleNext() {
    const file = step === 'quote' ? quoteFile : invoiceFile;

    if (file) {
      setIsUploading(true);
      setError(null);
      try {
        await uploadTemplate({ file, type: step });
      } catch {
        const message = 'Erreur lors de l\u2019analyse du modele. Reessayez.';
        setError(message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    if (step === 'quote') {
      setStep('invoice');
    } else {
      navigate('/chat');
    }
  }

  function handleSkip() {
    if (step === 'quote') {
      setStep('invoice');
    } else {
      navigate('/chat');
    }
  }

  const currentFile = step === 'quote' ? quoteFile : invoiceFile;
  const isQuote = step === 'quote';
  const label = isQuote ? 'devis' : 'facture';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div className="h-2 w-6 rounded-full bg-primary" />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold">
            Votre modele de {label}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isQuote
              ? 'Prenez en photo un devis que vous utilisez deja. On s\u2019en servira comme modele.'
              : 'Meme chose pour vos factures. Prenez en photo ou uploadez un PDF.'}
          </p>
        </div>

        {currentFile ? (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <CheckCircle className="h-5 w-5 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{currentFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(currentFile.size / 1024).toFixed(0)} Ko
              </p>
            </div>
          </div>
        ) : (
          <UploadZone
            onFile={handleFile}
            label="Prendre une photo ou choisir un fichier"
            hint="PDF, JPG ou PNG"
          />
        )}

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}

        <div className="space-y-3">
          <Button className="w-full" onClick={handleNext} disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyse du modele...
              </>
            ) : step === 'invoice' ? (
              'Commencer a utiliser Tuldio'
            ) : (
              'Continuer'
            )}
          </Button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isUploading}
            className="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Passer cette etape
          </button>
        </div>
      </div>
    </div>
  );
}
