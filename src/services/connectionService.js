import { supabase } from '../supabaseClient';

export const connectionService = {
  // Send a connection request from event organizer to supplier
  async sendConnectionRequest(requesterData, supplierData) {
    try {
      console.log('Sending connection request:', { requesterData, supplierData });

      // Check if the connection_requests table exists
      const { error: tableCheckError } = await supabase
        .from('connection_requests')
        .select('id')
        .limit(1);
      
      if (tableCheckError && tableCheckError.code === '42P01') {
        // Table doesn't exist
        return { error: 'Connection system not set up. Please run the database setup script first.' };
      }

      // First check if a connection request already exists
      const { data: existingRequest } = await supabase
        .from('connection_requests')
        .select('*')
        .eq('requester_id', requesterData.id)
        .eq('supplier_id', supplierData.id)
        .single();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          return { error: 'Connection request already sent and pending' };
        } else if (existingRequest.status === 'accepted') {
          return { error: 'Already connected with this supplier' };
        }
      }

      // Create the connection request
      const { data: connectionRequest, error: requestError } = await supabase
        .from('connection_requests')
        .insert([{
          requester_id: requesterData.id,
          requester_name: requesterData.name,
          requester_email: requesterData.email,
          supplier_id: supplierData.id,
          supplier_name: supplierData.name,
          supplier_email: supplierData.email,
          status: 'pending'
        }])
        .select()
        .single();

      if (requestError) {
        console.error('Error creating connection request:', requestError);
        return { error: requestError.message };
      }

      // Create notification for the supplier
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{
          supplier_email: supplierData.email,
          type: 'connection_request',
          content: JSON.stringify({
            requester_name: requesterData.name,
            requester_email: requesterData.email,
            message: `${requesterData.name} invited you to connect`
          }),
          connection_request_id: connectionRequest.id,
          status: 'unread'
        }]);

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
        return { error: notificationError.message };
      }

      return { data: connectionRequest };
    } catch (error) {
      console.error('Unexpected error in sendConnectionRequest:', error);
      return { error: error.message };
    }
  },

  // Accept a connection request
  async acceptConnectionRequest(connectionRequestId, supplierData) {
    try {
      console.log('Accepting connection request:', connectionRequestId);

      // Update the connection request status
      const { data: connectionRequest, error: updateError } = await supabase
        .from('connection_requests')
        .update({ 
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionRequestId)
        .eq('supplier_id', supplierData.id) // Ensure only the supplier can accept
        .select()
        .single();

      if (updateError) {
        console.error('Error updating connection request:', updateError);
        return { error: updateError.message };
      }

      if (!connectionRequest) {
        return { error: 'Connection request not found or unauthorized' };
      }

      // Add admin as liaison for the supplier's view
      try {
        await supabase
          .from('liaisons')
          .insert([{ 
            user_id: supplierData.id,             // Supplier user
            name: connectionRequest.requester_name,
            email: connectionRequest.requester_email,
            admin_email: connectionRequest.requester_email // Included if column exists; ignored otherwise
          }]);
      } catch (liaisonErr) {
        console.error('Error adding liaison:', liaisonErr);
        // Non-fatal – continue workflow
      }

      // Mark the original connection request notification as read for the supplier
      try {
        await supabase
          .from('notifications')
          .update({ status: 'read' })
          .eq('connection_request_id', connectionRequestId)
          .eq('supplier_email', supplierData.email);
      } catch (notifUpdateErr) {
        console.error('Error marking connection request notification as read:', notifUpdateErr);
      }

      // Add supplier to the requester's planners list
      const { error: plannerError } = await supabase
        .from('planners')
        .insert([{
          user_id: connectionRequest.requester_id,
          name: connectionRequest.supplier_name,
          email: connectionRequest.supplier_email
        }]);

      if (plannerError) {
        console.error('Error adding to planners:', plannerError);
        // Don't return error here as the connection was still accepted
      }

      // First, get the admin's user ID from the connection request
      const { data: adminData, error: adminError } = await supabase
        .from('connection_requests')
        .select('requester_id')
        .eq('id', connectionRequestId)
        .single();

      if (adminError || !adminData) {
        console.error('Error fetching admin data for notification:', adminError);
        return { error: 'Could not find admin user for this connection request' };
      }

      // Create notification for the requester (admin)
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{    
          admin_user_id: adminData.requester_id,  // Notify the admin (event organizer)
          supplier_email: supplierData.email,      // Needed so supplier RLS check passes
          type: 'connection_accepted',
          content: JSON.stringify({
            supplier_name: supplierData.name,
            supplier_email: supplierData.email,
            message: `${supplierData.name} has accepted your connection request`
          }),
          connection_request_id: connectionRequestId,
          status: 'unread',
          created_at: new Date().toISOString()
        }]);

      if (notificationError) {
        console.error('Error creating acceptance notification:', notificationError);
      }

      return { data: connectionRequest };
    } catch (error) {
      console.error('Unexpected error in acceptConnectionRequest:', error);
      return { error: error.message };
    }
  },

  // Decline a connection request
  async declineConnectionRequest(connectionRequestId, supplierData) {
    try {
      console.log('Declining connection request:', connectionRequestId);

      // Update the connection request status
      const { data: connectionRequest, error: updateError } = await supabase
        .from('connection_requests')
        .update({ 
          status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', connectionRequestId)
        .eq('supplier_id', supplierData.id) // Ensure only the supplier can decline
        .select()
        .single();

      if (updateError) {
        console.error('Error updating connection request:', updateError);
        return { error: updateError.message };
      }

      if (!connectionRequest) {
        return { error: 'Connection request not found or unauthorized' };
      }

      // Mark the original connection request notification as read for the supplier
      try {
        await supabase
          .from('notifications')
          .update({ status: 'read' })
          .eq('connection_request_id', connectionRequestId)
          .eq('supplier_email', supplierData.email);
      } catch (notifUpdateErr) {
        console.error('Error marking connection request notification as read:', notifUpdateErr);
      }

      // First, get the admin's user ID from the connection request
      const { data: adminData, error: adminError } = await supabase
        .from('connection_requests')
        .select('requester_id')
        .eq('id', connectionRequestId)
        .single();

      if (adminError || !adminData) {
        console.error('Error fetching admin data for notification:', adminError);
        return { error: 'Could not find admin user for this connection request' };
      }

      // Create notification for the requester (admin)
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([{    
          admin_user_id: adminData.requester_id,  // Notify the admin (event organizer)
          supplier_email: supplierData.email,      // Needed so supplier RLS check passes
          type: 'connection_declined',
          content: JSON.stringify({
            supplier_name: supplierData.name,
            supplier_email: supplierData.email,
            message: `${supplierData.name} has declined your connection request`
          }),
          connection_request_id: connectionRequestId,
          status: 'unread',
          created_at: new Date().toISOString()
        }]);

      if (notificationError) {
        console.error('Error creating decline notification:', notificationError);
      }

      return { data: connectionRequest };
    } catch (error) {
      console.error('Unexpected error in declineConnectionRequest:', error);
      return { error: error.message };
    }
  },

  // Get connection requests for a user
  async getConnectionRequests(userId, type = 'received') {
    try {
      const column = type === 'received' ? 'supplier_id' : 'requester_id';
      
      const { data, error } = await supabase
        .from('connection_requests')
        .select('*')
        .eq(column, userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching connection requests:', error);
        return { error: error.message };
      }

      return { data };
    } catch (error) {
      console.error('Unexpected error in getConnectionRequests:', error);
      return { error: error.message };
    }
  },

  // Check if users are connected
  async areUsersConnected(requesterId, supplierId) {
    try {
      const { data, error } = await supabase
        .from('connection_requests')
        .select('status')
        .eq('requester_id', requesterId)
        .eq('supplier_id', supplierId)
        .eq('status', 'accepted')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error checking connection status:', error);
        return { error: error.message };
      }

      return { data: { connected: !!data } };
    } catch (error) {
      console.error('Unexpected error in areUsersConnected:', error);
      return { error: error.message };
    }
  }
};
