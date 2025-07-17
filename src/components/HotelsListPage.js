import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LogoutButton from './LogoutButton';
import UserProfile from './UserProfile';
import styles from './HotelsListPage.module.css';
import { supabase } from '../supabaseClient';

// Default image for hotel suppliers
const DEFAULT_HOTEL_IMAGE = '/images/venues/2.png';

const mainNavItems = [
  { name: 'Home', path: '/SuppliersPage' },
  { name: 'Events', path: '/Events' },
  { name: 'Messages', path: '/MessagesPage' },
];
const rightNavItems = [
  { name: 'My Work', path: '/my-work' },
  { name: 'My Team', path: '/my-team' },
];
// User info will be handled by UserProfile component

const HotelsListPage = () => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [hotelSuppliers, setHotelSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Fetch hotel suppliers from Supabase
  useEffect(() => {
    fetchHotelSuppliers();
  }, []);

  const fetchHotelSuppliers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('service_type', 'Hotels')
        .eq('user_type', 'supplier');

      if (error) {
        console.error('Error fetching hotel suppliers:', error);
        setError('Failed to load hotel suppliers');
        return;
      }

      // Transform data to match expected format
      const transformedData = data.map(supplier => ({
        id: supplier.id,
        name: supplier.company_name || supplier.full_name || 'Hotel Supplier',
        location: supplier.address || 'Location not specified',
        rating: 4.0 + (Math.random() * 1), // Random rating between 4.0-5.0 for now
        image: DEFAULT_HOTEL_IMAGE,
        email: supplier.email,
        phone: supplier.phone || 'Not provided'
      }));

      setHotelSuppliers(transformedData);
      console.log('Fetched hotel suppliers:', transformedData);
    } catch (err) {
      console.error('Error in fetchHotelSuppliers:', err);
      setError('Failed to load hotel suppliers');
    } finally {
      setLoading(false);
    }
  };

  // Filtering and sorting logic
  let filteredHotels = hotelSuppliers.filter(hotel =>
    hotel.name.toLowerCase().includes(search.toLowerCase()) ||
    hotel.location.toLowerCase().includes(search.toLowerCase())
  );
  
  if (sort === 'name') {
    filteredHotels = filteredHotels.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === 'rating') {
    filteredHotels = filteredHotels.sort((a, b) => b.rating - a.rating);
  }

  // Get unique locations for filter
  const locations = Array.from(new Set(hotelSuppliers.map(h => h.location)));

  return (
    <div className={styles['app-container']}>
      {/* Top Navigation Bar */}
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
        <h1 className={styles['welcome-text']}>Hotels</h1>
      </div>

      {/* Toolbar: Search, Filter, Sort */}
      <div className={styles['hotels-toolbar']}>
        <input
          className={styles['search-input']}
          type="text"
          placeholder="Search hotels..."
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

      {/* Hotels Grid */}
      <div className={styles['hotels-grid']}>
        {loading ? (
          <div style={{ color: '#441752', fontWeight: 500, fontSize: 18, marginTop: 40 }}>Loading hotel suppliers...</div>
        ) : error ? (
          <div style={{ color: '#d32f2f', fontWeight: 500, fontSize: 18, marginTop: 40 }}>{error}</div>
        ) : filteredHotels.length === 0 ? (
          <div style={{ color: '#441752', fontWeight: 500, fontSize: 18, marginTop: 40 }}>
            {hotelSuppliers.length === 0 ? 'No hotel suppliers registered yet.' : 'No hotels found matching your search.'}
          </div>
        ) : (
          filteredHotels.map((hotel, idx) => (
            <div
              key={hotel.id || idx}
              className={styles['hotel-card']}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/SuppliersProfile', { state: { supplier: hotel } })}
            >
              <img
                src={process.env.PUBLIC_URL + hotel.image}
                alt={hotel.name}
                className={styles['hotel-image']}
              />
              <h2 className={styles['hotel-name']}>{hotel.name}</h2>
              <div className={styles['hotel-location']}>{hotel.location}</div>
              <div className={styles['hotel-rating']}>Rating: {hotel.rating.toFixed(1)} ⭐</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HotelsListPage;
