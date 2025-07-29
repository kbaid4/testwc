-- Enable RLS on messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view messages they are involved in
CREATE POLICY "Users can view their own messages" ON messages
FOR SELECT
TO authenticated
USING (
  auth.uid()::text = admin_id OR 
  auth.email() = supplier_email OR
  auth.email() = sender OR
  auth.uid()::text = receiver
);

-- Policy for authenticated users to insert messages
CREATE POLICY "Users can insert messages" ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid()::text = admin_id OR 
  auth.email() = supplier_email OR
  auth.email() = sender
);

-- Policy for authenticated users to update their own messages (for read status)
CREATE POLICY "Users can update their own messages" ON messages
FOR UPDATE
TO authenticated
USING (
  auth.uid()::text = admin_id OR 
  auth.email() = supplier_email OR
  auth.email() = sender OR
  auth.uid()::text = receiver
)
WITH CHECK (
  auth.uid()::text = admin_id OR 
  auth.email() = supplier_email OR
  auth.email() = sender OR
  auth.uid()::text = receiver
);
