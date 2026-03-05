import { insertClient } from '../repository/insert-client.js';
import { toClientView, type ClientView } from '../domain/client.view.js';

export async function createClient(input: {
  teamId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}): Promise<ClientView> {
  const client = await insertClient(input);

  return toClientView(client);
}
