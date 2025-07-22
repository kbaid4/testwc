import { supabase } from '../supabaseClient';

// Function to check the notifications table schema
export async function checkNotificationsSchema() {
  try {
    console.log('Checking notifications table schema...');
    
    // Get table information from information_schema
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'notifications');
    
    if (error) throw error;
    
    console.log('Notifications table schema:');
    console.table(data);
    
    // Also check if the table exists and has any rows
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting notifications:', countError);
    } else {
      console.log(`Notifications table has ${count} rows`);
    }
    
    return data;
  } catch (error) {
    console.error('Error checking notifications schema:', error);
    throw error;
  }
}

// Function to check for a specific column in the notifications table
async function checkColumn(columnName) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select(columnName)
      .limit(1);
    
    if (error) {
      console.log(`Column '${columnName}' does not exist or there was an error:`, error);
      return false;
    }
    
    console.log(`Column '${columnName}' exists. Sample data:`, data[0]);
    return true;
  } catch (error) {
    console.error(`Error checking column '${columnName}':`, error);
    return false;
  }
}

// Run the checks when this module is imported
(async () => {
  try {
    await checkNotificationsSchema();
    
    // Check for both possible column names
    console.log('\nChecking for message column...');
    const hasMessage = await checkColumn('message');
    
    console.log('\nChecking for content column...');
    const hasContent = await checkColumn('content');
    
    console.log('\nSchema check complete.');
    console.log(`- 'message' column exists: ${hasMessage}`);
    console.log(`- 'content' column exists: ${hasContent}`);
  } catch (error) {
    console.error('Error during schema check:', error);
  }
})();
