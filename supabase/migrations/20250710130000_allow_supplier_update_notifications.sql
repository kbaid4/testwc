-- Migration: Allow suppliers to update (mark read) their own notifications

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Suppliers can update their notifications" ON notifications;
 
CREATE POLICY "Suppliers can update their notifications" ON notifications
FOR UPDATE TO authenticated
USING (supplier_email = auth.email()); 