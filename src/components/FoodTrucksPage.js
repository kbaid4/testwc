import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfile from './UserProfile';
import styles from './HotelsListPage.module.css';
import { supabase } from '../supabaseClient';

// Default image for food truck suppliers
const DEFAULT_FOOD_TRUCK_IMAGE = '/images/venues/11.png';

const mainNavItems = [
  { name: 'Home', path: '/SuppliersPage' },
  { name: 'Events', path: '/Events' },
  { name: 'Messages', path: '/MessagesPage' },
];
const rightNavItems = [
  { name: 'My Work', path: '/my-work' },
  { name: 'My Team', path: '/my-team' },
];

const FoodTrucksPage = () => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [foodTrucks, setFoodTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Fetch food truck suppliers from Supabase
  useEffect(() => {
    fetchFoodTrucks();
  }, []);

  const fetchFoodTrucks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('service_type', 'Food Trucks')
        .eq('user_type', 'supplier');

      if (error) {
        console.error('Error fetching food trucks:', error);
        setError('Failed to load food trucks');
        return;
      }

      // Transform data to match expected format
      const transformedData = data.map(supplier => ({
        id: supplier.id,
        name: supplier.company_name || supplier.full_name || 'Food Truck',
        location: supplier.address || 'Location not specified',
        rating: 4.0 + (Math.random() * 1), // Random rating between 4.0-5.0 for now
        image: DEFAULT_FOOD_TRUCK_IMAGE,
        email: supplier.email,
        phone: supplier.phone || 'Not provided'
      }));

      setFoodTrucks(transformedData);
      console.log('Fetched food trucks:', transformedData);
    } catch (err) {
      console.error('Error in fetchFoodTrucks:', err);
      setError('Failed to load food trucks');
    } finally {
      setLoading(false);
    }
  };

  // Filtering and sorting logic
  let filtered = foodTrucks.filter(truck =>
    truck.name.toLowerCase().includes(search.toLowerCase()) ||
    truck.location.toLowerCase().includes(search.toLowerCase())
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
        <h1 className={styles['welcome-text']}>Food Trucks</h1>
      </div>

      {/* Toolbar: Search, Filter, Sort */}
      <div className={styles['hotels-toolbar']}>
        <input
          className={styles['search-input']}
          type="text"
          placeholder="Search food trucks..."
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

      {/* Food Trucks Grid */}
      <div className={styles['hotels-grid']}>
        {loading ? (
          <div style={{ color: '#441752', fontWeight: 500, fontSize: 18, marginTop: 40 }}>Loading food trucks...</div>
        ) : error ? (
          <div style={{ color: '#d32f2f', fontWeight: 500, fontSize: 18, marginTop: 40 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#441752', fontWeight: 500, fontSize: 18, marginTop: 40 }}>
            {foodTrucks.length === 0 ? 'No food trucks registered yet.' : 'No food trucks found matching your search.'}
          </div>
        ) : (
          filtered.map((truck, idx) => (
            <div
              key={truck.id || idx}
              className={styles['hotel-card']}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate('/SuppliersProfile', { state: { supplier: truck } })}
            >
              <img
                src={process.env.PUBLIC_URL + truck.image}
                alt={truck.name}
                className={styles['hotel-image']}
              />
              <h2 className={styles['hotel-name']}>{truck.name}</h2>
              <div className={styles['hotel-location']}>{truck.location}</div>
              <div className={styles['hotel-rating']}>Rating: {truck.rating.toFixed(1)} ⭐</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FoodTrucksPage;
