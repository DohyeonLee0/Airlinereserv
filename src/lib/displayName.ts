export function buildDisplayName(firstName: string, middleName?: string | null, lastName?: string) {
  return [firstName, middleName?.trim() || null, lastName].filter(Boolean).join(" ");
}
