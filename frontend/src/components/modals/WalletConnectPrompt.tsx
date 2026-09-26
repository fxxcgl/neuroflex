import React, { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi';
import { Wallet, ShieldCheck, X, Loader2, CheckCircle2 } from 'lucide-react';
import { setX402Wallet, clearX402Wallet } from '../../lib/x402Client';
import { SESSION_FEE_DISPLAY } from '../../lib/wagmiConfig';

interface WalletConnectPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export const WalletConnectPrompt: React.FC<WalletConnectPromptProps> = ({
  isOpen,
  onClose,
  onConnected,
}) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const [registered, setRegistered] = useState(false);

  // Once wallet is connected, register it with x402 client
  useEffect(() => {
    if (isConnected && address && !registered) {
      const signFn = async (message: string) => {
        return signMessageAsync({ message });
      };
      setX402Wallet(address, signFn);
      setRegistered(true);
      setTimeout(() => {
        onConnected();
        onClose();
      }, 1200);
    }
    if (!isConnected) {
      clearX402Wallet();
      setRegistered(false);
    }
  }, [isConnected, address]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-black">Connect Your Wallet</h2>
              <p className="text-xs text-blue-300 font-medium">One-time setup for seamless payments</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {registered ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
              <div>
                <p className="font-black text-slate-900 text-lg">Wallet Connected!</p>
                <p className="text-xs text-slate-500 font-mono mt-1">{address?.slice(0, 10)}...{address?.slice(-8)}</p>
                <p className="text-sm text-slate-600 mt-1">Session payments will now happen automatically.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Info card */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-2 text-blue-900 font-black text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  How payments work
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Each session automatically charges <strong>{SESSION_FEE_DISPLAY}</strong> from your wallet directly to your doctor on <strong>Base Sepolia</strong>. No popups — it happens in the background when you finish a workout.
                </p>
              </div>

              {/* Wallet options */}
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Choose wallet</p>
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    disabled={isPending}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-black text-sm">
                      {connector.name.slice(0, 2)}
                    </div>
                    <span className="font-bold text-slate-900 group-hover:text-blue-800 flex-1 text-left text-sm">
                      {connector.name}
                    </span>
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    ) : null}
                  </button>
                ))}
              </div>

              <p className="text-center text-[11px] text-slate-400">
                Payments run on Base Sepolia (testnet) — no real funds required for testing.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
