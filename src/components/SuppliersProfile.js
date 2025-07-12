import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import UserProfile from './UserProfile';
import { supabase } from '../supabaseClient';
import { connectionService } from '../services/connectionService';

const StarRating = ({ rating }) => {
  return (
    <div style={styles.starsContainer}>
      {[...Array(5)].map((star, index) => {
        const ratingValue = index + 1;
        return (
          <FaStar
            key={index}
            size={20}
            color={ratingValue <= rating ? '#ffc107' : '#e4e5e9'}
            style={styles.starIcon}
          />
        );
      })}
    </div>
  );
};

const SuppliersProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { supplierId } = useParams();
  const [activeNav, setActiveNav] = useState('Suppliers');
  const [userData, setUserData] = useState(null);
  const [supplierData, setSupplierData] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('unknown');

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setCurrentUser({
          id: user.id,
          email: user.email,
          name: profile?.full_name || profile?.company_name || user.email,
          userType: profile?.user_type || 'admin'
        });
      }
    };
    getCurrentUser();
  }, []);

  // Get supplier data and subscribe to changes
  useEffect(() => {
    let profileSubscription;

    const fetchSupplierData = async () => {
      if (location.state && location.state.supplier) {
        setSupplierData(location.state.supplier);
        // Also fetch fresh data from database to ensure we have latest
        const { data: supplier } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', location.state.supplier.id)
          .single();
          
        if (supplier) {
          setSupplierData({
            id: supplier.id,
            name: supplier.company_name || supplier.full_name,
            company_name: supplier.company_name,
            full_name: supplier.full_name,
            location: supplier.address,
            description: supplier.description,
            service_type: supplier.service_type,
            promotions: supplier.promotions || { title: '', description: '' },
            rating: supplier.rating || 4.5,
            email: supplier.email,
            phone: supplier.phone || 'Not provided'
          });
        }
      } else if (supplierId) {
        // Fetch supplier data from database using supplierId
        const { data: supplier, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', supplierId)
          .single();
        
        if (supplier && !error) {
          setSupplierData({
            id: supplier.id,
            name: supplier.company_name || supplier.full_name,
            company_name: supplier.company_name,
            full_name: supplier.full_name,
            location: supplier.address,
            description: supplier.description,
            service_type: supplier.service_type,
            promotions: supplier.promotions || { title: '', description: '' },
            rating: supplier.rating || 4.5,
            email: supplier.email,
            phone: supplier.phone || 'Not provided'
          });
        } else {
          console.error('Error fetching supplier:', error);
        }
      }
    };
    
    // Set up real-time subscription
    const setupSubscription = () => {
      const targetId = supplierId || (location.state && location.state.supplier && location.state.supplier.id);
      if (targetId) {
        profileSubscription = supabase
          .channel('profile_changes')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${targetId}`
            },
            (payload) => {
              console.log('Profile updated:', payload);
              const updatedProfile = payload.new;
              setSupplierData({
                id: updatedProfile.id,
                name: updatedProfile.company_name || updatedProfile.full_name,
                company_name: updatedProfile.company_name,
                full_name: updatedProfile.full_name,
                location: updatedProfile.address,
                description: updatedProfile.description,
                service_type: updatedProfile.service_type,
                promotions: updatedProfile.promotions || { title: '', description: '' },
                rating: updatedProfile.rating || 4.5,
                email: updatedProfile.email,
                phone: updatedProfile.phone || 'Not provided'
              });
            }
          )
          .subscribe();
      }
    };
    
    fetchSupplierData();
    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (profileSubscription) {
        supabase.removeChannel(profileSubscription);
      }
    };
  }, [location, supplierId]);

  // Check connection status
  useEffect(() => {
    const checkConnectionStatus = async () => {
      if (currentUser && supplierData && currentUser.userType === 'admin') {
        const { data, error } = await connectionService.areUsersConnected(
          currentUser.id, 
          supplierData.id
        );
        
        if (!error && data) {
          setConnectionStatus(data.connected ? 'connected' : 'not_connected');
        }
      }
    };
    
    checkConnectionStatus();
  }, [currentUser, supplierData]);

  // Handle connection request
  const handleConnectRequest = async () => {
    if (!currentUser || !supplierData || currentUser.userType !== 'admin') {
      alert('Only event organizers can send connection requests');
      return;
    }

    if (connectionStatus === 'connected') {
      alert('Already connected with this supplier');
      return;
    }

    setIsConnecting(true);
    
    const { data, error } = await connectionService.sendConnectionRequest(
      currentUser,
      supplierData
    );

    if (error) {
      alert('Error sending connection request: ' + error);
    } else {
      alert('Connection request sent successfully!');
      setConnectionStatus('pending');
    }
    
    setIsConnecting(false);
  };

  // Navigation data
  const mainNavItems = [
    { name: 'Home', path: '/SuppliersPage' },
    { name: 'Events', path: '/Events' },
    { name: 'Messages', path: '/MessagesPage' }
  ];

  const userNavItems = [
    { name: 'My Work', path: '/my-work' },
    { name: 'My Team', path: '/my-team' }
  ];

  const handleNavButtonClick = (path, navName) => {
    setActiveNav(navName);
    navigate(path);
  };

  if (!supplierData) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Navigation Bar */}
      <nav style={styles.navBar} className="suppliers-profile-navbar">
        <div style={styles.navSection} className="suppliers-profile-navsection">
          <img 
            src={`${process.env.PUBLIC_URL}/images/landingpage/logo.png`} 
            alt="CITADA Logo" 
            style={styles.navLogo}
          />
          {mainNavItems.map(item => (
            <button
              key={item.name}
              style={{
                ...styles.navButton,
                ...(activeNav === item.name && styles.activeNavButton)
              }}
              onClick={() => handleNavButtonClick(item.path, item.name)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div style={styles.userNav}>
          {userNavItems.map(item => (
            <button
              key={item.name}
              style={styles.navButton}
              onClick={() => handleNavButtonClick(item.path, item.name)}
            >
              {item.name}
            </button>
          ))}
          <UserProfile showName={false} />
        </div>
      </nav>

      {/* Hero Section */}
      <div style={styles.heroSection} className="suppliers-profile-hero">
        <div style={styles.backgroundOverlay}>
          <div style={styles.heroContent} className="suppliers-profile-herocontent">
            <div style={styles.heroHeader}>
              <h1 style={styles.heroTitle} className="suppliers-profile-herotitle">
                {supplierData.company_name || supplierData.full_name || 'Supplier Name'}
              </h1>
              <div style={styles.buttonGroup} className="suppliers-profile-buttongroup">
                <button 
                  style={{
                    ...styles.connectButton,
                    opacity: isConnecting ? 0.6 : 1,
                    cursor: isConnecting ? 'not-allowed' : 'pointer'
                  }} 
                  className="suppliers-profile-connectbutton"
                  onClick={handleConnectRequest}
                  disabled={isConnecting || connectionStatus === 'connected'}
                >
                  {isConnecting ? 'Sending...' : 
                   connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'pending' ? 'Request Sent' : 'Connect'}
                </button>
              </div>
            </div>
            <div style={styles.locationContainer}>
              <span style={styles.locationText}>
                {supplierData.location || 'Location not set'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content} className="suppliers-profile-content">
        <div style={styles.descriptionBox} className="suppliers-profile-descriptionbox">
          <p style={styles.description}>
            {supplierData.description || 'No description available'}
          </p>
        </div>

        {/* Services Section */}
        <div style={styles.gridContainer} className="suppliers-profile-gridcontainer">
          <div style={styles.column}>
            <h3 style={styles.sectionTitle} className="suppliers-profile-sectiontitle">Services</h3>
            <div style={styles.serviceItem}>{supplierData.service_type || 'Service type not set'}</div>
          </div>

          {/* Promo Section */}
          <div style={styles.column}>
            <h3 style={styles.sectionTitle} className="suppliers-profile-sectiontitle">Promo</h3>
            <div style={styles.promoCard} className="suppliers-profile-promocard">
              <div style={styles.promoTitle}>
                {supplierData.promotions?.title || 'No active promotions'}
              </div>
              <div style={styles.promoText}>
                {supplierData.promotions?.description || 'No promotion details available'}
              </div>
            </div>
          </div>

          {/* Ratings Section */}
          <div style={styles.column}>
            <h3 style={styles.sectionTitle} className="suppliers-profile-sectiontitle">Ratings</h3>
            <div style={styles.ratingItem}>
              <div>{supplierData.service_type || 'Overall Rating'}</div>
              <StarRating rating={supplierData.rating || 4.5} />
              <div style={styles.ratingText}>({supplierData.rating || 4.5}/5)</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .suppliers-profile-content {
            padding: 1rem !important;
          }
          .suppliers-profile-hero {
            height: 280px !important;
            margin: 0.5rem 0.5rem !important;
          }
        }
        @media (max-width: 600px) {
          .suppliers-profile-navbar {
            flex-direction: column !important;
            height: auto !important;
            padding: 8px 4px !important;
            gap: 8px !important;
          }
          .suppliers-profile-navsection, .suppliers-profile-usernav {
            gap: 8px !important;
          }
          .suppliers-profile-hero {
            height: 180px !important;
            margin: 0.3rem 0.2rem !important;
            border-radius: 6px !important;
          }
          .suppliers-profile-herotitle {
            font-size: 1.1rem !important;
          }
          .suppliers-profile-content {
            padding: 0.5rem !important;
          }
          .suppliers-profile-descriptionbox {
            padding: 0.7rem !important;
            margin-bottom: 1rem !important;
          }
          .suppliers-profile-gridcontainer {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          .suppliers-profile-column {
            padding: 0.7rem !important;
          }
          .suppliers-profile-sectiontitle {
            font-size: 1rem !important;
            padding-bottom: 0.2rem !important;
          }
          .suppliers-profile-connectbutton, .suppliers-profile-dealbutton {
            padding: 0.5rem 1rem !important;
            font-size: 0.8rem !important;
          }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: "'Inter', sans-serif",
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#A888B5',
  },
  navBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 32px',
    height: '64px',
    backgroundColor: '#441752',
    boxShadow: '#441752',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  navSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  navLogo: {
    height: '28px',
    marginRight: '16px',
  },
  userNav: {
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
  },
  navButton: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    color: '#A888B5',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  activeNavButton: {
    padding: '8px 16px',
    border: 'none',
    backgroundColor: '#441752',
    color: '#A888B5',
    fontSize: '14px',
    fontWeight: 500,
    borderRadius: '6px',
  },

  userProfile: {
    width: '32px',
    height: '32px',
    background: '#A888B5',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '500',
  },
  // Existing Styles Below
  heroSection: {
    position: 'relative',
    height: '400px',
    borderRadius: '12px',
    overflow: 'hidden',
    margin: '1rem 2rem',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  },
  backgroundOverlay: {
    backgroundImage: 'url(/images/Misc/SupplierProfileHeader.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    width: '100%',
    height: '100%',
    position: 'relative',
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
    padding: '2rem',
    color: 'white',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  heroHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitle: {
    color: '#441752',
    fontSize: '2.5rem',
    margin: 0,
    textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
  },
  locationContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: '0.5rem 1rem',
    borderRadius: '20px',
    backdropFilter: 'blur(5px)',
  },
  locationText: {
    fontSize: '1.1rem',
    fontWeight: '500',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
  },
  connectButton: {
    backgroundColor: '#A888B5',
    color: '#441752',
    border: 'none',
    padding: '0.8rem 2rem',
    borderRadius: '25px',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    ':hover': {
      transform: 'scale(1.05)',
    },
  },
  dealButton: {
    backgroundColor: '#441752',
    color: '#A888B5',
    border: 'none',
    padding: '0.8rem 2.5rem',
    borderRadius: '25px',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    ':hover': {
      transform: 'scale(1.05)',
    },
  },
  content: {
    padding: '2rem',
    flex: 1,
  },
  descriptionBox: {
    backgroundColor: '#441752',
    borderRadius: '8px',
    padding: '1.5rem',
    marginBottom: '2rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #A888B5',
  },
  description: {
    color: '#A888B5',
    lineHeight: '1.5',
    margin: 0,
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '2rem',
  },
  column: {
    backgroundColor: '#441752',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    marginTop: 0,
    color: '#A888B5',
    borderBottom: '2px solid #A888B5',
    paddingBottom: '0.5rem',
  },
  promoCard: {
    backgroundColor: '#441752',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '1rem',
    border: '1px solid #A888B5',
  },
  promoTitle: {
    color: '#A888B5',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
  promoText: {
    color: '#A888B5',
    fontSize: '0.9rem',
    lineHeight: '1.4',
  },
  serviceItem: {
    padding: '0.5rem 0',
    color: '#A888B5',
  },
  starsContainer: {
    display: 'flex',
    margin: '0.5rem 0',
  },
  starIcon: {
    marginRight: 2,
  },
  ratingItem: {
    padding: '1rem 0',
    color: '#A888B5',
    borderBottom: '1px solid #A888B5',
  },
  ratingText: {
    fontSize: '0.8rem',
    color: '#A888B5',
    marginTop: '0.3rem',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    color: '#441752',
    backgroundColor: '#A888B5',
  },
};

export default SuppliersProfile;