import create from 'zustand';
import { persist } from 'zustand/middleware';

// Types for persisted state
export type UserSession = {
  userId: string;
  phone: string;
  packageName: string | null;
  remainingSeconds: number;
  dataUsedMB: number;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
  sessionId: string | null;
  loginAt: string;
};

export type AdminState = {
  // Session management
  userSession: UserSession | null;
  setUserSession: (session: UserSession | null) => void;

  // Package/balance state
  packageBalance: number;
  setPackageBalance: (amount: number) => void;

  // Payment confirmation
  lastTransaction: {
    checkoutRequestId: string;
    mpesaReceipt: string;
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    timestamp: string;
  } | null;
  setLastTransaction: (tx: {
    checkoutRequestId: string;
    mpesaReceipt: string;
    amount: number;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    timestamp: string;
  } | null) => void;

  // UI state
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;

  // Status indicators
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
};

// Create persisted store
const useStore = create(
  persist<AdminState>(
    (set) => ({
      userSession: null,
      setUserSession: (session: UserSession | null) => set({ userSession: session }),

      packageBalance: 0,
      setPackageBalance: (amount: number) => set({ packageBalance: amount }),

      lastTransaction: null,
      setLastTransaction: (tx: {
        checkoutRequestId: string;
        mpesaReceipt: string;
        amount: number;
        status: 'PENDING' | 'COMPLETED' | 'FAILED';
        timestamp: string;
      } | null) => set({ lastTransaction: tx }),

      isSidebarOpen: false,
      setIsSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),

      isOnline: true,
      setIsOnline: (online: boolean) => set({ isOnline: online }),
    }),
    {
      name: 'smart-wifi-admin-storage',
    }
  ),
);

export default useStore;