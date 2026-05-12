CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.search_products(search_term text, max_results int DEFAULT 20)
RETURNS SETOF public.products
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT *
  FROM public.products
  WHERE extensions.unaccent(lower(coalesce(name, '')))     LIKE '%' || extensions.unaccent(lower(coalesce(search_term, ''))) || '%'
     OR extensions.unaccent(lower(coalesce(sku, '')))      LIKE '%' || extensions.unaccent(lower(coalesce(search_term, ''))) || '%'
     OR extensions.unaccent(lower(coalesce(category, ''))) LIKE '%' || extensions.unaccent(lower(coalesce(search_term, ''))) || '%'
  ORDER BY name
  LIMIT max_results;
$$;