export type DataSource = 'live' | 'cached' | 'offline';

export type ApiResult<T> = {
  data: T;
  source: DataSource;
  error?: string;
};

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

const fallbackHealth: Health = { status: 'ok', service: 'smart-wifi-api', timestamp: new Date().toISOString() };

const fallbackSupport: SupportMessage[] = [];

function isRecord(val: any): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function normalizePackage(raw: any): PackageRecord {
  return {
    id: raw.id || crypto.randomUUID(),
    name: raw.name || 'Unnamed Package',
    description: raw.description ?? null,
    dataLimitMB: raw.dataLimitMB ?? null,
    durationMin: raw.durationMin || 0,
    speedMbps: raw.speedMbps || 0,
    maxDevices: raw.maxDevices ?? 1,
    price: Number(raw.price) || 0,
    currency: raw.currency || 'KES',
    isActive: !!raw.isActive,
  };
}

function normalizeTransactions(raw: any[]): TransactionRecord[] {
  return (raw || []).map((tx) => ({
    id: tx.id || crypto.randomUUID(),
    status: tx.status || 'PENDING',
    amount: Number(tx.amount) || 0,
    currency: tx.currency || 'KES',
    phone: tx.phone || '',
    checkoutRequestId: tx.checkoutRequestId ?? null,
    mpesaReceipt: tx.mpesaReceipt ?? null,
    packageName: tx.packageName ?? null,
    createdAt: tx.createdAt || new Date().toISOString(),
  }));
}

function normalizeUsers(raw: any[]): UserRecord[] {
  return (raw || []).map((user) => ({
    id: user.id || crypto.randomUUID(),
    name: user.name || 'Unknown User',
    phone: user.phone || '',
    email: user.email ?? null,
    macAddress: user.macAddress ?? null,
    ipAddress: user.ipAddress ?? null,
    packageName: user.packageName ?? null,
    remainingSeconds: user.remainingSeconds ?? 0,
    dataUsedMB: user.dataUsedMB ?? 0,
    paymentStatus: user.paymentStatus || 'PENDING',
    sessionId: user.sessionId ?? null,
  }));
}

function normalizeRouter(raw: any): RouterStatus {
  return {
    adapter: (raw?.adapter || 'Mock') as 'MikroTik' | 'CoovaChilli' | 'Mock',
    status: (raw?.status || 'offline') as 'online' | 'offline' | 'degraded',
    latencyMs: raw?.latencyMs ?? null,
    activeSessions: typeof raw?.activeSessions === 'number' ? Math.max(0, raw.activeSessions) : 0,
    stream: (raw?.stream || 'offline') as 'live' | 'polling' | 'offline',
  };
}

function normalizeHealth(raw: any): Health {
  return {
    status: (raw?.status || 'ok') as 'ok' | 'error',
    service: raw?.service || 'smart-wifi-api',
    timestamp: raw?.timestamp || new Date().toISOString(),
  };
}

function normalizeSupport(raw: any[]): SupportMessage[] {
  return (raw || []).map((msg) => ({
    id: msg.id || crypto.randomUUID(),
    phone: msg.phone || '',
    transactionCode: msg.transactionCode ?? null,
    message: msg.message || '',
    createdAt: msg.createdAt || new Date().toISOString(),
    userName: msg.userName || 'Unknown',
  }));
}

function normalizePackages(payload: unknown): PackageRecord[] {
  const list = isRecord(payload) && Array.isArray(payload.packages) ? payload.packages : [];
  return list.map((item): PackageRecord => {
    const record = isRecord(item) ? item : {};
    return {
      id: String(record.id || 'unknown'), name: String(record.name || 'Unnamed package'), description: String(record.description || ''),
      dataLimitMB: record.dataLimitMB === null ? null : numeric(record.dataLimitMB ?? record.dataMb, 0), durationMin: numeric(record.durationMin),
      speedMbps: numeric(record.speedMbps), maxDevices: numeric(record.maxDevices, 1), price: numeric(record.price), currency: String(record.currency || 'KES'), isActive: record.isActive !== false,
    };
  });
}

