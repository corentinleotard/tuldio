import { searchClients } from '../repository/search-clients.js';
import { toClientView, type ClientView } from '../domain/client.view.js';

export async function searchClientsUc(input: {
  teamId: string;
  search: string;
}): Promise<ClientView[]> {
  const clients = await searchClients(input);

  return clients.map(toClientView);
}
