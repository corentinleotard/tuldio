import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, ChevronLeft } from 'lucide-react';
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
    <div className="flex h-full">
      {/* List panel */}
      <div className={`flex w-full flex-shrink-0 flex-col border-r border-border md:w-[380px] ${selectedId ? 'hidden md:flex' : ''}`}>
        {/* Header */}
        <div className="border-b border-border px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-bold tracking-tight text-primary">Clients</h1>
            {!isLoading && clients.length > 0 && (
              <span className="text-[13px] font-medium text-muted-foreground">
                {clients.length} client{clients.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="mt-3">
            <SearchInput
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!isLoading && clients.length === 0 && (
            <EmptyState
              icon={Users}
              message={
                isSearching
                  ? 'Aucun client trouvé pour cette recherche.'
                  : "Aucun client pour l'instant. Mentionnez un client dans le chat pour l'ajouter !"
              }
            />
          )}

          {!isLoading &&
            (() => {
              return grouped.map((group) => (
                <div key={group.letter}>
                  <p className="bg-secondary/50 px-5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
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
              ));
            })()}
        </div>
      </div>

      {/* Detail panel */}
      <div className={`flex-1 overflow-y-auto ${selectedId ? '' : 'hidden md:block'}`}>
        {selectedClient ? (
          <div>
            {/* Mobile back header */}
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 md:hidden">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex items-center gap-1 text-sm font-medium text-primary"
              >
                <ChevronLeft className="h-5 w-5" />
                Clients
              </button>
            </div>
            <ClientDetail client={selectedClient} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-12 text-center">
            <div className="mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-primary/10">
              <Users className="h-10 w-10 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="mb-2 text-[22px] font-bold tracking-tight">
              Vos clients, en un coup d&rsquo;oeil
            </h2>
            <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
              Sélectionnez un client à gauche pour voir ses informations, ses notes et son
              historique.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
