-- Bundled polish migration covering three small Round-3 findings:
--   • M6 (backend half): partial unique index on events.source_url for scraped
--     rows so re-runs of the scraper can't insert near-duplicates even if its
--     in-memory dedup key drifts.
--   • L-14: validate p_type at the top of create_chat (00017) so an invalid
--     value raises a clear error instead of leaning on the CHECK constraint
--     message ("violates check constraint chats_type_check").
--   • L-15: comment-only documentation note that tag_relations (from 00003)
--     is intentionally unread by today's ranker. The table itself is left in
--     place — future work to weight by it is tracked in CODE_REVIEW_REPORT_3.

-- ──────────────────────────────────────────────────────────────────────────────
-- M6 (backend) — Scraper dedup index
--
-- The scraper (scripts/scrape-events.mjs) currently dedupes in-memory on a
-- title|start_at|coords tuple, but identical re-runs of the workflow risk
-- inserting near-duplicates if any of those values shifts (rounded coords,
-- minute-level start_at jitter, etc.). The right identity for a scraped event
-- is its source URL — Eventbrite/Ticketmaster/etc. all assign a stable URL per
-- listing. The partial index enforces that uniqueness for `source='scraped'`
-- rows that have a non-NULL source_url, and leaves user-created rows
-- untouched.
--
-- One-time cleanup BEFORE creating the index: rows already in the table that
-- share a source_url with another row had source_url set to the LISTING page
-- URL (the city browse URL) rather than the per-event canonical URL — the
-- live scraper writes the per-event URL via the JSON-LD `url` field
-- (scrape-events.mjs:188), but the FALLBACK_EVENTS path used to write the
-- listing URL for all three hand-rolled seed events, and every CI fallback
-- run minted three rows sharing the same value. The listing URL is not a
-- meaningful per-event identity, so clear it (NULL is excluded by the
-- partial WHERE clause below, so the index applies cleanly to the
-- remaining well-formed rows and to every future scrape). The scraper has
-- been patched to write NULL for fallback seeds going forward, so this
-- cleanup is one-shot.
UPDATE public.events
   SET source_url = NULL
 WHERE source = 'scraped'
   AND source_url IN (
     SELECT source_url
       FROM public.events
      WHERE source = 'scraped' AND source_url IS NOT NULL
      GROUP BY source_url
      HAVING COUNT(*) > 1
   );
-- ──────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS events_scraped_source_url_uniq
  ON public.events (source_url)
  WHERE source = 'scraped' AND source_url IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────────────────
-- L-14 — create_chat: validate p_type before the INSERT
--
-- The chats.type column has CHECK (type IN ('dm','group')) (00006). Passing an
-- invalid value used to error with a generic constraint message; now we raise
-- with a useful one. Everything else about the function is preserved from
-- 00017.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_chat(
  p_member_ids UUID[],
  p_type       TEXT,
  p_title      TEXT DEFAULT ''
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me       UUID := auth.uid();
  members  UUID[];
  existing UUID;
  new_id   UUID;
  m        UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- L-14: pre-validate the enum-ish chat type. The CHECK constraint on
  -- chats.type catches this too, but its error message ("violates check
  -- constraint chats_type_check") is not actionable.
  IF p_type NOT IN ('dm', 'group') THEN
    RAISE EXCEPTION 'Invalid chat type: %', p_type;
  END IF;

  SELECT array_agg(uid ORDER BY uid)
    INTO members
  FROM (SELECT DISTINCT unnest(array_append(p_member_ids, me)) AS uid) s;

  SELECT c.id INTO existing
  FROM chats c
  WHERE c.type = p_type
    AND (
      SELECT array_agg(cm.user_id ORDER BY cm.user_id)
      FROM chat_members cm
      WHERE cm.chat_id = c.id
    ) = members
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO chats (type, title) VALUES (p_type, p_title)
  RETURNING id INTO new_id;

  FOREACH m IN ARRAY members LOOP
    INSERT INTO chat_members (chat_id, user_id) VALUES (new_id, m);
  END LOOP;

  RETURN new_id;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- L-15 — Note: tag_relations is intentionally unread today
--
-- The `tag_relations` table from 00003 was provisioned for FR3.4 (related-tag
-- matching) but is not consulted by `rank_events_query` (00012). The live
-- related-tag signal is the `similar_tags` text array on the interests row,
-- which the scraper uses when auto-tagging and which the ranker effectively
-- inherits via shared interest IDs. Weighting events by tag_relations is
-- tracked as future work in CODE_REVIEW_REPORT_3 L-15.
--
-- COMMENT ON TABLE persists the note in pg_catalog so anyone inspecting the
-- schema sees it without grepping migrations.
-- ──────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.tag_relations IS
  'Provisioned for FR3.4 related-tag weighting. Currently unread by '
  'rank_events_query — the live related-tag signal is interests.similar_tags. '
  'Wiring this into the ranker is tracked in CODE_REVIEW_REPORT_3 L-15.';
