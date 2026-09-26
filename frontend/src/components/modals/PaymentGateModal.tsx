import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Coins, 
  Wallet, 
  Loader2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Zap, 
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { 
  connectPeraWallet, 
  disconnectPeraWallet, 
  reconnectPeraSession, 
  sendAlgorandPayment 
} from '../../lib/algorandService';
import type { MovementAnalysisResult } from '../../api/analyzeMovement';

interface PaymentChallenge {
  amount: string;
  asset: string;
  network: string;
  payToAddress: string;
  sessionId: string;
  message?: string;
}

interface PaymentGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  challenge: PaymentChallenge;
  onPaymentVerified: (analysis: MovementAnalysisResult, txnId: string) => void;
  onResubmitAnalysis: (sessionId: string, txnId: string) => Promise<{ status: number; data: any }>;
}

export const PaymentGateModal: React.FC<PaymentGateModalProps> = ({
  isOpen,
  onClose,
  challenge,
  onPaymentVerified,
  onResubmitAnalysis,
}) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [manualTxId, setManualTxId] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  // Attempt reconnect on mount
  useEffect(() => {
    if (isOpen) {
      reconnectPeraSession().then((addr) => {
        if (addr) setWalletAddress(addr);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(challenge.payToAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnectWallet = async () => {
    setErrorMsg(null);
    setConnecting(true);
    try {
      const address = await connectPeraWallet();
      setWalletAddress(address);
    } catch (err: any) {
      if (err?.data?.type !== 'CONNECT_MODAL_CLOSED') {
        setErrorMsg(err?.message || 'Failed to connect Pera Wallet.');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectWallet = async () => {
    await disconnectPeraWallet();
    setWalletAddress(null);
  };

  const handlePayAndAnalyze = async () => {
    setErrorMsg(null);

    // 1. Ensure wallet is connected
    let activeAddress = walletAddress;
    if (!activeAddress) {
      setConnecting(true);
      try {
        activeAddress = await connectPeraWallet();
        setWalletAddress(activeAddress);
      } catch (err: any) {
        setConnecting(false);
        if (err?.data?.type !== 'CONNECT_MODAL_CLOSED') {
          setErrorMsg(err?.message || 'Please connect your Pera Wallet to continue.');
        }
        return;
      }
      setConnecting(false);
    }

    if (!activeAddress) return;

    // 2. Broadcast Payment on Algorand Testnet
    setPaying(true);
    let broadcastTxId: string | null = null;
    try {
      const result = await sendAlgorandPayment({
        senderAddress: activeAddress,
        receiverAddress: challenge.payToAddress,
        amountAlgo: parseFloat(challenge.amount) || 0.005,
        sessionId: challenge.sessionId,
      });
      broadcastTxId = result.txId;
      setLastTxId(result.txId);
    } catch (err: any) {
      console.error('Payment rejected or failed:', err);
      setErrorMsg(err?.message || 'Transaction was declined or failed in Pera Wallet.');
      setPaying(false);
      return;
    }

    setPaying(false);

    // 3. Verify on Backend
    if (broadcastTxId) {
      await verifyTransactionOnBackend(broadcastTxId);
    }
  };

  const verifyTransactionOnBackend = async (txId: string) => {
    setVerifying(true);
    setErrorMsg(null);

    try {
      console.log(`⚡ [PaymentModal] Resubmitting session with txnId: ${txId}...`);
      const res = await onResubmitAnalysis(challenge.sessionId, txId);

      if (res.status === 200 && res.data?.success && res.data?.analysis) {
        console.log('✅ [PaymentModal] Payment verified! Analysis received:', res.data.analysis);
        onPaymentVerified(res.data.analysis, txId);
        onClose();
      } else {
        const errorReason = res.data?.error || 'Verification failed';
        if (errorReason === 'not_confirmed') {
          setErrorMsg('Transaction is still pending block confirmation on Algorand. Please wait a few seconds and click "Re-verify".');
        } else if (errorReason === 'already_used') {
          setErrorMsg('This transaction ID has already been used for another session.');
        } else if (errorReason === 'amount_mismatch') {
          setErrorMsg('Transaction amount is less than the required fee (0.005 ALGO).');
        } else if (errorReason === 'receiver_mismatch') {
          setErrorMsg('Transaction was sent to an incorrect receiver address.');
        } else {
          setErrorMsg(res.data?.message || 'Could not verify payment on Algorand Indexer.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error verifying payment.');
    } finally {
      setVerifying(false);
    }
  };

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTxId.trim()) return;
    setLastTxId(manualTxId.trim());
    await verifyTransactionOnBackend(manualTxId.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border-2 border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950 text-white flex items-center justify-between border-b border-teal-800/40 relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-400/30">
              <Coins className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[11px] font-black uppercase tracking-wider border border-teal-400/30">
                  Algorand Testnet
                </span>
                <span className="text-xs text-emerald-300 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Micropayment Gate
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                Unlock AI Movement Analysis
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Fee & Network Highlight Card */}
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-5 border-2 border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider block">
                Session Telemetry Fee
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">
                  {challenge.amount} {challenge.asset}
                </span>
                <span className="text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md border border-teal-300">
                  Testnet
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Instant cryptographic on-chain verification powered by Algorand.
              </p>
            </div>

            <div className="bg-white px-4 py-3 rounded-xl border border-teal-200 shrink-0 text-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Analysis Tier
              </span>
              <span className="text-sm font-black text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" /> Kinematic + LSTM
              </span>
            </div>
          </div>

          {/* Destination Address with Copy */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
              Pay-To Smart Receiver Address
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 truncate select-all">
                {challenge.payToAddress}
              </div>
              <button
                type="button"
                onClick={handleCopyAddress}
                className="touch-target px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Wallet Connection Status */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                walletAddress ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-600'
              }`}>
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Pera Wallet Status
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-slate-900">
                  {walletAddress 
                    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` 
                    : 'No wallet connected'}
                </span>
              </div>
            </div>

            {walletAddress ? (
              <button
                type="button"
                onClick={handleDisconnectWallet}
                className="text-xs font-bold text-red-600 hover:text-red-800 underline self-start sm:self-center cursor-pointer"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={connecting}
                className="touch-target px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                <span>Connect Pera</span>
              </button>
            )}
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3 animate-in fade-in" role="alert">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-semibold">{errorMsg}</p>
                {lastTxId && (
                  <button
                    type="button"
                    onClick={() => verifyTransactionOnBackend(lastTxId)}
                    disabled={verifying}
                    className="mt-1 text-xs font-extrabold text-amber-800 bg-amber-200/80 hover:bg-amber-300 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Re-verify Transaction on Indexer</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading / Verification Banner */}
          {verifying && (
            <div className="p-4 rounded-2xl bg-teal-50 border-2 border-teal-300 text-teal-950 flex items-center gap-3 animate-in fade-in">
              <Loader2 className="w-5 h-5 text-teal-700 animate-spin shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-bold text-teal-900">
                  Verifying on Algorand Testnet Indexer...
                </p>
                <p className="text-xs text-teal-700">
                  Querying confirmed round & designated receiver.
                </p>
              </div>
            </div>
          )}

          {/* Action Button: Pay & Analyze */}
          <div>
            <button
              type="button"
              onClick={handlePayAndAnalyze}
              disabled={paying || verifying || connecting}
              className="w-full min-h-[58px] rounded-2xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-lg font-black shadow-lg shadow-teal-700/25 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {paying ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Signing in Pera Wallet...</span>
                </>
              ) : verifying ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Verifying on Blockchain...</span>
                </>
              ) : connecting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Connecting Pera Wallet...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
                  <span>Pay {challenge.amount} ALGO & Unlock Analysis</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* Manual Txn Input Accordion */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex items-center gap-1 mx-auto"
            >
              <span>{showManualInput ? '▲ Hide manual transaction input' : '▼ Already paid? Enter Algorand Txn ID manually'}</span>
            </button>

            {showManualInput && (
              <form onSubmit={handleManualVerify} className="mt-3 flex gap-2 animate-in fade-in">
                <input
                  type="text"
                  required
                  placeholder="Paste 52-character Algorand Txn ID..."
                  value={manualTxId}
                  onChange={(e) => setManualTxId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-teal-600"
                />
                <button
                  type="submit"
                  disabled={verifying || !manualTxId.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  Verify
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-700 font-medium">
          Protected by Algorand Pure Proof-of-Stake • Instant Finality • Zero Synthetic Telemetry
        </div>

      </div>
    </div>
  );
};
