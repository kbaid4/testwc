import { supabase } from '../supabaseClient';

export async function checkNotificationsTableSchema() {
  try {
    // Get table information from information_schema
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('*')
      .eq('table_name', 'notifications');
    
    if (error) throw error;
    
    console.log('Notifications table schema:', data);
    return data;
  } catch (error) {
    console.error('Error checking table schema:', error);
    throw error;
  }
}

// Run the check when this module is imported
checkNotificationsTableSchema().catch(console.error);
