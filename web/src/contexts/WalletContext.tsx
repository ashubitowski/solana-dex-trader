import React, { FC, ReactNode, useCallback, useMemo } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
  CoinbaseWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import the styles
require('@solana/wallet-adapter-react-ui/styles.css');

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'
  const network = WalletAdapterNetwork.MainnetBeta;

  // You can also provide a custom RPC endpoint
  const endpoint = useMemo(() => {
    // Use the RPC endpoint from the config if available
    if (window.config?.rpcEndpoint) {
      return window.config.rpcEndpoint;
    }
    return clusterApiUrl(network);
  }, [network]);

  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new CoinbaseWalletAdapter()
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

// Custom hook to access wallet functionality
export const useWalletContext = () => {
  const wallet = useWallet();
  
  const connectWallet = useCallback(async () => {
    if (wallet.wallet && !wallet.connected) {
      try {
        await wallet.connect();
      } catch (error) {
        console.error('Error connecting wallet:', error);
      }
    } else if (!wallet.wallet) {
      wallet.select(wallet.wallets[0]?.adapter.name);
    }
  }, [wallet]);
  
  const disconnectWallet = useCallback(async () => {
    if (wallet.connected) {
      try {
        await wallet.disconnect();
      } catch (error) {
        console.error('Error disconnecting wallet:', error);
      }
    }
  }, [wallet]);
  
  return {
    wallet,
    connected: wallet.connected,
    publicKey: wallet.publicKey?.toString(),
    connectWallet,
    disconnectWallet,
    walletName: wallet.wallet?.adapter.name
  };
};
