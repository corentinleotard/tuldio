import { useMemo } from 'react';
import type { ClientView } from '@tuldio/types';

interface GroupedClients {
  letter: string;
  clients: ClientView[];
}

export function useGroupedClients(clients: ClientView[]): GroupedClients[] {
  return useMemo(() => {
    const groups = new Map<string, ClientView[]>();
    for (const client of clients) {
      const sortKey = client.companyName ?? client.lastName ?? client.firstName ?? '';
      const letter = sortKey.charAt(0).toUpperCase() || '#';
      if (!groups.has(letter)) groups.set(letter, []);
      groups.get(letter)!.push(client);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([letter, clients]) => ({ letter, clients }));
  }, [clients]);
}
