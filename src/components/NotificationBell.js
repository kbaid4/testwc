import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FaBell, FaCheck, FaCheckDouble, FaTimes } from 'react-icons/fa';
import styled from 'styled-components';
import { connectionService } from '../services/connectionService';

// Styled components for better organization and theming
const NotificationContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const BellButton = styled.button`
  position: relative;
  background: none;
  border: none;
  color: #A888B5; /* Updated color to match theme */
  font-size: 1.2rem;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(168, 136, 181, 0.1);
    color: #8a6fa3; /* Slightly darker shade on hover */
  }
  
  &:focus {
    outline: 2px solid #A888B5;
    outline-offset: 2px;
  }
`;

const Badge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  background-color: #e74c3c;
  color: white;
  border-radius: 50%;
  padding: 2px 6px;
  font-size: 0.7rem;
  font-weight: bold;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
`;

const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 320px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
  display: ${props => props.isOpen ? 'block' : 'none'};
  
  @media (max-width: 768px) {
    width: 280px;
    right: -10px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  background-color: #f8f9fa;
  border-radius: 8px 8px 0 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
`;

const MarkAllButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: #e9ecef;
  }
`;

const NotificationList = styled.div`
  max-height: 300px;
  overflow-y: auto;
`;

const NotificationItem = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s ease;
  background-color: ${props => props.unread ? '#f8f9ff' : 'white'};
  
  &:hover {
    background-color: ${props => props.unread ? '#f0f4ff' : '#f8f9fa'};
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const Message = styled.div`
  font-size: 0.9rem;
  color: #333;
  line-height: 1.4;
  margin-bottom: 4px;
  display: flex;
  align-items: flex-start;
`;

const Time = styled.div`
  font-size: 0.8rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const EmptyState = styled.div`
  padding: 24px 16px;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
`;

const ReadIndicator = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4a6cf7;
  margin-right: 4px;
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`;

const ActionButton = styled.button`
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const AcceptButton = styled(ActionButton)`
  background-color: #10b981;
  color: white;
  
  &:hover:not(:disabled) {
    background-color: #059669;
  }
`;

const DeclineButton = styled(ActionButton)`
  background-color: #ef4444;
  color: white;
  
  &:hover:not(:disabled) {
    background-color: #dc2626;
  }
`;

