import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Search,
  FileText,
  Plus,
  Trash2,
  X,
  Loader2,
  Eye,
  EyeOff,
  ImagePlus,
} from 'lucide-react';
import type { TeamField, FieldScope } from '@tuldio/types';
import { useAuth } from '@/lib/auth-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { API_URL } from '@/lib/api-fetch';
import {
  fetchTeamFields,
  updateTeamField,
  createTeamField,
  deleteTeamField,
  uploadLogo,
  deleteLogo,
  updateTeamSettings,
} from '../api/fields.api';
import { viewDocument } from '@/lib/share-document';

type Tab = 'company' | 'quote' | 'invoice';

const TAB_LABELS: Record<Tab, string> = {
  company: 'Entreprise',
  quote: 'Devis',
  invoice: 'Factures',
};

const ZONE_LABELS: Record<string, string> = {
  identity: 'Mon entreprise',
  payment: 'Paiement',
  legal: 'Mentions legales',
};

const ZONE_ORDER = ['identity', 'payment', 'legal'];

type VisibilityState = 'both' | 'quote' | 'invoice' | 'none';

function getVisibility(f: TeamField): VisibilityState {
  if (f.showQuote && f.showInvoice) return 'both';
  if (f.showQuote) return 'quote';
  if (f.showInvoice) return 'invoice';
  return 'none';
}

function nextVisibility(current: VisibilityState): { showQuote: boolean; showInvoice: boolean; state: VisibilityState } {
  switch (current) {
    case 'both': return { showQuote: true, showInvoice: false, state: 'quote' };
    case 'quote': return { showQuote: false, showInvoice: true, state: 'invoice' };
    case 'invoice': return { showQuote: false, showInvoice: false, state: 'none' };
    case 'none': return { showQuote: true, showInvoice: true, state: 'both' };
  }
}

const VISIBILITY_LABEL: Record<VisibilityState, string> = {
  both: 'Tous',
  quote: 'Devis',
  invoice: 'Facture',
  none: 'Aucun',
};

const VISIBILITY_COLOR: Record<VisibilityState, string> = {
  both: 'bg-primary/10 text-primary',
  quote: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  invoice: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  none: 'bg-secondary text-muted-foreground',
};

