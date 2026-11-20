import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminSnapshot } from './admin-api';

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
  userSession: UserSession | null;
  setUserSession: (session: UserSession | null) => void;
  packageBalance: number;
  setPackageBalance: (amount: number) => void;
  search: string;
  setSearch: (q: string) => void;
  snapshot: AdminSnapshot | null;
  initializeSnapshot: (next: AdminSnapshot) => void;
};

export const useStore = create<AdminState>()(
  persist(
    (set) => ({
      userSession: null,
      setUserSession: (userSession) => set({ userSession }),
      packageBalance: 0,
      setPackageBalance: (packageBalance) => set({ packageBalance }),
      search: '',
      setSearch: (search) => set({ search }),
      snapshot: null,
      initializeSnapshot: (snapshot) => set({ snapshot }),
    }),
    {
      name: 'smart-wifi-admin-store',
      partialize: (state) => ({
        userSession: state.userSession,
        packageBalance: state.packageBalance,
        search: state.search,
      }),
    }
  )
);
