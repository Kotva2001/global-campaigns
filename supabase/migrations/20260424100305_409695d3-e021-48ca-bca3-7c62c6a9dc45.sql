CREATE OR REPLACE FUNCTION public._tmp_split_handles(input text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN input IS NULL OR btrim(input) = '' THEN NULL
    ELSE ARRAY(
      SELECT lower(btrim(regexp_replace(h, '^@+', '')))
      FROM unnest(regexp_split_to_array(input, '[\s,;]+')) AS h
      WHERE btrim(h) <> ''
    )
  END;
$$;

ALTER TABLE public.influencers
  ALTER COLUMN instagram_handle TYPE text[]
  USING public._tmp_split_handles(instagram_handle);

DROP FUNCTION public._tmp_split_handles(text);