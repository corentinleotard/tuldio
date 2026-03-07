import { findClientsByTeam } from '../repository/find-clients-by-team.js';
import { toClientView, type ClientView } from '../domain/client.view.js';

export async function listClients(teamId: string): Promise<ClientView[]> {
  const clients = await findClientsByTeam({ teamId });

  return clients.map(toClientView);
}
