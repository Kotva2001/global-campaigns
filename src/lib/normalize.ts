/**
 * Diacritics-insensitive string normalization for search/filter inputs.
 * Strips combining marks (č→c, š→s, á→a, ň→n, ř→r, etc.) and lowercases.
 */
export const normalize = (str: string): string =>
  (str ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Convenience: returns true if haystack contains needle, both normalized. */
export const matchesNormalized = (haystack: string, needle: string): boolean =>
  normalize(haystack).includes(normalize(needle));