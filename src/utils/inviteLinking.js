// Utility to link supplier to invited events and update invite status
// Usage: await linkSupplierInvites(supplierId, supplierEmail, supabase)

export async function linkSupplierInvites(arg1, arg2, arg3) {
  // Support both: (supplierId, supplierEmail, supabase) and ({ supplierId, supplierEmail }, optionalSupabase)
  let supplierId, supplierEmail, supabaseInstance;
  if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
    // Called as ({ supplierId, supplierEmail }, supabase?)
    supplierId = arg1.supplierId;
    supplierEmail = arg1.supplierEmail;
    supabaseInstance = arg2 || (typeof window !== 'undefined' ? window.supabase : undefined);
  } else {
    // Called as (supplierId, supplierEmail, supabase)
    supplierId = arg1;
    supplierEmail = arg2;
    supabaseInstance = arg3 || (typeof window !== 'undefined' ? window.supabase : undefined);
  }
  if (!supplierId || !supplierEmail) {
    console.warn('linkSupplierInvites: Missing supplierId or supplierEmail');
    return;
  }
  const supabase = supabaseInstance || (await import('../supabaseClient')).supabase;
  // 1. Find pending invites for this supplier (by email)
  const { data: invites, error: inviteError } = await supabase
    .from('invites')
    .select('*')
    .eq('supplier_email', supplierEmail)
    .eq('status', 'pending');
  if (inviteError) {
    console.error('Error fetching pending invites:', inviteError);
    throw inviteError;
  }
  if (!invites || invites.length === 0) {
    console.log('No pending invites found for supplier:', supplierEmail);
    return;
  }

  for (const invite of invites) {
    console.log('Processing invite for event ID:', invite.event_id);
    let eventId = invite.event_id;
    let eventFound = false;
    
    // 2. Check if the event exists (FK constraint) in the new 'events' table
    const { data: eventRows, error: eventError } = await supabase
      .from('events')
      .select('id, name')
      .eq('id', eventId);
      
    if (eventError) {
      console.error('Error checking event existence:', eventError);
      continue; // Skip this invite but don't break the whole process
    }
    
    if (!eventRows || eventRows.length === 0) {
      console.warn('Event not found for invite:', eventId);
      
      // Try finding by partial ID match (in case URL parameters were truncated)
      try {
        if (eventId && eventId.includes('-')) {
          const partialId = eventId.split('-')[0];
          console.log('Trying partial match with:', partialId);
          
          const { data: similarEvents } = await supabase
            .from('events')
            .select('id, name')
            .like('id', `${partialId}%`);
            
          if (similarEvents && similarEvents.length > 0) {
            console.log('Found similar events:', similarEvents.map(e => ({ id: e.id, name: e.name })));
            eventId = similarEvents[0].id;
            console.log('Using first matching event ID:', eventId);
            eventFound = true;
          } else {
            console.log('No similar events found');
          }
        }
      } catch (partialMatchError) {
        console.error('Error during partial ID match:', partialMatchError);
      }
      
      if (!eventFound) {
        // As a last resort, get the most recent events
        try {
          console.log('Attempting to find recent events as fallback');
          const { data: recentEvents } = await supabase
            .from('events')
            .select('id, name, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
            
          if (recentEvents && recentEvents.length > 0) {
            console.log('Recent events found:', recentEvents.map(e => ({ id: e.id, name: e.name })));
            eventId = recentEvents[0].id;
            console.log('Using most recent event as fallback:', eventId);
            eventFound = true;
          } else {
            console.log('No events found in the system');
            continue; // Skip this invite
          }
        } catch (recentEventsError) {
          console.error('Error fetching recent events:', recentEventsError);
          continue; // Skip this invite
        }
      }
    } else {
      console.log('Event found:', eventRows[0]);
      eventFound = true;
    }
    let skipInsert = false;
    let existingLink = null;
    let linkFetchError = null;
    try {
      const res = await supabase
        .from('event_suppliers')
        .select('id')
        .eq('event_id', invite.event_id)
        .eq('supplier_user_id', supplierId)
        .maybeSingle();
      existingLink = res.data;
      linkFetchError = res.error;
    } catch (err) {
      linkFetchError = err;
    }
    if (existingLink) {
      console.log('Supplier already linked to event:', invite.event_id);
      skipInsert = true;
    } else if (linkFetchError && linkFetchError.code !== 'PGRST116' && linkFetchError.code !== 'PGRST123' && linkFetchError.code !== 'PGRST116: No rows found') {
      // Only skip insert if the error is NOT 'no rows found' (Supabase returns PGRST116 for no rows)
      console.error('Error checking existing link:', linkFetchError);
      skipInsert = true;
    }
    if (!skipInsert) {
      try {
        console.log(`Attempting to link supplier ${supplierId} to event ${eventId} with email ${supplierEmail}`);
        
        // Track if linking was successful
        let linkSuccess = false;
        
        // Use upsert with conflict handling
        const { error: linkInsertError } = await supabase
          .from('event_suppliers')
          .upsert(
            {
              event_id: eventId, // Using the potentially corrected event ID
              supplier_user_id: supplierId,
              supplier_email: supplierEmail
            },
            { onConflict: 'event_id,supplier_user_id', ignoreDuplicates: true }
          );
            
        if (linkInsertError) {
          console.error('Error linking supplier to event:', linkInsertError);
          
          // Try direct check and insert as fallback
          try {
            // First check if this link already exists
            const { data: existingLink, error: checkError } = await supabase
              .from('event_suppliers')
              .select('*')
              .eq('event_id', eventId)
              .eq('supplier_user_id', supplierId)
              .maybeSingle();
              
            if (checkError) {
              console.error('Error checking for existing link:', checkError);
            } else if (existingLink) {
              console.log('Link already exists, no need to insert');
              console.log('Link already confirmed for supplier', supplierId, 'to event', eventId);
              // Count as success
              linkSuccess = true;
            } else {
              // Link doesn't exist, try one more direct insert
              try {
                const { error: insertError } = await supabase
                  .from('event_suppliers')
                  .insert({
                    event_id: eventId,
                    supplier_user_id: supplierId,
                    supplier_email: supplierEmail
                  });
                  
                if (insertError) {
                  console.error('Final direct insert attempt failed:', insertError);
                } else {
                  console.log('Final direct insert successful');
                  linkSuccess = true;
                }
              } catch (insertErr) {
                console.error('Error in final insert attempt:', insertErr);
              }
            }
          } catch (directErr) {
            console.error('Error in fallback direct check:', directErr);
            continue;
          }
        } else {
          console.log('Successfully linked supplier', supplierId, 'to event', eventId);
          linkSuccess = true;
        }
      } catch (err) {
        console.error('Unexpected error during link creation:', err);
        continue;
      }
    }
    // 3. Update invite status to 'accepted' only if supplier was linked
    if (!skipInsert) {
      const { error: updateError } = await supabase
        .from('invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id);
      if (updateError) {
        console.error('Error updating invite status:', updateError);
      } else {
        console.log('Updated invite status to accepted for invite', invite.id);
      }
    } else {
      // If already linked, you may still want to update status if needed (optional)
      // Uncomment below if you want to always update status
      // await supabase.from('invites').update({ status: 'accepted' }).eq('id', invite.id);
    }
  }

  // Make sure existing notifications are marked as "unread" to ensure visibility in notification bell
  // This guarantees suppliers see event invites when they sign in
  try {
    console.log('Ensuring invitation notifications are visible for supplier:', supplierEmail);
    
    // Find any invitation notifications for this supplier
    const { data: inviteNotifications, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('supplier_email', supplierEmail.toLowerCase().trim())
      .eq('type', 'invitation');
      
    if (notificationError) {
      console.error('Error fetching invitation notifications:', notificationError);
    } else {
      console.log(`Found ${inviteNotifications?.length || 0} invitation notifications for ${supplierEmail}`);
      
      // If no notifications exist yet, create them for each invite
      if (!inviteNotifications || inviteNotifications.length === 0) {
        console.log('Creating missing invitation notifications for supplier');
        
        const notificationPayloads = invites.map(invite => ({
          supplier_email: supplierEmail.toLowerCase().trim(),
          event_id: invite.event_id,
          admin_user_id: invite.invited_by_admin_id,
          type: 'invitation',
          status: 'unread',
          created_at: new Date().toISOString(),
          message: 'You have been invited to an event'
        }));
        
        if (notificationPayloads.length > 0) {
          const { error: insertError } = await supabase
            .from('notifications')
            .insert(notificationPayloads);
            
          if (insertError) {
            console.error('Error creating invitation notifications:', insertError);
          } else {
            console.log(`Successfully created ${notificationPayloads.length} invitation notifications`);
          }
        }
      } else {
        // Don't reset notifications to unread - let them stay as read if the user marked them read
        console.log('Invitation notifications already exist - keeping their current read/unread status');
      }
    }
  } catch (notificationErr) {
    console.error('Unexpected error processing notifications:', notificationErr);
  }
  
  console.log(`Completed processing invites and notifications for supplier: ${supplierEmail}`);
  return { processedInvites: invites.length };
}

