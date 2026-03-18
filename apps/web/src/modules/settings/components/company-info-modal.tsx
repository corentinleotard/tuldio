import { useState, useRef, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, ChevronLeft, Upload, Loader2, Check, Info, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { OtpInput } from '@/components/ui/otp-input';
import { updateTeam, acceptTerms, uploadDocument } from '@/modules/onboarding/api/onboarding.api';
import { updateTeamField } from '@/modules/settings/api/fields.api';
import { sendOtp, verifyOtp } from '@/modules/auth/api/auth.api';
import { cn } from '@/lib/utils';

interface CompanyInfoModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  errors: Array<{ code: string; message: string }>;
  documentType: 'quote' | 'invoice';
}

type Step = 1 | 2 | 3;

interface CompanyForm {
  name: string;
  siret: string;
  address: string;
  phone: string;
  email: string;
  tvaNumber: string;
  tvaExempt: boolean;
}

function getFieldValue(fields: { key: string; value: string }[], key: string): string {
  return fields.find((f) => f.key === key)?.value ?? '';
}

function getFieldId(fields: { id: string; key: string }[], key: string): string | undefined {
  return fields.find((f) => f.key === key)?.id;
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

function hasErrorCode(errors: Array<{ code: string }>, code: string): boolean {
  return errors.some((e) => e.code === code);
}

function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className={cn(
            'h-2 rounded-full transition-all',
            s === current && 'w-6 bg-primary',
            s < current && 'w-2 bg-primary',
            s > current && 'w-2 bg-secondary',
          )}
        />
      ))}
    </div>
  );
}

