-- Enable RLS and policies for events and related tables to ensure data is visible across devices

-- Enable RLS on events table (if not already enabled)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Allow admins (owners) to select their own events
CREATE POLICY "Admins can view their events" ON public.events
FOR SELECT TO authenticated
USING ( admin_id = auth.uid()::uuid );

-- Allow admins to insert events with their own admin_id (already enforced in frontend)
CREATE POLICY "Admins can insert events" ON public.events
FOR INSERT TO authenticated
WITH CHECK ( admin_id = auth.uid()::uuid );

-- Allow admins to update their own events
CREATE POLICY "Admins can update their events" ON public.events
FOR UPDATE TO authenticated
USING ( admin_id = auth.uid()::uuid )
WITH CHECK ( admin_id = auth.uid()::uuid );

-- ----------------------------------------------------------------
-- event_suppliers table policies so suppliers & admins can read links
-- ----------------------------------------------------------------

-- Enable RLS on event_suppliers
ALTER TABLE public.event_suppliers ENABLE ROW LEVEL SECURITY;

-- Suppliers can view rows where they are linked via supplier_user_id or supplier_email
CREATE POLICY "Supplier can view their event links" ON public.event_suppliers
FOR SELECT TO authenticated
USING ( supplier_user_id = auth.uid()::uuid OR supplier_email = auth.email() );

-- Admins can view rows for events they own
CREATE POLICY "Admin can view links for their events" ON public.event_suppliers
FOR SELECT TO authenticated
USING (
  EXISTS ( SELECT 1 FROM public.events e WHERE e.id = event_suppliers.event_id AND e.admin_id = auth.uid()::uuid )
);

-- Admins can insert links for their events
CREATE POLICY "Admin can insert supplier links" ON public.event_suppliers
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS ( SELECT 1 FROM public.events e WHERE e.id = event_suppliers.event_id AND e.admin_id = auth.uid()::uuid )
); 