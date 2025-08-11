-- Fix policy recursion: redefine supplier event select policy to exclude reference to event_suppliers

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can view invited/public events" ON public.events;

CREATE POLICY "Suppliers can view invited/public events" ON public.events
FOR SELECT TO authenticated
USING (
  visibility = 'public'
  OR EXISTS (
    SELECT 1 FROM public.invites i
    WHERE i.event_id = id
      AND i.supplier_email = auth.email()
  )
); 