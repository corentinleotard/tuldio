import { useQuery } from '@tanstack/react-query';
import { fetchReport } from '../api/god-prospection.api';

const statusLabel: Record<string, string> = {
  new: 'Nouveau',
  sent: 'Envoyé',
  error: 'Erreur',
};

const statusColor: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
};

export function ProspectReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['god-prospection', 'report'],
    queryFn: fetchReport,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={data.total} />
        <StatCard label="Prêts à contacter" value={data.totalNew} color="text-blue-600" />
        <StatCard label="Emails envoyés" value={data.totalSent} color="text-green-600" />
        <StatCard label="Erreurs" value={data.totalError} color="text-red-600" />
      </div>

      {/* By profession table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Par profession</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Profession</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Nouveaux</th>
                <th className="px-3 py-2 text-right font-medium">Envoyés</th>
                <th className="px-3 py-2 text-right font-medium">Erreurs</th>
                <th className="px-3 py-2 text-right font-medium">Score ICP</th>
              </tr>
            </thead>
            <tbody>
              {data.byProfession.map((row) => (
                <tr key={row.profession} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{row.profession}</td>
                  <td className="px-3 py-2 text-right">{row.total}</td>
                  <td className="px-3 py-2 text-right text-blue-600">{row.newCount}</td>
                  <td className="px-3 py-2 text-right text-green-600">{row.sent}</td>
                  <td className="px-3 py-2 text-right text-red-600">{row.error || '-'}</td>
                  <td className="px-3 py-2 text-right">
                    {row.avgScore ? (
                      <span className={row.avgScore >= 7 ? 'text-green-600' : 'text-muted-foreground'}>
                        {row.avgScore}/10
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent prospects */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Derniers prospects ({data.recentProspects.length})
        </h3>
        <div className="space-y-1.5">
          {data.recentProspects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{p.fullName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{p.profession}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{p.email}</span>
                  {p.website && (
                    <>
                      <span>·</span>
                      <span className="truncate">{p.website}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {p.icpScore && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.icpScore >= 8
                        ? 'bg-green-100 text-green-700'
                        : p.icpScore >= 6
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                    title={p.icpReason || ''}
                  >
                    {p.icpScore}/10
                  </span>
                )}

                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[p.status] || 'bg-gray-100 text-gray-700'}`}
                >
                  {statusLabel[p.status] || p.status}
                  {p.contactedVia === 'form' && ' (form)'}
                </span>

                <span className="text-xs text-muted-foreground">{p.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard(props: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className={`text-2xl font-bold ${props.color || ''}`}>{props.value}</div>
    </div>
  );
}
