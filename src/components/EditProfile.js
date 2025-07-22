import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import UserProfile from './UserProfile';
import { supabase } from '../supabaseClient';

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

const EditProfile = () => {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('Suppliers');
  const [userData, setUserData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    description: '',
    service_type: '',
    promotions: { title: '', description: '' },
    speciality: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (error) throw error;
          if (profile) {
            setUserData(profile);
            setEditedData({
              description: profile.description || '',
              service_type: profile.service_type || '',
              promotions: profile.promotions || { title: '', description: '' },
              speciality: profile.speciality || ''
            });
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error.message);
      }
    };

    fetchUserProfile();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('profiles')
        .update({
          description: editedData.description,
          service_type: editedData.service_type,
          promotions: editedData.promotions,
          speciality: editedData.speciality,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setUserData({
        ...userData,
        ...editedData
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error.message);
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Navigation data
  const mainNavItems = [
    { name: 'Home', path: '/SupplierHomepage' },
    { name: 'My Events', path: '/SupplierEvents' },
    { name: 'Messages', path: '/SupplierMessagesPage' }
  ];

  const userNavItems = [
    { name: 'My Work', path: '/SupplierWork' },
    { name: 'My Team', path: '/SupplierTeam' }
  ];

  const handleNavButtonClick = (path, navName) => {
    setActiveNav(navName);
    navigate(path);
  };

  return (
    <div style={styles.container} className="edit-profile-root">
      {/* Updated Navigation Bar */}
      <nav style={styles.navBar} className="edit-profile-navbar">
        <div style={styles.navSection} className="edit-profile-navsection">
          <img 
            src={`${process.env.PUBLIC_URL}/images/landingpage/logo.png`} 
            alt="CITADA Logo" 
            style={styles.navLogo}
            className="edit-profile-logo"
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
      <div style={styles.heroSection} className="edit-profile-hero">
        <div style={styles.backgroundOverlay} className="edit-profile-hero-bg">
          <div style={styles.heroContent} className="edit-profile-hero-content">
            <div style={styles.heroHeader} className="edit-profile-hero-header">
              <h1 style={styles.heroTitle}>
                {userData?.company_name || userData?.full_name || userData?.email || 'Loading...'}
              </h1>
              <div style={styles.editButtons}>
                {!isEditing ? (
                  <button 
                    style={styles.editButton}
                    onClick={() => setIsEditing(true)}
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div style={styles.saveButtonGroup}>
                    <button 
                      style={styles.saveButton}
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                      style={styles.cancelButton}
                      onClick={() => {
                        setIsEditing(false);
                        setEditedData({
                          description: userData?.description || '',
                          service_type: userData?.service_type || '',
                          promotions: userData?.promotions || { title: '', description: '' },
                          speciality: userData?.speciality || ''
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div style={styles.locationContainer}>
              <span style={styles.locationText}>{userData?.address || 'Location not set'}</span>
            </div>
          </div>
        </div>
      </div>

      {saveError && (
        <div style={styles.errorMessage}>
          {saveError}
        </div>
      )}

      {/* Main Content */}
      <div style={styles.content} className="edit-profile-content">
        <div style={styles.descriptionBox} className="edit-profile-descbox">
          {isEditing ? (
            <textarea
              style={styles.editInput}
              value={editedData.description}
              onChange={(e) => setEditedData({
                ...editedData,
                description: e.target.value
              })}
              placeholder="Add a description of your services..."
              rows={4}
            />
          ) : (
            <p style={styles.description}>
              {userData?.description || 'Add a description of your services...'}
            </p>
          )}
        </div>

        {/* Services Section */}
        <div style={styles.gridContainer} className="edit-profile-grid">
          <div style={styles.column} className="edit-profile-col">
            <h3 style={styles.sectionTitle}>Services</h3>
            <div style={styles.serviceItem}>
              {userData?.service_type || 'Service type not set'}
            </div>
          </div>

          {/* Promo Section */}
          <div style={styles.column} className="edit-profile-col">
            <h3 style={styles.sectionTitle}>Promo</h3>
            <div style={styles.promoCard}>
              {isEditing ? (
                <>
                  <input
                    style={styles.editInput}
                    value={editedData.promotions.title}
                    onChange={(e) => setEditedData({
                      ...editedData,
                      promotions: {
                        ...editedData.promotions,
                        title: e.target.value
                      }
                    })}
                    placeholder="Promotion title"
                  />
                  <textarea
                    style={{...styles.editInput, marginTop: '8px'}}
                    value={editedData.promotions.description}
                    onChange={(e) => setEditedData({
                      ...editedData,
                      promotions: {
                        ...editedData.promotions,
                        description: e.target.value
                      }
                    })}
                    placeholder="Promotion description"
                    rows={2}
                  />
                </>
              ) : (
                <>
                  <div style={styles.promoTitle}>
                    {userData?.promotions?.title || 'Current Promotions'}
                  </div>
                  <div style={styles.promoText}>
                    {userData?.promotions?.description || 'No active promotions'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Speciality Section */}
          <div style={styles.column} className="edit-profile-col">
            <h3 style={styles.sectionTitle}>Speciality</h3>
            <div style={styles.promoCard}>
              {isEditing ? (
                <input
                  style={styles.editInput}
                  value={editedData.speciality || ''}
                  onChange={(e) => setEditedData({
                    ...editedData,
                    speciality: e.target.value
                  })}
                  placeholder="Enter your speciality..."
                />
              ) : (
                <>
                  <div style={styles.promoTitle}>
                    Current Speciality
                  </div>
                  <div style={styles.promoText}>
                    {userData?.speciality || 'No speciality set'}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Ratings Section */}
          <div style={styles.column} className="edit-profile-col">
            <h3 style={styles.sectionTitle}>Ratings</h3>
            <div style={styles.ratingItem}>
              <div>{userData?.service_type || 'Overall Rating'}</div>
              <StarRating rating={4.5} />
              <div style={styles.ratingText}>(4.5/5)</div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 1200px) {
          .edit-profile-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 1.5rem !important;
          }
        }
        @media (max-width: 900px) {
          .edit-profile-content {
            padding: 1rem !important;
          }
          .edit-profile-hero {
            margin: 1rem 0 !important;
          }
          .edit-profile-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 1rem !important;
          }
        }
        @media (max-width: 600px) {
          .edit-profile-navbar {
            flex-direction: column !important;
            height: auto !important;
            padding: 8px 4px !important;
            gap: 8px !important;
          }
          .edit-profile-navsection {
            gap: 8px !important;
          }
          .edit-profile-logo {
            height: 24px !important;
            margin-right: 8px !important;
          }
          .edit-profile-hero {
            height: 220px !important;
            margin: 0.5rem 0 !important;
          }
          .edit-profile-hero-content {
            padding: 1rem !important;
          }
          .edit-profile-hero-header {
            flex-direction: column !important;
            gap: 0.5rem !important;
          }
          .edit-profile-content {
            padding: 0.5rem !important;
          }
          .edit-profile-descbox {
            padding: 0.7rem !important;
            margin-bottom: 1rem !important;
          }
          .edit-profile-grid {
            grid-template-columns: 1fr !important;
            gap: 0.7rem !important;
          }
          .edit-profile-col {
            padding: 0.6rem !important;
          }
          .edit-profile-hero-title {
            font-size: 1.3rem !important;
          }
          .edit-profile-navbar button, .edit-profile-navbar .UserProfile {
            font-size: 0.9rem !important;
            padding: 0.4rem 0.8rem !important;
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
    gridTemplateColumns: 'repeat(4, 1fr)',
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
  editButton: {
    backgroundColor: '#A888B5',
    color: '#441752',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'background-color 0.2s',
  },
  saveButton: {
    backgroundColor: '#441752',
    color: '#A888B5',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
    marginRight: '8px',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    color: '#A888B5',
    border: '1px solid #A888B5',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  editInput: {
    backgroundColor: '#441752',
    color: '#A888B5',
    border: '1px solid #A888B5',
    borderRadius: '4px',
    padding: '8px',
    width: '100%',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  saveButtonGroup: {
    display: 'flex',
    gap: '8px',
  },
  errorMessage: {
    backgroundColor: '#ff6b6b',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '4px',
    margin: '0 2rem',
    textAlign: 'center',
  },
  editButtons: {
    display: 'flex',
    gap: '8px',
    marginLeft: 'auto',
  },
};

export default EditProfile;