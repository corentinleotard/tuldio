import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, FileText, PenLine, ChevronRight, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { updateTeam, acceptTerms, uploadDocument, downloadPreviewPdf } from '../api/onboarding.api';
import { updateTeamField } from '@/modules/settings/api/fields.api';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3;

interface CompanyForm {
  name: string;
  siret: string;
  address: string;
  phone: string;
  mobile: string;
  email: string;
  tvaNumber: string;
}

function getFieldValue(fields: { key: string; value: string }[], key: string): string {
  return fields.find((f) => f.key === key)?.value ?? '';
}

function getFieldId(fields: { id: string; key: string }[], key: string): string | undefined {
  return fields.find((f) => f.key === key)?.id;
}

function StepIndicator({ current, onNavigate }: { current: Step; onNavigate: (step: Step) => void }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3].map((s) => (
        <button
          key={s}
          type="button"
          disabled={s >= current}
          onClick={() => onNavigate(s as Step)}
          className={cn(
            'h-2 rounded-full transition-all',
            s === current && 'w-6 rounded bg-primary',
            s < current && 'w-2 cursor-pointer bg-primary hover:opacity-70',
            s > current && 'w-2 bg-secondary',
          )}
        />
      ))}
    </div>
  );
}

export function OnboardingPage() {
  const { team } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fields = team?.fields ?? [];
  const siretVal = getFieldValue(fields, 'siret');
  const hasInfo = Boolean(team?.name || siretVal || getFieldValue(fields, 'address'));
  const [step, setStep] = useState<Step>(hasInfo ? 2 : 1);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<'quote' | 'invoice' | null>(null);
  const [form, setForm] = useState<CompanyForm>({
    name: team?.name ?? '',
    siret: formatSiret(siretVal),
    address: getFieldValue(fields, 'address'),
    phone: getFieldValue(fields, 'phone'),
    mobile: getFieldValue(fields, 'mobile'),
    email: getFieldValue(fields, 'email'),
    tvaNumber: formatTva(getFieldValue(fields, 'tva_number')),
  });

  if (team?.termsAcceptedAt && siretVal) {
    return <Navigate to="/chat" replace />;
  }

  function formatSiret(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)];
    return parts.filter(Boolean).join(' ');
  }

  function formatTva(value: string): string {
    const upper = value.toUpperCase();
    const digits = upper.replace(/[^0-9]/g, '').slice(0, 11);
    if (digits.length === 0) return upper.startsWith('F') ? upper.slice(0, 2) : '';
    const key = digits.slice(0, 2);
    const siren = digits.slice(2, 11);
    return `FR ${[key, siren].filter(Boolean).join(' ')}`;
  }

  function updateFormField(field: keyof CompanyForm, value: string) {
    if (field === 'siret') value = formatSiret(value);
    if (field === 'tvaNumber') value = formatTva(value);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError('');
    try {
      const updated = await uploadDocument(file);
      const uf = updated.fields;
      setForm({
        name: updated.name ?? '',
        siret: formatSiret(getFieldValue(uf, 'siret')),
        address: getFieldValue(uf, 'address'),
        phone: getFieldValue(uf, 'phone'),
        mobile: getFieldValue(uf, 'mobile'),
        email: getFieldValue(uf, 'email'),
        tvaNumber: formatTva(getFieldValue(uf, 'tva_number')),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Update team name
      await updateTeam({ name: form.name.trim() });

      // Update field values
      const fieldUpdates: { key: string; value: string }[] = [
        { key: 'siret', value: form.siret.replace(/\s/g, '').trim() },
        { key: 'address', value: form.address.trim() },
        { key: 'phone', value: form.phone.trim() },
        { key: 'mobile', value: form.mobile.trim() },
        { key: 'email', value: form.email.trim() },
        { key: 'tva_number', value: form.tvaNumber.replace(/\s/g, '').trim() },
      ];

      for (const { key, value } of fieldUpdates) {
        const fieldId = getFieldId(fields, key);
        if (fieldId) {
          await updateTeamField(fieldId, { value });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      await acceptTerms();
      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPreview(type: 'quote' | 'invoice') {
    setDownloading(type);
    try {
      await downloadPreviewPdf(type);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du telechargement');
    } finally {
      setDownloading(null);
    }
  }

  function navigateToStep(s: Step) {
    setError('');
    setStep(s);
  }

  const canContinue = form.name.trim() && form.siret.trim() && form.address.trim();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Desktop header */}
      <header className="hidden items-center justify-between border-b bg-card px-10 py-5 md:flex">
        <span className="text-2xl font-bold tracking-tight text-primary">Tuldio</span>
        <span className="text-[13px] italic text-muted-foreground">
          Tu lui dis, c&apos;est fait.
        </span>
      </header>

      {/* Main content */}
      <main
        className={cn(
          'flex flex-1 justify-center',
          step === 2
            ? 'items-stretch md:items-center md:py-12'
            : 'items-start pt-6 md:items-center md:py-12',
        )}
      >
        <div
          className={cn(
            'w-full',
            step === 2 ? 'max-w-[680px]' : 'max-w-[520px]',
            step === 2
              ? 'flex flex-col md:rounded-2xl md:border md:bg-card md:p-10'
              : 'px-7 text-center md:rounded-2xl md:border md:bg-card md:p-10',
          )}
        >
          {step === 1 && renderMethodStep()}
          {step === 2 && renderVerifyStep()}
          {step === 3 && renderModelsStep()}
        </div>
      </main>
    </div>
  );

  function renderMethodStep() {
    if (uploading) {
      return (
        <>
          <StepIndicator current={1} onNavigate={navigateToStep} />
          <h1 className="mt-4 text-xl font-semibold">Vos informations</h1>
          <div className="mt-16 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyse en cours...</p>
          </div>
        </>
      );
    }

    return (
      <>
        <StepIndicator current={1} onNavigate={navigateToStep} />
        <h1 className="mt-4 text-xl font-semibold">Vos informations</h1>
        <p className="mb-7 mt-2 text-sm leading-relaxed text-muted-foreground">
          Comment voulez-vous renseigner les infos de votre entreprise ?
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center gap-3.5 rounded-[14px] border-2 border-input bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary-lightest"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-lightest text-primary">
            <FileText className="h-[22px] w-[22px]" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Envoyer un document</div>
            <div className="text-[13px] leading-snug text-muted-foreground">
              Devis ou facture existante
            </div>
          </div>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
        </button>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={() => setStep(2)}
          className="mt-3 flex w-full items-center gap-3.5 rounded-[14px] border-2 border-input bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary-lightest"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-primary-lightest text-primary">
            <PenLine className="h-[22px] w-[22px]" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Saisir manuellement</div>
            <div className="text-[13px] leading-snug text-muted-foreground">
              Remplir les informations vous-meme
            </div>
          </div>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
        </button>
      </>
    );
  }

  function renderVerifyStep() {
    return (
      <form onSubmit={handleSaveInfo} className="flex flex-1 flex-col md:block">
        {/* Header */}
        <div className="shrink-0 px-7 pt-6 text-center md:px-0 md:pt-0">
          <StepIndicator current={2} onNavigate={navigateToStep} />
          <h1 className="mt-3 text-xl font-semibold">Verifiez vos informations</h1>
          <p className="mb-3 mt-1 text-[13px] text-muted-foreground">
            Elles apparaitront sur vos devis et factures.
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-7 pb-6 md:overflow-visible md:px-0">
          {/* Required fields */}
          <div className="mb-2.5 mt-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Obligatoires
          </div>
          <div className="md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-left text-xs text-muted-foreground">
                Nom de l&apos;entreprise <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                placeholder="Ex : Dupont Renovation"
                className="mb-2.5 font-semibold md:mb-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-left text-xs text-muted-foreground">SIRET <span className="text-destructive">*</span></label>
              <Input
                value={form.siret}
                onChange={(e) => updateFormField('siret', e.target.value)}
                placeholder="123 456 789 00012"
                className="mb-2.5 md:mb-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-left text-xs text-muted-foreground">Adresse <span className="text-destructive">*</span></label>
              <Input
                value={form.address}
                onChange={(e) => updateFormField('address', e.target.value)}
                placeholder="12 rue des Lilas, 75011 Paris"
                className="mb-2.5 md:mb-0"
              />
            </div>
          </div>

          {/* Complementary fields */}
          <div className="mb-2.5 mt-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Complementaires
          </div>
          <div className="md:grid md:grid-cols-2 md:gap-x-4 md:gap-y-3">
            <div>
              <label className="mb-1 block text-left text-xs text-muted-foreground">
                Telephone fixe
              </label>
              <Input
                value={form.phone}
                onChange={(e) => updateFormField('phone', e.target.value)}
                placeholder="01 23 45 67 89"
                className="mb-2.5 md:mb-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-left text-xs text-muted-foreground">
                Telephone mobile
              </label>
              <Input
                value={form.mobile}
                onChange={(e) => updateFormField('mobile', e.target.value)}
                placeholder="06 12 34 56 78"
                className="mb-2.5 md:mb-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-left text-xs text-muted-foreground">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateFormField('email', e.target.value)}
                placeholder="contact@dupont-renovation.fr"
                className="mb-2.5 md:mb-0"
              />
            </div>
            <div>
              <label className="mb-1 block text-left text-xs text-muted-foreground">
                N° TVA{' '}
                <span className="text-[11px] font-normal">(si assujetti)</span>
              </label>
              <Input
                value={form.tvaNumber}
                onChange={(e) => updateFormField('tvaNumber', e.target.value)}
                placeholder="FR 32 123456789"
                className="mb-2.5 md:mb-0"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            className="mt-3 w-full md:mt-6"
            disabled={loading || !canContinue}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continuer
          </Button>
        </div>
      </form>
    );
  }

  function renderModelsStep() {
    return (
      <>
        <StepIndicator current={3} onNavigate={navigateToStep} />
        <h1 className="mt-4 text-xl font-semibold">Vos modeles de documents</h1>
        <p className="mb-6 mt-2 text-sm leading-relaxed text-muted-foreground">
          Tuldio genere vos devis et factures avec votre identite. Voici un apercu.
        </p>

        {/* Download cards */}
        <div className="flex flex-col gap-4 md:flex-row">
          <button
            type="button"
            disabled={downloading === 'quote'}
            onClick={() => handleDownloadPreview('quote')}
            className="flex flex-1 items-center gap-3 rounded-xl border border-primary bg-primary-lightest p-4 text-left transition-colors hover:bg-primary-lightest/80 disabled:opacity-60"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-primary">Modele de devis</div>
              <div className="text-xs text-muted-foreground">
                Telecharger l&apos;apercu PDF
              </div>
            </div>
            {downloading === 'quote' ? (
              <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary" />
            ) : (
              <Download className="h-[18px] w-[18px] shrink-0 text-primary" />
            )}
          </button>

          <button
            type="button"
            disabled={downloading === 'invoice'}
            onClick={() => handleDownloadPreview('invoice')}
            className="flex flex-1 items-center gap-3 rounded-xl border border-primary bg-primary-lightest p-4 text-left transition-colors hover:bg-primary-lightest/80 disabled:opacity-60"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-primary">Modele de facture</div>
              <div className="text-xs text-muted-foreground">
                Telecharger l&apos;apercu PDF
              </div>
            </div>
            {downloading === 'invoice' ? (
              <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin text-primary" />
            ) : (
              <Download className="h-[18px] w-[18px] shrink-0 text-primary" />
            )}
          </button>
        </div>

        {/* Terms */}
        <div className="mt-7 flex items-start gap-2.5 text-left">
          <Checkbox checked={termsAccepted} onChange={setTermsAccepted} className="mt-0.5" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            J&apos;accepte les{' '}
            <a href="#" className="text-primary underline">
              conditions generales d&apos;utilisation
            </a>{' '}
            et je certifie que les informations fournies sont exactes.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          className="mt-5 w-full"
          disabled={loading || !termsAccepted}
          onClick={handleFinish}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Commencer a utiliser Tuldio
        </Button>
      </>
    );
  }
}