export function CompanyPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const { team } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [fields, setFields] = useState<TeamField[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingZone, setAddingZone] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [downloading, setDownloading] = useState<'quote' | 'invoice' | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(team?.logoUrl ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Team settings state
  const [quoteLastNumber, setQuoteLastNumber] = useState(team?.quoteLastNumber ?? 0);
  const [quoteValidityDays, setQuoteValidityDays] = useState(team?.quoteValidityDays ?? 30);
  const [invoiceLastNumber, setInvoiceLastNumber] = useState(team?.invoiceLastNumber ?? 0);
  const [invoicePaymentDelayDays, setInvoicePaymentDelayDays] = useState(team?.invoicePaymentDelayDays ?? 30);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const settingsDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const pendingSettingsRef = useRef<{ quoteLastNumber?: number; quoteValidityDays?: number; invoiceLastNumber?: number; invoicePaymentDelayDays?: number }>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Load fields
  useEffect(() => {
    if (team?.fields) {
      setFields(team.fields);
    }
    if (team?.logoUrl !== undefined) {
      setLogoUrl(team.logoUrl);
    }
    if (team) {
      setQuoteLastNumber(team.quoteLastNumber);
      setQuoteValidityDays(team.quoteValidityDays);
      setInvoiceLastNumber(team.invoiceLastNumber);
      setInvoicePaymentDelayDays(team.invoicePaymentDelayDays);
    }
    fetchTeamFields().then(setFields).catch(() => {});
  }, [team?.fields, team?.logoUrl, team?.quoteLastNumber, team?.quoteValidityDays, team?.invoiceLastNumber, team?.invoicePaymentDelayDays, team]);

  // Filter fields by active tab scope
  const tabScope: FieldScope | null = activeTab === 'company' ? 'both' : activeTab === 'quote' ? 'quote' : 'invoice';

  const filteredFields = fields.filter((f) => f.scope === tabScope);

  const visibleFields = filteredFields.filter((f) => {
    if (!search) return true;
    return f.label.toLowerCase().includes(search.toLowerCase()) ||
           f.value.toLowerCase().includes(search.toLowerCase());
  });

  const groupedByZone = ZONE_ORDER.map((zone) => ({
    zone,
    label: ZONE_LABELS[zone],
    fields: visibleFields.filter((f) => f.zone === zone),
  })).filter((g) => g.fields.length > 0);

  const handleSaveValue = useCallback(async (fieldId: string, value: string) => {
    setFields((prev) => prev.map((f) => f.id === fieldId ? { ...f, value } : f));
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const updated = await updateTeamField(fieldId, { value });
      setFields((prev) => prev.map((f) => f.id === fieldId ? updated : f));
      queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
    }, 500);
  }, [queryClient]);

  const handleToggleVisibility = useCallback(async (field: TeamField) => {
    if (field.scope === 'both') {
      // 4-state cycle for company fields
      const current = getVisibility(field);
      const next = nextVisibility(current);
      setFields((prev) => prev.map((f) =>
        f.id === field.id ? { ...f, showQuote: next.showQuote, showInvoice: next.showInvoice } : f
      ));
      const updated = await updateTeamField(field.id, {
        showQuote: next.showQuote,
        showInvoice: next.showInvoice,
      });
      setFields((prev) => prev.map((f) => f.id === field.id ? updated : f));
    } else {
      // Simple on/off for scoped fields
      const isVisible = field.scope === 'quote' ? field.showQuote : field.showInvoice;
      const payload = field.scope === 'quote'
        ? { showQuote: !isVisible }
        : { showInvoice: !isVisible };
      setFields((prev) => prev.map((f) =>
        f.id === field.id ? { ...f, ...payload } : f
      ));
      const updated = await updateTeamField(field.id, payload);
      setFields((prev) => prev.map((f) => f.id === field.id ? updated : f));
    }
    queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
  }, [queryClient]);

  const handleCreateField = useCallback(async (zone: string) => {
    if (!newLabel.trim()) return;
    const created = await createTeamField({
      label: newLabel.trim(),
      zone: zone as TeamField['zone'],
      scope: tabScope,
    });
    setFields((prev) => [...prev, created]);
    setAddingZone(null);
    setNewLabel('');
    queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
  }, [newLabel, queryClient, tabScope]);

  const handleDeleteField = useCallback(async (fieldId: string) => {
    await deleteTeamField(fieldId);
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
  }, [queryClient]);

  const handleDownload = useCallback(async (type: 'quote' | 'invoice') => {
    setDownloading(type);
    try {
      await viewDocument({ pdfUrl: `/api/teams/me/preview-pdf?type=${type}` });
    } catch {
      // ignore
    } finally {
      setDownloading(null);
    }
  }, []);

  const handleLogoUpload = useCallback(async (file: File) => {
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      setLogoUrl(url);
      queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
    } catch {
      // ignore
    } finally {
      setUploadingLogo(false);
    }
  }, [queryClient]);

  const handleLogoDelete = useCallback(async () => {
    await deleteLogo();
    setLogoUrl(null);
    queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
  }, [queryClient]);

  const handleSaveSettings = useCallback((updates: { quoteLastNumber?: number; quoteValidityDays?: number; invoiceLastNumber?: number; invoicePaymentDelayDays?: number }) => {
    pendingSettingsRef.current = { ...pendingSettingsRef.current, ...updates };
    clearTimeout(settingsDebounceRef.current);
    settingsDebounceRef.current = setTimeout(async () => {
      const merged = pendingSettingsRef.current;
      pendingSettingsRef.current = {};
      await updateTeamSettings(merged);
      queryClient.invalidateQueries({ queryKey: ['auth', 'bootstrap'] });
    }, 500);
  }, [queryClient]);

  const startEditing = useCallback((field: TeamField) => {
    setEditingId(field.id);
    setEditValue(field.value);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const finishEditing = useCallback(() => {
    if (editingId) {
      const field = fields.find((f) => f.id === editingId);
      if (field && editValue !== field.value) {
        handleSaveValue(editingId, editValue);
      }
    }
    setEditingId(null);
  }, [editingId, editValue, fields, handleSaveValue]);

  // Render visibility badge for a field
  const renderVisibilityBadge = (field: TeamField) => {
    if (field.scope === 'both') {
      const vis = getVisibility(field);
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleToggleVisibility(field); }}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${VISIBILITY_COLOR[vis]}`}
          title={`Visible sur: ${VISIBILITY_LABEL[vis]}`}
        >
          {vis === 'none' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {VISIBILITY_LABEL[vis]}
        </button>
      );
    }

    // Scoped fields: simple on/off
    const isVisible = field.scope === 'quote' ? field.showQuote : field.showInvoice;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleToggleVisibility(field); }}
        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
          isVisible ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
        }`}
        title={isVisible ? 'Visible' : 'Masque'}
      >
        {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        {isVisible ? 'Visible' : 'Masque'}
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b bg-card px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack ?? (() => navigate('/settings'))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <h1 className="text-lg font-semibold">Mon entreprise</h1>
        </div>

        {/* Tab bar + Search (single line on desktop, stacked on mobile) */}
        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex h-12 w-fit items-center gap-0.5 rounded-2xl border border-input bg-background px-1">
            {(['company', 'quote', 'invoice'] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); setSearch(''); setEditingId(null); setAddingZone(null); }}
                className={`flex items-center rounded-xl px-3.5 text-xs font-medium transition-colors h-[calc(100%-6px)] ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un champ..."
                className="pl-8 text-sm"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              onClick={() => handleDownload(activeTab === 'invoice' ? 'invoice' : 'quote')}
              className="shrink-0 gap-1.5 text-xs"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              Apercu
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">

        {/* Settings section for Devis tab */}
        {activeTab === 'quote' && !search && (
          <div className="mb-5">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Numerotation & validite
            </span>
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <div className="w-[120px] shrink-0 md:w-[160px]">
                  <span className="text-[13px] font-medium text-foreground">Dernier n&deg; de devis</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={quoteLastNumber}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      setQuoteLastNumber(v);
                      handleSaveSettings({ quoteLastNumber: v });
                    }}
                    className="h-7 w-28 text-[13px]"
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">Prochain : {quoteLastNumber + 1}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="w-[120px] shrink-0 md:w-[160px]">
                  <span className="text-[13px] font-medium text-foreground">Validite (jours)</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    type="number"
                    min={1}
                    value={quoteValidityDays}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value) || 30);
                      setQuoteValidityDays(v);
                      handleSaveSettings({ quoteValidityDays: v });
                    }}
                    className="h-7 w-28 text-[13px]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings section for Factures tab */}
        {activeTab === 'invoice' && !search && (
          <div className="mb-5">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Param&egrave;tres
            </span>
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <div className="w-[120px] shrink-0 md:w-[160px]">
                  <span className="text-[13px] font-medium text-foreground">Dernier n&deg; de facture</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    type="number"
                    min={0}
                    value={invoiceLastNumber}
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value) || 0);
                      setInvoiceLastNumber(v);
                      handleSaveSettings({ invoiceLastNumber: v });
                    }}
                    className="h-7 w-28 text-[13px]"
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">Prochain : {invoiceLastNumber + 1}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5">
                <div className="w-[120px] shrink-0 md:w-[160px]">
                  <span className="text-[13px] font-medium text-foreground">D&eacute;lai de paiement (jours)</span>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    type="number"
                    min={1}
                    value={invoicePaymentDelayDays}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value) || 30);
                      setInvoicePaymentDelayDays(v);
                      handleSaveSettings({ invoicePaymentDelayDays: v });
                    }}
                    className="h-7 w-28 text-[13px]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fields grid */}
        {groupedByZone.map(({ zone, label, fields: zoneFields }) => (
          <div key={zone} className="mb-5">
            {/* Zone header */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAddingZone(addingZone === zone ? null : zone);
                  setNewLabel('');
                }}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </button>
            </div>

            {/* Logo block — only in identity zone on company tab, before fields */}
            {zone === 'identity' && activeTab === 'company' && !search && (
              <div className="mb-2 overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-[120px] shrink-0 md:w-[160px]">
                    <span className="text-[13px] font-medium text-foreground">Logo</span>
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {uploadingLogo ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : logoUrl ? (
                      <img
                        src={`${API_URL}${logoUrl}`}
                        alt="Logo"
                        className="h-10 max-w-[120px] rounded object-contain"
                      />
                    ) : (
                      <span className="text-[13px] italic text-muted-foreground/50">
                        Aucun logo
                      </span>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                  >
                    <ImagePlus className="h-3 w-3" />
                    {logoUrl ? 'Modifier' : 'Ajouter'}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleLogoDelete}
                      className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Add custom field inline */}
            {addingZone === zone && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateField(zone);
                    if (e.key === 'Escape') setAddingZone(null);
                  }}
                  placeholder="Nom du champ..."
                  className="h-8 flex-1 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => handleCreateField(zone)}
                  disabled={!newLabel.trim()}
                  className="h-8 text-xs"
                >
                  Ajouter
                </Button>
              </div>
            )}

            {/* Field rows */}
            <div className="overflow-hidden rounded-xl border bg-card">
              {zoneFields.length === 0 && (
                <div className="px-4 py-3 text-center text-sm text-muted-foreground">
                  Aucun champ
                </div>
              )}
              {zoneFields.map((field, idx) => {
                const isEditing = editingId === field.id;

                return (
                  <div
                    key={field.id}
                    className={`flex items-center gap-2 px-4 py-2.5 ${
                      idx < zoneFields.length - 1 ? 'border-b' : ''
                    } ${isEditing ? '' : 'cursor-pointer transition-colors hover:bg-secondary/50'}`}
                    onClick={() => {
                      if (!isEditing && field.key !== 'tva_exempt') startEditing(field);
                    }}
                  >
                    {/* Label */}
                    <div className="w-[120px] shrink-0 md:w-[160px]">
                      <span className="text-[13px] font-medium text-foreground">
                        {field.label}
                      </span>
                      {!field.isSystem && (
                        <span className="ml-1 text-[10px] text-muted-foreground" title="Champ personnalise">&#10022;</span>
                      )}
                    </div>

                    {/* Value */}
                    <div className="min-w-0 flex-1 overflow-hidden">
                      {field.key === 'tva_exempt' ? (
                        <Checkbox
                          checked={field.value === 'true'}
                          onChange={(checked) => {
                            handleSaveValue(field.id, checked ? 'true' : '');
                          }}
                        />
                      ) : isEditing ? (
                        <Input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={finishEditing}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishEditing();
                            if (e.key === 'Escape') {
                              setEditingId(null);
                            }
                          }}
                          className="h-7 text-[13px]"
                        />
                      ) : (
                        <p className={`truncate text-[13px] ${field.value ? 'text-foreground' : 'text-muted-foreground/50 italic'}`}>
                          {field.value || 'Non renseigne'}
                        </p>
                      )}
                    </div>

                    {/* Visibility toggle */}
                    {renderVisibilityBadge(field)}

                    {/* Delete custom field */}
                    {!field.isSystem && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteField(field.id);
                        }}
                        className="shrink-0 text-muted-foreground/50 transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
