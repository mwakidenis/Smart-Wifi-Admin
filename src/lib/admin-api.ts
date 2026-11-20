export type DataSource = 'live' | 'cached' | 'offline';

export type ApiResult<T> = {
  data: T;
  source: DataSource;
  error?: string;
};

export type Overview = {
  revenueKES: number;
  successfulTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  activeSessions: number;
  timePackages: number;
  speedPackages: number;
};

export type UserRecord = {
  id: string;
  name: string;
  phone: string;
  macAddress?: string;
  ipAddress?: string;
  packageName: string;
  dataUsedMB: number;
  remainingSeconds: number;
  paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED';
};

export type TransactionRecord = {
  id: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  amount: number;
  currency: string;
  phone: string;
  checkoutRequestId?: string;
  mpesaReceipt?: string;
  packageName: string;
  createdAt: string;
};

export type PackageRecord = {
  id: string;
  name: string;
  description: string;
  dataLimitMB: number | null;
  durationMin: number;
  speedMbps: number;
  maxDevices: number;
  price: number;
  currency: string;
  isActive: boolean;
};

export type RouterStatus = {
  adapter: 'MikroTik' | 'CoovaChilli' | 'Mock' | string;
  status: 'online' | 'degraded' | 'offline' | string;
  latencyMs: number | null;
  activeSessions: number;
  stream: 'live' | 'polling' | 'offline' | string;
};

export type Health = {
  status: string;
  service: string;
  timestamp?: string;
};

export type SupportMessage = {
  id: string;
  userName: string;
  phone: string;
  transactionCode?: string;
  message: string;
  createdAt: string;
};

