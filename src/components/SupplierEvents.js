import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { updateEventSuppliersWithUserId } from '../utils/updateSupplierEvents';

// UserAvatar component
const UserAvatar = () => {
  const [initial, setInitial] = useState('S');
  React.useEffect(() => {
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

  // Fetch the current user ID and ensure event_suppliers table is updated
  // Check if required tables exist
  const checkTables = async () => {
    try {
      // Check events table
      const { error: eventsError } = await supabase
        .from('events')
        .select('*')
        .limit(1);
      
      if (eventsError) {
        console.error('Error accessing events table:', eventsError);
      }
      
      // Check event_suppliers table
      const { error: eventSuppliersError } = await supabase
        .from('event_suppliers')
        .select('*')
        .limit(1);
        
      if (eventSuppliersError) {
        console.error('Error accessing event_suppliers table:', eventSuppliersError);
      }
    } catch (err) {
      console.error('Error checking database tables:', err);
    }
  };

  useEffect(() => {
    // Run table check on component mount
    checkTables();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      if (session?.user) {
        setUserId(session.user.id);
        
        // Update event_suppliers table with user ID when auth state changes
        // This handles both initial login and email verification
        if (session.user.id && session.user.email) {
          updateEventSuppliersWithUserId(session.user.id, session.user.email)
            .then(result => {
              console.log('Event suppliers update result:', result);
            })
            .catch(err => {
              console.error('Failed to update event_suppliers table:', err);
            });
        }
      }
    });

    // Initial check for current user
    async function fetchCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          
          // Also attempt to update event_suppliers on component mount
          if (user.email) {
            updateEventSuppliersWithUserId(user.id, user.email)
              .then(result => {
                console.log('Initial event suppliers update result:', result);
              })
              .catch(err => {
                console.error('Failed to update event_suppliers table:', err);
              });
          }
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    }
    fetchCurrentUser();

    // Cleanup subscription
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Fetch events for this supplier using multiple sources to ensure persistence across logins
  useEffect(() => {
    async function fetchSupplierEvents() {
      setLoading(true);
      setError(null);
      console.log('Fetching supplier events - ensuring all events are shown regardless of status');
      
      try {
        // Step 1: Get current user details (ID and email)
        let userEmail = null;
        let currentUserId = userId;
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            userEmail = user.email;
            currentUserId = user.id;
            console.log(`Current user details - ID: ${currentUserId}, Email: ${userEmail}`);
          }
        } catch (authErr) {
          console.error('Error getting authenticated user:', authErr);
        }
        
        // Step 2: Get email from profile if not from auth
        if (!userEmail && currentUserId) {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', currentUserId)
              .maybeSingle();
              
            if (profile?.email) {
              userEmail = profile.email;
              console.log(`Retrieved email from profile: ${userEmail}`);
            }
          } catch (profileErr) {
            console.error('Error getting profile:', profileErr);
          }
        }
        
        // Step 3: If we still don't have user info, try from localStorage as fallback
        if (!userEmail) {
          const storedEmail = localStorage.getItem('supplierEmail');
          if (storedEmail) {
            userEmail = storedEmail;
            console.log(`Using email from localStorage: ${userEmail}`);
          } else {
            console.error('Cannot fetch events: No user email available from any source');
            setEvents([]);
            setLoading(false);
            return;
          }
        }
        
        // Remember this email for future sessions
        localStorage.setItem('supplierEmail', userEmail);
        
        // We'll collect event IDs from multiple sources
        const eventIdsSet = new Set();
        
        // Source 1: Get event IDs from invites table
        try {
          const { data: invites } = await supabase
            .from('invites')
            .select('event_id')
            .eq('supplier_email', userEmail.toLowerCase().trim());
            
          if (invites?.length > 0) {
            console.log(`Found ${invites.length} invites for ${userEmail}`);
            invites.forEach(invite => eventIdsSet.add(invite.event_id));
          }
        } catch (invitesErr) {
          console.error('Error fetching invites:', invitesErr);
        }
        
        // Source 2: Get event IDs from event_suppliers table by email
        try {
          const { data: eventSuppliersByEmail } = await supabase
            .from('event_suppliers')
            .select('event_id')
            .eq('supplier_email', userEmail);
            
          if (eventSuppliersByEmail?.length > 0) {
            console.log(`Found ${eventSuppliersByEmail.length} event_suppliers by email`);
            eventSuppliersByEmail.forEach(es => eventIdsSet.add(es.event_id));
          }
        } catch (esEmailErr) {
          console.error('Error fetching event_suppliers by email:', esEmailErr);
        }
        
        // Source 3: Get event IDs from event_suppliers table by user ID
        if (currentUserId) {
          try {
            const { data: eventSuppliersByUserId } = await supabase
              .from('event_suppliers')
              .select('event_id')
              .eq('supplier_user_id', currentUserId);
              
            if (eventSuppliersByUserId?.length > 0) {
              console.log(`Found ${eventSuppliersByUserId.length} event_suppliers by user ID`);
              eventSuppliersByUserId.forEach(es => eventIdsSet.add(es.event_id));
            }
          } catch (esUserIdErr) {
            console.error('Error fetching event_suppliers by user ID:', esUserIdErr);
          }
        }
        
        // Now we have all possible event IDs
        const eventIdsList = Array.from(eventIdsSet);
        console.log(`Combined unique event IDs: ${eventIdsList.length}`, eventIdsList);
        
        // Always include public events visible to every supplier
        let publicEvents = [];
        try {
          const { data: pubEvents, error: pubErr } = await supabase
            .from('events')
            .select('*')
            .eq('visibility', 'public');
          if (pubErr) {
            console.error('Error fetching public events:', pubErr);
          } else {
            publicEvents = pubEvents || [];
          }
        } catch (pubCatch) {
          console.error('Unexpected error fetching public events:', pubCatch);
        }

        if (eventIdsList.length === 0 && publicEvents.length === 0) {
          console.log('No events found for this supplier and no public events available');
          setEvents([]);
          setLoading(false);
          return;
        }
        
        // Batch fetch all events in one query
        let allEvents = [];
        let missingEventIds = [];
        
        if (eventIdsList.length > 0) {
          console.log('Batch fetching events for IDs:', eventIdsList, eventIdsList.map(id => typeof id));
          
          // First try to fetch real events from events table with all required fields
          let realEvents = [];
          try {
            // Ensure we have valid UUIDs
            const validEventIds = eventIdsList.filter(id => 
              typeof id === 'string' && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
            );
            
            if (validEventIds.length !== eventIdsList.length) {
              console.warn(`Filtered out ${eventIdsList.length - validEventIds.length} invalid UUIDs`);
            }
            
            if (validEventIds.length === 0) {
              console.log('No valid UUIDs to fetch');
              return;
            }
            
            // Process event IDs in smaller batches to avoid URL length issues
            const batchSize = 10; // Reduced batch size
            const batches = [];
            
            // Split event IDs into batches
            for (let i = 0; i < validEventIds.length; i += batchSize) {
              const batch = validEventIds.slice(i, i + batchSize);
              if (batch.length > 0) {
                batches.push(batch);
              }
            }
            
            console.log(`Processing ${batches.length} batches of event IDs`);
            
            // Process each batch sequentially
            for (const [index, batch] of batches.entries()) {
              console.log(`Processing batch ${index + 1}/${batches.length} with ${batch.length} IDs`);
              try {
                // Use a different query approach for better compatibility
                const query = supabase
                  .from('events')
                  .select('*');
                
                // Add each ID as a separate OR condition
                batch.forEach((id, i) => {
                  if (i === 0) {
                    query.eq('id', id);
                  } else {
                    query.or(`id.eq.${id}`);
                  }
                });
                
                const { data, error } = await query;
                
                if (error) {
                  console.error(`Error in batch ${index + 1}:`, {
                    error,
                    batchSize: batch.length,
                    firstId: batch[0],
                    lastId: batch[batch.length - 1]
                  });
                  continue; // Skip to next batch on error
                }
                
                if (data && data.length > 0) {
                  realEvents = [...realEvents, ...data];
                  console.log(`Batch ${index + 1}: Fetched ${data.length} events, total: ${realEvents.length}`);
                } else {
                  console.log(`Batch ${index + 1}: No events found`);
                }
              } catch (batchError) {
                console.error('Error in batch processing:', {
                  error: batchError,
                  batchIndex: index,
                  batchSize: batch.length,
                  firstId: batch[0],
                  lastId: batch[batch.length - 1]
                });
                // Continue with next batch even if one fails
              }
            }
            
            // Sort all events by created_at after all batches are processed
            realEvents.sort((a, b) => 
              new Date(b.created_at) - new Date(a.created_at)
            );
            
            console.log(`Total real events found: ${realEvents.length} out of ${validEventIds.length} valid IDs`);
          } catch (realEventsError) {
            console.error('Error fetching real events, will use placeholders:', realEventsError);
            // Continue with empty array to use placeholders
          }
          
          // Process real events
          const foundEventIds = new Set();
          if (realEvents && realEvents.length > 0) {
            allEvents = realEvents.map(event => {
              if (!event) return null;
              
              const eventId = event.id || event.event_id;
              if (!eventId) return null;
              
              foundEventIds.add(eventId);
              return {
                id: eventId,
                name: event.name || event.event_name || 'Untitled Event',
                type: event.type || 'event',
                start_date: event.start_date || event.startDate || new Date().toISOString(),
                end_date: event.end_date || event.endDate || new Date().toISOString(),
                location: event.location || 'Location not specified',
                status: event.status || 'pending',
                admin_id: event.admin_id || event.adminId,
                created_at: event.created_at || new Date().toISOString(),
                // Include any other fields that might be needed
                subType: event.sub_type || '',
                location: event.location || 'Location TBD',
                startDate: event.start_date || '',
                endDate: event.end_date || '',
                budget: event.budget || 0,
                imageUrl: '',
                isPlaceholder: false
              };
            });
          }
          
          // Find missing event IDs that need placeholders
          missingEventIds = eventIdsList.filter(id => id && !foundEventIds.has(id));
          console.log('Missing event IDs needing placeholders:', missingEventIds);
          
          if (missingEventIds.length > 0) {
            console.log(`Attempting to create placeholders for ${missingEventIds.length} missing events`);
            
            // Filter out any null/undefined IDs and process them
            const validMissingIds = missingEventIds.filter(id => id);
            
            // Process each missing event ID
            const placeholderPromises = validMissingIds.map(async (eventId) => {
              if (!eventId) return null;
              
              console.log(`Processing event ID: ${eventId}`);
              
              try {
                // First try to get the actual event
                try {
                  const { data: eventData, error: eventError } = await supabase
                    .from('events')
                    .select('*')
                    .eq('id', eventId)
                    .single();
                    
                  if (eventData && !eventError) {
                    console.log(`Found existing event: ${eventId}`);
                    return {
                      ...eventData,
                      name: eventData.name || 'Untitled Event',
                      type: eventData.type || 'event',
                      status: eventData.status || 'active',
                      isPlaceholder: false
                    };
                  }
                } catch (eventErr) {
                  console.log(`Event ${eventId} not found in events table, checking invites...`);
                }
                
                // If event not found, check for invites
                const { data: invite, error: inviteError } = await supabase
                  .from('invites')
                  .select('*')
                  .eq('event_id', eventId)
                  .eq('supplier_email', userEmail)
                  .maybeSingle();
                  
                if (invite && !inviteError) {
                  let adminName = 'Event Organizer';
                  
                  // Get admin info if available
                  if (invite.invited_by_admin_id) {
                    try {
                      const { data: adminData } = await supabase
                        .from('profiles')
                        .select('full_name, email')
                        .eq('id', invite.invited_by_admin_id)
                        .maybeSingle();
                        
                      if (adminData) {
                        adminName = adminData.full_name || adminData.email || 'Event Organizer';
                      }
                    } catch (adminErr) {
                      console.error('Error fetching admin info:', adminErr);
                    }
                  }
                  
                  // Create a placeholder event with invite data
                  return {
                    id: eventId,
                    name: `${adminName}'s Event`,
                    description: `You've been invited to this event`,
                    type: 'event',
                    status: invite.status || 'pending',
                    start_date: invite.created_at || new Date().toISOString(),
                    end_date: invite.created_at || new Date().toISOString(),
                    location: 'Location not specified',
                    isPlaceholder: true,
                    created_at: invite.created_at || new Date().toISOString()
                  };
                }
                
                // If we get here, no valid event or invite was found
                console.log(`No valid event or invite found for ${eventId}`);
                return {
                  id: eventId,
                  name: 'Event Not Found',
                  type: 'event',
                  status: 'error',
                  isPlaceholder: true,
                  created_at: new Date().toISOString()
                };
                
              } catch (err) {
                console.error(`Error processing event ${eventId}:`, err);
                return {
                  id: eventId,
                  name: 'Error Loading Event',
                  type: 'event',
                  status: 'error',
                  isPlaceholder: true,
                  created_at: new Date().toISOString(),
                  error: err.message
                };
              }
            });
            
            // Wait for all placeholders to be processed
            const placeholderResults = await Promise.all(placeholderPromises);
            
            // Filter out any null values and add to allEvents
            const validPlaceholders = placeholderResults.filter(event => event !== null);
            allEvents = [...allEvents, ...validPlaceholders];
          } else {
            console.log('No missing events to process');
          }
          
          console.log(`Successfully fetched ${allEvents.length} events:`, allEvents);
          
          // Sort events by most recent start date first
          const sortedEvents = allEvents.sort((a, b) => {
            // If both have start dates, sort by those
            if (a.start_date && b.start_date) {
              return new Date(b.start_date) - new Date(a.start_date);
            }
            // If only one has a start date, prioritize it
            if (a.start_date) return -1;
            if (b.start_date) return 1;
            // Otherwise sort by created date if available
            if (a.created_at && b.created_at) {
              return new Date(b.created_at) - new Date(a.created_at);
            }
            return 0;
          });
          
          // Map all events to camelCase for UI consistency
          function mapEventToCamelCase(event) {
            return {
              id: event.id,
              name: event.name || 'Untitled Event',
              description: event.description || '',
              type: event.type || 'event',
              subType: event.sub_type || event.subType || '',
              location: event.location || 'Location TBD',
              startDate: event.start_date || event.startDate || new Date().toISOString(),
              endDate: event.end_date || event.endDate || new Date().toISOString(),
              visibility: event.visibility || 'private',
              budget: event.budget || 0,
              status: event.status || 'pending',
              imageUrl: event.image_url || event.imageUrl || '',
              isPlaceholder: event.is_placeholder || event.isPlaceholder || false,
              adminId: event.admin_id || event.adminId,
              createdAt: event.created_at || event.createdAt || new Date().toISOString(),
              updatedAt: event.updated_at || event.updatedAt || new Date().toISOString(),
              // Include any additional fields that might be needed
              ...(event.invitation_status && { invitationStatus: event.invitation_status })
            };
          }
          const camelEvents = sortedEvents.map(mapEventToCamelCase);
          try {
            localStorage.setItem('supplierEvents', JSON.stringify(camelEvents));
            console.log('Saved events to localStorage, total:', camelEvents.length);
          } catch (storageErr) {
            console.warn('Failed to save events to localStorage:', storageErr);
          }
          setEvents(camelEvents);
        } else {
          console.log('No events found for this supplier');
          setEvents([]);
        }
      } catch (error) {
        console.error('Error fetching supplier events:', error);
        setError('Failed to load events. Please try again later.');
        
        // Try to load from localStorage as fallback if we have error
        try {
          const savedEvents = localStorage.getItem('supplierEvents');
          if (savedEvents) {
            const parsedEvents = JSON.parse(savedEvents);
            console.log('Loading events from localStorage fallback:', parsedEvents);
            setEvents(parsedEvents);
            setError(null); // Clear error if we successfully load from localStorage
          }
        } catch (storageErr) {
          console.error('Error loading events from localStorage:', storageErr);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSupplierEvents();
    
    // Refresh events whenever userId changes OR after 2 seconds (to handle post-confirmation load)
    const postLoginRefresh = setTimeout(() => {
      fetchSupplierEvents();
    }, 2000);
    
    return () => clearTimeout(postLoginRefresh);
  }, [userId, supabase]);

  return (
    <div className="supplier-events-root" style={{ backgroundColor: '#A888B5', minHeight: '100vh', fontFamily: 'Arial, sans-serif', color: '#441752' }}>
      <nav className="top-nav">
        <div className="nav-section left">
          <img 
            src={`${process.env.PUBLIC_URL}/images/landingpage/logo.png`} 
            alt="CITADA Logo"
            className="nav-logo"
          />
          {mainNavItems.map(item => (
            <button
              key={item.name}
              className={`nav-btn${activeNav === item.name ? ' active' : ''}`}
              onClick={() => {
                setActiveNav(item.name);
                navigate(item.path);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="nav-section right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {userNavItems.map(item => (
            <button
              key={item.name}
              className="nav-btn"
              onClick={() => {
                setActiveNav(item.name);
                navigate(item.path);
              }}
            >
              {item.name}
            </button>
          ))}
          <UserAvatar />
        </div>
      </nav>
      <h1 className="supplier-events-title" style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '24px', padding: '10px' }}>My Events</h1>
      
      <div className="events-container" style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>Loading events...</div>
        ) : error ? (
          <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: '8px' }}>
            <p style={{ fontSize: '18px', color: '#441752' }}>You don't have any events yet.</p>
            <p style={{ fontSize: '14px', color: '#666' }}>Events will appear here when you're invited by an organizer.</p>
          </div>
        ) : (
          <div className="events-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {events.map(event => (
              <div 
                key={event.id} 
                className="event-card" 
                style={{
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  padding: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onClick={() => navigate(`/SupplierEventDetail/${event.id}`)}
              >
                <h3 style={{ color: '#441752', marginBottom: '12px', fontSize: '20px', borderBottom: '2px solid #A888B5', paddingBottom: '8px' }}>
                  {event.name || 'Untitled Event'}
                </h3>
                
                {/* Event Details Section - Admin entered fields */}
                <div style={{ fontSize: '14px', color: '#444', marginBottom: '15px', backgroundColor: '#f9f5fc', padding: '10px', borderRadius: '6px' }}>
                  {/* Type and Sub-type - Admin entered */}
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>🏷️</span>
                    <div>
                      <strong>Type:</strong> {event.type}
                      {event.subType && (
                        <span> - {event.subType}</span>
                      )} 
                    </div>
                  </div>

                  {/* Location - Admin entered */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>📍</span>
                    <div>
                      <strong>Location:</strong> {event.location}
                    </div>
                  </div>

                  {/* Budget - Admin entered */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>💰</span>
                    <div>
                      <strong>Budget:</strong> {typeof event.budget === 'number' 
                         ? `$${event.budget.toLocaleString()}` 
                         : event.budget} 
                    </div>
                  </div>

                  {/* Date information - Admin entered */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                    <span style={{ color: '#A888B5', fontWeight: 'bold', fontSize: '16px', marginRight: '2px' }}>📅</span>
                    <div>
                      <strong>Date:</strong> {event.startDate 
                        ? new Date(event.startDate).toLocaleDateString() 
                        : 'Not specified'}
                      {event.endDate && event.endDate !== event.startDate && 
                        <div style={{ marginTop: '2px' }}>
                          <strong>End Date:</strong> {new Date(event.endDate).toLocaleDateString()}
                        </div>}
                    </div>
                  </div>
                </div>
                
                {/* Footer with status */}
                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  
                  
                  <span style={{ fontSize: '13px', color: '#777', fontStyle: 'italic' }}>
                    Click to view details
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}      
      </div>
      <style jsx="true">{`
        body {
          margin: 0;
          padding: 0;
        }
        .top-nav {
          margin-top: 0;
          margin-bottom: 0;
          padding-top: 0;
          padding-bottom: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-left: 32px;
          padding-right: 32px;
          height: 64px;
          background: #441752;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
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
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #A888B5;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 16px;
          flex-shrink: 0;
          cursor: pointer;
          margin-right: 4px;
        }
        @media (max-width: 900px) {
          .supplier-events-root {
            padding: 1rem;
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
          .supplier-events-root {
            padding: 16px 4px !important;
          }
          .supplier-events-title {
            font-size: 20px !important;
            margin-bottom: 12px !important;
          }
          .supplier-events-desc {
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SupplierEvents;
