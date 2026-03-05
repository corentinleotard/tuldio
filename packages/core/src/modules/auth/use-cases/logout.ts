import { revokeRefreshToken } from '../repository/revoke-refresh-token.js';

export async function logout(input: { token: string }): Promise<void> {
  await revokeRefreshToken(input.token);
}
