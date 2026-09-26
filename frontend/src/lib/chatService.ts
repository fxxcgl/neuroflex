import { supabase, isSupabaseConfigured } from './supabase';
import type { Message } from '../types';

const DEMO_MESSAGES_KEY = 'neuroflex_chat_messages';

/**
 * Deterministic thread id generator for pair (userId1, userId2).
 * Sorting ensures both patient and clinician always arrive at the exact same thread.
 */
export function getThreadId(userA: string, userB: string): string {
  const sorted = [String(userA || '').trim(), String(userB || '').trim()].sort();
  return `thread_${sorted[0]}_${sorted[1]}`;
}

export async function fetchMessages(currentUserId: string, otherUserId: string): Promise<Message[]> {
  const threadId = getThreadId(currentUserId, otherUserId);

  if (isSupabaseConfigured) {
    try {
      console.log('⚡ [ChatService] Fetching messages for deterministic thread:', threadId, { currentUserId, otherUserId });
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      console.log('⚡ [ChatService] fetchMessages response:', { count: data?.length || 0, error });

      if (error) {
        console.error('❌ [ChatService] Error fetching messages:', error);
        return [];
      } else if (data) {
        console.log(`✅ [ChatService] Loaded ${data.length} messages for thread: ${threadId}`);
        return data as Message[];
      }
      return [];
    } catch (e) {
      console.error('❌ [ChatService] Supabase fetch messages exception:', e);
      return [];
    }
  }

  // Local fallback (only for offline demo mode)
  try {
    const raw = localStorage.getItem(DEMO_MESSAGES_KEY);
    const allMessages: Message[] = raw ? JSON.parse(raw) : [];
    return allMessages.filter((m) => m.thread_id === threadId);
  } catch (e) {
    return [];
  }
}

export async function sendMessage(
  senderId: string,
  recipientId: string,
  body: string
): Promise<Message> {
  const threadId = getThreadId(senderId, recipientId);
  const tempId = `msg-${Date.now()}`;
  const trimmedBody = body.trim();

  const newMessage: Message = {
    id: tempId,
    thread_id: threadId,
    sender_id: senderId,
    recipient_id: recipientId,
    body: trimmedBody,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      console.log('⚡ [ChatService] Inserting message into Supabase:', {
        thread_id: threadId,
        sender_id: senderId,
        recipient_id: recipientId,
        body: trimmedBody,
      });

      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            thread_id: threadId,
            sender_id: senderId,
            recipient_id: recipientId,
            body: trimmedBody,
          },
        ])
        .select()
        .single();

      console.log('⚡ [ChatService] Supabase sendMessage response:', { data, error });

      if (error) {
        console.error('❌ [ChatService] Error sending message:', error);
      } else if (data) {
        return data as Message;
      }
    } catch (e) {
      console.error('❌ [ChatService] Exception sending message:', e);
    }
  }

  // Save to local store fallback
  try {
    const raw = localStorage.getItem(DEMO_MESSAGES_KEY);
    const allMessages: Message[] = raw ? JSON.parse(raw) : [];
    allMessages.push(newMessage);
    localStorage.setItem(DEMO_MESSAGES_KEY, JSON.stringify(allMessages));
  } catch (e) {
    // ignore
  }

  return newMessage;
}

export function subscribeToMessages(
  currentUserId: string,
  otherUserId: string,
  onNewMessage: (msg: Message) => void
) {
  const threadId = getThreadId(currentUserId, otherUserId);

  if (!isSupabaseConfigured) {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === DEMO_MESSAGES_KEY && e.newValue) {
        try {
          const list: Message[] = JSON.parse(e.newValue);
          const latest = list[list.length - 1];
          if (
            latest &&
            (latest.thread_id === threadId ||
              (latest.sender_id === otherUserId && latest.recipient_id === currentUserId) ||
              (latest.sender_id === currentUserId && latest.recipient_id === otherUserId))
          ) {
            onNewMessage(latest);
          }
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }

  const channel = supabase
    .channel(`chat_${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        const msg = payload.new as Message;
        onNewMessage(msg);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
