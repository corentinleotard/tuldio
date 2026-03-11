// Auth
export interface OtpSendRequest {
  email: string;
}

export interface OtpVerifyRequest {
  email: string;
  code: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  teamId: string;
  role: 'owner' | 'member';
  god: boolean;
}

export type FieldScope = 'both' | 'quote' | 'invoice';

export interface TeamField {
  id: string;
  key: string;
  label: string;
  value: string;
  zone: 'identity' | 'payment' | 'legal';
  scope: FieldScope;
  showQuote: boolean;
  showInvoice: boolean;
  sortOrder: number;
  isSystem: boolean;
}

export interface TeamSummary {
  id: string;
  name: string;
  logoUrl: string | null;
  fields: TeamField[];
  quoteLastNumber: number;
  quoteValidityDays: number;
  invoiceLastNumber: number;
  invoicePaymentDelayDays: number;
  termsAcceptedAt: string | null;
  subscriptionStatus: 'trial' | 'active' | 'cancelled' | 'expired';
  trialEndsAt: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  team: TeamSummary;
}

export interface BootstrapResponse {
  user: AuthUser;
  team: TeamSummary;
  messages: Message[];
}

// Team Fields
export interface UpdateTeamFieldRequest {
  value?: string;
  showQuote?: boolean;
  showInvoice?: boolean;
}

export interface CreateTeamFieldRequest {
  label: string;
  zone: 'identity' | 'payment' | 'legal';
  scope?: FieldScope;
  value?: string;
}

export interface UpdateTeamSettingsRequest {
  quoteLastNumber?: number;
  quoteValidityDays?: number;
  invoiceLastNumber?: number;
  invoicePaymentDelayDays?: number;
}

export interface UpdateTeamRequest {
  name?: string;
}

// Clients
export interface ClientNote {
  content: string;
  type: 'note' | 'warning';
  createdAt: string;
}

export interface ClientView {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: ClientNote[];
  createdAt: string;
}

export interface CreateClientRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
}

// Document Lines (shared between quotes and invoices)
export interface DocumentLineView {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number; // basis points (2000 = 20%)
  totalHt: number;
  prestationId: string | null;
}

export interface TvaGroupView {
  tvaRate: number;
  baseHt: number;
  tvaMontant: number;
}

// Quotes
export interface QuoteView {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  title: string | null;
  lines: DocumentLineView[];
  totalHt: number;
  totalTtc: number;
  tvaGroups: TvaGroupView[];
  status: 'draft' | 'sent' | 'accepted' | 'refused' | 'cancelled';
  pdfUrl: string | null;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface CreateQuoteLineRequest {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  tvaRate?: number;
}

export interface CreateQuoteRequest {
  clientId: string;
  title?: string;
  lines: CreateQuoteLineRequest[];
}

// Invoices
export type InvoiceType = 'standard' | 'acompte' | 'solde' | 'situation' | 'avoir';

export interface InvoiceView {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  quoteId: string | null;
  title: string | null;
  lines: DocumentLineView[];
  totalHt: number;
  totalTtc: number;
  tvaGroups: TvaGroupView[];
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  invoiceType: InvoiceType;
  sourceInvoiceId: string | null;
  sourceInvoiceNumber: string | null;
  situationNumber: number | null;
  avoirId: string | null;
  pdfUrl: string | null;
  sentAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  dueDate: string | null;
  prestationDate: string | null;
  createdAt: string;
}

export interface CreateInvoiceLineRequest {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  tvaRate?: number;
}

export interface CreateInvoiceRequest {
  clientId: string;
  title?: string;
  lines: CreateInvoiceLineRequest[];
  dueDate?: string;
  prestationDate?: string;
}

// Past Pricing
export interface PastPricingView {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  tvaRate: number;
  totalHt: number;
  documentType: 'quote' | 'invoice';
  documentNumber: string;
  clientName: string;
  createdAt: string;
  score: number;
}

// Prestations
export interface PrestationView {
  id: string;
  type: 'service' | 'fourniture';
  description: string;
  reference: string | null;
  unit: string;
  defaultUnitPrice: number | null;
  defaultTvaRate: number;
  archived: boolean;
}

// Messages
export interface Attachment {
  type: string;
  url: string;
  name: string;
}

export interface RichCard {
  type: string;
  data: unknown;
}

export interface DebugTraceToolCall {
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export interface DebugTraceRound {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  durationMs: number;
  toolCalls: DebugTraceToolCall[];
}

export interface DebugTrace {
  rounds: DebugTraceRound[];
  totalTokens: number;
  totalCostCents: number;
  totalDurationMs: number;
}

export interface Message {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: Attachment[];
  toolCalls: unknown;
  richCard: RichCard | null;
  quickReplies: string[] | null;
  debugTrace: DebugTrace | null;
  createdAt: string;
}

export interface MessageMetadata {
  selectedClientId?: string;
}

export interface SendMessageRequest {
  content: string;
  attachments?: Attachment[];
  metadata?: MessageMetadata;
}

// Stats
export interface MonthlyStatsView {
  revenue: { totalHt: number; totalTtc: number; count: number };
  unpaid: { total: number; count: number };
  quoteConversion: { total: number; accepted: number; rate: number };
  bestClient: { clientId: string; clientName: string; total: number } | null;
}

// AI Calls
export interface AiCallView {
  id: string;
  model: string;
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costCents: number;
  durationMs: number;
  createdAt: string;
}

export interface AiCostsSummary {
  totalCostCents: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  calls: AiCallView[];
}

// Demand State
export interface DemandClient {
  id: string;
  name: string;
}

export interface DemandActiveDocument {
  id: string;
  type: 'quote' | 'invoice';
}

export interface DemandState {
  client: DemandClient | null;
  document: DemandActiveDocument | null;
  pendingCandidates?: DemandClient[] | null;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  cursor: string | null;
}
