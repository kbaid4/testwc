import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { realtimeService } from '../services/realtimeService';
import { updateEventSuppliersWithUserId } from '../utils/updateSupplierEvents';

// UserAvatar component
const UserAvatar = () => {
  const [initial, setInitial] = useState('S');
  
  useEffect(() => {
    const fetchInitial = async () => {
      let name = localStorage.getItem('supplierName') || localStorage.getItem('signupName') || 'Supplier';
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();
          if (profile?.full_name) {
            name = profile.full_name;
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
      setInitial(name.charAt(0).toUpperCase());
    };
    
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

const mainNavItems = [
  { name: 'Home', path: '/SupplierHomepage' },
  { name: 'My Events', path: '/SupplierEvents' },
  { name: 'Messages', path: '/SupplierMessagesPage' }
];

const userNavItems = [
  { name: 'My Work', path: '/SupplierWork' },
  { name: 'My Team', path: '/SupplierTeam' }
];

const SupplierEvents = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('My Events');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');

  // Fetch events with real-time updates
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      setUserId(user.id);
      setUserEmail(user.email);
      
      // Ensure user is properly linked to events
      await updateEventSuppliersWithUserId(user.id, user.email);
      
      // Get events where user is a supplier
      const { data: supplierEvents, error: supplierError } = await supabase
        .from('event_suppliers')
        .select('event_id, status, events(*)')
        .eq('supplier_email', user.email);
        
      if (supplierError) throw supplierError;
      
      // Get invites for this user
      const { data: invites, error: invitesError } = await supabase
        .from('invites')
        .select('*')
        .eq('supplier_email', user.email);
        
      if (invitesError) throw invitesError;
      
      // Process events from event_suppliers
      const processedEvents = (supplierEvents || [])
        .filter(se => se.events) // Filter out null events
        .map(se => ({
          ...se.events,
          invitationStatus: se.status || 'accepted',
          isPlaceholder: false
        }));
      
      // Process invites that don't have corresponding events
      const inviteEvents = (invites || [])
        .filter(invite => !supplierEvents?.some(se => se.event_id === invite.event_id))
        .map(invite => ({
          id: invite.event_id,
          name: invite.event_name || 'Invited Event',
          description: invite.event_description || 'You have been invited to this event',
          start_date: invite.event_date || new Date().toISOString(),
          end_date: invite.event_end_date || new Date().toISOString(),
          location: invite.event_location || 'Location to be announced',
          status: 'invited',
          invitationStatus: invite.status || 'pending',
          isPlaceholder: true,
          admin_id: invite.admin_id,
          adminName: 'Event Organizer'
        }));
      
      // Combine and sort events
      const allEvents = [...processedEvents, ...inviteEvents]
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
      
      // Get admin names for all events
      const adminIds = [...new Set(allEvents.map(e => e.admin_id).filter(Boolean))];
      const adminNames = {};
      
      if (adminIds.length > 0) {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id, full_name, companyname')
          .in('id', adminIds);
          
        admins?.forEach(admin => {
          adminNames[admin.id] = admin.full_name || admin.companyname || 'Event Organizer';
        });
      }
      
      // Update events with admin names
      const eventsWithAdminNames = allEvents.map(event => ({
        ...event,
        adminName: event.admin_id ? (adminNames[event.admin_id] || 'Event Organizer') : 'Event Organizer'
      }));
      
      setEvents(eventsWithAdminNames);
      setError(null);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userEmail) return;
    
    // Subscribe to event updates
    const unsubscribeEvents = realtimeService.subscribeToTable(
      'events',
      '',
      (payload) => {
        if (payload.eventType === 'UPDATE') {
          setEvents(prev => 
            prev.map(event => 
              event.id === payload.new.id 
                ? { ...event, ...payload.new } 
                : event
            )
          );
        }
      }
    );
    
    // Subscribe to invites
    const unsubscribeInvites = realtimeService.subscribeToTable(
      'invites',
      `supplier_email=eq.${userEmail}`,
      async (payload) => {
        if (payload.eventType === 'INSERT') {
          // New invite - add to events if not already there
          const newInvite = {
            id: payload.new.event_id,
            name: payload.new.event_name || 'Invited Event',
            description: payload.new.event_description || 'You have been invited to this event',
            start_date: payload.new.event_date || new Date().toISOString(),
            end_date: payload.new.event_end_date || new Date().toISOString(),
            location: payload.new.event_location || 'Location to be announced',
            status: 'invited',
            invitationStatus: payload.new.status || 'pending',
            isPlaceholder: true,
            admin_id: payload.new.admin_id,
            adminName: 'Event Organizer'
          };
          
          // Get admin name if available
          if (payload.new.admin_id) {
            try {
              const { data: admin } = await supabase
                .from('profiles')
                .select('full_name, companyname')
                .eq('id', payload.new.admin_id)
                .single();
                
              if (admin) {
                newInvite.adminName = admin.full_name || admin.companyname || 'Event Organizer';
              }
            } catch (err) {
              console.error('Error fetching admin details:', err);
            }
          }
          
          setEvents(prev => {
            // Don't add if already exists
            if (prev.some(e => e.id === newInvite.id)) {
              return prev;
            }
            return [...prev, newInvite];
          });
        } else if (payload.eventType === 'UPDATE') {
          // Update existing invite
          setEvents(prev => 
            prev.map(event => 
              event.id === payload.new.event_id
                ? { 
                    ...event, 
                    ...(payload.new.status && { invitationStatus: payload.new.status }),
                    ...(payload.new.event_name && { name: payload.new.event_name }),
                    ...(payload.new.event_description && { description: payload.new.event_description })
                  }
                : event
            )
          );
        } else if (payload.eventType === 'DELETE') {
          // Remove invite
          setEvents(prev => 
            prev.filter(event => event.id !== payload.old.event_id || !event.isPlaceholder)
          );
        }
      }
    );
    
    // Subscribe to event_suppliers for accepted invites
    const unsubscribeEventSuppliers = realtimeService.subscribeToTable(
      'event_suppliers',
      `supplier_email=eq.${userEmail}`,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          // New event_supplier record - update the corresponding event
          setEvents(prev => 
            prev.map(event => 
              event.id === payload.new.event_id
                ? { 
                    ...event, 
                    isPlaceholder: false,
                    invitationStatus: payload.new.status || 'accepted'
                  }
                : event
            )
          );
        } else if (payload.eventType === 'UPDATE') {
          // Updated status
          setEvents(prev => 
            prev.map(event => 
              event.id === payload.new.event_id
                ? { 
                    ...event, 
                    invitationStatus: payload.new.status || 'accepted'
                  }
                : event
            )
          );
        } else if (payload.eventType === 'DELETE') {
          // Handle removal from event_suppliers
          setEvents(prev => 
            prev.map(event => 
              event.id === payload.old.event_id
                ? { 
                    ...event, 
                    isPlaceholder: true,
                    invitationStatus: 'revoked'
                  }
                : event
            )
          );
        }
      }
    );
    
    // Initial fetch
    fetchEvents();
    
    // Cleanup
    return () => {
      unsubscribeEvents();
      unsubscribeInvites();
      unsubscribeEventSuppliers();
    };
  }, [userEmail, fetchEvents]);

  // Handle event click
  const handleEventClick = (eventId) => {
    navigate(`/supplier/events/${eventId}`);
  };

  // Render event card
  const renderEventCard = (event) => {
    const statusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-gray-100 text-gray-800',
      invited: 'bg-purple-100 text-purple-800',
      default: 'bg-gray-100 text-gray-800'
    };
    
    const statusText = {
      pending: 'Pending',
      accepted: 'Accepted',
      rejected: 'Rejected',
      completed: 'Completed',
      cancelled: 'Cancelled',
      invited: 'Invitation Received',
      default: 'Unknown'
    };
    
    const status = event.invitationStatus?.toLowerCase() || 'default';
    const statusClass = statusColors[status] || statusColors.default;
    const statusDisplay = statusText[status] || statusText.default;
    
    return (
      <div 
        key={event.id}
        className="border rounded-lg p-4 mb-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => handleEventClick(event.id)}
      >
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-semibold">{event.name}</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${statusClass}`}>
            {statusDisplay}
          </span>
        </div>
        
        <div className="mt-2 text-sm text-gray-600">
          <p>Organizer: {event.adminName}</p>
          <p>Date: {new Date(event.start_date).toLocaleDateString()}</p>
          {event.location && <p>Location: {event.location}</p>}
        </div>
        
        {event.isPlaceholder && (
          <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
            Awaiting event details from the organizer
          </div>
        )}
      </div>
    );
  };

  // Main render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
          <UserAvatar />
        </div>
      </header>
      
      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Navigation */}
        <nav className="mb-6">
          <ul className="flex space-x-4">
            {mainNavItems.map((item) => (
              <li key={item.name}>
                <button
                  onClick={() => navigate(item.path)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeNav === item.name
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        )}
        
        {/* Error state */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Events list */}
        {!loading && !error && (
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No events</h3>
                <p className="mt-1 text-sm text-gray-500">
                  You don't have any events yet. Check back later or contact the event organizer.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map(event => renderEventCard(event))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default SupplierEvents;
