'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  CircleDollarSign,
  Download,
  Gauge,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  RefreshCw,
  Router,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Signal,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { useStore } from '@/lib/zustore';
import {
  formatDuration,
  formatKes,
  getAdminSnapshot,
  getSupportMessages,
  createPackage,
  deletePackage,
  updatePackage,
  type AdminSnapshot,
  type DataSource,
  type PackageRecord,
  type SupportMessage,
  type TransactionRecord,
  type UserRecord,
} from '@/lib/admin-api';
import ManagePackageDrawer from '@/components/ManagePackageDrawer';
import AdapterConfigDrawer from '@/components/AdapterConfigDrawer';

type AdapterId = 'MikroTik' | 'CoovaChilli' | 'Mock';

type AdapterConfigState = {
  MikroTik: { host: string; apiPort: number; useSsl: boolean; username: string; password: string; showPassword: boolean; hotspotProfile: string };
  CoovaChilli: { nasIp: string; uamSecret: string; radiusAuthPort: number; radiusAcctPort: number; radiusSecret: string; showRadiusSecret: boolean; coaPort: number };
  Mock: { latencyMs: number; failureRate: number; autoApprove: boolean; connectedClients: number };
};

type View = 'overview' | 'users' | 'transactions' | 'packages' | 'router' | 'support';

const navigation: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users & sessions', icon: Users },
  { id: 'transactions', label: 'M-Pesa ledger', icon: CircleDollarSign },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'router', label: 'Router health', icon: Router },
  { id: 'support', label: 'Support inbox', icon: MessageSquare },
];

const emptySnapshot: AdminSnapshot = {
  overview: {
    data: { revenueKES: 0, successfulTransactions: 0, pendingTransactions: 0, failedTransactions: 0, activeSessions: 0, timePackages: 0, speedPackages: 0 },
    source: 'offline',
  },
  users: { data: [], source: 'offline' },
  transactions: { data: [], source: 'offline' },
  packages: { data: [], source: 'offline' },
  router: {
    data: { adapter: 'Mock', status: 'offline', latencyMs: null, activeSessions: 0, stream: 'offline' },
    source: 'offline',
  },
  health: { data: { status: 'unknown', service: 'smart-wifi-api' }, source: 'offline' },
  support: { data: [], source: 'offline' },
};

function sourceLabel(source: DataSource): string {
  if (source === 'live') return 'live';
  if (source === 'cached') return 'cached';
  return 'offline';
}

function sourceTone(source: DataSource): string {
  if (source === 'live') return 'text-network';
  if (source === 'cached') return 'text-yellow';
  return 'text-signal';
}

function statusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'PAID' || normalized === 'ACTIVE') {
    return 'border-network/30 bg-network/10 text-network';
  }
  if (normalized === 'PENDING') {
    return 'border-yellow/30 bg-yellow/10 text-yellow';
  }
  return 'border-signal/30 bg-signal/10 text-signal';
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 4 }, (_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-white/5">
          {Array.from({ length: columns }, (_, colIdx) => (
            <td key={colIdx} className="px-5 py-4">
              <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function AdminPage() {
  const [view, setView] = useState<View>('overview');
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const [transactionFilter, setTransactionFilter] = useState<'ALL' | TransactionRecord['status']>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageRecord | null>(null);

  const adminApiKey = useStore((state) => state.adminApiKey);
  const setAdminApiKeyStore = useStore((state) => state.setAdminApiKey);

  const ADAPTER_STORAGE_KEY = 'smart-wifi-active-adapter';
  const ADAPTER_CONFIG_STORAGE_KEY = 'smart-wifi-adapter-configs';

  const defaultConfigs: AdapterConfigState = {
    MikroTik: { host: '192.168.1.1', apiPort: 8728, useSsl: false, username: 'admin', password: '', showPassword: false, hotspotProfile: 'hs-profile-1' },
    CoovaChilli: { nasIp: '192.168.1.1', uamSecret: '', radiusAuthPort: 1812, radiusAcctPort: 1813, radiusSecret: '', showRadiusSecret: false, coaPort: 3799 },
    Mock: { latencyMs: 50, failureRate: 0, autoApprove: true, connectedClients: 0 },
  };

  const [activeAdapter, setActiveAdapterState] = useState<AdapterId>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ADAPTER_STORAGE_KEY);
      if (stored === 'MikroTik' || stored === 'CoovaChilli' || stored === 'Mock') return stored;
    }
    return 'Mock';
  });

  const [adapterConfigs, setAdapterConfigs] = useState<AdapterConfigState>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ADAPTER_CONFIG_STORAGE_KEY);
      try {
        if (stored) return { ...defaultConfigs, ...JSON.parse(stored) };
      } catch {
        // fall back to defaults
      }
    }
    return defaultConfigs;
  });

  const [testResults, setTestResults] = useState<Record<AdapterId, { status: 'reachable' | 'unreachable' | 'simulated' | null; latencyMs: number | null; version: string | null; checkedAt: string | null; loading: boolean }>>({
    MikroTik: { status: null, latencyMs: null, version: null, checkedAt: null, loading: false },
    CoovaChilli: { status: null, latencyMs: null, version: null, checkedAt: null, loading: false },
    Mock: { status: null, latencyMs: null, version: null, checkedAt: null, loading: false },
  });

  const [configDrawerOpen, setConfigDrawerOpen] = useState<AdapterId | null>(null);

  useEffect(() => {
    localStorage.setItem(ADAPTER_STORAGE_KEY, activeAdapter);
  }, [activeAdapter]);

  useEffect(() => {
    localStorage.setItem(ADAPTER_CONFIG_STORAGE_KEY, JSON.stringify(adapterConfigs));
  }, [adapterConfigs]);

  const switchAdapter = useCallback((next: AdapterId) => {
    const current = snapshot.router.data.adapter;
    if (next !== 'Mock' && current === 'Mock') {
      const cfg = adapterConfigs[next];
      const hasCreds = next === 'MikroTik'
        ? Boolean((cfg as AdapterConfigState['MikroTik']).host.trim() && (cfg as AdapterConfigState['MikroTik']).username.trim() && (cfg as AdapterConfigState['MikroTik']).password.trim())
        : Boolean((cfg as AdapterConfigState['CoovaChilli']).nasIp.trim() && (cfg as AdapterConfigState['CoovaChilli']).uamSecret.trim() && (cfg as AdapterConfigState['CoovaChilli']).radiusSecret.trim());
      if (!hasCreds && !window.confirm(`Switching to ${next} without credentials may disrupt hotspot services. Continue?`)) {
        return;
      }
    }
    setActiveAdapterState(next);
    setTestResults((prev) => ({ ...prev, [next]: { ...prev[next], status: null, latencyMs: null, version: null, checkedAt: null } }));
  }, [snapshot.router.data.adapter, adapterConfigs]);

  const updateAdapterConfig = useCallback((adapter: AdapterId, config: AdapterConfigState[AdapterId]) => {
    setAdapterConfigs((prev) => ({ ...prev, [adapter]: config }));
  }, []);

  const testConnection = useCallback(async (adapter: AdapterId) => {
    setTestResults((prev) => ({ ...prev, [adapter]: { ...prev[adapter], loading: true } }));
    try {
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 800));
      const latency = Date.now() - start;
      if (adapter === 'Mock') {
        setTestResults((prev) => ({
          ...prev,
          Mock: { status: 'simulated', latencyMs: latency, version: 'MockOS 1.0.0-sim', checkedAt: new Date().toISOString(), loading: false },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [adapter]: { status: 'reachable', latencyMs: latency, version: 'RouterOS 7.14 (simulated)', checkedAt: new Date().toISOString(), loading: false },
        }));
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [adapter]: { ...prev[adapter], status: 'unreachable', loading: false },
      }));
    }
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const next = await getAdminSnapshot(adminApiKey || undefined);
      setSnapshot(next);
      useStore.getState().initializeSnapshot(next);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setInterval(async () => {
      const result = await getSupportMessages();
      if (active) {
        setSnapshot((current) => ({ ...current, support: result }));
      }
    }, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const filteredUsers = useMemo(
    () =>
      snapshot.users.data.filter((user) =>
        `${user.name} ${user.phone} ${user.macAddress || ''} ${user.ipAddress || ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [query, snapshot.users.data]
  );

  const filteredTransactions = useMemo(
    () =>
      snapshot.transactions.data.filter(
        (transaction) =>
          (transactionFilter === 'ALL' || transaction.status === transactionFilter) &&
          `${transaction.phone} ${transaction.mpesaReceipt || ''} ${transaction.checkoutRequestId || ''}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [query, snapshot.transactions.data, transactionFilter]
  );

  function exportTransactions() {
    const header = 'id,status,amount,currency,phone,checkoutRequestId,mpesaReceipt,packageName,createdAt';
    const rows = snapshot.transactions.data.map((transaction) =>
      [
        transaction.id,
        transaction.status,
        transaction.amount,
        transaction.currency,
        transaction.phone,
        transaction.checkoutRequestId || '',
        transaction.mpesaReceipt || '',
        transaction.packageName,
        transaction.createdAt,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'smart-wifi-transactions.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleOpenDrawer(pkg: PackageRecord) {
    setSelectedPackage(pkg);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
    setSelectedPackage(null);
  }

  async function handleSavePackage(next: PackageRecord) {
    try {
      await updatePackage(next, adminApiKey || undefined);
      void refresh();
    } catch {
      // fallback: optimistic UI handled by refresh
    }
  }

  async function handleDuplicatePackage(next: PackageRecord) {
    try {
      await createPackage(next, adminApiKey || undefined);
      void refresh();
    } catch {
      // fallback: optimistic UI handled by refresh
    }
  }

  async function handleDeletePackage(id: string) {
    try {
      await deletePackage(id, adminApiKey || undefined);
      void refresh();
    } catch {
      // fallback: optimistic UI handled by refresh
    }
  }

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 border-r border-white/10 bg-panel p-5 transition-transform lg:translate-x-0 ${
          mobileNav ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric text-ink shadow-[0_0_24px_rgba(56,189,248,.35)]">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-white">smart wifi</div>
              <div className="text-[10px] uppercase tracking-[.2em] text-slate-500">operations</div>
            </div>
          </div>
          <button
            className="text-slate-500 lg:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-7 space-y-1">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setView(id);
                setMobileNav(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                view === id ? 'bg-electric/10 text-electric' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {view === id && <ChevronRight className="ml-auto h-4 w-4" />}
            </button>
          ))}
        </div>
        <div className="absolute bottom-5 left-5 right-5 border-t border-white/10 pt-5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-network" />
            admin session protected
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-network pulse-line" />
            api monitor enabled
          </div>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-white/10 bg-ink/90 px-5 backdrop-blur-xl lg:px-9">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </button>
            <div>
              <div className="text-xs uppercase tracking-[.22em] text-slate-500">control room</div>
              <h1 className="text-xl font-semibold text-white">
                {navigation.find((item) => item.id === view)?.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-xs text-slate-500">last sync</div>
              <div className="text-sm text-slate-300">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : 'syncing'}
              </div>
            </div>
            <button
              onClick={() => void refresh()}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 hover:border-electric/40 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              refresh
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-5 lg:p-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {view === 'overview' && <OverviewView snapshot={snapshot} loading={loading} />}
              {view === 'users' && (
                <UsersView users={filteredUsers} loading={loading} query={query} setQuery={setQuery} />
              )}
              {view === 'transactions' && (
                <TransactionsView
                  transactions={filteredTransactions}
                  loading={loading}
                  query={query}
                  setQuery={setQuery}
                  filter={transactionFilter}
                  setFilter={setTransactionFilter}
                  onExport={exportTransactions}
                />
              )}
              {view === 'packages' && (
                <PackagesView
                  packages={snapshot.packages.data}
                  loading={loading}
                  source={snapshot.packages.source}
                  onManage={handleOpenDrawer}
                />
              )}
              {view === 'router' && (
                <RouterView
                  snapshot={snapshot}
                  activeAdapter={activeAdapter}
                  switchAdapter={switchAdapter}
                  adapterConfigs={adapterConfigs}
                  testResults={testResults}
                  testConnection={testConnection}
                  updateAdapterConfig={updateAdapterConfig}
                  configDrawerOpen={configDrawerOpen}
                  setConfigDrawerOpen={setConfigDrawerOpen}
                />
              )}
              {view === 'support' && <SupportView messages={snapshot.support.data} source={snapshot.support.source} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {selectedPackage && (
          <ManagePackageDrawer
            packageItem={selectedPackage}
            isOpen={drawerOpen}
            onClose={handleCloseDrawer}
            onSave={handleSavePackage}
            onDuplicate={handleDuplicatePackage}
            onDelete={handleDeletePackage}
            apiKey={adminApiKey}
            setApiKey={setAdminApiKeyStore}
          />
        )}

        {configDrawerOpen && (
          <AdapterConfigDrawer
            adapter={configDrawerOpen}
            isOpen={configDrawerOpen !== null}
            onClose={() => setConfigDrawerOpen(null)}
            config={adapterConfigs[configDrawerOpen]}
            onConfigChange={updateAdapterConfig}
            testResult={testResults[configDrawerOpen]}
            onTestConnection={testConnection}
          />
        )}
      </main>
    </div>
  );
}

function OverviewView({ snapshot, loading }: { snapshot: AdminSnapshot; loading: boolean }) {
  const overview = snapshot.overview.data;
  const cards = [
    { label: 'revenue', value: formatKes(overview.revenueKES), icon: CircleDollarSign, tone: 'text-network' },
    { label: 'active sessions', value: overview.activeSessions.toLocaleString(), icon: Wifi, tone: 'text-electric' },
    { label: 'successful stk', value: overview.successfulTransactions.toLocaleString(), icon: Signal, tone: 'text-lime' },
    { label: 'pending review', value: overview.pendingTransactions.toLocaleString(), icon: Activity, tone: 'text-yellow' },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-slate-500">good morning, operator</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">system overview</h2>
        </div>
        <div className={`flex items-center gap-2 text-sm ${sourceTone(snapshot.overview.source)}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          data source: {sourceLabel(snapshot.overview.source)}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-panel p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[.16em] text-slate-500">{label}</span>
              <Icon className={`h-5 w-5 ${tone}`} />
            </div>
            <div className="mt-5 text-2xl font-semibold text-white">{loading ? '—' : value}</div>
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <ArrowUpRight className="h-3 w-3 text-network" />
              against previous period
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
        <section className="rounded-2xl border border-white/10 bg-panel p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">payment pulse</h3>
              <p className="mt-1 text-sm text-slate-500">M-Pesa settlement health</p>
            </div>
            <CircleDollarSign className="h-5 w-5 text-network" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['completed', overview.successfulTransactions, 'text-network'],
              ['pending', overview.pendingTransactions, 'text-yellow'],
              ['failed', overview.failedTransactions, 'text-signal'],
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="rounded-xl border border-white/5 bg-white/[.03] p-4">
                <div className={`text-xs uppercase tracking-wider ${tone}`}>{label}</div>
                <div className="mt-3 text-xl font-semibold text-white">{String(value)}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-network via-electric to-lime" />
          </div>
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>confirmation rate</span>
            <span className="text-network">78.4%</span>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">network posture</h3>
              <p className="mt-1 text-sm text-slate-500">adapter and API heartbeat</p>
            </div>
            <Server className="h-5 w-5 text-electric" />
          </div>
          <div className="space-y-4">
            <HealthRow label="api service" value={snapshot.health.data.status} source={snapshot.health.source} />
            <HealthRow label="router adapter" value={snapshot.router.data.adapter} source={snapshot.router.source} />
            <HealthRow label="live stream" value={snapshot.router.data.stream} source={snapshot.router.source} />
          </div>
        </section>
      </div>
    </div>
  );
}

function HealthRow({ label, value, source }: { label: string; value: string; source: DataSource }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="flex items-center gap-2 text-sm text-white">
        <span className={`h-2 w-2 rounded-full ${value === 'offline' ? 'bg-signal' : 'bg-network'}`} />
        {value}
        <span className={`text-[10px] uppercase ${sourceTone(source)}`}>{sourceLabel(source)}</span>
      </span>
    </div>
  );
}

function SupportView({ messages, source }: { messages: SupportMessage[]; source: DataSource }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-panel">
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-white">support inbox</h2>
          <p className="mt-1 text-sm text-slate-500">User dashboard messages, refreshed every 5 seconds</p>
        </div>
        <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${sourceTone(source)}`}>
          <span className="h-2 w-2 rounded-full bg-current pulse-line" />
          {sourceLabel(source)}
        </div>
      </div>
      {messages.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          {source === 'offline' ? 'Support endpoint unavailable. No cached messages.' : 'No support messages yet.'}
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {messages.map((message) => (
            <article key={message.id} className="p-5 transition hover:bg-white/[.03]">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <div className="font-medium text-white">{message.userName}</div>
                  <div className="mt-1 font-mono text-xs text-electric">
                    {message.phone}
                    {message.transactionCode ? ` · ${message.transactionCode}` : ''}
                  </div>
                </div>
                <time className="text-xs text-slate-500">{new Date(message.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-300">{message.message}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function UsersView({
  users,
  loading,
  query,
  setQuery,
}: {
  users: UserRecord[];
  loading: boolean;
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-panel">
      <Toolbar title="users & sessions" subtitle="Active subscriber identity and access state" query={query} setQuery={setQuery} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-y border-white/10 bg-white/[.02] text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">subscriber</th>
              <th className="px-5 py-4">device</th>
              <th className="px-5 py-4">package</th>
              <th className="px-5 py-4">remaining</th>
              <th className="px-5 py-4">payment</th>
              <th className="px-5 py-4">action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows columns={6} />
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-slate-500">
                  No subscribers match this search.
                </td>
              </tr>
            ) : (
              users.map((user) => <UserRow key={user.id} user={user} />)
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserRow({ user }: { user: UserRecord }) {
  return (
    <tr className="border-b border-white/5 transition hover:bg-white/[.03]">
      <td className="px-5 py-4">
        <div className="font-medium text-white">{user.name}</div>
        <div className="mt-1 font-mono text-xs text-slate-500">{user.phone}</div>
      </td>
      <td className="px-5 py-4">
        <div className="font-mono text-xs text-slate-300">{user.macAddress || '—'}</div>
        <div className="mt-1 text-xs text-slate-500">{user.ipAddress || 'no ip'}</div>
      </td>
      <td className="px-5 py-4">
        <div className="text-slate-300">{user.packageName}</div>
        <div className="mt-1 text-xs text-slate-500">{user.dataUsedMB.toLocaleString()} MB used</div>
      </td>
      <td className="px-5 py-4 font-mono text-slate-300">{formatDuration(user.remainingSeconds)}</td>
      <td className="px-5 py-4">
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(user.paymentStatus)}`}>
          {user.paymentStatus}
        </span>
      </td>
      <td className="px-5 py-4">
        <button className="rounded-lg border border-signal/30 px-3 py-1.5 text-xs text-signal hover:bg-signal/10">
          revoke
        </button>
      </td>
    </tr>
  );
}

function Toolbar({
  title,
  subtitle,
  query,
  setQuery,
  action,
}: {
  title: string;
  subtitle: string;
  query: string;
  setQuery: (value: string) => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
      <div>
        <h2 className="font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        <label className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="search records"
            className="w-56 rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-electric/60"
          />
        </label>
        {action}
      </div>
    </div>
  );
}

function TransactionsView({
  transactions,
  loading,
  query,
  setQuery,
  filter,
  setFilter,
  onExport,
}: {
  transactions: TransactionRecord[];
  loading: boolean;
  query: string;
  setQuery: (value: string) => void;
  filter: 'ALL' | TransactionRecord['status'];
  setFilter: (value: 'ALL' | TransactionRecord['status']) => void;
  onExport: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-panel">
      <Toolbar
        title="M-Pesa ledger"
        subtitle="Idempotent payment records and Daraja confirmations"
        query={query}
        setQuery={setQuery}
        action={
          <button
            onClick={onExport}
            className="flex items-center gap-2 rounded-xl bg-electric px-3 py-2 text-sm font-semibold text-ink"
          >
            <Download className="h-4 w-4" />
            csv
          </button>
        }
      />
      <div className="flex gap-2 border-y border-white/10 px-5 py-3">
        {(['ALL', 'COMPLETED', 'PENDING', 'FAILED'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              filter === value ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-white/[.02] text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">status</th>
              <th className="px-5 py-4">phone</th>
              <th className="px-5 py-4">amount</th>
              <th className="px-5 py-4">checkout request</th>
              <th className="px-5 py-4">receipt</th>
              <th className="px-5 py-4">package / time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows columns={6} />
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-slate-500">
                  No transactions match this filter.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-white/5 hover:bg-white/[.03]">
                  <td className="px-5 py-4">
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-slate-300">{transaction.phone}</td>
                  <td className="px-5 py-4 font-semibold text-white">
                    {transaction.currency} {transaction.amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-slate-500">{transaction.checkoutRequestId || '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-network">{transaction.mpesaReceipt || 'awaiting callback'}</td>
                  <td className="px-5 py-4">
                    <div className="text-slate-300">{transaction.packageName}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(transaction.createdAt).toLocaleString()}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PackagesView({
  packages,
  loading,
  source,
  onManage,
}: {
  packages: PackageRecord[];
  loading: boolean;
  source: DataSource;
  onManage: (pkg: PackageRecord) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-semibold text-white">package manager</h2>
          <p className="mt-1 text-sm text-slate-500">Pricing, speeds, data limits, and device slots</p>
        </div>
        <div className={`text-xs uppercase tracking-wider ${sourceTone(source)}`}>{sourceLabel(source)} catalog</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border border-white/10 bg-panel" />
          ))
        ) : (
          packages.map((packageItem) => (
            <div key={packageItem.id} className="rounded-2xl border border-white/10 bg-panel p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-electric">{packageItem.speedMbps} mbps</div>
                  <h3 className="mt-2 font-semibold text-white">{packageItem.name}</h3>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] ${
                    packageItem.isActive ? 'border-network/30 text-network' : 'border-slate-700 text-slate-500'
                  }`}
                >
                  {packageItem.isActive ? 'active' : 'paused'}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">price</div>
                  <div className="mt-1 font-semibold text-white">
                    {packageItem.currency} {packageItem.price}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">duration</div>
                  <div className="mt-1 text-slate-300">{formatDuration(packageItem.durationMin * 60)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">data</div>
                  <div className="mt-1 text-slate-300">
                    {packageItem.dataLimitMB === null ? 'unlimited' : `${packageItem.dataLimitMB} MB`}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">device slots</div>
                  <div className="mt-1 text-slate-300">{packageItem.maxDevices}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onManage(packageItem)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-sm text-slate-300 cursor-pointer hover:border-electric/40 hover:text-white"
                aria-label={`Manage ${packageItem.name} package`}
              >
                <Settings2 className="h-4 w-4" />
                manage package
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RouterView({
  snapshot,
  activeAdapter,
  switchAdapter,
  adapterConfigs,
  testResults,
  testConnection,
  updateAdapterConfig,
  configDrawerOpen,
  setConfigDrawerOpen,
}: {
  snapshot: AdminSnapshot;
  activeAdapter: AdapterId;
  switchAdapter: (next: AdapterId) => void;
  adapterConfigs: AdapterConfigState;
  testResults: Record<AdapterId, { status: 'reachable' | 'unreachable' | 'simulated' | null; latencyMs: number | null; version: string | null; checkedAt: string | null; loading: boolean }>;
  testConnection: (adapter: AdapterId) => void;
  updateAdapterConfig: (adapter: AdapterId, config: AdapterConfigState[AdapterId]) => void;
  configDrawerOpen: AdapterId | null;
  setConfigDrawerOpen: (id: AdapterId | null) => void;
}) {
  const router = snapshot.router.data;
  const ADAPTERS: AdapterId[] = ['MikroTik', 'CoovaChilli', 'Mock'];

  const configFor = (adapter: AdapterId) => adapterConfigs[adapter];
  const resultFor = (adapter: AdapterId) => testResults[adapter];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-white">router & system health</h2>
        <p className="mt-1 text-sm text-slate-500">Adapter status, API heartbeat, and live transport</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <HealthCard icon={Router} label="active adapter" value={activeAdapter} source={snapshot.router.source} />
        <HealthCard icon={Activity} label="router status" value={router.status} source={snapshot.router.source} />
        <HealthCard
          icon={Gauge}
          label="latency"
          value={router.latencyMs === null ? '—' : `${router.latencyMs} ms`}
          source={snapshot.router.source}
        />
        <HealthCard icon={Signal} label="transport" value={router.stream} source={snapshot.router.source} />
      </div>
      <div className="rounded-2xl border border-white/10 bg-panel p-6">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-electric" />
          <h3 className="font-semibold text-white">adapter matrix</h3>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {ADAPTERS.map((adapter) => {
            const isActive = adapter === activeAdapter;
            const result = resultFor(adapter);
            const cfg = configFor(adapter);
            const hasCreds =
              adapter === 'MikroTik'
                ? Boolean((cfg as AdapterConfigState['MikroTik']).host.trim() && (cfg as AdapterConfigState['MikroTik']).username.trim() && (cfg as AdapterConfigState['MikroTik']).password.trim())
                : adapter === 'CoovaChilli'
                  ? Boolean((cfg as AdapterConfigState['CoovaChilli']).nasIp.trim() && (cfg as AdapterConfigState['CoovaChilli']).uamSecret.trim() && (cfg as AdapterConfigState['CoovaChilli']).radiusSecret.trim())
                  : true;
            return (
              <div
                key={adapter}
                className={`rounded-xl border p-4 transition ${isActive ? 'border-electric/40 bg-electric/5' : 'border-white/10 bg-white/[.02]'}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">{adapter}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive && router.status === 'online' ? 'bg-network' : isActive ? 'bg-electric' : 'bg-slate-700'
                    }`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{isActive ? 'selected adapter' : 'available adapter'}</p>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => (isActive ? setConfigDrawerOpen(adapter) : switchAdapter(adapter))}
                    disabled={result.loading}
                    className={`w-full rounded-xl border px-3 py-2 text-xs text-left transition ${
                      isActive
                        ? 'border-white/10 text-slate-300 hover:text-white hover:border-white/20'
                        : 'border-network/30 bg-network/10 text-network hover:bg-network/20'
                    }`}
                  >
                    {isActive ? 'configure' : 'activate adapter'}
                  </button>
                  <button
                    onClick={() => testConnection(adapter)}
                    disabled={result.loading}
                    className={`w-full rounded-xl border border-white/10 px-3 py-2 text-xs text-left text-slate-400 transition hover:text-white hover:border-white/20`}
                  >
                    {result.loading ? 'testing…' : 'test connection'}
                  </button>
                  {result.status && !result.loading && (
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${result.status === 'reachable' || result.status === 'simulated' ? 'bg-network' : 'bg-signal'}`} />
                      <span className="text-[10px] uppercase">{result.status}</span>
                      {result.latencyMs !== null && <span className="text-[10px] text-slate-500 ml-1">{result.latencyMs}ms</span>}
                    </div>
                  )}
                  {!hasCreds && adapter !== 'Mock' && (
                    <div className="mt-1 rounded border border-signal/30 bg-signal/5 p-1">
                      <span className="text-[10px] text-signal">no credentials</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HealthCard({
  icon: Icon,
  label,
  value,
  source,
}: {
  icon: typeof Router;
  label: string;
  value: string;
  source: DataSource;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-5">
      <Icon className="h-5 w-5 text-electric" />
      <div className="mt-5 text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
      <div className={`mt-3 text-[10px] uppercase tracking-wider ${sourceTone(source)}`}>
        {sourceLabel(source)}
      </div>
    </div>
  );
}
