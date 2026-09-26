import React, { useState } from 'react';
import { X, Loader2, Link as LinkIcon, Check } from 'lucide-react';
import { JitsiMeeting } from '@jitsi/react-sdk';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  userName: string;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  isOpen,
  onClose,
  roomName,
  userName,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const link = `https://meet.jit.si/${roomName}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200 p-2 sm:p-4 md:p-6 lg:p-8">
      <div className="bg-slate-950 rounded-3xl w-full h-full shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Secure Tele-Rehab Session
            </h3>
            <p className="text-xs text-slate-400 font-medium">End-to-End Encrypted</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              title="Copy Invite Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 touch-target transition-colors bg-slate-800/50 border border-slate-700"
              title="End Call"
            >
              <span className="sr-only">End Call</span>
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Jitsi Meeting Container */}
        <div className="flex-1 relative bg-black">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomName}
            configOverwrite={{
              startWithAudioMuted: false,
              startWithVideoMuted: false,
              disableModeratorIndicator: true,
              enableEmailInStats: false,
              prejoinPageEnabled: false,
            }}
            interfaceConfigOverwrite={{
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            }}
            userInfo={{
              displayName: userName,
            }}
            onApiReady={(externalApi) => {
              // Handle external API events if needed
              // e.g. when the user hangs up from inside Jitsi UI:
              externalApi.addListener('videoConferenceLeft', () => {
                onClose();
              });
            }}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
              iframeRef.style.border = 'none';
            }}
            spinner={() => (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-300">
                <Loader2 className="w-12 h-12 animate-spin text-teal-500 mb-4" />
                <p className="font-semibold">Connecting to secure server...</p>
              </div>
            )}
          />
        </div>

      </div>
    </div>
  );
};
