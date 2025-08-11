const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://oesorptwsvoydqhmkbof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lc29ycHR3c3ZveWRxaG1rYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNzk5MzIsImV4cCI6MjA2NDY1NTkzMn0.8bE5C-L0q040phw4gnRgo4rJ2XNnZ64My_02GMj9hAU'
);

async function checkTable() {
  try {
    // Try to get one row from the notifications table
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      console.log('First notification row:');
      console.log(JSON.stringify(data[0], null, 2));
      
      console.log('\nColumn names:');
      console.log(Object.keys(data[0]));
    } else {
      console.log('No notifications found in the table.');
      
      // Try to insert a test notification to check the schema
      console.log('\nAttempting to insert a test notification...');
      const { data: insertData, error: insertError } = await supabase
        .from('notifications')
        .insert([
          {
            supplier_email: 'test@example.com',
            event_id: 'test-event-id',
            type: 'test',
            status: 'unread',
            content: 'Test notification',
            admin_user_id: 'test-admin-id'
          }
        ])
        .select();
      
      if (insertError) {
        console.error('Error inserting test notification:');
        console.error(insertError);
      } else {
        console.log('Successfully inserted test notification:');
        console.log(insertData);
        
        // Clean up
        await supabase
          .from('notifications')
          .delete()
          .eq('id', insertData[0].id);
      }
    }
  } catch (error) {
    console.error('Error checking table:');
    console.error(error);
  }
}

checkTable();
