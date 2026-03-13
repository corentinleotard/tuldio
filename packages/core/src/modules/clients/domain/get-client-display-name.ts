/**
 * Returns the display name for a client.
 * B2B (company_name set): company name, with optional contact person in parentheses.
 * B2C: "firstName lastName".
 */
export function getClientDisplayName(client: {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}): string {
  if (client.company_name) {
    const contact = [client.first_name, client.last_name].filter(Boolean).join(' ');
    return contact ? `${client.company_name} (${contact})` : client.company_name;
  }
  return [client.first_name, client.last_name].filter(Boolean).join(' ');
}
