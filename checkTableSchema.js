const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://oesorptwsvoydqhmkbof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lc29ycHR3c3ZveWRxaG1rYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNzk5MzIsImV4cCI6MjA2NDY1NTkzMn0.8bE5C-L0q040phw4gnRgo4rJ2XNnZ64My_02GMj9hAU'
);

async function checkTableSchema() {
  try {
    console.log('Checking notifications table structure...');
    
    // Get a single row to see the structure
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    
    console.log('Table structure sample:', JSON.stringify(data, null, 2));
    
    // Check if is_read column exists by trying to select it
    const { data: readCheck, error: readError } = await supabase
      .from('notifications')
      .select('is_read')
      .limit(1);
      
    if (readError) {
      console.log('\nError checking for is_read column:', readError.message);
    } else {
      console.log('\nis_read column exists and is accessible');
    }
    
  } catch (error) {
    console.error('Error checking table schema:', error);
  }
}

// Run the check
checkTableSchema();
