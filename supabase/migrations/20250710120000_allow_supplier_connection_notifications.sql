-- Migration: Allow suppliers to create connection response notifications for admins

-- Make sure RLS is enabled (it should already be)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Remove old policy if it conflicts (optional – safe if policy doesn't exist)
DROP POLICY IF EXISTS "Suppliers can create connection response notifications" ON notifications;

-- Allow any authenticated user to create notifications for connection responses **as long as** their email matches supplier_email
CREATE POLICY "Suppliers can create connection response notifications" ON notifications
FOR INSERT TO authenticated
WITH CHECK (
  (type IN ('connection_accepted', 'connection_declined')) AND
  supplier_email = auth.email()
); 