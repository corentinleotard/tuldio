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
}

export interface TeamSummary {
  id: string;
  name: string;
  siret: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  mobile: string | null;
  website: string | null;
  logoUrl: string | null;
  tvaNumber: string | null;
  tvaExempt: boolean;
  apeCode: string | null;
  legalForm: string | null;
  capitalSocial: number | null;
  rcsCity: string | null;
  rmCity: string | null;
  activityDescription: string | null;
  insuranceCompany: string | null;
  insurancePolicyNumber: string | null;
  insuranceCoverageZone: string | null;
  paymentTerms: string | null;
  depositPercent: number | null;
  earlyPaymentDiscount: string | null;
  latePenaltyRate: string | null;
  recoveryFee: number | null;
  customClauses: string[];
  originalDocumentUrl: string | null;
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

// Clients
export interface ClientNote {
  content: string;
  createdAt: string;
}

export interface ClientView {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: ClientNote[];
  createdAt: string;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

// Quotes
export interface QuoteLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteView {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  lines: QuoteLine[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
  status: 'draft' | 'sent' | 'accepted' | 'refused';
  pdfUrl: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CreateQuoteRequest {
  clientId: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  tvaRate: number;
}

// Invoices
export interface InvoiceView {
  id: string;
  number: string;
  clientId: string;
  clientName?: string;
  quoteId: string | null;
  lines: QuoteLine[];
  totalHt: number;
  totalTtc: number;
  tvaRate: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  pdfUrl: string | null;
  sentAt: string | null;
  paidAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface CreateInvoiceRequest {
  clientId: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  tvaRate: number;
  dueDate?: string;
}

// Expenses
export interface ExpenseView {
  id: string;
  amount: number;
  category: string | null;
  vendor: string | null;
  receiptUrl: string | null;
  date: string;
  createdAt: string;
}

export interface CreateExpenseRequest {
  amount: number;
  category?: string;
  vendor?: string;
  receiptUrl?: string;
  date: string;
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

export interface Message {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: Attachment[];
  toolCalls: unknown;
  richCard: RichCard | null;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
  attachments?: Attachment[];
}

// Stats
export interface MonthlyStatsView {
  revenue: { totalHt: number; totalTtc: number; count: number };
  expenses: { total: number; count: number };
  unpaid: { total: number; count: number };
  quoteConversion: { total: number; accepted: number; rate: number };
  bestClient: { clientId: string; clientName: string; total: number } | null;
}

// Teams
export interface UpdateTeamRequest {
  name?: string;
  siret?: string;
  address?: string;
  phone?: string;
  email?: string;
  mobile?: string;
  website?: string;
  tvaNumber?: string;
  tvaExempt?: boolean;
  apeCode?: string;
  legalForm?: string;
  capitalSocial?: number;
  rcsCity?: string;
  rmCity?: string;
  activityDescription?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceCoverageZone?: string;
  paymentTerms?: string;
  depositPercent?: number;
  earlyPaymentDiscount?: string;
  latePenaltyRate?: string;
  recoveryFee?: number;
  customClauses?: string[];
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  cursor: string | null;
}