export function CompanyInfoModal({ open, onClose, onComplete, errors, documentType }: CompanyInfoModalProps) {
  const { team, user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fields = team?.fields ?? [];

  const [step, setStep] = useState<Step>(1);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<CompanyForm>({
    name: team?.name ?? '',
    siret: formatSiret(getFieldValue(fields, 'siret')),
    address: getFieldValue(fields, 'address'),
    phone: getFieldValue(fields, 'phone'),
    email: getFieldValue(fields, 'email'),
    tvaNumber: formatTva(getFieldValue(fields, 'tva_number')),
    tvaExempt: getFieldValue(fields, 'tva_exempt') === 'true',
  });

  // Step 2 state
  const [clientAddress, setClientAddress] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const needsEmail = !user?.email;
  const needsClientAddress = hasErrorCode(errors, 'MISSING_CLIENT_ADDRESS');
  const needsClientSiret = hasErrorCode(errors, 'MISSING_CLIENT_SIRET');

  if (!open) return null;

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
        email: getFieldValue(uf, 'email'),
        tvaNumber: formatTva(getFieldValue(uf, 'tva_number')),
        tvaExempt: false,
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
    } finally {
      setUploading(false);
    }
  }

  async function handleStep1Submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await updateTeam({ name: form.name.trim() });

      const fieldUpdates: { key: string; value: string }[] = [
        { key: 'siret', value: form.siret.replace(/\s/g, '').trim() },
        { key: 'address', value: form.address.trim() },
        { key: 'phone', value: form.phone.trim() },
        { key: 'email', value: form.email.trim() },
        { key: 'tva_exempt', value: form.tvaExempt ? 'true' : '' },
        { key: 'tva_number', value: form.tvaExempt ? '' : form.tvaNumber.replace(/\s/g, '').trim() },
      ];

      for (const { key, value } of fieldUpdates) {
        const fieldId = getFieldId(fields, key);
        if (fieldId) {
          await updateTeamField(fieldId, { value });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    setOtpLoading(true);
    setError('');
    try {
      await sendOtp(otpEmail.trim());
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi du code");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true);
    setError('');
    try {
      await verifyOtp({ email: otpEmail.trim(), code: otpCode });
      setOtpVerified(true);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    } finally {
      setOtpLoading(false);
    }
  }

  function canContinueStep1(): boolean {
    const hasName = form.name.trim().length > 0;
    const hasSiret = form.siret.replace(/\s/g, '').length > 0;
    const hasAddress = form.address.trim().length > 0;
    const hasTva = form.tvaExempt || form.tvaNumber.replace(/\s/g, '').length > 0;
    return hasName && hasSiret && hasAddress && hasTva;
  }

  function canContinueStep2(): boolean {
    if (!termsAccepted) return false;
    if (needsEmail && !otpVerified) return false;
    if (needsClientAddress && !clientAddress.trim()) return false;
    return true;
  }

  function handleStep2Continue() {
    setError('');
    setStep(3);
  }

  async function handleFinalSubmit() {
    setLoading(true);
    setError('');
    try {
      // Accept terms
      await acceptTerms();
      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setError('');
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  }

  const docLabel = documentType === 'quote' ? 'devis' : 'facture';

  // Field highlight for missing required fields
  function isFieldMissing(value: string): boolean {
    return value.trim().length === 0;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 flex flex-col bg-background',
          // Mobile: fullscreen. Desktop: centered modal.
          'h-full w-full md:h-auto md:max-h-[90vh] md:w-[540px] md:rounded-2xl md:border md:border-border md:shadow-lg',
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-5 pt-safe-top">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <h1 className="text-xl font-semibold">Informations requises</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step dots */}
        <div className="shrink-0 px-5 pt-4">
          <StepDots current={step} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </div>
    </div>
  );

  function renderStep1() {
    return (
      <form onSubmit={handleStep1Submit} className="flex flex-col">
        <h2 className="text-center text-lg font-semibold">Votre entreprise</h2>
        <p className="mb-5 mt-1 text-center text-[13px] text-muted-foreground">
          Ces informations apparaitront sur vos documents.
        </p>

        {/* Upload zone */}
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
          disabled={uploading}
          className="mb-2 flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-input p-4 text-left transition-colors hover:border-primary hover:bg-primary-lightest disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
          ) : (
            <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1">
            <div className="text-sm font-medium">
              {uploading ? 'Analyse en cours...' : 'Importer un document existant'}
            </div>
            <div className="text-[12px] text-muted-foreground">Devis ou facture (PDF, image)</div>
          </div>
        </button>

        {/* Divider */}
        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[12px] text-muted-foreground">ou remplir</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Nom entreprise <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.name}
              onChange={(e) => updateFormField('name', e.target.value)}
              placeholder="Ex : Dupont Renovation"
              className={cn('font-semibold', isFieldMissing(form.name) && 'border-orange-400')}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                SIRET <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.siret}
                onChange={(e) => updateFormField('siret', e.target.value)}
                placeholder="123 456 789 00012"
                className={cn(isFieldMissing(form.siret) && 'border-orange-400')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Adresse <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.address}
                onChange={(e) => updateFormField('address', e.target.value)}
                placeholder="12 rue des Lilas, 75011 Paris"
                className={cn(isFieldMissing(form.address) && 'border-orange-400')}
              />
            </div>
          </div>

          {/* TVA */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Checkbox checked={form.tvaExempt} onChange={(v) => setForm((prev) => ({ ...prev, tvaExempt: v }))} />
              <span className="text-[13px] text-muted-foreground">Exonere de TVA</span>
            </div>
            {!form.tvaExempt && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  N° TVA <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.tvaNumber}
                  onChange={(e) => updateFormField('tvaNumber', e.target.value)}
                  placeholder="FR 32 123456789"
                  className={cn(!form.tvaExempt && isFieldMissing(form.tvaNumber) && 'border-orange-400')}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Telephone</label>
              <Input
                value={form.phone}
                onChange={(e) => updateFormField('phone', e.target.value)}
                placeholder="01 23 45 67 89"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Email entreprise</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateFormField('email', e.target.value)}
                placeholder="contact@entreprise.fr"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <Button type="submit" className="mt-5 w-full" disabled={loading || !canContinueStep1()}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Continuer
        </Button>
      </form>
    );
  }

  function renderStep2() {
    return (
      <div className="flex flex-col">
        <h2 className="text-center text-lg font-semibold">Finalisation</h2>
        <p className="mb-5 mt-1 text-center text-[13px] text-muted-foreground">
          Quelques informations supplementaires pour envoyer votre {docLabel}.
        </p>

        {/* Missing client fields */}
        {(needsClientAddress || needsClientSiret) && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Informations client manquantes
            </div>
            {needsClientAddress && (
              <div className="mb-3">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Adresse du client <span className="text-destructive">*</span>
                </label>
                <Input
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Adresse du client"
                  className={cn(isFieldMissing(clientAddress) && 'border-orange-400')}
                />
              </div>
            )}
          </div>
        )}

        {/* Email section for token users */}
        {needsEmail && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Votre adresse email
            </div>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Pour vous reconnecter a votre compte et recevoir vos notifications.
            </p>

            {otpVerified ? (
              <div className="flex items-center gap-2 rounded-xl bg-primary-lightest p-3">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">{otpEmail}</span>
              </div>
            ) : otpSent ? (
              <div className="space-y-3">
                <p className="text-[13px] text-muted-foreground">
                  Code envoye a <span className="font-medium text-foreground">{otpEmail}</span>
                </p>
                <OtpInput value={otpCode} onChange={setOtpCode} />
                <Button
                  type="button"
                  className="w-full"
                  disabled={otpLoading || otpCode.length < 6}
                  onClick={handleVerifyOtp}
                >
                  {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Verifier
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode('');
                  }}
                  className="w-full text-center text-[13px] text-muted-foreground underline"
                >
                  Modifier l&apos;adresse
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                  placeholder="votre@email.fr"
                  className="flex-1"
                />
                <Button
                  type="button"
                  disabled={otpLoading || !otpEmail.trim().includes('@')}
                  onClick={handleSendOtp}
                >
                  {otpLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Envoyer code'}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* CGU checkbox */}
        <div className="mt-2 flex items-start gap-2.5">
          <Checkbox checked={termsAccepted} onChange={setTermsAccepted} className="mt-0.5" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            J&apos;accepte les{' '}
            <a
              href="https://tuldio.fr/cgu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              conditions generales d&apos;utilisation
            </a>{' '}
            et la{' '}
            <a
              href="https://tuldio.fr/confidentialite"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              politique de confidentialite
            </a>
            .
          </p>
        </div>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          className="mt-5 w-full"
          disabled={!canContinueStep2()}
          onClick={handleStep2Continue}
        >
          Continuer
        </Button>
      </div>
    );
  }

  function renderStep3() {
    const summaryFields = [
      { label: 'Entreprise', value: form.name },
      { label: 'SIRET', value: form.siret },
      { label: 'Adresse', value: form.address },
      form.phone ? { label: 'Telephone', value: form.phone } : null,
      form.email ? { label: 'Email', value: form.email } : null,
      { label: 'TVA', value: form.tvaExempt ? 'Exonere' : form.tvaNumber },
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    const legalDefaults = [
      { label: 'Escompte', value: 'Pas d\'escompte pour paiement anticipe' },
      { label: 'Penalites de retard', value: '3x le taux d\'interet legal' },
      { label: 'Indemnite de recouvrement', value: '40,00 EUR' },
      { label: 'Conditions de paiement', value: '30 jours' },
    ];

    return (
      <div className="flex flex-col">
        <h2 className="text-center text-lg font-semibold">Recapitulatif</h2>
        <p className="mb-5 mt-1 text-center text-[13px] text-muted-foreground">
          Verifiez vos informations avant d&apos;envoyer.
        </p>

        {/* Company info summary */}
        <div className="mb-4 rounded-xl border bg-card p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Votre entreprise
          </div>
          <div className="space-y-1.5">
            {summaryFields.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">{f.label}</span>
                <span className="text-right text-[13px] font-medium">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legal defaults */}
        <div className="mb-4 rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mentions legales
            </span>
            <a
              href="/settings/company"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
            >
              <Settings className="h-3 w-3" />
              Modifier
            </a>
          </div>
          <div className="space-y-1.5">
            {legalDefaults.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-muted-foreground">{f.label}</span>
                <span className="text-right text-[13px] font-medium">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Info callout */}
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-primary-lightest p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Conformes a la loi francaise. Modifiables dans{' '}
            <span className="font-medium text-foreground">Parametres &gt; Mon entreprise</span>.
          </p>
        </div>

        {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}

        <Button type="button" className="w-full" disabled={loading} onClick={handleFinalSubmit}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Valider et envoyer le {docLabel}
        </Button>
        <p className="mt-2 text-center text-[12px] text-muted-foreground">Sans engagement.</p>
      </div>
    );
  }
}