export type AdminSnapshot = {
  overview: ApiResult<Overview>;
  users: ApiResult<UserRecord[]>;
  transactions: ApiResult<TransactionRecord[]>;
  packages: ApiResult<PackageRecord[]>;
  router: ApiResult<RouterStatus>;
  health: ApiResult<Health>;
  support: ApiResult<SupportMessage[]>;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 300;

const fallbackPackages: PackageRecord[] = [
  { id: 'pkg_1', name: '1 Hour', description: 'Capped bundle', dataLimitMB: 500, durationMin: 60, speedMbps: 5, maxDevices: 1, price: 10, currency: 'KES', isActive: true },
  { id: 'pkg_2', name: '12 Hours 1 Device', description: 'Unlimited access', dataLimitMB: null, durationMin: 720, speedMbps: 10, maxDevices: 1, price: 15, currency: 'KES', isActive: true },
  { id: 'pkg_3', name: '12 Hours 2 Devices', description: 'Unlimited multi-device access', dataLimitMB: null, durationMin: 720, speedMbps: 10, maxDevices: 2, price: 25, currency: 'KES', isActive: true },
  { id: 'pkg_4', name: '24 Hours 1 Device', description: 'Unlimited daily access', dataLimitMB: null, durationMin: 1440, speedMbps: 15, maxDevices: 1, price: 30, currency: 'KES', isActive: true },
  { id: 'pkg_5', name: '2 Weeks 1 Device', description: 'Unlimited fortnight access', dataLimitMB: null, durationMin: 20160, speedMbps: 15, maxDevices: 1, price: 450, currency: 'KES', isActive: true },
  { id: 'pkg_6', name: '1 Month 1 Device', description: 'Unlimited monthly access', dataLimitMB: null, durationMin: 43200, speedMbps: 25, maxDevices: 1, price: 750, currency: 'KES', isActive: true },
];

const fallbackTransactions: TransactionRecord[] = [
  { id: 'tx_demo_1', status: 'COMPLETED', amount: 25, currency: 'KES', phone: '254712345678', checkoutRequestId: 'ws_CO_demo_1', mpesaReceipt: 'QWE123ABC', packageName: '12 Hours 2 Devices', createdAt: new Date().toISOString() },
];

const fallbackUsers: UserRecord[] = [];
const fallbackOverview: Overview = { revenueKES: 0, successfulTransactions: 0, pendingTransactions: 0, failedTransactions: 0, activeSessions: 0, timePackages: 0, speedPackages: 0 };
const fallbackRouter: RouterStatus = { adapter: 'Mock', status: 'offline', latencyMs: null, activeSessions: 0, stream: 'offline' };
const fallbackHealth: Health = { status: 'ok', service: 'smart-wifi-api', timestamp: new Date().toISOString() };
const fallbackSupport: SupportMessage[] = [];

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function asNumber(val: unknown, fallback = 0): number {
  return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
}

function normalizeOverview(payload: unknown): Overview {
  const rec = isRecord(payload) && isRecord(payload.overview) ? payload.overview : isRecord(payload) ? payload : {};
  return {
    revenueKES: asNumber(rec.revenueKES),
    successfulTransactions: asNumber(rec.successfulTransactions),
    pendingTransactions: asNumber(rec.pendingTransactions),
    failedTransactions: asNumber(rec.failedTransactions),
    activeSessions: asNumber(rec.activeSessions),
    timePackages: asNumber(rec.timePackages),
    speedPackages: asNumber(rec.speedPackages),
  };
}



function normalizePackages(payload: unknown): PackageRecord[] {
  const list = isRecord(payload) && Array.isArray(payload.packages) ? payload.packages : Array.isArray(payload) ? payload : [];
  if (list.length === 0) return fallbackPackages;
  return list.map((item, idx) => {
    const record = isRecord(item) ? item : {};
    return {
      id: asString(record.id, `pkg_${idx}`),
      name: asString(record.name, 'Bundle'),
      description: asString(record.description, 'Internet access'),
      dataLimitMB: typeof record.dataLimitMB === 'number' ? record.dataLimitMB : null,
      durationMin: asNumber(record.durationMin, 60),
      speedMbps: asNumber(record.speedMbps, 5),
      maxDevices: asNumber(record.maxDevices, 1),
      price: asNumber(record.price, 10),
      currency: asString(record.currency, 'KES'),
      isActive: typeof record.isActive === 'boolean' ? record.isActive : true,
    };
  });
}

function normalizeRouter(payload: unknown): RouterStatus {
  const rec = isRecord(payload) && isRecord(payload.router) ? payload.router : isRecord(payload) ? payload : {};
  return {
    adapter: asString(rec.adapter, fallbackRouter.adapter),
    status: asString(rec.status, fallbackRouter.status),
    latencyMs: typeof rec.latencyMs === 'number' ? rec.latencyMs : null,
    activeSessions: asNumber(rec.activeSessions),
    stream: asString(rec.stream, fallbackRouter.stream),
  };
}

function normalizeHealth(payload: unknown): Health {
  const rec = isRecord(payload) ? payload : {};
  return {
    status: asString(rec.status, 'ok'),
    service: asString(rec.service, 'smart-wifi-api'),
    timestamp: asString(rec.timestamp) || undefined,
  };
}



export async function fetchOverview(): Promise<ApiResult<Overview>> {
  const res = await request<unknown>('/admin/overview', fallbackOverview);
  return { ...res, data: res.source === 'live' ? normalizeOverview(res.data) : fallbackOverview };
}

export async function fetchUsers(): Promise<ApiResult<UserRecord[]>> {
  const res = await request<unknown>('/admin/users', fallbackUsers);
  return { ...res, data: res.source === 'live' ? normalizeUsers(res.data) : fallbackUsers };
}

export async function fetchTransactions(): Promise<ApiResult<TransactionRecord[]>> {
  const res = await request<unknown>('/admin/transactions', fallbackTransactions);
  return { ...res, data: res.source === 'live' ? normalizeTransactions(res.data) : fallbackTransactions };
}

export async function fetchPackages(): Promise<ApiResult<PackageRecord[]>> {
  const res = await request<unknown>('/packages', fallbackPackages);
  return { ...res, data: res.source === 'live' ? normalizePackages(res.data) : fallbackPackages };
}

export async function fetchRouterStatus(): Promise<ApiResult<RouterStatus>> {
  const res = await request<unknown>('/admin/router-status', fallbackRouter);
  return { ...res, data: res.source === 'live' ? normalizeRouter(res.data) : fallbackRouter };
}

export async function fetchHealth(): Promise<ApiResult<Health>> {
  const res = await request<unknown>('/health', fallbackHealth);
  return { ...res, data: res.source === 'live' ? normalizeHealth(res.data) : { ...fallbackHealth, status: 'offline' } };
}

export async function getSupportMessages(): Promise<ApiResult<SupportMessage[]>> {
  const res = await request<unknown>('/admin/support', fallbackSupport);
  return { ...res, data: res.source === 'live' ? normalizeSupport(res.data) : fallbackSupport };
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const [overview, users, transactions, packages, router, health, support] = await Promise.all([
    fetchOverview(),
    fetchUsers(),
    fetchTransactions(),
    fetchPackages(),
    fetchRouterStatus(),
    fetchHealth(),
    getSupportMessages(),
  ]);
  return { overview, users, transactions, packages, router, health, support };
}

export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString()}`;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

