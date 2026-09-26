import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';

let peraWalletInstance: PeraWalletConnect | null = null;

export const ALGORAND_TESTNET_CHAIN_ID = 416002;
export const DEFAULT_INDEXER_URL = 'https://testnet-idx.algonode.cloud';
export const DEFAULT_ALGOD_URL = 'https://testnet-api.algonode.cloud';

/**
 * Singleton PeraWalletConnect instance for Algorand Testnet.
 */
export function getPeraWallet(): PeraWalletConnect {
  if (!peraWalletInstance) {
    peraWalletInstance = new PeraWalletConnect({
      chainId: ALGORAND_TESTNET_CHAIN_ID,
      shouldShowSignTxnToast: true,
    });
  }
  return peraWalletInstance;
}

/**
 * Returns an Algodv2 client for querying suggested params and sending transactions.
 */
export function getAlgodClient(): algosdk.Algodv2 {
  const nodeUrl = import.meta.env.VITE_ALGORAND_NODE_URL || DEFAULT_ALGOD_URL;
  return new algosdk.Algodv2('', nodeUrl, '');
}

/**
 * Connect to Pera Wallet and return primary connected account.
 */
export async function connectPeraWallet(): Promise<string> {
  const pera = getPeraWallet();
  try {
    const accounts = await pera.connect();
    pera.connector?.on('disconnect', () => {
      console.log('⚡ [PeraWallet] Disconnected');
    });
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
    throw new Error('No accounts selected in Pera Wallet');
  } catch (error: any) {
    if (error?.data?.type !== 'CONNECT_MODAL_CLOSED') {
      console.error('❌ [PeraWallet] Connection error:', error);
    }
    throw error;
  }
}

/**
 * Reconnect existing session if present.
 */
export async function reconnectPeraSession(): Promise<string | null> {
  const pera = getPeraWallet();
  try {
    const accounts = await pera.reconnectSession();
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
  } catch (err) {
    console.warn('⚡ [PeraWallet] Reconnect session notice:', err);
  }
  return null;
}

/**
 * Disconnect Pera Wallet session.
 */
export async function disconnectPeraWallet(): Promise<void> {
  const pera = getPeraWallet();
  try {
    await pera.disconnect();
  } catch (err) {
    console.warn('⚡ [PeraWallet] Disconnect notice:', err);
  }
}

/**
 * Construct, sign with Pera Wallet, and broadcast an Algorand Testnet payment transaction.
 */
export async function sendAlgorandPayment(params: {
  senderAddress: string;
  receiverAddress: string;
  amountAlgo: number; // e.g. 0.005
  sessionId: string;
  noteText?: string;
}): Promise<{ txId: string }> {
  const { senderAddress, receiverAddress, amountAlgo, sessionId, noteText } = params;
  const pera = getPeraWallet();
  const algod = getAlgodClient();

  console.log('⚡ [AlgorandService] Preparing payment transaction:', {
    from: senderAddress,
    to: receiverAddress,
    amountAlgo,
    sessionId,
  });

  // 1. Fetch live suggested transaction parameters
  const suggestedParams = await algod.getTransactionParams().do();

  // Convert ALGO to microAlgos (0.005 ALGO = 5000 microAlgos)
  const microAlgos = Math.round(amountAlgo * 1_000_000);

  // Note string encoded as Uint8Array
  const noteContent = noteText || `NeuroFlex AI Rehab Analysis: ${sessionId}`;
  const enc = new TextEncoder();
  const noteUint8 = enc.encode(noteContent);

  // 2. Build payment transaction
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: senderAddress,
    receiver: receiverAddress,
    amount: microAlgos,
    suggestedParams,
    note: noteUint8,
  });

  console.log('⚡ [AlgorandService] Requesting Pera Wallet signature for txn...');

  // 3. Request Pera Wallet signature
  const singleTxnGroup = [{ txn, signers: [senderAddress] }];
  const signedTxns = await pera.signTransaction([singleTxnGroup]);

  console.log('⚡ [AlgorandService] Transaction signed by Pera Wallet. Broadcasting to Algorand Testnet...');

  // 4. Broadcast raw transaction to Algorand Testnet node
  const sendResult = await algod.sendRawTransaction(signedTxns).do();
  const txId = (sendResult as any).txId || (sendResult as any).txid || txn.txID().toString();

  console.log('✅ [AlgorandService] Broadcast successful! Captured txId:', txId);

  return { txId };
}

/**
 * Poll indexer or node until transaction confirmed.
 */
export async function waitForTransactionConfirmation(
  txId: string,
  maxAttempts: number = 8,
  delayMs: number = 2000
): Promise<boolean> {
  const indexerUrl = import.meta.env.VITE_ALGORAND_INDEXER_URL || DEFAULT_INDEXER_URL;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`⚡ [AlgorandService] Polling Indexer for tx ${txId} (attempt ${attempt}/${maxAttempts})...`);
      const res = await fetch(`${indexerUrl.replace(/\/$/, '')}/v2/transactions/${txId}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.transaction?.['confirmed-round'] > 0) {
          console.log(`✅ [AlgorandService] Confirmed at round ${json.transaction['confirmed-round']}!`);
          return true;
        }
      }
    } catch (e) {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}