function normalizeTransactions(payload: unknown): TransactionRecord[] {
  const list = isRecord(payload) && Array.isArray(payload.transactions) ? payload.transactions : [];
  return list.map((item): TransactionRecord => {
    const record = isRecord(item) ? item : {};
    const packageValue = isRecord(record.package) ? record.package.name : record.packageName;
    const status = record.status === 'COMPLETED' || record.status === 'FAILED' || record.status === 'REVERSED' ? record.status : 'PENDING';
    return { id: String(record.id || crypto.randomUUID()), status, amount: numeric(record.amount), currency: String(record.currency || 'KES'), phone: String(record.phone || '—'), checkoutRequestId: typeof record.checkoutRequestId === 'string' ? record.checkoutRequestId : null, mpesaReceipt: typeof record.mpesaReceipt === 'string' ? record.mpesaReceipt : null, packageName: String(packageValue || 'Unknown package'), createdAt: String(record.createdAt || new Date().toISOString()) };
  });
}

function normalizeUsers(payload: unknown): UserRecord[] {
  const list = isRecord(payload) && Array.isArray(payload.users) ? payload.users : Array.isArray(payload) ? payload : [];
  return list.map((item): UserRecord => {
    const record = isRecord(item) ? item : {};
    return { id: String(record.id || crypto.randomUUID()), name: String(record.name || record.email || 'Unknown user'), phone: String(record.phone || '—'), email: String(record.email || '—'), macAddress: typeof record.macAddress === 'string' ? record.macAddress : null, ipAddress: typeof record.ipAddress === 'string' ? record.ipAddress : null, packageName: String(record.packageName || 'No active package'), remainingSeconds: numeric(record.remainingSeconds), dataUsedMB: numeric(record.dataUsedMB), paymentStatus: record.paymentStatus === 'COMPLETED' || record.paymentStatus === 'FAILED' || record.paymentStatus === 'REVERSED' ? record.paymentStatus : 'PENDING', sessionId: typeof record.sessionId === 'string' ? record.sessionId : null };
  });
}

function normalizeSupport(payload: unknown): SupportMessage[] {
  const list = isRecord(payload) && Array.isArray(payload.supportMessages) ? payload.supportMessages : [];
  return list.map((item): SupportMessage => {
    const record = isRecord(item) ? item : {};
    const metadata = isRecord(record.metadata) ? record.metadata : {};
    const user = isRecord(record.user) ? record.user : {};
    return {
      id: String(record.id || crypto.randomUUID()),
      phone: String(metadata.phone || user.phone || '—'),
      transactionCode: typeof metadata.transactionCode === 'string' ? metadata.transactionCode : null,
      message: String(metadata.message || record.action || 'No message content'),
      createdAt: String(record.createdAt || new Date().toISOString()),
      userName: String(user.name || user.email || 'Customer'),
    };
  });
}

