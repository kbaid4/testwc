-- Allow suppliers to read events they are invited to or linked to
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view invited/public events" ON public.events
FOR SELECT TO authenticated
USING (
  visibility = 'public'
  OR EXISTS (
    SELECT 1 FROM public.invites i
    WHERE i.event_id = id
      AND i.supplier_email = auth.email()
  )
  /*
   * NOTE: The clause below referenced event_suppliers which itself has an RLS
   * policy that references events, leading Postgres to detect an infinite
   * recursion when both policies are evaluated in the same statement.
   * Until we can refactor the event_suppliers policies so they do not depend
   * on events (or switch to a SECURITY DEFINER helper function), we remove
   * this condition.  Suppliers will still see events they are invited to
   * via the invites table and any public events.
   */
  -- OR EXISTS (
  --   SELECT 1 FROM public.event_suppliers es
  --   WHERE es.event_id = id
  --     AND es.supplier_user_id = auth.uid()
  -- )
); 