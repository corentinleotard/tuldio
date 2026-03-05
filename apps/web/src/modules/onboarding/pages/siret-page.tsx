import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2 } from 'lucide-react';
import type { SiretLookupResponse } from '@tuldio/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { lookupSiret, updateTeam } from '../api/onboarding.api';

export function SiretPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [siret, setSiret] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState<SiretLookupResponse | null>(null);

  async function handleLookup() {
    const cleaned = siret.replace(/\s/g, '');
    if (cleaned.length !== 14) {
      setError('Le SIRET doit contenir 14 chiffres');
      return;
    }

    setIsLooking(true);
    setError('');
    try {
      const result = await lookupSiret(cleaned);
      setCompany(result);
    } catch {
      setError('SIRET introuvable. Verifiez le numero.');
    } finally {
      setIsLooking(false);
    }
  }

  async function handleContinue() {
    if (!company) return;
    setIsSaving(true);
    try {
      await updateTeam({
        name: company.name,
        siret: company.siret,
        address: company.address,
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
      navigate('/onboarding/templates');
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div className="h-2 w-6 rounded-full bg-primary" />
          <div className="h-2 w-2 rounded-full bg-secondary" />
        </div>

        <div className="text-center">
          <h1 className="text-xl font-semibold">Votre entreprise</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            On recupere vos infos automatiquement
          </p>
        </div>

        <div className="space-y-3">
          <Input
            placeholder="123 456 789 00012"
            value={siret}
            onChange={(e) => {
              setSiret(e.target.value);
              setCompany(null);
              setError('');
            }}
            maxLength={17}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}

          {!company && (
            <Button
              className="w-full"
              onClick={handleLookup}
              disabled={isLooking || siret.replace(/\s/g, '').length < 14}
            >
              {isLooking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Rechercher
            </Button>
          )}
        </div>

        {company && (
          <Card>
            <CardContent className="flex items-start gap-3 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              <div>
                <p className="font-semibold">{company.name}</p>
                <p className="text-sm text-muted-foreground">{company.address}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  SIRET: {company.siret}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {company && (
          <Button className="w-full" onClick={handleContinue} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Continuer
          </Button>
        )}
      </div>
    </div>
  );
}
