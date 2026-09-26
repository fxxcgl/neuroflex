/**
 * Wagmi + RainbowKit config for Base Sepolia (testnet).
 * Supports MetaMask, Coinbase Smart Wallet, and WalletConnect.
 */
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { baseSepolia } from 'wagmi/chains';

export const PLATFORM_WALLET_ADDRESS =
  (import.meta.env.VITE_PLATFORM_WALLET_ADDRESS as string) ||
  '0x0000000000000000000000000000000000000001'; // placeholder — set in .env

// USDC contract on Base Sepolia
export const USDC_ADDRESS_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Per-session fee in USDC (2.00 USDC = 2_000_000 in 6-decimal units)
export const SESSION_FEE_USDC_MICRO = 2_000_000n;
export const SESSION_FEE_DISPLAY = '$2.00 USDC';

// Platform commission (15%)
export const COMMISSION_BPS = 1500; // basis points

export const wagmiConfig = getDefaultConfig({
  appName: 'NeuroFlex Tele-Rehab',
  projectId: (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || 'neuroflex-demo',
  chains: [baseSepolia],
  ssr: false,
});
