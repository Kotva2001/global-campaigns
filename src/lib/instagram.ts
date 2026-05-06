const safeDecode = (raw: string): string => {
  if (!raw.includes("%")) return raw;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const normalizeInstagramHandle = (handle: string | null | undefined) =>
  safeDecode((handle ?? "").trim()).replace(/^@+/, "").toLowerCase();

export const parseInstagramHandles = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map(normalizeInstagramHandle)
        .filter(Boolean),
    ),
  );

export const instagramHandlesFromValue = (value: string | string[] | null | undefined) =>
  Array.isArray(value) ? value.map(normalizeInstagramHandle).filter(Boolean) : parseInstagramHandles(value ?? "");

export const formatInstagramHandles = (value: string | string[] | null | undefined) =>
  instagramHandlesFromValue(value).join("\n");
