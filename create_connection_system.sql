-- SQL script to create the connection request system tables

-- Table for connection requests
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name VARCHAR(255) NOT NULL,
  requester_email VARCHAR(255) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on connection_requests
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own connection requests
CREATE POLICY "Users can view their own connection requests" ON connection_requests
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = supplier_id
  );

-- Policy for users to insert connection requests they are the requester of
CREATE POLICY "Users can create connection requests" ON connection_requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Policy for suppliers to update requests directed to them
CREATE POLICY "Suppliers can update their received requests" ON connection_requests
  FOR UPDATE USING (auth.uid() = supplier_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connection_requests_requester ON connection_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_supplier ON connection_requests(supplier_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(status);

-- Update the notifications table to handle connection requests
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS connection_request_id UUID REFERENCES connection_requests(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_type VARCHAR(50); -- 'accept', 'decline', etc.

-- Add indexes for connection request notifications
CREATE INDEX IF NOT EXISTS idx_notifications_connection_request ON notifications(connection_request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_action_type ON notifications(action_type);