const NotificationBell = ({ userType, userId, supplierEmail }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [processingConnections, setProcessingConnections] = useState(new Set());
  const dropdownRef = useRef(null);

  console.log('NotificationBell rendered with:', { userType, userId, supplierEmail });

  // Debug function to check authentication and email matching
  const debugAuthAndEmail = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('🔍 Auth Debug Info:', {
        authUser: user,
        authError: error,
        authEmail: user?.email,
        supplierEmailProp: supplierEmail,
        emailsMatch: user?.email?.toLowerCase().trim() === supplierEmail?.toLowerCase().trim(),
        userType,
        userId
      });
    } catch (err) {
      console.error('🚨 Auth debug error:', err);
    }
  };

  // Run debug check when component mounts
  useEffect(() => {
    if (userType === 'supplier') {
      debugAuthAndEmail();
    }
  }, [userType, supplierEmail]);

  // Helper to determine if a notification should be hidden based on user role
  const shouldHideNotification = (notification, userType) => {
    // If there's no type specified or it's a generic notification, only show to admin users
    if (!notification.type || notification.content === 'New notification' || !notification.content) {
      return userType !== 'admin';
    }
    
    // Hide task assignment notifications from admin users
    if (userType === 'admin' && notification.type === 'task_assignment') {
      return true;
    }
    
    // Hide event opportunity notifications from admin users
    if (userType === 'admin' && notification.type === 'invitation') {
      return true;
    }
    
    // Hide event opportunity notifications from admin users (they created the event)
    if (userType === 'admin' && notification.type === 'event_opportunity') {
      return true;
    }
    
    // Hide application acceptance notifications from admin users (they created these notifications)
    if (userType === 'admin' && notification.type === 'application_accepted') {
      return true;
    }
    
    // Hide admin-only notifications from suppliers
    if (userType === 'supplier' && notification.type === 'admin_only') {
      return true;
    }

    // For message notifications, show only to the recipient
    if (notification.type === 'message') {
      return false;
    }

    return false;
  };

  // Fetch notifications based on user type
  const fetchNotifications = async () => {
    try {
      let query;
      
      if (userType === 'admin' && userId) {
        // For admin users - get notifications where they are the target
        query = supabase
          .from('notifications')
          .select(`
            *,
            events:event_id (name)
          `)
          .eq('admin_user_id', userId)
          .not('type', 'eq', 'task_assignment') // Exclude task assignment notifications for admin
          .not('type', 'eq', 'event_opportunity') // Exclude event opportunity notifications for admin
          .not('type', 'eq', 'application_accepted') // Exclude application acceptance notifications for admin
          .order('created_at', { ascending: false })
          .limit(50); // Increased limit to ensure we get all relevant notifications
      } else if (userType === 'supplier' && supplierEmail) {
        // For supplier users - get notifications for the supplier email
        console.log('Fetching notifications for supplier:', supplierEmail);
        
        const normalizedSupplierEmail = supplierEmail.toLowerCase().trim();
        
        query = supabase
          .from('notifications')
          .select(`
            *,
            events:event_id (name)
          `)
          .eq('supplier_email', normalizedSupplierEmail)
          .not('type', 'in', '("connection_accepted","connection_declined")')
          .not('type', 'is', null) // Exclude notifications without a type (generic notifications)
          .order('created_at', { ascending: false })
          .limit(50); // Increased limit to ensure we get all relevant notifications
      } else {
        console.log('Missing required parameters for notification fetch:', { userType, userId, supplierEmail });
        return;
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      
      console.log(`Fetched ${data?.length || 0} notifications:`, data);
      
      if (data) {
        // Filter out notifications that should be hidden
        const filteredData = data.filter(notification => !shouldHideNotification(notification, userType));
        setNotifications(filteredData);
        
        // Count unread notifications after filtering, also excluding messages that won't be displayed
        const unread = filteredData.filter(notification => {
          // Only count if it's unread AND will be displayed (formatNotificationMessage doesn't return null)
          if (notification.status !== 'unread') return false;
          const message = formatNotificationMessage(notification);
          return message !== null;
        }).length;
        setUnreadCount(unread);
        console.log(`Set unread count to: ${unread}`);
      } else {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Unexpected error in fetchNotifications:', err);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    // Only setup if we have the required parameters
    if ((userType === 'admin' && userId) || (userType === 'supplier' && supplierEmail)) {
      fetchNotifications();
    }
  }, [userType, userId, supplierEmail]);
  
  // Create a separate effect for the subscription to better control its lifecycle
  useEffect(() => {
    let subscription = null;
    
    const setupSubscription = async () => {
      try {
        if ((userType === 'admin' && userId) || (userType === 'supplier' && supplierEmail)) {
          console.log('Setting up real-time subscription for notifications...');
          subscription = supabase
            .channel('notifications')
            .on('postgres_changes', {
              event: '*',
              schema: 'public',
              table: 'notifications'
            }, (payload) => {
              console.log('Real-time notification update received:', payload);
              fetchNotifications(); // Refresh notifications when changes occur
            })
            .subscribe();
        }
      } catch (error) {
        console.error('Error setting up subscription:', error);
      }
    };
    
    setupSubscription();
    
    return () => {
      if (subscription) {
        console.log('Cleaning up notifications subscription');
        supabase.removeChannel(subscription);
      }
    };
  }, [userType, userId, supplierEmail]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Mark a notification as read
  const markAsRead = async (notificationId) => {
    try {
      let matchClause = {};
      
      if (userType === 'admin' && userId) {
        matchClause = { id: notificationId, admin_user_id: userId };
      } else if (userType === 'supplier' && supplierEmail) {
        const normalizedEmail = supplierEmail.toLowerCase().trim();
        matchClause = { id: notificationId, supplier_email: normalizedEmail };
      }
      
      console.log('🔄 Marking notification as read:', {
        notificationId,
        userType,
        supplierEmail,
        matchClause
      });
      
      const { data, error, count } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .match(matchClause)
        .select();
        
      console.log('📝 Mark as read result:', {
        data,
        error,
        count,
        updated: data?.length || 0
      });
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.warn('⚠️ No notifications were updated. This might indicate an email mismatch or RLS policy issue.');
      }
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, status: 'read' } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('❌ Error marking notification as read:', err);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      let matchClause = {};
      
      if (userType === 'admin' && userId) {
        matchClause = { admin_user_id: userId };
      } else if (userType === 'supplier' && supplierEmail) {
        const normalizedEmail = supplierEmail.toLowerCase().trim();
        matchClause = { supplier_email: normalizedEmail };
      }
      
      console.log('🔄 Marking all notifications as read:', {
        userType,
        supplierEmail,
        matchClause,
        unreadCount,
        totalNotifications: notifications.length,
        unreadInLocal: notifications.filter(n => n.status === 'unread').length
      });

      // First, let's see what notifications we're trying to update
      const { data: targetNotifications, error: selectError } = await supabase
        .from('notifications')
        .select('id, status, supplier_email, type')
        .match(matchClause)
        .eq('status', 'unread');

      console.log('🎯 Target notifications to update:', {
        targetNotifications,
        selectError,
        count: targetNotifications?.length || 0
      });

      if (selectError) {
        console.error('❌ Error selecting notifications to update:', selectError);
        throw selectError;
      }

      if (!targetNotifications || targetNotifications.length === 0) {
        console.log('ℹ️ No unread notifications found in database to update');
        // Still update local state to match database
        setNotifications(notifications.map(n => ({ ...n, status: 'read' })));
        setUnreadCount(0);
        return;
      }
      
      const { data, error, count } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .match(matchClause)
        .eq('status', 'unread')
        .select();
        
      console.log('📝 Mark all as read result:', {
        data,
        error,
        count,
        updated: data?.length || 0,
        expectedUpdates: targetNotifications.length
      });

      // Check if the update actually worked by re-querying
      const { data: verifyData, error: verifyError } = await supabase
        .from('notifications')
        .select('id, status, type')
        .match(matchClause)
        .eq('status', 'unread');

      console.log('🔍 Verification - remaining unread notifications:', {
        verifyData,
        verifyError,
        remainingUnread: verifyData?.length || 0
      });
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.warn('⚠️ No notifications were updated in bulk operation. This might indicate an email mismatch or RLS policy issue.');
        
        // Let's try updating one by one as a fallback
        console.log('🔄 Attempting individual updates as fallback...');
        let individualUpdateCount = 0;
        
        for (const notification of targetNotifications) {
          try {
            const { data: individualData, error: individualError } = await supabase
              .from('notifications')
              .update({ status: 'read' })
              .eq('id', notification.id)
              .select();
              
            if (!individualError && individualData && individualData.length > 0) {
              individualUpdateCount++;
              console.log(`✅ Updated notification ${notification.id}`);
            } else {
              console.log(`❌ Failed to update notification ${notification.id}:`, individualError);
            }
          } catch (indivErr) {
            console.log(`❌ Exception updating notification ${notification.id}:`, indivErr);
          }
        }
        
        console.log(`📊 Individual updates completed: ${individualUpdateCount}/${targetNotifications.length}`);
      }
      
      // Update local state
      setNotifications(notifications.map(n => ({ ...n, status: 'read' })));
      setUnreadCount(0);
    } catch (err) {
      console.error('❌ Error marking all notifications as read:', err);
    }
  };

  // Enhanced message formatting logic
  const formatNotificationMessage = (notification) => {
    // Handle generic notifications (no type) - only shown to admin
    if (!notification.type && userType === 'admin') {
      // Get event name from either the events relation or event_id
      let eventName = notification.events?.name;
      if (!eventName && notification.event_id) {
        eventName = `Event ID: ${notification.event_id}`;
      }
      eventName = eventName || 'this event';
      
      // For all admin notifications, show as supplier application
      return `New supplier has applied to ${eventName}`;
    }

    // If content exists, check if it's an admin message and skip it
    // Always override for task assignment notifications
    if (notification.type === 'task_assignment') {
      // Only show to supplier, never to admin
      if (userType === 'admin') return null;
      return 'You have been assigned a new task for this event.';
    }
    
    // Supplier application notifications for admins
    if (notification.type === 'application' && userType === 'admin') {
      // Get event name from either the events relation or event_id
      let eventName = notification.events?.name;
      if (!eventName && notification.event_id) {
        eventName = `Event ID: ${notification.event_id}`;
      }
      eventName = eventName || 'this event';
      
      return `New supplier has applied to ${eventName}`;
    }
    
    // Connection request notifications
    if (notification.type === 'connection_request') {
      let requesterName = 'Someone';
      let message = 'Someone invited you to connect';
      
      try {
        // Try to parse as JSON first
        const content = JSON.parse(notification.content || '{}');
        requesterName = content.requester_name || 'Someone';
        message = content.message || `${requesterName} invited you to connect`;
        console.log('Parsed connection request content:', content);
      } catch (e) {
        // If parsing fails, check if it's a plain string with the admin name
        if (notification.content && typeof notification.content === 'string' && !notification.content.startsWith('{')) {
          message = notification.content;
        }
        console.log('Using direct content for connection request:', notification.content);
      }
      return message;
    }
    
    if (notification.type === 'connection_accepted') {
      let supplierName = 'Supplier';
      let message = 'Supplier has accepted your connection request';
      
      try {
        // Try to parse as JSON first
        const content = JSON.parse(notification.content || '{}');
        supplierName = content.supplier_name || 'Supplier';
        message = content.message || `${supplierName} has accepted your connection request`;
        console.log('Parsed connection accepted content:', content);
      } catch (e) {
        // If parsing fails, check if it's a plain string message
        if (notification.content && typeof notification.content === 'string' && !notification.content.startsWith('{')) {
          message = notification.content;
        }
        console.log('Using direct content for connection accepted:', notification.content);
      }
      return message;
    }
    
    if (notification.type === 'connection_declined') {
      let supplierName = 'Supplier';
      let message = 'Supplier has declined your connection request';
      
      try {
        // Try to parse as JSON first
        const content = JSON.parse(notification.content || '{}');
        supplierName = content.supplier_name || 'Supplier';
        message = content.message || `${supplierName} has declined your connection request`;
        console.log('Parsed connection declined content:', content);
      } catch (e) {
        // If parsing fails, check if it's a plain string message
        if (notification.content && typeof notification.content === 'string' && !notification.content.startsWith('{')) {
          message = notification.content;
        }
        console.log('Using direct content for connection declined:', notification.content);
      }
      return message;
    }
    
    // Event opportunity notifications for suppliers
    if (notification.type === 'event_opportunity') {
      // Use the content directly as it already contains the formatted message
      return notification.content || 'New event opportunity available';
    }
    
    // Supplier invitation message
    if (userType === 'supplier' && notification.type === 'invitation') {
      let eventName = notification.events?.name;
      if (!eventName) {
        // Try to extract event name from existing content string
        if (notification.content) {
          const match = notification.content.match(/available: ([^\"]+)/);
          if (match && match[1]) eventName = match[1];
        }
      }
      if (!eventName && notification.event_id) {
        eventName = `Event ID: ${notification.event_id}`;
      }
      // If we still could not resolve the event name, it likely means this was a public event
      // broadcast where the name wasn't included. Show a generic public-event message.
      if (!eventName || eventName === 'this event' || eventName.startsWith('Event ID')) {
        return 'New event opportunity added';
      }
      return `New event opportunity added: ${eventName}`;
    }
    if (userType === 'supplier' && notification.type === 'application_accepted') {
      // Use content field if available, otherwise fall back to formatted message
      if (notification.content) {
        return notification.content;
      }
      return `Your application for event "${notification.events?.name || notification.event_id || 'Unknown event'}" has been accepted`;
    }
    // Admin-only messages should not be shown to suppliers
    if (userType === 'supplier' && notification.type === 'admin_only') {
      return null;
    }
    
    // Message notifications - only show to the intended recipient
    if (notification.type === 'new_message') {
      // Parse metadata to determine sender type
      let senderType = null;
      try {
        const metadata = JSON.parse(notification.metadata || '{}');
        senderType = metadata.sender_type;
      } catch (e) {
        // Fallback: determine sender type based on notification structure
        // If notification has admin_user_id but no user_id, it's from an admin to a supplier
        // If notification has user_id, it's from a supplier to an admin
        if (notification.admin_user_id && !notification.user_id && notification.supplier_email) {
          senderType = 'admin';
        } else if (notification.user_id && notification.admin_user_id) {
          senderType = 'supplier';
        } else {
          // Final fallback: check content for legacy notifications
          if (notification.content?.includes('from supplier')) {
            senderType = 'supplier';
          } else if (notification.content?.includes('from admin')) {
            senderType = 'admin';
          }
        }
      }
      
      // Admin should only see messages FROM suppliers
      if (userType === 'admin' && senderType !== 'supplier') {
        return null;
      }
      
      // Supplier should only see messages FROM admins
      if (userType === 'supplier' && senderType !== 'admin') {
        return null;
      }
      
      // For old notifications with generic "supplier" text, enhance them with actual supplier names
      let content = notification.content || 'New message';
      if (content.includes('New message from supplier:') && notification.supplier_email) {
        // Extract the message part after the generic "supplier:" text
        const messageMatch = content.match(/New message from supplier:\s*(.+)/);
        const messageText = messageMatch ? messageMatch[1] : '';
        
        // Try to get supplier name from metadata first
        try {
          const metadata = JSON.parse(notification.metadata || '{}');
          if (metadata.sender && metadata.sender !== notification.supplier_email) {
            return `New message from ${metadata.sender}: ${messageText}`;
          }
        } catch (e) {
          // Metadata parsing failed, continue with other methods
        }
        
        // For now, return as-is, but this creates an opportunity for async enhancement
        // In a more complex implementation, we could cache supplier names or lookup asynchronously
        return content;
      }
      
      // Return the content if it's for the correct recipient
      return content;
    }
    
    // Default to showing content or message
    return notification.content || notification.message || 'New notification';
  };

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Handle connection request actions
  const handleAcceptConnection = async (connectionRequestId) => {
    // Add to processing state to hide buttons
    setProcessingConnections(prev => new Set([...prev, connectionRequestId]));
    
    try {
      // Get current user data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      const supplierData = {
        id: user.id,
        name: profile?.full_name || profile?.company_name || user.email,
        email: user.email
      };
      
      const { error } = await connectionService.acceptConnectionRequest(
        connectionRequestId, 
        supplierData
      );
      
      if (error) {
        alert('Error accepting connection request: ' + error);
        // Remove from processing state on error
        setProcessingConnections(prev => {
          const newSet = new Set(prev);
          newSet.delete(connectionRequestId);
          return newSet;
        });
      } else {
        // Refresh notifications to reflect new state
        fetchNotifications();
        alert('Connection request accepted successfully!');
      }
    } catch (error) {
      console.error('Error accepting connection:', error);
      alert('Error accepting connection request');
      // Remove from processing state on error
      setProcessingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionRequestId);
        return newSet;
      });
    }
  };
  
  const handleDeclineConnection = async (connectionRequestId) => {
    // Add to processing state to hide buttons
    setProcessingConnections(prev => new Set([...prev, connectionRequestId]));
    
    try {
      // Get current user data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      const supplierData = {
        id: user.id,
        name: profile?.full_name || profile?.company_name || user.email,
        email: user.email
      };
      
      const { error } = await connectionService.declineConnectionRequest(
        connectionRequestId, 
        supplierData
      );
      
      if (error) {
        alert('Error declining connection request: ' + error);
        // Remove from processing state on error
        setProcessingConnections(prev => {
          const newSet = new Set(prev);
          newSet.delete(connectionRequestId);
          return newSet;
        });
      } else {
        // Refresh notifications to reflect new state
        fetchNotifications();
        alert('Connection request declined.');
      }
    } catch (error) {
      console.error('Error declining connection:', error);
      alert('Error declining connection request');
      // Remove from processing state on error
      setProcessingConnections(prev => {
        const newSet = new Set(prev);
        newSet.delete(connectionRequestId);
        return newSet;
      });
    }
  };

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <NotificationContainer>
      <BellButton 
        onClick={toggleDropdown}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <FaBell />
        {unreadCount > 0 && (
          <Badge aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </BellButton>

      <Dropdown 
        ref={dropdownRef}
        isOpen={isOpen}
        aria-hidden={!isOpen}
      >
        <Header>
          <Title>Notifications</Title>
          {unreadCount > 0 ? (
            <MarkAllButton onClick={markAllAsRead}>
              <FaCheckDouble size={12} />
              <span>Mark all as read</span>
            </MarkAllButton>
          ) : (
            <MarkAllButton onClick={() => setIsOpen(false)}>
              <FaTimes size={14} />
            </MarkAllButton>
          )}
        </Header>

        <NotificationList>
          {notifications.length === 0 ? (
            <EmptyState>No notifications yet</EmptyState>
          ) : (
            notifications
              .filter(notification => !shouldHideNotification(notification, userType))
              .map(notification => {
                const message = formatNotificationMessage(notification);
                if (message === null) return null;
                
                const isUnread = notification.status === 'unread';
                
                // Check if this is a connection request notification that needs action buttons
                const isConnectionRequest = notification.type === 'connection_request' && 
                                          userType === 'supplier' && 
                                          isUnread;
                
                // Check if this connection request is being processed
                const isProcessing = processingConnections.has(notification.connection_request_id);
                
                return (
                  <NotificationItem
                    key={notification.id}
                    unread={isUnread}
                    onClick={() => !isConnectionRequest && isUnread && markAsRead(notification.id)}
                  >
                    <Message>
                      {isUnread && <ReadIndicator aria-hidden="true" />}
                      {message}
                    </Message>
                    <Time>
                      {isUnread && <FaCheck size={10} />}
                      {formatRelativeTime(notification.created_at)}
                    </Time>
                    {isConnectionRequest && notification.connection_request_id && !isProcessing && (
                      <ActionButtons>
                        <AcceptButton 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptConnection(notification.connection_request_id);
                          }}
                        >
                          Accept
                        </AcceptButton>
                        <DeclineButton 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeclineConnection(notification.connection_request_id);
                          }}
                        >
                          Decline
                        </DeclineButton>
                      </ActionButtons>
                    )}
                    {isConnectionRequest && isProcessing && (
                      <ActionButtons>
                        <div style={{padding: '4px 12px', fontSize: '0.75rem', color: '#666'}}>Processing...</div>
                      </ActionButtons>
                    )}
                  </NotificationItem>
                );
              })
              .filter(Boolean)
          )}
        </NotificationList>
      </Dropdown>
    </NotificationContainer>
  );
};

export default NotificationBell;
