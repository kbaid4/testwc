import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAdminId } from '../hooks/useAdminId';

// UserAvatar component for nav bar
const UserAvatar = () => {
  const [initial, setInitial] = useState('S');
  useEffect(() => {
    async function fetchInitial() {
      let name = localStorage.getItem('supplierName') || localStorage.getItem('signupName') || 'Supplier';
      try {
        const { data: { user } } = await import('../supabaseClient').then(m => m.supabase.auth.getUser());
        if (user) {
          const { data: profile } = await import('../supabaseClient').then(m => m.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single());
          if (profile && profile.full_name) {
            name = profile.full_name;
          }
        }
      } catch {}
      setInitial(name.charAt(0).toUpperCase());
    }
    fetchInitial();
  }, []);
  return (
    <div
      className="user-avatar"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#A888B5',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '16px',
        flexShrink: 0,
        cursor: 'pointer',
        marginRight: '4px'
      }}
      title={initial}
    >
      {initial}
    </div>
  );
};

function getUserContext() {
  const isSupplier = localStorage.getItem('isSupplier') === 'true';
  const name = isSupplier
    ? localStorage.getItem('supplierName') || 'Supplier'
    : localStorage.getItem('signupName') || 'Admin';
  return { isSupplier, name };
}

const SupplierMessagesPage = () => {
  const { adminId } = useAdminId();
  const user = getUserContext();
  const { eventId: urlEventId } = useParams();
  const navigate = useNavigate();
  const [allMessages, setAllMessages] = useState([]);
  const [eventList, setEventList] = useState([]); // [{eventId, eventName, adminId}]
  const [selectedEvent, setSelectedEvent] = useState(null); // {eventId, eventName, adminId}
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch messages from Supabase
  const fetchMessages = useCallback(async (eventId, supplierEmail) => {
    try {
      if (!eventId || !supplierEmail) {
        console.log('Missing eventId or supplierEmail for fetch');
        return [];
      }
      
      console.log(`Fetching messages for event ${eventId} and supplier ${supplierEmail}`);
      
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('event_id', eventId)
        .or(`supplier_email.eq.${supplierEmail},sender.eq.${supplierEmail},receiver.eq.${supplierEmail}`)
        .order('timestamp', { ascending: true });
        
      if (error) {
        console.error('Error in fetchMessages query:', error);
        throw error;
      }
      
      console.log(`Fetched ${messages?.length || 0} messages for event ${eventId}`);
      
      // Create a set of unique IDs to deduplicate messages
      const uniqueMessages = [];
      const seenIds = new Set();
      
      (messages || []).forEach(msg => {
        if (!seenIds.has(msg.id)) {
          seenIds.add(msg.id);
          uniqueMessages.push(msg);
        }
      });
      
      console.log(`Returning ${uniqueMessages.length} unique messages`);
      return uniqueMessages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }, []);

  // Fetch events and messages
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const supplierEmail = localStorage.getItem('supplierEmail');
        console.log('Supplier Email:', supplierEmail);
        
        if (!supplierEmail) {
          console.error('No supplier email found in localStorage');
          return;
        }
        
        // First, fetch all invites for this supplier
        const { data: invites, error: invitesError } = await supabase
          .from('invites')
          .select('*')
          .eq('supplier_email', supplierEmail);
          
        console.log('Fetched invites:', invites);
        if (invitesError) {
          console.error('Error fetching invites:', invitesError);
          throw invitesError;
        }
        
        if (invites.length === 0) {
          console.log('No invites found for supplier');
          setEventList([]);
          setAllMessages([]);
          return;
        }
        
        // Extract unique event IDs from invites
        const eventIds = [...new Set(invites.map(invite => invite.event_id).filter(Boolean))];
        console.log('Event IDs from invites:', eventIds);
        
        // If no valid event IDs, return early
        if (eventIds.length === 0) {
          console.log('No valid event IDs found in invites');
          setEventList([]);
          setAllMessages([]);
          return;
        }
        
        // Fetch events in chunks to avoid URL length limits
        const CHUNK_SIZE = 10;
        let events = [];
        
        for (let i = 0; i < eventIds.length; i += CHUNK_SIZE) {
          const chunk = eventIds.slice(i, i + CHUNK_SIZE);
          console.log('Fetching events chunk:', chunk);
          
          try {
            const { data: chunkEvents, error: chunkError } = await supabase
              .from('events')
              .select('*')
              .in('id', chunk);
              
            if (chunkError) {
              console.error(`Error fetching events chunk ${i}:`, chunkError);
              continue;
            }
            
            if (chunkEvents && chunkEvents.length > 0) {
              events = [...events, ...chunkEvents];
            }
          } catch (error) {
            console.error(`Error processing chunk ${i}:`, error);
            // Continue with next chunk even if one fails
          }
        }
        
        console.log('Fetched events:', events);
        
        // Create relevant events by combining invite and event data
        const relevantEvents = [];
        for (const invite of invites) {
          if (!invite.event_id) continue;
          
          let eventData = events.find(e => e && e.id === invite.event_id);
          
          // If event not found, try to fetch it individually
          if (!eventData) {
            console.log(`Event ${invite.event_id} not found in batch, fetching individually`);
            const { data: singleEvents, error: singleError } = await supabase
              .from('events')
              .select('*')
              .eq('id', invite.event_id);
              
            if (!singleError && singleEvents && singleEvents.length > 0) {
              eventData = singleEvents[0]; // Take the first matching event
              events.push(eventData);
            } else {
              console.error(`Error fetching event ${invite.event_id}:`, singleError || 'No events found');
              // Create a placeholder event since the actual event wasn't found
              eventData = {
                id: invite.event_id,
                name: `Event (${invite.event_id.substring(0, 8)}...)`,
                admin_id: invite.invited_by_admin_id || invite.admin_id || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              events.push(eventData);
            }
          }
          
          if (eventData) {
            // Fetch admin profile to get company_name
            let adminProfile = null;
            const adminId = eventData.admin_id || invite.invited_by_admin_id || invite.admin_id;
            if (adminId) {
              const { data: adminProfiles } = await supabase
                .from('profiles')
                .select('id, email, company_name, full_name, user_type')
                .eq('id', adminId)
                .eq('user_type', 'admin')
                .single();
              adminProfile = adminProfiles;
            }
            
            const adminDisplayName = adminProfile?.company_name || adminProfile?.full_name || 'Event Organizer';
            const adminName = adminProfile?.full_name || 'Event Organizer';
            
            relevantEvents.push({
              eventId: eventData.id,
              eventName: eventData.name || `Event (${eventData.id.substring(0, 8)}...)`,
              adminId: adminId || '',
              adminName: adminName,
              adminCompanyName: adminProfile?.company_name,
              adminFullName: adminProfile?.full_name,
              supplierEmail: invite.supplier_email,
              supplierName: invite.supplier_name || invite.supplier_email
            });
          }
        }
        
        console.log('Processed relevant events:', relevantEvents);
        setEventList(relevantEvents);
        
        // Select the appropriate event
        if (relevantEvents.length > 0) {
          setEventList(relevantEvents);
          
          let eventToSelect = null;
          
          // If URL has an eventId, try to find and select it
          if (urlEventId) {
            eventToSelect = relevantEvents.find(e => e.eventId === urlEventId);
            console.log('Event from URL:', urlEventId, 'Found:', eventToSelect);
          }
          
          // If no event from URL or not found, select the first one
          if (!eventToSelect) {
            eventToSelect = relevantEvents[0];
            console.log('Selecting first event:', eventToSelect);
            // Update URL to reflect the selected event
            navigate(`/SupplierMessagesPage/${eventToSelect.eventId}`, { replace: true });
          }
          
          setSelectedEvent(eventToSelect);
          
          // Fetch all messages for proper conversation sorting
          const allEventIds = relevantEvents.map(e => e.eventId);
          console.log('Fetching all messages for events:', allEventIds);
          
          const { data: allMessagesData, error: allMessagesError } = await supabase
            .from('messages')
            .select('*')
            .in('event_id', allEventIds)
            .or(`supplier_email.eq.${supplierEmail},sender.eq.${supplierEmail},receiver.eq.${supplierEmail}`)
            .order('timestamp', { ascending: true });
            
          let messages = [];
          if (allMessagesError) {
            console.error('Error fetching all messages:', allMessagesError);
            // Fallback to single event
            messages = await fetchMessages(eventToSelect.eventId, supplierEmail);
          } else {
            console.log('Fetched all messages for sorting:', allMessagesData?.length || 0);
            
            // Deduplicate messages
            const uniqueMessages = [];
            const seenIds = new Set();
            
            (allMessagesData || []).forEach(msg => {
              if (!seenIds.has(msg.id)) {
                seenIds.add(msg.id);
                uniqueMessages.push(msg);
              }
            });
            
            messages = uniqueMessages;
          }
          console.log('Fetched messages from Supabase:', messages);
          setAllMessages(messages);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to localStorage if Supabase fails
        const events = JSON.parse(localStorage.getItem('events') || '[]');
        const supplierEmail = localStorage.getItem('supplierEmail');
        const relevantEvents = events
          .filter(ev => Array.isArray(ev.invitedSuppliers) && ev.invitedSuppliers.includes(supplierEmail))
          .map(ev => ({ 
            eventId: ev.id, 
            eventName: ev.name, 
            event: { 
              ...ev, 
              admin_id: ev.admin_id || ev.adminId || '' 
            } 
          }));
          
        setEventList(relevantEvents);
        
        if (relevantEvents.length > 0 && !selectedEvent) {
          const eventToSelect = urlEventId 
            ? relevantEvents.find(e => e.eventId === urlEventId) || relevantEvents[0]
            : relevantEvents[0];
          setSelectedEvent(eventToSelect);
          
          if (urlEventId !== eventToSelect.eventId) {
            navigate(`/SupplierMessagesPage/${eventToSelect.eventId}`, { replace: true });
          }
        }
        
        const msgs = JSON.parse(localStorage.getItem('messages') || '[]');
        setAllMessages(msgs);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [urlEventId, navigate]);

  // Enhanced polling fallback with better error handling
  useEffect(() => {
    if (!selectedEvent?.eventId) {
      console.log('Skipping supplier polling - no event selected');
      setAllMessages([]);
      return;
    }
    
    console.log('🔄 Setting up polling for supplier event:', selectedEvent.eventId);
    
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 3000; // 3 seconds
    
    const fetchWithRetry = async () => {
      if (!isMounted) return;
      
      try {
        console.log(`🔍 Polling supplier messages (attempt ${retryCount + 1}/${maxRetries})...`);
        await fetchMessages();
        retryCount = 0; // Reset retry count on success
      } catch (error) {
        console.error('❌ Supplier polling error:', error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error('Max retries reached for supplier, giving up');
          return;
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`⏳ Retrying supplier in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        fetchWithRetry();
      }
    };
    
    // Initial fetch
    fetchWithRetry();
    
    // Set up polling
    const pollInterval = setInterval(fetchWithRetry, baseDelay);
    
    return () => {
      console.log('🧹 Cleaning up supplier polling');
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [selectedEvent?.eventId, fetchMessages]);

  // Set up real-time subscription for new messages and fetch initial messages
  useEffect(() => {
    if (!selectedEvent?.eventId) return;
    
    const supplierEmail = localStorage.getItem('supplierEmail') || user?.email;
    if (!supplierEmail) {
      console.error('No supplier email found for real-time subscription');
      return;
    }
    
    console.log('Setting up real-time subscription for event:', selectedEvent.eventId);
    
    let channel;
    let reconnectTimeout;
    let isMounted = true;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const INITIAL_RECONNECT_DELAY = 1000; // 1 second
    const MAX_RECONNECT_DELAY = 30000; // 30 seconds
    
    // Initial message fetch
    const fetchInitialMessages = async () => {
      try {
        const messages = await fetchMessages(selectedEvent.eventId, supplierEmail);
        if (isMounted) {
          setAllMessages(messages);
        }
      } catch (error) {
        console.error('Error fetching initial messages:', error);
      }
    };
    
    fetchInitialMessages();
    
    // Set up real-time subscription
    const setupRealtime = async () => {
      if (!isMounted) return;
      
      try {
        // Clean up any existing channel
        if (channel) {
          await supabase.removeChannel(channel).catch(console.error);
        }
        
        const channelName = `messages:${selectedEvent.eventId}:admin`;
        console.log('Setting up real-time channel:', channelName);
        
        channel = supabase.channel(channelName, {
          config: {
            broadcast: { ack: true, self: true },
            presence: { key: `supplier:${supplierEmail}` }
          }
        });
        
        // Debounce message updates to prevent rapid refreshes
        let updateTimeout;
        const debouncedUpdate = () => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(async () => {
            try {
              const updatedMessages = await fetchMessages(selectedEvent.eventId, supplierEmail);
              if (isMounted) {
                setAllMessages(updatedMessages);
              }
            } catch (error) {
              console.error('Error refreshing messages:', error);
            }
          }, 300); // 300ms debounce
        };
        
        channel
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `and(event_id.eq.${selectedEvent.eventId},or(message_type.eq.supplier_to_admin,message_type.eq.admin_to_supplier))`
          }, (payload) => {
            console.log('Message change received:', payload);
            debouncedUpdate();
          })
          .on('system', { event: 'disconnect' }, () => {
            if (!isMounted) return;
            console.log('Realtime disconnected. Attempting to reconnect...');
            clearTimeout(reconnectTimeout);
            const delay = Math.min(
              INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
              MAX_RECONNECT_DELAY
            );
            reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
            reconnectTimeout = setTimeout(setupRealtime, delay);
          })
          .on('system', { event: 'channel_joined' }, () => {
            console.log('Successfully (re)connected to channel');
            reconnectAttempts = 0;
          })
          .subscribe((status) => {
            console.log('Subscription status:', status);
            if (!isMounted) return;
            
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error(`Channel ${status}, attempting to reconnect...`);
              clearTimeout(reconnectTimeout);
              const delay = Math.min(
                INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
                MAX_RECONNECT_DELAY
              );
              reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
              reconnectTimeout = setTimeout(setupRealtime, delay);
            }
          });
      } catch (error) {
        console.error('Error in real-time setup:', error);
        if (isMounted) {
          clearTimeout(reconnectTimeout);
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
            MAX_RECONNECT_DELAY
          );
          reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
          reconnectTimeout = setTimeout(setupRealtime, delay);
        }
      }
    };
    
    // Initial setup with debounce
    const setupTimeout = setTimeout(setupRealtime, 100);
    
    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      clearTimeout(setupTimeout);
      if (channel) {
        console.log('Cleaning up real-time channel');
        supabase.removeChannel(channel).catch(console.error);
      }
    };
  }, [selectedEvent?.eventId, user?.email]);
  
  // Sort events by latest message timestamp (most recent conversations first)
  const sortedEventList = useMemo(() => {
    if (eventList.length === 0) return [];
    
    const supplierEmail = localStorage.getItem('supplierEmail') || '';
    
    // Sort events by latest message timestamp
    const sorted = [...eventList].sort((a, b) => {
      const aMessages = allMessages.filter(msg => {
        const isForEventA = (msg.event_id === a.eventId) || (msg.eventId === a.eventId);
        const isForThisSupplier = 
          (msg.supplier_email === supplierEmail) ||
          (msg.sender === supplierEmail) ||
          (msg.receiver === supplierEmail) ||
          (msg.sender === a.adminId) ||
          (msg.receiver === a.adminId);
        return isForEventA && isForThisSupplier;
      });
      
      const bMessages = allMessages.filter(msg => {
        const isForEventB = (msg.event_id === b.eventId) || (msg.eventId === b.eventId);
        const isForThisSupplier = 
          (msg.supplier_email === supplierEmail) ||
          (msg.sender === supplierEmail) ||
          (msg.receiver === supplierEmail) ||
          (msg.sender === b.adminId) ||
          (msg.receiver === b.adminId);
        return isForEventB && isForThisSupplier;
      });
      
      const aLatest = aMessages.length > 0 ? 
        Math.max(...aMessages.map(msg => new Date(msg.timestamp || msg.time || 0).getTime())) : 0;
      const bLatest = bMessages.length > 0 ? 
        Math.max(...bMessages.map(msg => new Date(msg.timestamp || msg.time || 0).getTime())) : 0;
      
      // Sort by latest message timestamp (most recent first)
      return bLatest - aLatest;
    });
    
    return sorted;
  }, [eventList, allMessages]);

  // Auto-select the first conversation when sortedEventList changes and no event is selected
  useEffect(() => {
    if (sortedEventList.length > 0 && !selectedEvent) {
      let eventToSelect = null;
      
      // If URL has an eventId, try to find and select it
      if (urlEventId) {
        eventToSelect = sortedEventList.find(e => e.eventId === urlEventId);
      }
      
      // If no event from URL or not found, select the first one (most recent)
      if (!eventToSelect) {
        eventToSelect = sortedEventList[0];
        // Update URL to reflect the selected event
        navigate(`/SupplierMessagesPage/${eventToSelect.eventId}`, { replace: true });
      }
      
      setSelectedEvent(eventToSelect);
    }
  }, [sortedEventList, selectedEvent, urlEventId, navigate]);

  // Filter messages for selected event and this supplier
  const filteredMessages = useMemo(() => {
    if (!selectedEvent) return [];
    
    const supplierEmail = localStorage.getItem('supplierEmail') || '';
    const currentEventId = selectedEvent.eventId;
    
    // Create a Set to track seen message IDs for deduplication
    const seenMessageIds = new Set();
    
    return allMessages
      .filter(msg => {
        // Skip if we've already seen this message ID
        if (msg.id && seenMessageIds.has(msg.id)) return false;
        if (msg.id) seenMessageIds.add(msg.id);
        
        // Check if message is for this event
        const isForThisEvent = 
          (msg.event_id === currentEventId) || 
          (msg.eventId === currentEventId);
          
        if (!isForThisEvent) return false;
        
        // Check if message is to/from this supplier or admin
        const isForThisSupplier = 
          (msg.supplier_email === supplierEmail) ||
          (msg.sender === supplierEmail) ||
          (msg.receiver === supplierEmail) ||
          (msg.sender === selectedEvent.adminId) ||
          (msg.receiver === selectedEvent.adminId);
          
        return isForThisSupplier;
      })
      .sort((a, b) => {
        try {
          const timeA = new Date(a.timestamp || a.time || 0);
          const timeB = new Date(b.timestamp || b.time || 0);
          return timeA - timeB; // Sort in ascending order (oldest first)
        } catch (e) {
          console.error('Error sorting messages:', e);
          return 0;
        }
      });
  }, [allMessages, selectedEvent]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !selectedEvent) return;
    
    const supplierEmail = localStorage.getItem('supplierEmail') || user?.email;
    const trimmedContent = inputValue.trim();
    
    console.log('📤 Supplier sending message:', {
      supplierEmail: supplierEmail,
      fromLocalStorage: localStorage.getItem('supplierEmail'),
      fromUser: user?.email,
      selectedEvent: selectedEvent,
      adminId: selectedEvent?.adminId
    });
    let notification = null;
    let channel = null;
    
    try {
      // Validate authentication
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('Not authenticated');
      
      // Fetch supplier profile information for better notification content
      let senderDisplayName = 'supplier';
      try {
        const { data: senderProfile, error: profileError } = await supabase
          .from('profiles')
          .select('company_name, full_name, email')
          .eq('email', authUser.email)
          .single();
        
        if (!profileError && senderProfile) {
          // Prioritize company_name, then full_name, then email
          senderDisplayName = senderProfile.company_name || 
                            senderProfile.full_name || 
                            senderProfile.email ||
                            'supplier';
        }
      } catch (profileFetchError) {
        console.error('Error fetching sender profile:', profileFetchError);
        senderDisplayName = 'supplier';
      }

      // Prepare notification data
      const notificationData = {
        // Only include user_id if it's a valid UUID
        ...(selectedEvent?.adminId && { user_id: selectedEvent.adminId }),
        supplier_email: supplierEmail,
        event_id: selectedEvent.eventId,
        type: 'new_message',
        content: `New message from ${senderDisplayName}: ${trimmedContent.substring(0, 50)}${trimmedContent.length > 50 ? '...' : ''}`,
        admin_user_id: selectedEvent.adminId || null, // Keep for backward compatibility
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_read: false,
        metadata: JSON.stringify({
          event_id: selectedEvent.eventId,
          event_name: selectedEvent.eventName,
          sender: supplierEmail,
          sender_type: 'supplier',
          message_preview: trimmedContent.substring(0, 100),
          timestamp: new Date().toISOString()
        })
      };
      
      // Insert notification
      const { data: notificationDataResult, error: notifError } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select()
        .single();

      if (notifError) throw new Error(`Notification error: ${notifError.message}`);
      notification = notificationDataResult;
      
      // Prepare message data with message_type
      const messageData = {
        event_id: selectedEvent.eventId,
        supplier_email: supplierEmail,
        sender: supplierEmail,
        receiver: selectedEvent.adminId,
        content: trimmedContent,
        admin_id: selectedEvent.adminId,
        timestamp: new Date().toISOString(),
        notification_id: notification?.id,
        is_read: false,
        sender_type: 'supplier',
        message_type: 'supplier_to_admin',
        metadata: JSON.stringify({
          sent_from: 'supplier_page',
          event_name: selectedEvent.eventName,
          admin_id: selectedEvent.adminId,
          timestamp: new Date().toISOString()
        })
      };

      console.log('📤 Sending message with data:', {
        messageData: messageData,
        supplierEmailUsed: supplierEmail,
        adminIdTarget: selectedEvent.adminId,
        eventId: selectedEvent.eventId
      });
      
      // Insert message
      const { data: newMessage, error: messageError } = await supabase
        .from('messages')
        .insert([messageData])
        .select()
        .single();

      if (messageError) throw new Error(`Message error: ${messageError.message}`);
      
      console.log('Message sent successfully:', newMessage);

      // Update local state
      if (newMessage) {
        setAllMessages(prev => {
          const exists = prev.some(msg => msg.id === newMessage.id);
          const updated = exists ? prev : [...prev, newMessage];
          // Trigger refresh to update sorting if new message was added
          if (!exists) {
            setTimeout(() => {
              window.location.reload();
            }, 200);
          }
          return updated;
        });
      }
      
      // Clear input field
      setInputValue('');
      
      // Broadcast to channel using a dedicated broadcast channel
      try {
        const channelName = `messages:${selectedEvent.eventId}:admin`;
        const broadcastChannel = supabase.channel(`broadcast-${Date.now()}`, {
          config: {
            broadcast: { ack: true, self: true },
            presence: { key: `supplier:${supplierEmail}` }
          }
        });
        
        // Use a short timeout to avoid hanging if something goes wrong
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('Broadcast timeout');
            resolve();
          }, 2000);

          broadcastChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              broadcastChannel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: { 
                  message: newMessage,
                  event_id: selectedEvent.eventId,
                  timestamp: new Date().toISOString()
                }
              })
              .then(() => {
                console.log('Broadcast successful');
                clearTimeout(timeout);
                resolve();
              })
              .catch((err) => {
                console.warn('Broadcast send error:', err);
                clearTimeout(timeout);
                resolve();
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.warn('Broadcast channel error:', status);
              clearTimeout(timeout);
              resolve();
            }
          });
        });
        
        // Always clean up the broadcast channel
        await supabase.removeChannel(broadcastChannel).catch(console.error);
      } catch (broadcastError) {
        console.warn('Non-critical: Could not broadcast message:', broadcastError.message);
      }
      
      // Force UI update
      try {
        const updatedMessages = await fetchMessages(selectedEvent.eventId, supplierEmail);
        setAllMessages(updatedMessages);
      } catch (fetchError) {
        console.warn('Could not refresh messages:', fetchError.message);
      }
      
      // Scroll to bottom of messages
      requestAnimationFrame(() => {
        const messageList = document.querySelector('.message-list');
        if (messageList) {
          messageList.scrollTop = messageList.scrollHeight;
        }
      });
      
    } catch (error) {
      console.error('Error in sendMessage:', error);
      alert(`Failed to send message: ${error.message}`);
      
      // Fallback to local storage if online send fails
      const newMsg = {
        id: `local-${Date.now()}`,
        event_id: selectedEvent.eventId,
        supplier_email: supplierEmail,
        content: inputValue,
        timestamp: new Date().toISOString(),
        type: 'supplier_to_admin',
        sender: supplierEmail,
        receiver: selectedEvent.adminId,
        admin_id: selectedEvent.adminId
      };
      
      const updatedMsgs = [...allMessages, newMsg];
      setAllMessages(updatedMsgs);
      localStorage.setItem(`messages_${selectedEvent.eventId}_${supplierEmail}`, JSON.stringify(updatedMsgs));
      setInputValue('');
      
      // Show error to user
      alert('Message sent (offline). It will sync when back online.');
    }
  };

  return (
    <div className="app-container">
      <nav className="top-nav">
        <div className="nav-section left">
          <img 
            src={`${process.env.PUBLIC_URL}/images/landingpage/logo.png`} 
            alt="CITADA Logo"
            className="nav-logo"
          />
          <button className="nav-btn" onClick={() => window.location.href='/SupplierHomepage'}>Home</button>
          <button className="nav-btn" onClick={() => window.location.href='/SupplierEvents'}>My Events</button>
          <button className="nav-btn active">Messages</button>
        </div>
        <div className="nav-section right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="nav-btn" onClick={() => window.location.href = '/SupplierWork'}>
            My Work
          </button>
          <button className="nav-btn" onClick={() => window.location.href = '/SupplierTeam'}>
            My Team
          </button>
          <UserAvatar />
        </div>
      </nav>
      <main className="content-area">
        <h2 className="section-title">My Messages</h2>
        <div className="container">
          {/* Sidebar for Events */}
          <div className="sidebar">
            {sortedEventList.length === 0 && (
              <div className="event" style={{ color: '#999' }}>No conversations</div>
            )}
            {sortedEventList.map((ev) => (
              <div
                key={ev.eventId}
                className={`event ${selectedEvent?.eventId === ev.eventId ? 'active' : ''}`}
                onClick={() => setSelectedEvent(ev)}
              >
                <div style={{fontWeight:'bold'}}>{ev.eventName}</div>
                <div style={{fontSize:'14px', color:'#441752'}}>
                  {ev.adminCompanyName ? (
                    <>
                      <span style={{fontWeight:'bold'}}>{ev.adminCompanyName}</span>
                      <span style={{fontSize:'12px', color:'#441752'}}> • {ev.adminFullName || ev.adminName}</span>
                    </>
                  ) : (
                    ev.adminName
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Area */}
          <div className="chat-area">
            {!selectedEvent ? (
              <div className="no-event-selected">
                {eventList.length === 0
                  ? 'No conversations available'
                  : 'Select an event to view messages'}
              </div>
            ) : (
              <div>
                {/* Chat Header */}
                <div className="chat-header" style={{
                  fontSize: '18px',
                  color: '#441752',
                  padding: '16px 24px',
                  background: 'white',
                  borderBottom: '1px solid #eee',
                  fontWeight: '600'
                }}>
                  {selectedEvent.eventName} / {
                    selectedEvent.adminCompanyName ? (
                      <>
                        <span style={{fontWeight:'bold'}}>{selectedEvent.adminCompanyName}</span>
                        <span style={{fontSize:'14px', color:'#441752'}}> ({selectedEvent.adminFullName || selectedEvent.adminName})</span>
                      </>
                    ) : (
                      selectedEvent.adminName
                    )
                  }
                </div>
                
                {/* Message List */}
                <div className="message-list">
                  {filteredMessages.map((msg, index) => {
                    const isCurrentUser = msg.sender === (localStorage.getItem('supplierEmail') || '');
                    const isAdmin = msg.sender === selectedEvent?.adminId || (msg.sender !== (localStorage.getItem('supplierEmail') || '') && msg.sender !== 'system');

                    return (
                      <div
                        key={msg.id || `msg-${index}`}
                        className={`message ${isCurrentUser ? 'sent' : 'received'}`}
                      >
                        {!isCurrentUser && (
                          <div className="message-avatar">
                            {isAdmin ? 'EO' : 'S'}
                          </div>
                        )}
                        <div className="message-content">
                          <div className="message-text">{msg.content}</div>
                          <div className="message-time">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Just now'}
                          </div>
                        </div>
                        {isCurrentUser && (
                          <div className="message-avatar">
                            {'S'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredMessages.length === 0 && !isLoading && (
                    <div className="no-messages">No messages yet. Start the conversation!</div>
                  )}
                  {isLoading && <div className="loading">Loading messages...</div>}
                </div>

                {/* Message Input */}
                <div className="message-input-container">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && inputValue.trim() && sendMessage()}
                    placeholder="Type your message..."
                    className="message-input"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="send-button"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background-color: #A888B5;
          font-family: 'Inter', sans-serif;
        }
        .top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 32px;
          height: 64px;
          background: #441752;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-section {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .nav-logo {
          height: 28px;
          margin-right: 16px;
        }
        .nav-btn {
          padding: 8px 16px;
          border: none;
          background: none;
          color: #A888B5;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .nav-btn:hover {
          background: #A888B5;
          color: #441752;
        }
        .nav-btn.active {
          color: #A888B5;
          background: #441752;
        }
        .user-profile {
          width: 32px;
          height: 32px;
          background: #A888B5;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 500;
        }
        .content-area {
          padding: 32px 40px;
          margin-top: 32px;
        }
        .section-title {
          font-size: 24px;
          color: #441752;
          margin-left: 40px;
        }
        .container {
          display: flex;
          height: 70vh;
          background-color: #A888B5;
          font-family: 'Inter', sans-serif;
        }
        .sidebar {
          width: 20%;
          display: flex;
          flex-direction: column;
          border-right: 2px solid #441752;
          background-color: #A888B5;
          padding: 8px;
        }
        .event {
          padding: 16px;
          font-weight: bold;
          border-bottom: 2px solid #441752;
          background-color: #A888B5;
          color: #441752;
        }
        .event.active {
          background: #fff;
        }
        .chat-box {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: calc(100vh - 180px);
          background: #f5f5f5;
          border-radius: 16px;
          overflow: hidden;
        }
        .supplier-name {
          font-size: 18px;
          color: #441752;
          padding: 16px 24px;
          background: white;
          border-bottom: 1px solid #eee;
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .message {
          display: flex;
          max-width: 80%;
          margin-bottom: 10px;
          align-items: flex-end;
        }
        .message.sent {
          align-self: flex-end;
          flex-direction: row-reverse;
          margin-right: 16px;
        }
        .message.received {
          align-self: flex-start;
        }
        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #f0e6f5;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 8px;
          color: #441752;
          font-weight: bold;
          font-size: 14px;
          flex-shrink: 0;
        }
        .message-content {
          background: #441752;
          color: white;
          border-radius: 16px;
          padding: 10px 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          font-size: 15px;
          max-width: 100%;
          word-wrap: break-word;
        }
        .message.sent .message-content {
          background: #441752;
          color: white;
          margin-left: 8px;
        }
        .message.received .message-content {
          background: white;
          color: #333;
          margin-right: 8px;
        }
        .message-time {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 4px;
          text-align: right;
        }
        .message.received .message-time {
          color: rgba(0, 0, 0, 0.5);
        }
        .message-input-container {
          display: flex;
          padding: 12px 16px;
          background: white;
          border-top: 1px solid #eee;
          gap: 8px;
        }
        .message-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 24px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s;
        }
        .message-input:focus {
          border-color: #441752;
        }
        .send-button {
          background: #441752;
          color: white;
          border: none;
          border-radius: 24px;
          padding: 0 24px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        .send-button:disabled {
          background: #b39eb5;
          cursor: not-allowed;
        }
        .send-button:not(:disabled):hover {
          background: #5d2c6e;
        }
        @media (max-width: 900px) {
          .content-area {
            padding: 12px 4px;
          }
          .container {
            height: auto;
          }
        }
        @media (max-width: 600px) {
          .top-nav {
            flex-direction: column;
            height: auto;
            padding: 8px 4px;
            gap: 8px;
          }
          .nav-section {
            gap: 8px;
          }
          .content-area {
            padding: 4px 1px;
            margin-top: 24px;
          }
          .section-title {
            font-size: 15px;
            margin-left: 8px;
          }
          .container {
            flex-direction: column;
            height: auto;
            min-height: 0;
          }
          .sidebar {
            width: 100%;
            flex-direction: row;
            border-right: none;
            border-bottom: 2px solid #441752;
            padding: 4px;
            overflow-x: auto;
            gap: 4px;
          }
          .event {
            padding: 8px 12px;
            font-size: 12px;
            min-width: 80px;
          }
          .chat-box {
            width: 100%;
            padding: 8px 4px;
            min-width: 0;
          }
          .supplier-name {
            font-size: 13px;
            margin-bottom: 8px;
          }
          .chat-messages {
            font-size: 13px;
            margin-bottom: 8px;
          }
          .message-field {
            font-size: 12px;
            padding: 8px;
          }
          .send-button {
            background: #441752;
            color: #A888B5;
            border: none;
            border-radius: 8px;
            padding: 0 24px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }
          .send-button:disabled {
            background: #A888B5;
            color: #441752;
            cursor: not-allowed;
          }
          @media (max-width: 900px) {
            .content-area {
              padding: 12px 4px;
            }
            .container {
              height: auto;
            }
          }
          @media (max-width: 600px) {
            .top-nav {
              flex-direction: column;
              height: auto;
              padding: 8px 4px;
              gap: 8px;
            }
            .nav-section {
              gap: 8px;
            }
            .content-area {
              padding: 4px 1px;
              margin-top: 24px;
            }
            .section-title {
              font-size: 15px;
              margin-left: 8px;
            }
            .container {
              flex-direction: column;
              height: auto;
              min-height: 0;
            }
            .sidebar {
              width: 100%;
              flex-direction: row;
              border-right: none;
              border-bottom: 2px solid #441752;
              padding: 4px;
              overflow-x: auto;
              gap: 4px;
            }
            .event {
              padding: 8px 12px;
              font-size: 12px;
              min-width: 80px;
            }
            .chat-box {
              width: 100%;
              padding: 8px 4px;
              min-width: 0;
            }
            .supplier-name {
              font-size: 13px;
              margin-bottom: 8px;
            }
            .chat-messages {
              font-size: 13px;
              margin-bottom: 8px;
            }
            .message-field {
              font-size: 12px;
              padding: 8px;
            }
            .send-button {
              font-size: 12px;
              padding: 0 12px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default SupplierMessagesPage;
