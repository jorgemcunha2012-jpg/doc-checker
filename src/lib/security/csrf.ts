export function isAllowedMutationOrigin(origin: string | null, expectedOrigin: string) {
  return Boolean(origin && origin === expectedOrigin);
}
