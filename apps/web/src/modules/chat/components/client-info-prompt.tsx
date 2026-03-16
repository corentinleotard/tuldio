import { useState } from 'react';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MissingField {
  key: 'email' | 'address' | 'siret';
  label: string;
  placeholder: string;
  type?: string;
}

interface ClientInfoPromptProps {
  clientName: string | null;
  missingFields: MissingField[];
  actionLabel: string;
  onSubmit: (values: Record<string, string>) => void;
  loading: boolean;
}

export function ClientInfoPrompt({ clientName, missingFields, actionLabel, onSubmit, loading }: ClientInfoPromptProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function isValid(): boolean {
    return missingFields.every((f) => {
      const v = (values[f.key] ?? '').trim();
      if (!v) return false;
      if (f.key === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      return true;
    });
  }

  function handleSubmit() {
    if (!isValid()) return;
    const trimmed: Record<string, string> = {};
    for (const f of missingFields) {
      trimmed[f.key] = (values[f.key] ?? '').trim();
    }
    onSubmit(trimmed);
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-3">
      <p className="mb-2.5 text-xs font-medium text-muted-foreground">
        Complète les infos de {clientName ?? 'ce client'} pour continuer
      </p>
      <div className="space-y-2">
        {missingFields.map((field) => (
          <input
            key={field.key}
            type={field.type ?? 'text'}
            placeholder={field.placeholder}
            value={values[field.key] ?? ''}
            onChange={(e) => handleChange(field.key, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && isValid() && handleSubmit()}
            className="h-8 w-full rounded-md border border-input bg-card px-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus={field === missingFields[0]}
          />
        ))}
      </div>
      <div className="mt-2.5 flex justify-end">
        <Button
          size="sm"
          className="h-8 gap-1.5 px-4"
          disabled={!isValid() || loading}
          onClick={handleSubmit}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

/** Build the list of missing client fields based on readiness errors + whether email is needed */
export function getMissingClientFields(input: {
  needsEmail: boolean;
  clientEmail?: string | null;
  readinessErrors: { code: string }[];
}): MissingField[] {
  const fields: MissingField[] = [];

  if (input.needsEmail && !input.clientEmail) {
    fields.push({ key: 'email', label: 'Email', placeholder: 'email@exemple.com', type: 'email' });
  }

  const hasAddressError = input.readinessErrors.some((e) => e.code === 'MISSING_CLIENT_ADDRESS');
  if (hasAddressError) {
    fields.push({ key: 'address', label: 'Adresse postale', placeholder: 'Adresse postale du client' });
  }

  const hasSiretError = input.readinessErrors.some((e) => e.code === 'MISSING_CLIENT_SIRET');
  if (hasSiretError) {
    fields.push({ key: 'siret', label: 'SIRET', placeholder: 'SIRET du client' });
  }

  return fields;
}
