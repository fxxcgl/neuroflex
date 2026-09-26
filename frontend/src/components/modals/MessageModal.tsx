import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, User, Stethoscope, Sparkles } from 'lucide-react';
import { fetchMessages, sendMessage, subscribeToMessages } from '../../lib/chatService';
import type { Message } from '../../types';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  recipientId,
  recipientName,
  recipientRole,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    fetchMessages(currentUserId, recipientId).then((data) => {
      if (isMounted) {
        setMessages(data);
        setTimeout(scrollToBottom, 50);
      }
    });

    const unsubscribe = subscribeToMessages(currentUserId, recipientId, (newMsg) => {
      if (isMounted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(scrollToBottom, 50);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen, currentUserId, recipientId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    const sent = await sendMessage(currentUserId, recipientId, inputText.trim());
    setMessages((prev) => [...prev, sent]);
    setInputText('');
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full h-[600px] max-h-[90vh] shadow-2xl border-2 border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Chat Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-teal-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-600/50 flex items-center justify-center border border-teal-400/40 text-white font-bold text-lg">
              {recipientRole.toLowerCase().includes('clinician') || recipientRole.toLowerCase().includes('pt') ? (
                <Stethoscope className="w-6 h-6 text-teal-300" />
              ) : (
                <User className="w-6 h-6 text-sky-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">{recipientName}</h3>
                <span className="bg-teal-500/20 text-teal-200 text-xs px-2.5 py-0.5 rounded-full border border-teal-400/30 font-bold">
                  {recipientRole}
                </span>
              </div>
              <p className="text-xs text-teal-200 font-medium flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Real-Time Secure Channel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 touch-target transition-colors"
            aria-label="Close chat window"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Message Thread History */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50">
          
          <div className="text-center my-2">
            <span className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs uppercase tracking-wider inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-teal-600" /> Encrypted Practitioner Tele-Rehab Thread
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <MessageSquare className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No messages in this thread yet.</p>
              <p className="text-xs max-w-xs text-slate-500">
                Send a note or question to your care provider to begin conversation.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_id === currentUserId;
              const formattedTime = new Date(m.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-sm font-medium shadow-sm leading-relaxed ${
                      isMe
                        ? 'bg-teal-700 text-white rounded-br-none'
                        : 'bg-white border-2 border-slate-200 text-slate-900 rounded-bl-none'
                    }`}
                  >
                    <p>{m.body}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 mt-1 px-1">
                    {formattedTime}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSend}
          className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-3"
        >
          <input
            type="text"
            required
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 min-h-[50px] px-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-slate-900 text-sm sm:text-base font-medium focus:bg-white focus:border-teal-600 focus:outline-none transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="touch-target px-5 sm:px-6 min-h-[50px] rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

      </div>
    </div>
  );
};
