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

export type WorkerPackageResponse = {
  version: string;
  updatedAt: string;
  packages: PackageRecord[];
};

export type PackageApiError = {
  status: number;
  message: string;
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

function normalizeTransactions(payload: unknown): TransactionRecord[] {
  const list = isRecord(payload) && Array.isArray(payload.transactions) ? payload.transactions : Array.isArray(payload) ? payload : [];
  return list.map((item, idx) => {
    const record = isRecord(item) ? item : {};
    const rawStatus = asString(record.status, 'PENDING').toUpperCase();
    const status: TransactionRecord['status'] =
      rawStatus === 'COMPLETED' || rawStatus === 'FAILED' ? rawStatus : 'PENDING';
    return {
      id: asString(record.id, `tx_${idx}`),
      status,
      amount: asNumber(record.amount),
      currency: asString(record.currency, 'KES'),
      phone: asString(record.phone),
      checkoutRequestId: asString(record.checkoutRequestId) || undefined,
      mpesaReceipt: asString(record.mpesaReceipt) || undefined,
      packageName: asString(record.packageName, 'Standard Plan'),
      createdAt: asString(record.createdAt, new Date().toISOString()),
    };
  });
}

function normalizeUsers(payload: unknown): UserRecord[] {
  const list = isRecord(payload) && Array.isArray(payload.users) ? payload.users : Array.isArray(payload) ? payload : [];
  return list.map((item, idx) => {
    const record = isRecord(item) ? item : {};
    const rawStatus = asString(record.paymentStatus, 'PENDING').toUpperCase();
    const paymentStatus: UserRecord['paymentStatus'] =
      rawStatus === 'COMPLETED' || rawStatus === 'FAILED' ? rawStatus : 'PENDING';
    return {
      id: asString(record.id, `usr_${idx}`),
      name: asString(record.name, 'Subscriber'),
      phone: asString(record.phone),
      macAddress: asString(record.macAddress) || undefined,
      ipAddress: asString(record.ipAddress) || undefined,
      packageName: asString(record.packageName, 'Standard Plan'),
      dataUsedMB: asNumber(record.dataUsedMB),
      remainingSeconds: asNumber(record.remainingSeconds),
      paymentStatus,
    };
  });
}

function normalizePackages(payload: unknown): PackageRecord[] {
  const wrapper = isRecord(payload) && Array.isArray((payload as Record<string, unknown>).packages) ? (payload as Record<string, unknown>).packages : null;
  const list: unknown[] = wrapper ? (wrapper as unknown[]) : Array.isArray(payload) ? payload : [];
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

function normalizeSupport(payload: unknown): SupportMessage[] {
  const list = isRecord(payload) && Array.isArray(payload.supportMessages) ? payload.supportMessages : Array.isArray(payload) ? payload : [];
  return list.map((item, idx) => {
    const record = isRecord(item) ? item : {};
    return {
      id: asString(record.id, `sup_${idx}`),
      userName: asString(record.userName, 'User'),
      phone: asString(record.phone),
      transactionCode: asString(record.transactionCode) || undefined,
      message: asString(record.message),
      createdAt: asString(record.createdAt, new Date().toISOString()),
    };
  });
}

async function request<T>(path: string, fallback: T, attempts = DEFAULT_RETRIES, init?: RequestInit): Promise<ApiResult<T>> {
  let lastError = 'Request failed';
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${path}`, { cache: 'no-store', ...init });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
      } else {
        const json: unknown = await response.json();
        return { data: json as T, source: 'live' };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, DEFAULT_RETRY_DELAY * (attempt + 1)));
    }
  }
  return { data: fallback, source: 'offline', error: lastError };
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

export async function fetchPackages(apiKey?: string): Promise<ApiResult<PackageRecord[]>> {
  const res = await request<unknown>('/api/packages', fallbackPackages, 2, apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined);
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

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function resolveBackendId(apiKey: string | undefined, uiId: string, uiName: string): Promise<string> {
  const res = await request<unknown>('/api/packages', fallbackPackages, 1, apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : undefined);
  if (res.source !== 'live') return uiId;
  const raw = isRecord(res.data) && Array.isArray((res.data as WorkerPackageResponse).packages)
    ? (res.data as WorkerPackageResponse).packages
    : Array.isArray(res.data) ? res.data : [];
  const wrapper: unknown[] = raw;
  const byExactId = wrapper.find((item) => isRecord(item) && asString((item as Record<string, unknown>).id) === uiId);
  if (byExactId) return uiId;
  const byName = wrapper.find((item) => isRecord(item) && asString((item as Record<string, unknown>).name).toLowerCase() === uiName.toLowerCase());
  if (byName) return asString((byName as Record<string, unknown>).id);
  const bySlug = wrapper.find((item) => isRecord(item) && slugify(asString((item as Record<string, unknown>).name)) === slugify(uiName));
  if (bySlug) return asString((bySlug as Record<string, unknown>).id);
  return uiId;
}

export async function updatePackage(patch: Partial<PackageRecord> & { id: string }, apiKey?: string): Promise<{ success: boolean; data?: PackageRecord; error?: PackageApiError }> {
  const backendId = await resolveBackendId(apiKey, patch.id, patch.name || '');
  try {
    const response = await fetch(`${API_BASE}/api/packages/${backendId}`, {
      method: 'PATCH',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ ...patch, id: backendId }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return {
        success: false,
        error: { status: response.status, message: String((errorBody as Record<string, unknown>).error) || `HTTP ${response.status}` },
      };
    }
    const json: unknown = await response.json();
    const updated = isRecord(json) && isRecord(json.packages) ? (json.packages as unknown as unknown[]).find((p) => isRecord(p) && asString((p as Record<string, unknown>).id) === backendId) : json;
    const normalized = isRecord(updated) ? normalizePackages([updated])[0] : { ...fallbackPackages[0], ...patch, id: backendId };
    return { success: true, data: normalized };
  } catch (err) {
    return {
      success: false,
      error: { status: 0, message: err instanceof Error ? err.message : 'Network error' },
    };
  }
}

export async function deletePackage(id: string, apiKey?: string): Promise<{ success: boolean; error?: PackageApiError }> {
  try {
    const backendId = await resolveBackendId(apiKey, id, id);
    const response = await fetch(`${API_BASE}/api/packages/${backendId}`, {
      method: 'DELETE',
      cache: 'no-store',
      ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { success: false, error: { status: response.status, message: String((errorBody as Record<string, unknown>).error) || `HTTP ${response.status}` } };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: { status: 0, message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function createPackage(patch: Omit<PackageRecord, 'id'>, apiKey?: string): Promise<{ success: boolean; data?: PackageRecord; error?: PackageApiError }> {
  try {
    const response = await fetch(`${API_BASE}/api/packages`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { success: false, error: { status: response.status, message: String((errorBody as Record<string, unknown>).error) || `HTTP ${response.status}` } };
    }
    const json: unknown = await response.json();
    const created = isRecord(json) ? json : {};
    const normalized = normalizePackages([created])[0];
    return { success: true, data: normalized };
  } catch (err) {
    return { success: false, error: { status: 0, message: err instanceof Error ? err.message : 'Network error' } };
  }
}

export async function getAdminSnapshot(apiKey?: string): Promise<AdminSnapshot> {
  const [overview, users, transactions, packages, router, health, support] = await Promise.all([
    fetchOverview(),
    fetchUsers(),
    fetchTransactions(),
    fetchPackages(apiKey),
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
