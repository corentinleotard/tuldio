import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { SearchInput } from '@/components/ui/search-input';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchClients, searchClients } from '../api/clients.api.js';
import { useGroupedClients } from '../hooks/use-grouped-clients.js';
import { ClientListItem } from '../components/client-list-item.js';
import { ClientDetail } from '../components/client-detail.js';

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const allClientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
  });

  const searchQuery = useQuery({
    queryKey: ['clients', 'search', debouncedSearch],
    queryFn: () => searchClients(debouncedSearch),
    enabled: debouncedSearch.length > 0,
  });

  const isSearching = debouncedSearch.length > 0;
  const clients = isSearching
    ? (searchQuery.data ?? [])
    : (allClientsQuery.data ?? []);
  const isLoading = isSearching ? searchQuery.isLoading : allClientsQuery.isLoading;

  const grouped = useGroupedClients(clients);
  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4 md:px-5 md:pb-4 md:pt-5">
        <h1 className="text-[22px] font-bold tracking-tight text-primary">Clients</h1>
        {!isLoading && clients.length > 0 && (
          <span className="text-[13px] font-medium text-muted-foreground">
            {clients.length} client{clients.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* List panel */}
        <div className="flex w-full flex-col border-r border-border md:w-[380px]">
          <div className="p-4">
            <SearchInput
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : clients.length === 0 ? (
              <EmptyState
                icon={Users}
                message={
                  isSearching
                    ? 'Aucun client trouvé pour cette recherche.'
                    : "Aucun client pour l'instant. Mentionnez un client dans le chat pour l'ajouter !"
                }
              />
            ) : (
              grouped.map((group) => (
                <div key={group.letter}>
                  <p className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">
                    {group.letter}
                  </p>
                  {group.clients.map((client) => (
                    <ClientListItem
                      key={client.id}
                      client={client}
                      isSelected={client.id === selectedId}
                      onClick={() => setSelectedId(client.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail panel — desktop only */}
        <div className="hidden flex-1 overflow-y-auto md:block">
          {selectedClient ? (
            <ClientDetail client={selectedClient} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Sélectionnez un client pour voir ses détails
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