async function request<T>(path: string, fallback: T, attempts = 2): Promise<ApiResult<T>> {
  let lastError = 'Request failed';
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    try {
      const token = window.localStorage.getItem('admin-token') || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
      const response = await fetch(`${baseUrl()}${path}`, { signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as T;
      return { data, source: 'live' };
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : 'Request failed';
      if (attempt + 1 < attempts) await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
    } finally {
      window.clearTimeout(timeout);
    }
  }
  return { data: fallback, source: 'offline', error: lastError };
}

function baseUrl(): string {
  return DEFAULT_BASE_URL.replace(/\/+$/, '');
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

function isAbortError(error: unknown): boolean {
  const msg = normalizeError(error).toLowerCase();
  return msg.includes('aborted') || msg.includes('canceled');
}

const DEFAULT_TIMEOUT = 7000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 300;

async function request<T>(path: string, fallback: T, attempts = DEFAULT_RETRIES): Promise<ApiResult<T>> {
  let lastError = 'Request failed';

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const token = window.localStorage.getItem('admin-token') || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${baseUrl()}${path}`, {
        signal: controller.signal,
        headers,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}${errText ? `: ${errText}` : ''}`);
      }

      const data = (await response.json()) as T;
      return { data, source: 'live' };
    } catch (error: unknown) {
      lastError = normalizeError(error);

      // Don't retry on 4xx errors (client errors) except 408 (timeout)
      if (lastError.includes('HTTP 4') && !lastError.includes('408')) {
        break;
      }

      if (attempt + 1 < attempts) {
        const delay = DEFAULT_RETRY_DELAY * (2 ** attempt) + Math.random() * 100;
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return { data: fallback, source: 'offline', error: lastError };
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  const [overview, users, transactions, packages, router, health, support] = await Promise.all([
    request<Overview>('/admin/overview', fallbackOverview),
    request<unknown>('/admin/users', fallbackUsers),
    request<unknown>('/transactions', { transactions: fallbackTransactions }),
    request<unknown>('/packages', { packages: fallbackPackages }),
    request<RouterStatus>('/admin/router-status', fallbackRouter),
    request<Health>('/health', fallbackHealth),
    request<unknown>('/support', { supportMessages: fallbackSupport }),
  ]);
  return {
    overview,
    users: { ...users, data: users.source === 'live' ? normalizeUsers(users.data) : fallbackUsers },
    transactions: { ...transactions, data: transactions.source === 'live' ? normalizeTransactions(transactions.data) : fallbackTransactions },
    packages: { ...packages, data: packages.source === 'live' ? normalizePackages(packages.data) : fallbackPackages },
    router,
    health: health.source === 'live' && isRecord(health.data) && 'status' in health.data ? health as ApiResult<Health> : { data: fallbackHealth, source: health.source, error: health.error },
    support: { ...support, data: support.source === 'live' ? normalizeSupport(support.data) : fallbackSupport },
  };
}

export async function getSupportMessages(): Promise<ApiResult<SupportMessage[]>> {
  const result = await request<unknown>('/support', { supportMessages: fallbackSupport });
  return { ...result, data: result.source === 'live' ? normalizeSupport(result.data) : fallbackSupport };
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'expired';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatKes(amount: number): string {
  return `${amount.toLocaleString('en-KE')} KES`;
}

export async function fetchOverview(): Promise<ApiResult<Overview>> {
  return request<Overview>('/admin/overview', fallbackOverview);
}

export async function fetchUsers(): Promise<ApiResult<UserRecord[]>> {
  return request<unknown>('/admin/users', { users: fallbackUsers }).then((result) => ({
    ...result,
    data: result.source === 'live' ? normalizeUsers(result.data.users) : fallbackUsers,
  }));
}

export async function fetchTransactions(): Promise<ApiResult<TransactionRecord[]>> {
  return request<unknown>('/transactions', { transactions: fallbackTransactions }).then((result) => ({
    ...result,
    data: result.source === 'live' ? normalizeTransactions(result.data.transactions) : fallbackTransactions,
  }));
}

export async function fetchPackages(): Promise<ApiResult<PackageRecord[]>> {
  return request<unknown>('/packages', { packages: fallbackPackages }).then((result) => ({
    ...result,
    data: result.source === 'live' ? normalizePackages(result.data.packages) : fallbackPackages,
  }));
}

export async function fetchRouterStatus(): Promise<ApiResult<RouterStatus>> {
  return request<RouterStatus>('/admin/router-status', { adapter: 'Mock', status: 'offline', latencyMs: null, activeSessions: 0, stream: 'offline' });
}

export async function fetchHealth(): Promise<ApiResult<Health>> {
  return request<Health>('/health', fallbackHealth);
}

export async function fetchSupportMessages(): Promise<ApiResult<SupportMessage[]>> {
  return request<unknown>('/support', { supportMessages: fallbackSupport }).then((result) => ({
    ...result,
    data: result.source === 'live' ? normalizeSupport(result.data.supportMessages) : fallbackSupport,
  }));
}

// Type guards
export function isSourceLive(result: ApiResult<any>): result is ApiResult<any> & { source: 'live' } {
  return result.source === 'live';
}

export function hasError(result: ApiResult<any>): boolean {
  return !!result.error;
}
