import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import styles from './SignUpPage.module.css';
import { supabase } from '../supabaseClient';
import { linkSupplierInvites } from '../utils/inviteLinking';
import { updateEventSuppliersWithUserId } from '../utils/updateSupplierEvents';

const SignUpPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract invitation parameters from URL if present
  const [invitationData, setInvitationData] = useState({
    isInvited: false,
    email: '',
    eventId: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    companyname: '',
    type: '',
    eventType: '',
    serviceType: '',
    address: '',
    taxid: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Parse URL parameters for invitation data
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const isInvited = queryParams.get('invite') === 'true';
    const email = queryParams.get('email');
    const eventId = queryParams.get('eventId');
    
    if (isInvited && email && eventId) {
      setInvitationData({
        isInvited: true,
        email,
        eventId
      });
      
      // Pre-fill the email field and set type to Supplier
      setFormData(prevData => ({
        ...prevData,
        email,
        type: 'Supplier'
      }));
    }
  }, [location]);

  // Track window width for responsive background image
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const bgStyle = windowWidth > 600 ? {
    backgroundImage: `url(${process.env.PUBLIC_URL}/images/landingpage/loginbg.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  } : undefined;


  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');

    // Prevent duplicate registration by email
    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', formData.email)
      .single();
    if (existing) {
      setError('An account with this email already exists.');
      return;
    }

    try {
      // DEBUG: Log what type is selected at signup
      console.log('SignUp: formData.type =', formData.type);
      // DEBUG: Log the full signup payload
      const signupPayload = {
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            companyname: formData.companyname,
            user_type: formData.type === "Admin" ? "admin" : (formData.type === "Supplier" ? "supplier" : ""),
            eventType: formData.eventType,
            serviceType: formData.serviceType,
            address: formData.address,
            taxid: formData.taxid,
            phone: formData.phone
          }
        }
      };
      console.log('SignUp: signupPayload =', signupPayload);
      // 1. Sign up the user with Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            companyname: formData.companyname,
            user_type: formData.type === "Admin" ? "admin" : (formData.type === "Supplier" ? "supplier" : ""),
            eventType: formData.eventType,
            serviceType: formData.serviceType,
            address: formData.address,
            taxid: formData.taxid,
            phone: formData.phone
          }
        }
      });

      if (signUpError) {
        console.error('Supabase signUp error:', signUpError.message);
        setError('Signup failed: ' + signUpError.message);
        return;
      }
      if (!authData || !authData.user || !authData.user.id) {
        setError('Signup failed: No user data returned.');
        return;
      }
      // 2. Redirect after successful signup
      if (formData.type === "Admin") {
        // Update Admin profile with service_type (eventType)
        const adminUserId = authData?.user?.id;
        if (adminUserId) {
          try {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ 
                full_name: formData.name,
                company_name: formData.companyname,
                service_type: formData.eventType,
                updated_at: new Date().toISOString()
              })
              .eq('id', adminUserId);
              
            if (profileError) {
              console.error('Admin profile update failed:', profileError);
            }
          } catch (err) {
            console.error('Error updating admin profile:', err);
          }
        }
        navigate("/SuppliersPage");
      } else if (formData.type === "Supplier") {
        // Get new user id from signup response
        const newUserId = authData?.user?.id;
        if (!newUserId) {
          setError('Could not determine user ID after signup.');
          return;
        }
        // Store supplier info and serviceType in localStorage
        const signedUpSuppliers = JSON.parse(localStorage.getItem('signedUpSuppliers') || '[]');
        signedUpSuppliers.push({
          id: newUserId,
          name: formData.name,
          email: formData.email,
          serviceType: formData.serviceType
        });
        localStorage.setItem('signedUpSuppliers', JSON.stringify(signedUpSuppliers));
        
        // Update supplier profile with service_type (for ALL suppliers)
        console.log('DEBUG - Updating supplier profile...');
        console.log('DEBUG - formData.type:', formData.type);
        console.log('DEBUG - formData.serviceType:', formData.serviceType);
        console.log('DEBUG - formData.eventType:', formData.eventType);
        
        const serviceType = formData.serviceType;
        console.log('DEBUG - Final serviceType to save:', serviceType);
        
        try {
          // Use upsert to handle both update and insert cases
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({ 
              id: newUserId,
              email: formData.email,
              full_name: formData.name,
              user_type: "supplier",
              company_name: formData.companyname,
              address: formData.address,
              tax_id: formData.taxid,
              phone: formData.phone,
              service_type: serviceType,
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id' 
            });
            
          if (profileError) {
            console.error('Profile update failed:', profileError);
            console.error('Profile update error details:', JSON.stringify(profileError, null, 2));
          } else {
            console.log('✅ Supplier profile updated successfully with service_type:', serviceType);
          }
        } catch (err) {
          console.error('Error during supplier profile update:', err);
        }
        
        // Special handling for invited suppliers
        if (invitationData.isInvited && invitationData.eventId) {
          console.log('Processing invitation for event ID:', invitationData.eventId);
          
          // First check if the event actually exists
          const { data: eventData, error: eventCheckError } = await supabase
            .from('events')
            .select('id, name')
            .eq('id', invitationData.eventId)
            .maybeSingle();
            
          if (eventCheckError) {
            console.error('Error checking event existence:', eventCheckError);
          }
          
          if (!eventData) {
            console.warn('Event not found in database, attempting to find by similar ID');
            
            // Try to find partial matches for the event ID
            // This addresses potential issues with UUIDs being truncated or malformed
            const partialId = invitationData.eventId.split('-')[0];
            const { data: similarEvents } = await supabase
              .from('events')
              .select('id, name')
              .like('id', `${partialId}%`);
              
            if (similarEvents && similarEvents.length > 0) {
              console.log('Found similar events:', similarEvents);
              invitationData.eventId = similarEvents[0].id;
              console.log('Using first matching event ID:', invitationData.eventId);
            }
          } else {
            console.log('Event found:', eventData);
          }
          
          // Profile update already handled above for all suppliers
          
          // First update any existing event_suppliers entries with this user's ID
          try {
            console.log(`Updating event_suppliers entries for email ${formData.email} with user ID ${newUserId}`);
            const result = await updateEventSuppliersWithUserId(newUserId, formData.email);
            console.log('Updated existing event_suppliers entries:', result);
          } catch (updateErr) {
            console.error('Error updating event_suppliers table:', updateErr);
            // Continue despite this error
          }

          // Then link the supplier to the specific event in the invitation using upsert
          try {
            console.log(`Linking supplier ${newUserId} to event ${invitationData.eventId}`);
            
            // Use upsert to handle potential conflicts
            const { data: linkResult, error: linkError } = await supabase
              .from('event_suppliers')
              .upsert(
                {
                  event_id: invitationData.eventId,
                  supplier_user_id: newUserId,
                  supplier_email: formData.email
                },
                { onConflict: 'event_id,supplier_user_id', ignoreDuplicates: true }
              );
            
            if (linkError) {
              console.error('Error linking supplier to event:', linkError);
              
              // As a fallback, try a direct insert with explicit check first to avoid conflict
              try {
                console.log('Attempting fallback direct insert');
                
                // First check if the link already exists to avoid conflict
                const { data: existingLink, error: checkError } = await supabase
                  .from('event_suppliers')
                  .select('*')
                  .eq('event_id', invitationData.eventId)
                  .eq('supplier_user_id', newUserId)
                  .maybeSingle();
                  
                if (checkError) {
                  console.error('Error checking for existing link:', checkError);
                } else if (existingLink) {
                  console.log('Link already exists, no need to insert');
                } else {
                  // Link doesn't exist, safe to insert
                  const { error: insertError } = await supabase
                    .from('event_suppliers')
                    .insert({
                      event_id: invitationData.eventId,
                      supplier_user_id: newUserId,
                      supplier_email: formData.email
                    });
                  
                  if (insertError) {
                    console.error('Direct insert fallback failed:', insertError);
                  } else {
                    console.log('Direct insert fallback successful');
                  }
                }
              } catch (fallbackErr) {
                console.error('Error in direct insert fallback:', fallbackErr);
              }
            } else {
              console.log('Successfully linked supplier to invited event:', invitationData.eventId);
            }
            
            // Always try to update invite status regardless of previous steps
            try {
              const { error: inviteUpdateError } = await supabase
                .from('invites')
                .update({ status: 'accepted' })
                .eq('supplier_email', formData.email)
                .eq('event_id', invitationData.eventId);
                
              if (inviteUpdateError) {
                console.error('Error updating invite status:', inviteUpdateError);
              } else {
                console.log('Updated invite status to accepted');
              }
            } catch (statusErr) {
              console.error('Error updating invite status:', statusErr);
            }
          } catch (err) {
            console.error('Unexpected error in event linking process:', err);
          }
        }
        
        // Link any other pending invites for this supplier
        await linkSupplierInvites({
          supplierId: newUserId,
          supplierEmail: formData.email
        });
        
        navigate("/SupplierEvents");
      } else {
        setError('Unknown user type, cannot redirect.');
      }
    } catch (error) {
      console.error('Signup handler error:', error);
      setError(error.message || 'An unknown error occurred.');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div
      className={styles['main-container']}
      style={bgStyle}
    >
      <div className={styles['signup-container']}>
        <div className={styles['logo-container']}>
          <img 
            src={`${process.env.PUBLIC_URL}/images/landingpage/logo.png`} 
            alt="CITADA Logo" 
            className={styles['site-logo']}
          />
        </div>        
        <form onSubmit={handleSubmit} className={styles['signup-form']}>
          <div className={styles['form-group']}>
            <label htmlFor="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="companyname">Company Name</label>
            <input
              type="text"
              id="companyname"
              name="companyname"
              value={formData.companyname}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="type">Title</label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value="" disabled>Select service type</option>
              <option value="Admin">Event Organizer</option>
              <option value="Supplier">Supplier</option>
            </select>
          </div>

          {formData.type === "Admin" && (
            <div className={styles['form-group']}>
              <label htmlFor="eventType">Event Type</label>
              <select
                id="eventType"
                name="eventType"
                value={formData.eventType}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select event type</option>
                <option value="Corporate Events">Corporate Events</option>
                <option value="Social Events">Social Events</option>
                <option value="Networking Events">Networking Events</option>
                <option value="Educational Events">Educational Events</option>
                <option value="Trade Shows">Trade Shows</option>
                <option value="Charity Events">Charity Events</option>
                <option value="Cultural Events">Cultural Events</option>
                <option value="Sports Events">Sports Events</option>
              </select>
            </div>
          )}

          {formData.type === "Supplier" && (
            <div className={styles['form-group']}>
              <label htmlFor="serviceType">Service Type</label>
              <select
                id="serviceType"
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                required
              >
                <option value="" disabled>Select service type</option>
                <option value="Audio Equipment Rental">Audio Equipment Rental</option>
                <option value="Augmented Reality (AR)">Augmented Reality (AR)</option>
                <option value="AV Production Companies">AV Production Companies</option>
                <option value="Balloon Artists">Balloon Artists</option>
                <option value="Banner Printing Services">Banner Printing Services</option>
                <option value="Beverage Suppliers">Beverage Suppliers</option>
                <option value="Bike Rental Services">Bike Rental Services</option>
                <option value="Branding Agencies">Branding Agencies</option>
                <option value="Bus/Coach Rentals">Bus/Coach Rentals</option>
                <option value="Car Rental Companies">Car Rental Companies</option>
                <option value="Chauffeur Services">Chauffeur Services</option>
                <option value="Circus Acts">Circus Acts</option>
                <option value="Cleaning Services">Cleaning Services</option>
                <option value="Comedians">Comedians</option>
                <option value="Conference Centers">Conference Centers</option>
                <option value="Content Creation Services">Content Creation Services</option>
                <option value="Corporate Catering Services">Corporate Catering Services</option>
                <option value="Dancers/Choreographers">Dancers/Choreographers</option>
                <option value="Dessert Caterers">Dessert Caterers</option>
                <option value="Digital Marketing Agencies">Digital Marketing Agencies</option>
                <option value="DJs">DJs</option>
                <option value="Drone Videography Services">Drone Videography Services</option>
                <option value="Editing & Post-Production Services">Editing & Post-Production Services</option>
                <option value="Event Album Printing Services">Event Album Printing Services</option>
                <option value="Event Analytics Solutions">Event Analytics Solutions</option>
                <option value="Event Decorators">Event Decorators</option>
                <option value="Event Flooring Suppliers">Event Flooring Suppliers</option>
                <option value="Event Furniture Rental">Event Furniture Rental</option>
                <option value="Event Photographers">Event Photographers</option>
                <option value="Florists">Florists</option>
                <option value="Food Trucks">Food Trucks</option>
                <option value="Full-Service Caterers">Full-Service Caterers</option>
                <option value="Graphic Designers">Graphic Designers</option>
                <option value="Historic Sites & Monuments">Historic Sites & Monuments</option>
                <option value="Hotels">Hotels</option>
                <option value="Inflatable Structures">Inflatable Structures</option>
                <option value="Interactive Performers">Interactive Performers</option>
                <option value="Lighting Equipment Rental">Lighting Equipment Rental</option>
                <option value="Limousine Services">Limousine Services</option>
                <option value="Live Bands">Live Bands</option>
                <option value="Live Streaming & Webcasting Platforms">Live Streaming & Webcasting Platforms</option>
                <option value="Live Streaming Services">Live Streaming Services</option>
                <option value="Magicians/Illusionists">Magicians/Illusionists</option>
                <option value="Musicians">Musicians</option>
                <option value="Outdoor Equipment Rental">Outdoor Equipment Rental</option>
                <option value="Outdoor Venues">Outdoor Venues</option>
                <option value="Permits, Licenses, Security & Hygiene">Permits, Licenses, Security & Hygiene</option>
                <option value="Photo Booth Rental">Photo Booth Rental</option>
                <option value="Photo Booth Rental">Photo Booth Rental</option>
                <option value="Photobooths">Photobooths</option>
                <option value="Printing Services">Printing Services</option>
                <option value="Promo Product Suppliers">Promo Product Suppliers</option>
                <option value="Restaurants & Bars">Restaurants & Bars</option>
                <option value="Security services">Security services</option>
                <option value="Shuttle Services">Shuttle Services</option>
                <option value="Social Media Marketing Services">Social Media Marketing Services</option>
                <option value="Speciality Cuisine Caterers">Speciality Cuisine Caterers</option>
                <option value="Stage & Set Design Services">Stage & Set Design Services</option>
                <option value="Stadiums/Arenas">Stadiums/Arenas</option>
                <option value="Table Setting Rental">Table Setting Rental</option>
                <option value="Tableware Rental Services">Tableware Rental Services</option>
                <option value="Technical Support Services">Technical Support Services</option>
                <option value="Tent Rental Companies">Tent Rental Companies</option>
                <option value="Theater/Art Centers">Theater/Art Centers</option>
                <option value="Thematic Design Specialists">Thematic Design Specialists</option>
                <option value="Transportation">Transportation</option>
                <option value="Videography Services">Videography Services</option>
                <option value="Virtual Reality (VR)">Virtual Reality (VR)</option>
                <option value="Visual Equipment Rental">Visual Equipment Rental</option>
              </select>
            </div>
          )}

          <div className={styles['form-group']}>
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="taxid">Tax ID</label>
            <input
              type="text"
              id="taxid"
              name="taxid"
              value={formData.taxid}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="phone">Phone</label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles['form-group']}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className={styles['error-message']}>{error}</div>}

          <button type="submit" className={styles['signup-button']}>Register</button>
        </form>
      </div>
    </div>
  );
};

export default SignUpPage;
