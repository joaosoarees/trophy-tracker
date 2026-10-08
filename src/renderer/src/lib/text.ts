/** Minúsculas e sem acentos, para busca. */
export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

export const matches = (query: string, ...fields: string[]): boolean => {
  const q = normalize(query.trim())
  return q === '' || fields.some((f) => normalize(f).includes(q))
}
