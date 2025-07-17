import { supabase } from '../supabaseClient';

class RealtimeService {
  constructor() {
    this.subscriptions = new Map();
    this.presenceChannels = new Map();
  }

  subscribeToTable(table, filter, callback) {
    const channel = supabase
      .channel(`table:${table}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        callback
      )
      .subscribe();

    const subscriptionId = `table:${table}:${Date.now()}`;
    this.subscriptions.set(subscriptionId, channel);
    return () => this.unsubscribe(subscriptionId);
  }

  trackPresence(channelName, userId, state = {}) {
    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      console.log('Online users:', channel.presenceState());
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ ...state, online_at: new Date().toISOString() });
      }
    });

    this.presenceChannels.set(channelName, channel);
    return () => channel.unsubscribe();
  }

  unsubscribe(id) {
    const channel = this.subscriptions.get(id);
    if (channel) {
      supabase.removeChannel(channel);
      this.subscriptions.delete(id);
    }
  }

  cleanup() {
    this.subscriptions.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.subscriptions.clear();
    this.presenceChannels.clear();
  }
}

export const realtimeService = new RealtimeService();
