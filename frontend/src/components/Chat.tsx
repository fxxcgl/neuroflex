import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

interface ChatProps {
  recipientId: string;
  recipientName: string;
}

export function generateThreadId(id1: string, id2: string): string {
  const sorted = [id1, id2].sort();
  return `thread_${sorted[0]}_${sorted[1]}`;
}

export const Chat: React.FC<ChatProps> = ({ recipientId, recipientName }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUserId = user?.id || '';
  const threadId = currentUserId && recipientId ? generateThreadId(currentUserId, recipientId) : '';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!threadId) return;

    let isMounted = true;
    let subscription: any = null;

    const fetchMessages = async () => {
      if (!isSupabaseConfigured) {
        // Demo mode fallback
        const demoMessages: Message[] = [
          {
            id: 'm1',
            thread_id: threadId,
            sender_id: recipientId,
            recipient_id: currentUserId,
            content: `Hello! I'm ${recipientName}. How are you feeling today?`,
            created_at: new Date(Date.now() - 3600000).toISOString(),
          }
        ];
        if (isMounted) {
          setMessages(demoMessages);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true });

        if (!error && data && isMounted) {
          setMessages(data);
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMessages();

    if (isSupabaseConfigured) {
      subscription = supabase
        .channel(`messages_${threadId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          (payload) => {
            const newMessage = payload.new as Message;
            if (isMounted) {
              setMessages((prev) => [...prev, newMessage]);
            }
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [threadId, currentUserId, recipientId, recipientName]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId) return;

    const messageText = input.trim();
    setInput('');

    if (!isSupabaseConfigured) {
      // Demo mode
      const newMsg: Message = {
        id: `demo_msg_${Date.now()}`,
        thread_id: threadId,
        sender_id: currentUserId,
        recipient_id: recipientId,
        content: messageText,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
      
      // Auto-reply in demo mode
      setTimeout(() => {
        const reply: Message = {
          id: `demo_reply_${Date.now()}`,
          thread_id: threadId,
          sender_id: recipientId,
          recipient_id: currentUserId,
          content: 'Thank you for the update! Let\'s discuss this more during our next session.',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, reply]);
      }, 1500);
      return;
    }

    try {
      const { error } = await supabase.from('messages').insert([
        {
          thread_id: threadId,
          sender_id: currentUserId,
          recipient_id: recipientId,
          content: messageText,
        },
      ]);

      if (error) {
        console.error('Error sending message:', error);
      }
    } catch (err) {
      console.error('Error in handleSend:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] bg-slate-50 border-2 border-slate-200 rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="bg-white px-6 py-4 border-b-2 border-slate-200 shadow-sm flex items-center gap-4 z-10">
        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center font-bold text-teal-700">
          {recipientName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="font-bold text-slate-800">{recipientName}</h3>
          <p className="text-xs font-medium text-teal-600">Online &bull; Secure Encrypted Chat</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
            <div className="w-16 h-16 bg-white rounded-2xl border-2 border-slate-200 flex items-center justify-center shadow-sm">
              <Send className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-semibold text-sm">No messages yet — say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-5 py-3 rounded-3xl text-sm leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-teal-600 text-white rounded-br-md'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                  <div
                    className={`text-[10px] mt-1.5 font-medium ${
                      isMe ? 'text-teal-200' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t-2 border-slate-200">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your secure message..."
            className="w-full pl-6 pr-14 py-4 rounded-full bg-slate-50 border-2 border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-medium text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 p-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
