const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://oesorptwsvoydqhmkbof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lc29ycHR3c3ZveWRxaG1rYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNzk5MzIsImV4cCI6MjA2NDY1NTkzMn0.8bE5C-L0q040phw4gnRgo4rJ2XNnZ64My_02GMj9hAU'
);

// Function to check the notifications table schema
async function checkNotificationsSchema() {
  try {
    console.log('Checking notifications table schema...');
    
    // Get table information from information_schema
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_schema', 'public')
      .eq('table_name', 'notifications');
    
    if (error) throw error;
    
    console.log('\nNotifications table columns:');
    console.table(data);
    
    // Also check if the table exists and has any rows
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting notifications:', countError);
    } else {
      console.log(`\nNotifications table has ${count} rows`);
    }
    
    return data;
  } catch (error) {
    console.error('Error checking notifications schema:', error);
    throw error;
  }
}

// Run the check
checkNotificationsSchema()
  .then(() => console.log('\nSchema check completed successfully'))
  .catch(console.error);
