import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutButton from './LogoutButton';
import UserProfile from './UserProfile';
import NotificationBell from './NotificationBell';
import { supabase } from '../supabaseClient';

const SupplierHomepage = () => {
  const navigate = useNavigate();
  const supplierName = localStorage.getItem('supplierName');
  const [userId, setUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const supplierEmail = currentUserEmail || localStorage.getItem('supplierEmail'); 
  const [displayName, setDisplayName] = React.useState('Supplier');
  const [invites, setInvites] = React.useState([]);
  const [inviteEvents, setInviteEvents] = React.useState([]);
  const [showInviteNotification, setShowInviteNotification] = React.useState(true);
  
  const [activeNav, setActiveNav] = useState('Home');
  const [activeCategory, setActiveCategory] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');

  // Events state (no longer sourced from localStorage)
  const [events, setEvents] = useState([]);

  React.useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        setCurrentUserEmail(user.email);
        console.log('SupplierHomepage - Current user:', { id: user.id, email: user.email });
        
        // Fetch supplier name
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
          
        if (profile && profile.full_name) {
          setDisplayName(profile.full_name);
        }
        
        // IMPORTANT: Ensure invitation notifications exist for this supplier
        ensureInvitationNotifications(user.email, user.id);
        
        // This is a direct attempt to create a test notification
        // that bypasses the usual flow to diagnose the issue
        createTestNotification(user.email);
      }
    };

    fetchCurrentUser();
  }, []);
  
  // Direct test function to create a notification
  const createTestNotification = async (email) => {
    if (!email) return;
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('DIRECT TEST: Creating test notification for:', normalizedEmail);
      
      // Create a test notification without requiring admin lookup
      const testNotification = {
        supplier_email: normalizedEmail,
        event_id: '00000000-0000-0000-0000-000000000000',
        admin_user_id: '00000000-0000-0000-0000-000000000000', // Using default ID
        type: 'test',
        status: 'unread',
        created_at: new Date().toISOString(),
        content: 'Test notification - please ignore'
      };
      
      const { data: result, error: insertError } = await supabase
        .from('notifications')
        .insert([testNotification])
        .select();
        
      if (insertError) {
        console.error('DIRECT TEST: Failed to insert test notification:', insertError);
      } else {
        console.log('DIRECT TEST: Successfully created test notification');
      }
    } catch (err) {
      console.error('DIRECT TEST: Error creating test notification:', err);
    }
  };
  
  // Function to ensure event invitation notifications exist for the supplier
  const ensureInvitationNotifications = async (email, userId) => {
    if (!email) return;
    
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('Checking for invitation notifications for:', normalizedEmail);
      
      // First, check if supplier has any invitations
      const { data: invitesData, error: invitesError } = await supabase
        .from('invites')
        .select('*')
        .eq('supplier_email', normalizedEmail);
        
      if (invitesError) {
        console.error('Error fetching supplier invites:', invitesError);
        return;
      }
      
      console.log(`Found ${invitesData?.length || 0} invites for supplier ${normalizedEmail}`);
      
      if (invitesData && invitesData.length > 0) {
        // Now check if notifications exist for these invites
        const { data: notificationsData, error: notificationsError } = await supabase
          .from('notifications')
          .select('*')
          .eq('supplier_email', normalizedEmail)
          .eq('type', 'invitation');
          
        if (notificationsError) {
          console.error('Error fetching invitation notifications:', notificationsError);
          return;
        }
        
        console.log(`Found ${notificationsData?.length || 0} existing notifications for ${normalizedEmail}`);
        
        // Create notifications for any invites that don't have corresponding notifications
        if (!notificationsData || notificationsData.length < invitesData.length) {
          // Create missing notifications
          const notificationsToCreate = invitesData.map(invite => ({
            supplier_email: normalizedEmail,
            event_id: invite.event_id,
            admin_user_id: invite.invited_by_admin_id,
            type: 'invitation',
            status: 'unread',
            created_at: new Date().toISOString(),
            content: 'You have been invited to an event'  // Using content field
          }));
          
          console.log('Creating missing notifications:', notificationsToCreate);
          
          const { error: insertError } = await supabase
            .from('notifications')
            .insert(notificationsToCreate);
            
          if (insertError) {
            console.error('Failed to create invitation notifications:', insertError);
          } else {
            console.log(`Successfully created ${notificationsToCreate.length} invitation notifications`);
          }
        } else {
          // Don't force notifications to be unread - respect user's read/unread status
          console.log('Invitation notifications already exist - preserving their read/unread status');
        }
      } else {
        console.log('No invites found for supplier, no notifications needed');
      }
    } catch (err) {
      console.error('Unexpected error ensuring invitation notifications:', err);
    }
  };

  React.useEffect(() => {
    async function fetchInvites() {
      try {
        // Get current user email
        let email = currentUserEmail || supplierEmail; 
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          email = user.email;
        }
        
        if (!email) {
          console.error('No email found for fetching invites');
          return;
        }

        console.log('Fetching invites for supplier email:', email);

        const { data: invitesData, error } = await supabase
          .from('invites')
          .select('*')
          .eq('supplier_email', email.toLowerCase().trim());

        if (error) {
          console.error('Error fetching invites:', error);
          return;
        }

        setInvites(invitesData || []);

        if (invitesData && invitesData.length > 0) {
          // No notification creation logic here
        }
      } catch (error) {
        console.error('Error in fetchInvites:', error);
      }
    }

    if (currentUserEmail || supplierEmail) {
      fetchInvites();
    }
  }, [currentUserEmail, supplierEmail, userId]);

  // Fetch public events (and invited events) from Supabase so every supplier sees the same list on any device
  useEffect(() => {
    async function fetchVisibleEvents() {
      try {
        // 1) Always pull all public events
        const { data: publicEvents, error: pubErr } = await supabase
          .from('events')
          .select('*')
          .eq('visibility', 'public');

        if (pubErr) {
          console.error('Error fetching public events:', pubErr);
        }

        // 2) Pull invite-specific events for this supplier (if we have their email)
        const supplierEmailLower = (supplierEmail || currentUserEmail || '').toLowerCase().trim();
        let inviteEvents = [];
        if (supplierEmailLower) {
          try {
            const { data: inviteRows } = await supabase
              .from('invites')
              .select('event_id')
              .eq('supplier_email', supplierEmailLower);

            const eventIds = (inviteRows || []).map(r => r.event_id);

            if (eventIds.length) {
              const { data: invitedEvents } = await supabase
                .from('events')
                .select('*')
                .in('id', eventIds);
              inviteEvents = invitedEvents || [];
            }
          } catch (invErr) {
            console.error('Error fetching invite events:', invErr);
          }
        }

        // Merge arrays by id to avoid duplicates
        const combinedMap = new Map();
        [...(publicEvents || []), ...inviteEvents].forEach(ev => combinedMap.set(ev.id, ev));
        const combinedEvents = Array.from(combinedMap.values());

        setEvents(combinedEvents);
      } catch (err) {
        console.error('Unexpected error loading events:', err);
      }
    }

    fetchVisibleEvents();
  }, [supabase, supplierEmail, currentUserEmail]);

  // Navigation data
  const mainNavItems = [
    { name: 'Home', path: '/SupplierHomepage' },
    { name: 'My Events', path: '/SupplierEvents' },
    { name: 'Messages', path: '/SupplierMessagesPage' }
  ];
  const rightNavItems = [
    { name: 'My Work', path: '/SupplierWork' },
    { name: 'My Team', path: '/SupplierTeam' }
  ];
  
  const categories = [
    { name: 'Venues & Facilities', path: '/SuppliersPage' },
    { name: 'Service Providers', path: '/ServiceProvider' },
    { name: 'Marketing', path: '/Marketing' },
    { name: 'Legal', path: '/Legal' }
  ];
  
  // Venue data with corrected image paths
  const venueTypes = [
    { name: 'Corporate Events', image: '1.png', path: '/SupplierSide' },
    { name: 'Social Events', image: '2.png' , path: '/SupplierSide'},
    { name: 'Professional Networking Events', image: '3.png' , path: '/SupplierSide'},
    { name: 'Educational Events', image: '4.png' , path: '/SupplierSide'},
    { name: 'Trade Shows and Expos', image: '5.png' , path: '/SupplierSide'},
    { name: 'Charity and Fundraising Events', image: '6.png' , path: '/SupplierSide'},
    { name: 'Cultural and Community Events', image: '7.png' , path: '/SupplierSide'},
    { name: 'Sport Events', image: '20.png' , path: '/SupplierSide'},
    { name: 'Art and Entertainment Events', image: '21.png' , path: '/SupplierSide'},
    { name: 'Health and Wellness Events', image: '10.png' , path: '/SupplierSide'},
    { name: 'Technology and Innovation Events', image: '17.png' , path: '/SupplierSide'},
    { name: 'Government Events', image: '12.png' , path: '/SupplierSide'}
  ];

  const handleCreateEventClick = () => {
    navigate('/CreateEventPage'); // Navigate to the Create Event page
  };

  const visibleEvents = events.filter(event => {
    if (event.visibility === 'public' || !event.visibility) return true;
    if (event.visibility === 'private' && event.invitedSuppliers && supplierEmail) {
      return event.invitedSuppliers.includes(supplierEmail);
    }
    return false;
  });

  return (
    <div className="app-container">
      {/* Notification for new event invites */}
      {showInviteNotification && inviteEvents.length > 0 && (
        <div style={{
          background: '#fffbe6',
          color: '#a77c00',
          border: '1px solid #ffe58f',
          borderRadius: '8px',
          padding: '16px',
          margin: '24px',
          marginBottom: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(255, 215, 0, 0.08)'
        }}>
          <div>
            <strong>You're invited to new event{inviteEvents.length > 1 ? 's' : ''}!</strong>
            <div style={{ marginTop: 4 }}>
              {inviteEvents.map((eventName, idx) => (
                <span key={eventName}>
                  {eventName}{idx < inviteEvents.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <a href="/SupplierEvents" style={{ color: '#a77c00', textDecoration: 'underline', fontWeight: 500 }}>
                View your invited events
              </a>
            </div>
          </div>
          <button
            onClick={() => setShowInviteNotification(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#a77c00',
              fontSize: '18px',
              cursor: 'pointer',
              marginLeft: '16px',
              fontWeight: 'bold'
            }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Navigation Bar */}
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
              className={`nav-btn ${activeNav === item.name ? 'active' : ''}`}
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
          {rightNavItems.map(item => (
            <button
              key={item.name}
              className={`nav-btn ${activeNav === item.name ? 'active' : ''}`}
              onClick={() => {
                setActiveNav(item.name);
                navigate(item.path);
              }}
            >
              {item.name}
            </button>
          ))}
          {/* Notification Bell */}
          {console.log('SupplierHomepage NotificationBell props:', {
            userType: 'supplier',
            userId: userId,
            supplierEmail: currentUserEmail || supplierEmail,
            currentUserEmail: currentUserEmail,
            localStorageEmail: supplierEmail
          })}
          <NotificationBell 
            key={currentUserEmail || supplierEmail} // Force re-render when email changes
            userType="supplier" 
            userId={userId} 
            supplierEmail={currentUserEmail || supplierEmail} 
          />
          
          {/* User Avatar */}
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
            title={displayName}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <LogoutButton className="nav-btn" style={{ color: '#A888B5', background: 'none', marginLeft: '12px' }} />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="content-area">
        <header className="content-header">
          <div className="header-left">
            <div className="welcome-section" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="welcome-text" style={{ margin: 0 }}>Welcome,</h1>
              <div className="welcome-username" style={{
                color: '#441752', 
                fontSize: '24px', 
                fontWeight: 600,
                maxWidth: '200px',
                display: 'inline-block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {displayName}
              </div>
            </div>
            <div className="action-btns">
              <button className="primary-btn" onClick={() => navigate('/EditProfile')}>Edit Profile</button>
            </div>
          </div>
        </header>
        {/* Events Section */}
        <div className="event-cards-section">
          <h2 style={{ color: '#441752', fontWeight: 700, fontSize: '26px', marginBottom: '16px' }}>Public Events</h2>
          {visibleEvents.length === 0 ? (
            <p style={{ color: '#A888B5', fontSize: '18px' }}>No events available for you at this time.</p>
          ) : (
            <ul className="event-cards-list" style={{ padding: '0 32px' }}>
              {visibleEvents.map((event) => (
                <li key={event.id} className="event-card-custom" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 18, padding: '12px 0' }}>
                  <img
                    src={process.env.PUBLIC_URL + '/images/venues/5.png'}
                    alt="Event"
                    style={{ width: '100px', height: '80px', objectFit: 'cover', borderRadius: 12, background: '#eee', flexShrink: 0, marginLeft: '20px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#A888B5', fontSize: '20px' }}>{event.name}</strong>
                    <div style={{ color: '#A888B5', fontSize: '15px', marginTop: '4px' }}>
                      {event.type} {event.subType ? `- ${event.subType}` : ''} | {event.location} | {event.visibility === 'private' ? 'Private' : 'Public'}
                    </div>
                    <div style={{ color: '#A888B5', fontSize: '14px', marginTop: '4px' }}>
                      {event.startDate} to {event.endDate}
                    </div>
                    <button
                      className="apply-btn"
                      style={{ background: '#A888B5', color: '#441752', border: 'none', borderRadius: '8px', padding: '10px 28px', fontWeight: 600, fontSize: '16px', cursor: 'pointer', marginTop: 10 }}
                      onClick={async () => {
  try {
    // 1. Insert into event_suppliers (if not already applied)
    const { data: existing, error: checkError } = await supabase
      .from('event_suppliers')
      .select('id')
      .eq('event_id', event.id)
      .eq('supplier_email', currentUserEmail || supplierEmail);

    if (checkError) throw checkError;
    if (!existing || existing.length === 0) {
      const { error: insertError } = await supabase
        .from('event_suppliers')
        .insert([{ event_id: event.id, supplier_email: currentUserEmail || supplierEmail }]);
      if (insertError) throw insertError;
    }

    // 2. Insert notification for admin (event.admin_id must be available)
    if (event.admin_id) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert([{
          admin_user_id: event.admin_id,
          event_id: event.id,
          supplier_email: currentUserEmail || supplierEmail,
          type: 'application',
          status: 'unread'
        }]);
      if (notifError) throw notifError;
    }

    alert('Applied! The event admin will be notified.');
  } catch (err) {
    alert('Error applying for event: ' + err.message);
  }
}}
                    >
                      Apply
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <style jsx="true">{`
        :root {
          --primary-blue: #441752;
          --hover-blue: #441752;
          --light-bg: #A888B5;
          --text-dark: #1A1F36;
          --text-light: #441752;
          --border-color: #441752;
          --event-card-width: 420px;
        }

        .event-cards-section {
          margin-top: 48px;
          text-align: left;
          width: 100%;
          max-width: 1200px;
          margin-left: 5px;
          margin-right: auto;
          box-sizing: border-box;
        }
        .event-cards-list {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
          padding: 0;
          margin: 0;
          list-style: none;
        }
        @media (max-width: 1100px) {
          .event-cards-list {
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          }
        }
        @media (max-width: 800px) {
          .event-cards-list {
            grid-template-columns: 1fr;
          }
        }
        .event-card-custom {
          background: #441752;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(68,23,82,0.06);
          padding: 50px 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
          height: 100%;
        }
        .event-card-custom .apply-btn {
          width: 100%;
          margin-top: 24px;
        }

        .app-container {
          min-height: 100vh;
          background-color: var(--light-bg);
          font-family: 'Inter', sans-serif;
        }

        /* Top Navigation Styles */
        .top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 32px;
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

        /* Main Content Styles */
 /* Main Content Styles */
        .content-area {
          padding: 32px 40px;
          margin-top: 64px;
        }

        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
        }

        .header-left {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .welcome-section {
          margin-bottom: 16px;
        }

        .welcome-text {
          font-size: 32px;
          color: #441752;
          margin: 0;
        }

        .username {
          font-size: 24px;
          color: #441752;
          font-weight: 500;
          margin-top: 4px;
        }

        .action-btns {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .primary-btn {
          padding: 10px 24px;
          background: var(--primary-blue);
          color: #A888B5;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .primary-btn:hover {
          background: var(--hover-blue);
          transform: translateY(-1px);
        }

        /* Category Tabs */
        .category-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 2px solid var(--border-color);
        }

        .tab-btn {
          padding: 12px 24px;
          border: none;
          background: none;
          color: var(--text-light);
          font-size: 14px;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }

        .tab-btn.active {
          color: var(--primary-blue);
          font-weight: 600;
        }

        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 100%;
          height: 2px;
          background: var(--primary-blue);
        }

        /* Venue Grid with Images */
        .venue-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }

        .venue-card {
          background: #A888B5;
          border-radius: 8px;
          border: 2px solid var(--border-color);
          box-shadow: 0 2px 4px rgba(0,0,0,0.04);
          cursor: pointer;
          transition: all 0.2s ease;
          overflow: hidden;
        }

        .card-image {
          height: 180px;
          overflow: hidden;
          position: relative;
        }

        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .card-label {
          padding: 16px;
          font-weight: 500;
          text-align: center;
          color: #441752;
          background: #A888B5;
        }

        .venue-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.08);
          border-color: var(--primary-blue);
        }

        .venue-card:hover .card-image img {
          transform: scale(1.05);
        }

        .venue-card.selected {
          border: 2px solid var(--primary-blue);
          box-shadow: 0 4px 12px rgba(44, 125, 250, 0.15);
        }

        .venue-card.selected .card-label {
          background: rgba(44, 125, 250, 0.04);
        }


        .section-title {
            font-size: 24px;
            color: #441752;
            margin-left: 0px;
          }

        /* Responsive Styles */
        @media (max-width: 900px) {
          .content-area {
            padding: 20px 8px;
          }
          .event-cards-section {
            margin-top: 24px;
          }
          .event-cards-list {
            gap: 16px;
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
            padding: 10px 2px;
            margin-top: 48px;
          }
          .content-header {
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }
          .header-left {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .welcome-text, .section-title {
            font-size: 18px;
          }
          .welcome-username {
            font-size: 15px !important;
            max-width: 120px !important;
          }
          .action-btns {
            gap: 8px;
          }
          .primary-btn {
            padding: 7px 12px;
            font-size: 12px;
          }
          .event-cards-section h2 {
            font-size: 16px;
          }
          .event-card-custom {
            padding: 24px 8px;
          }
          .event-card-custom .apply-btn {
            font-size: 13px;
            padding: 8px 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default SupplierHomepage;
