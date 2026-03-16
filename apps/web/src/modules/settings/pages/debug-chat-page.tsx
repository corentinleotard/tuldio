import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, ChevronRight, Search, Wrench, Zap, Clock, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Message, DebugTrace, DebugTraceRound } from '@tuldio/common';
import { fetchUsers, fetchDebugMessages } from '../api/settings.api';

function formatCost(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 4,
  });
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
  return n.toLocaleString('fr-FR');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// --- Components ---

function ToolCallRow(props: { tc: { name: string; input: unknown; output: unknown; durationMs: number } }) {
  const [open, setOpen] = useState(false);
  const { tc } = props;

  return (
    <div className="border-l-2 border-primary/30 pl-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-1 text-left text-sm transition-colors hover:text-primary"
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <Wrench className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="font-mono text-xs font-medium">{tc.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{formatDuration(tc.durationMs)}</span>
      </button>
      {open && (
        <div className="mt-1 space-y-2 pb-2 pl-5">
          <div>
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Input</p>
            <pre className="mt-0.5 max-h-40 overflow-auto rounded-lg bg-secondary/50 p-2 text-xs">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Output</p>
            <pre className="mt-0.5 max-h-40 overflow-auto rounded-lg bg-secondary/50 p-2 text-xs">
              {JSON.stringify(tc.output, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function RoundBlock(props: { round: DebugTraceRound; index: number }) {
  const { round, index } = props;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Round {index + 1}</span>
        <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{formatTokens(round.inputTokens + round.outputTokens)} tokens</span>
        <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{formatCost(round.costCents)}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(round.durationMs)}</span>
      </div>
      {round.toolCalls.length > 0 ? (
        <div className="space-y-1">
          {round.toolCalls.map((tc, i) => (
            <ToolCallRow key={i} tc={tc} />
          ))}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">Final text response</p>
      )}
    </div>
  );
}

function TraceBlock(props: { trace: DebugTrace }) {
  const { trace } = props;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs font-medium">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
          {trace.rounds.length} round{trace.rounds.length > 1 ? 's' : ''}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5">
          {formatTokens(trace.totalTokens)} tokens
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5">
          {formatCost(trace.totalCostCents)}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5">
          {formatDuration(trace.totalDurationMs)}
        </span>
      </div>
      <div className="space-y-2">
        {trace.rounds.map((round, i) => (
          <RoundBlock key={i} round={round} index={i} />
        ))}
      </div>
    </div>
  );
}

function MessagePair(props: { userMsg: Message; assistantMsg: Message }) {
  const [expanded, setExpanded] = useState(false);
  const { userMsg, assistantMsg } = props;
  const trace = assistantMsg.debugTrace;

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* User message */}
      <div className="border-b bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{userMsg.content}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{formatTime(userMsg.createdAt)}</span>
        </div>
      </div>

      {/* Trace toggle */}
      {trace && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 border-b px-4 py-2 text-left text-xs font-medium text-primary transition-colors hover:bg-secondary/50"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {trace.rounds.length} round{trace.rounds.length > 1 ? 's' : ''} — {formatTokens(trace.totalTokens)} tokens — {formatCost(trace.totalCostCents)} — {formatDuration(trace.totalDurationMs)}
        </button>
      )}

      {expanded && trace && (
        <div className="border-b bg-secondary/20 p-4">
          <TraceBlock trace={trace} />
        </div>
      )}

      {/* Assistant message */}
      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{assistantMsg.content}</p>
      </div>
    </div>
  );
}

function MessageTimeline(props: { messages: Message[] }) {
  const pairs: { userMsg: Message; assistantMsg: Message }[] = [];

  for (let i = 0; i < props.messages.length; i++) {
    const msg = props.messages[i]!;
    if (msg.role === 'user') {
      const next = props.messages[i + 1];
      if (next && next.role === 'assistant') {
        pairs.push({ userMsg: msg, assistantMsg: next });
        i++;
      }
    }
  }

  if (pairs.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Aucun message.</p>;
  }

  return (
    <div className="space-y-3">
      {pairs.map((pair) => (
        <MessagePair key={pair.userMsg.id} userMsg={pair.userMsg} assistantMsg={pair.assistantMsg} />
      ))}
    </div>
  );
}

// --- Page ---

export function DebugChatPage() {
  const navigate = useNavigate();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchUsers,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['admin', 'debug-messages', selectedUserId],
    queryFn: () => fetchDebugMessages(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const selectedUser = users?.find((u) => u.id === selectedUserId);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Reglages
      </button>

      <h1 className="mb-6 text-[22px] font-bold tracking-tight text-primary">
        Debug Chat
      </h1>

      {/* User selector */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            className="w-full appearance-none rounded-xl border bg-card py-2.5 pl-9 pr-4 text-sm transition-colors focus:border-primary focus:outline-none"
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
          >
            <option value="">Selectionner un utilisateur...</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
      </div>

      {usersLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {selectedUser && messagesLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {selectedUser && messages && (
        <>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold">{selectedUser.name}</h2>
            <span className="text-sm text-muted-foreground">{messages.length} messages</span>
          </div>
          <MessageTimeline messages={messages} />
        </>
      )}
    </div>
  );
}
