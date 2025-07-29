-- Enable RLS on notifications table if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy that allows suppliers to view their own notifications
CREATE POLICY "Suppliers can view their notifications" ON notifications 
FOR SELECT USING (supplier_email = auth.email());

-- Create policy that allows admins to create notifications for any supplier
CREATE POLICY "Admins can create notifications" ON notifications 
FOR INSERT TO authenticated USING (auth.jwt() ->> 'user_metadata'::text = '{"user_type":"admin"}');
