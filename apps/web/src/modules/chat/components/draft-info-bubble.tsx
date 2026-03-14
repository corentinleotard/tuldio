import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';

interface ReadinessError {
  code: string;
  message: string;
}

interface DraftInfoBubbleProps {
  documentType: 'quote' | 'invoice';
  errors: ReadinessError[];
  showTutorial: boolean;
}

export function DraftInfoBubble({ documentType, errors, showTutorial }: DraftInfoBubbleProps) {
  const isQuote = documentType === 'quote';
  const hasErrors = errors.length > 0;

  return (
    <div className="mt-2 max-w-[92%] rounded-bubble-ai border bg-card px-4 py-3 text-sm text-card-foreground">
      <p className="text-muted-foreground">
        {isQuote ? 'Ton devis est en brouillon' : 'Ta facture est en brouillon'}, tu peux encore tout modifier.
        {' '}
        {hasErrors
          ? 'Ecris-moi ici ce que tu veux changer.'
          : isQuote
            ? "Ecris-moi ici ce que tu veux changer, ou dis-moi quand tu l'as envoyé."
            : "Ecris-moi ici ce que tu veux changer, ou dis-moi quand tu l'as envoyée."
        }
      </p>

      {hasErrors && (
        <div className="mt-2 space-y-1">
          {errors.map((err) => (
            <p key={err.code} className="text-sm text-destructive">
              {err.message}
            </p>
          ))}
        </div>
      )}

      {showTutorial && (
        <p className="mt-2.5 border-t pt-2.5 text-xs text-muted-foreground">
          Pense à vérifier tes infos entreprise sur le PDF (TVA, conditions de paiement, assurance...). Tu peux les modifier à tout moment dans{' '}
          <Link
            to="/settings/company"
            className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1 font-semibold text-primary hover:bg-primary/15"
          >
            <Settings className="h-3 w-3" />
            Compte &gt; Mon entreprise
          </Link>
        </p>
      )}
    </div>
  );
}
