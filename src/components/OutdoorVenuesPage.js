import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';
import styles from './HotelsListPage.module.css';
import { supabase } from '../supabaseClient';

// Default image for outdoor venue suppliers
const DEFAULT_OUTDOOR_VENUE_IMAGE = '/images/venues/4.png';

const mainNavItems = [
  { name: 'Home', path: '/SuppliersPage' },
  { name: 'Events', path: '/Events' },
  { name: 'Messages', path: '/MessagesPage' },
];
const rightNavItems = [
  { name: 'My Work', path: '/my-work' },
  { name: 'My Team', path: '/my-team' },
];

const OutdoorVenuesPage = () => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [outdoorVenues, setOutdoorVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Fetch outdoor venue suppliers from Supabase
  useEffect(() => {
    fetchOutdoorVenues();
  }, []);

  const fetchOutdoorVenues = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('service_type', 'Outdoor Venues')
        .eq('user_type', 'supplier');

      if (error) {
        console.error('Error fetching outdoor venues:', error);
        setError('Failed to load outdoor venues');
        return;
      }

      // Transform data to match expected format
      const transformedData = data.map(supplier => ({
        id: supplier.id,
        name: supplier.company_name || supplier.full_name || 'Outdoor Venue',
        location: supplier.address || 'Location not specified',
        rating: 4.0 + (Math.random() * 1), // Random rating between 4.0-5.0 for now
        image: DEFAULT_OUTDOOR_VENUE_IMAGE,
        email: supplier.email,
        phone: supplier.phone || 'Not provided'
      }));

      setOutdoorVenues(transformedData);
      console.log('Fetched outdoor venues:', transformedData);
    } catch (err) {
      console.error('Error in fetchOutdoorVenues:', err);
      setError('Failed to load outdoor venues');
    } finally {
      setLoading(false);
    }
  };

  // Filtering and sorting logic
  let filtered = outdoorVenues.filter(venue =>
    venue.name.toLowerCase().includes(search.toLowerCase()) ||
    venue.location.toLowerCase().includes(search.toLowerCase())
  );
  
  if (sort === 'name') {
    filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'rating') {
    filtered = filtered.sort((a, b) => b.rating - a.rating);
  }

  return (
    <div className={styles['app-container']}>
      <nav className={styles['top-nav']}>
        <div className={styles['nav-section']}>
          <img
            src={process.env.PUBLIC_URL + '/images/landingpage/logo.png'}
            alt="CITADA Logo"
            className={styles['nav-logo']}
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer' }}
          />
          {mainNavItems.map(item => (
            <button
              key={item.name}
              className={styles['nav-btn']}
              onClick={() => navigate(item.path)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className={styles['nav-section']}>
          {rightNavItems.map(item => (
            <button
              key={item.name}
              className={styles['nav-btn']}
              onClick={() => navigate(item.path)}
            >
              {item.name}
            </button>
          ))}
          <UserProfile showName={false} />
        </div>
      </nav>

      {/* Welcome Section */}
      <div className={styles['welcome-section']}>
        <h1 className={styles['welcome-text']}>Outdoor Venues</h1>
      </div>

      {/* Toolbar: Search, Filter, Sort */}
      <div className={styles['hotels-toolbar']}>
        <input
          className={styles['search-input']}
          type="text"
          placeholder="Search outdoor venues..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles['filter-sort-group']}>
          <select
            className={styles['sort-select']}
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="name">Sort by Name</option>
            <option value="rating">Sort by Rating</option>
          </select>
        </div>
      </div>

      {/* Outdoor Venues Grid */}
      <div className={styles['hotels-grid']}>
        {loading ? (
          <div style={{ color: '#441752', fontWeight: 500, fontSize: 18, marginTop: 40 }}>Loading outdoor venues...</div>
        ) : error ? (
          <div style={{ color: '#d32f2f', fontWeight: 500, fontSize: 18, marginTop: 40 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#441752', fontWeight: 500, fontSize: 18, marginTop: 40 }}>
            {outdoorVenues.length === 0 ? 'No outdoor venues registered yet.' : 'No outdoor venues found matching your search.'}
          </div>
        ) : (
          filtered.map((venue, idx) => (
            <div
              key={venue.id || idx}
              className={styles['hotel-card']}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/SuppliersProfile', { state: { supplier: venue } })}
            >
              <img
                src={process.env.PUBLIC_URL + venue.image}
                alt={venue.name}
                className={styles['hotel-image']}
              />
              <h2 className={styles['hotel-name']}>{venue.name}</h2>
              <div className={styles['hotel-location']}>{venue.location}</div>
              <div className={styles['hotel-rating']}>Rating: {venue.rating.toFixed(1)} ⭐</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default OutdoorVenuesPage;
