'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Lock,
  Play,
  Settings2,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { RouterStatus } from '@/lib/admin-api';

type AdapterId = 'MikroTik' | 'CoovaChilli' | 'Mock';

type MikroTikConfig = {
  host: string;
  apiPort: number;
  useSsl: boolean;
  username: string;
  password: string;
  showPassword: boolean;
  hotspotProfile: string;
};

type CoovaChilliConfig = {
  nasIp: string;
  uamSecret: string;
  radiusAuthPort: number;
  radiusAcctPort: number;
  radiusSecret: string;
  showRadiusSecret: boolean;
  coaPort: number;
};

type MockConfig = {
  latencyMs: number;
  failureRate: number;
  autoApprove: boolean;
  connectedClients: number;
};

type AdapterConfig = {
  MikroTik: MikroTikConfig;
  CoovaChilli: CoovaChilliConfig;
  Mock: MockConfig;
};

type TestResult = {
  status: 'reachable' | 'unreachable' | 'simulated' | null;
  latencyMs: number | null;
  version: string | null;
  checkedAt: string | null;
  loading: boolean;
};

type AdapterConfigDrawerProps = {
  adapter: AdapterId;
  isOpen: boolean;
  onClose: () => void;
  config: AdapterConfig[AdapterId];
  onConfigChange: (adapter: AdapterId, config: AdapterConfig[AdapterId]) => void;
  testResult: TestResult | null;
  onTestConnection: (adapter: AdapterId) => void;
};

const defaultMikroTik: MikroTikConfig = {
  host: '192.168.1.1',
  apiPort: 8728,
  useSsl: false,
  username: 'admin',
  password: '',
  showPassword: false,
  hotspotProfile: 'hs-profile-1',
};

const defaultCoovaChilli: CoovaChilliConfig = {
  nasIp: '192.168.1.1',
  uamSecret: '',
  radiusAuthPort: 1812,
  radiusAcctPort: 1813,
  radiusSecret: '',
  showRadiusSecret: false,
  coaPort: 3799,
};

const defaultMock: MockConfig = {
  latencyMs: 50,
  failureRate: 0,
  autoApprove: true,
  connectedClients: 0,
};

function hasMikroTikCredentials(cfg: MikroTikConfig): boolean {
  return Boolean(cfg.host.trim() && cfg.username.trim() && cfg.password.trim());
}

function hasCoovaChilliCredentials(cfg: CoovaChilliConfig): boolean {
  return Boolean(cfg.nasIp.trim() && cfg.uamSecret.trim() && cfg.radiusSecret.trim());
}

export default function AdapterConfigDrawer({
  adapter,
  isOpen,
  onClose,
  config,
  onConfigChange,
  testResult,
  onTestConnection,
}: AdapterConfigDrawerProps) {
  const [localConfig, setLocalConfig] = useState<AdapterConfig[AdapterId]>(config);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === backdropRef.current) onClose();
    },
    [onClose]
  );

  const handleSave = useCallback(() => {
    onConfigChange(adapter, localConfig);
    onClose();
  }, [adapter, localConfig, onConfigChange, onClose]);

  const handleTest = useCallback(() => {
    onTestConnection(adapter);
  }, [adapter, onTestConnection]);

  const credentialsValid = adapter === 'MikroTik' ? hasMikroTikCredentials(localConfig as MikroTikConfig) : hasCoovaChilliCredentials(localConfig as CoovaChilliConfig);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            ref={backdropRef}
            className="fixed inset-0 z-40 bg-ink/80 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />
          <motion.div
            initial={{ translateY: 40, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: 40, opacity: 0 }}
            className="fixed left-0 top-0 h-full w-full md:w-[520px] z-50 bg-panel border-r border-white/10 transform transition duration-300"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-electric/10 text-electric">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-white">{adapter} configuration</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">hotspot adapter credentials</div>
                </div>
              </div>
              <button
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                onClick={onClose}
                aria-label="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-3rem)]">
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                {adapter === 'MikroTik' && (
                  <section className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">host ip / domain</label>
                      <input
                        value={(localConfig as MikroTikConfig).host}
                        onChange={(e) => setLocalConfig({ ...localConfig, host: e.target.value } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        placeholder="192.168.1.1"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500">api port</label>
                        <input
                          type="number"
                          value={(localConfig as MikroTikConfig).apiPort}
                          onChange={(e) => setLocalConfig({ ...localConfig, apiPort: parseInt(e.target.value, 10) || 8728 } as AdapterConfig[AdapterId])}
                          className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        />
                      </div>
                      <div className="space-y-2 flex items-end">
                        <button
                          onClick={() =>
                            setLocalConfig({
                              ...localConfig,
                              useSsl: !(localConfig as MikroTikConfig).useSsl,
                            } as AdapterConfig[AdapterId])
                          }
                          className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                            (localConfig as MikroTikConfig).useSsl ? 'border-electric/40 bg-electric/10 text-electric' : 'border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {(localConfig as MikroTikConfig).useSsl ? 'ssl on' : 'ssl off'} ({(localConfig as MikroTikConfig).useSsl ? 8729 : 8728})
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">username</label>
                      <input
                        value={(localConfig as MikroTikConfig).username}
                        onChange={(e) => setLocalConfig({ ...localConfig, username: e.target.value } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs uppercase tracking-wider text-slate-500">password</label>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalConfig({
                              ...localConfig,
                              showPassword: !(localConfig as MikroTikConfig).showPassword,
                            } as AdapterConfig[AdapterId])
                          }
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          {(localConfig as MikroTikConfig).showPassword ? 'hide' : 'show'}
                        </button>
                      </div>
                      <input
                        type={(localConfig as MikroTikConfig).showPassword ? 'text' : 'password'}
                        value={(localConfig as MikroTikConfig).password}
                        onChange={(e) => setLocalConfig({ ...localConfig, password: e.target.value } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">hotspot server profile</label>
                      <input
                        value={(localConfig as MikroTikConfig).hotspotProfile}
                        onChange={(e) => setLocalConfig({ ...localConfig, hotspotProfile: e.target.value } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        placeholder="hs-profile-1"
                      />
                    </div>
                  </section>
                )}

                {adapter === 'CoovaChilli' && (
                  <section className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">controller host / nas ip</label>
                      <input
                        value={(localConfig as CoovaChilliConfig).nasIp}
                        onChange={(e) => setLocalConfig({ ...localConfig, nasIp: e.target.value } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        placeholder="192.168.1.1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">uam secret</label>
                      <input
                        value={(localConfig as CoovaChilliConfig).uamSecret}
                        onChange={(e) => setLocalConfig({ ...localConfig, uamSecret: e.target.value } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500">radius auth port</label>
                        <input
                          type="number"
                          value={(localConfig as CoovaChilliConfig).radiusAuthPort}
                          onChange={(e) => setLocalConfig({ ...localConfig, radiusAuthPort: parseInt(e.target.value, 10) || 1812 } as AdapterConfig[AdapterId])}
                          className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500">radius acct port</label>
                        <input
                          type="number"
                          value={(localConfig as CoovaChilliConfig).radiusAcctPort}
                          onChange={(e) => setLocalConfig({ ...localConfig, radiusAcctPort: parseInt(e.target.value, 10) || 1813 } as AdapterConfig[AdapterId])}
                          className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500">coa port</label>
                        <input
                          type="number"
                          value={(localConfig as CoovaChilliConfig).coaPort}
                          onChange={(e) => setLocalConfig({ ...localConfig, coaPort: parseInt(e.target.value, 10) || 3799 } as AdapterConfig[AdapterId])}
                          className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs uppercase tracking-wider text-slate-500">radius shared secret</label>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalConfig({
                              ...localConfig,
                              showRadiusSecret: !(localConfig as CoovaChilliConfig).showRadiusSecret,
                            } as AdapterConfig[AdapterId])
                          }
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          {(localConfig as CoovaChilliConfig).showRadiusSecret ? 'hide' : 'show'}
                        </button>
                      </div>
                      <input
                        type={(localConfig as CoovaChilliConfig).showRadiusSecret ? 'text' : 'password'}
                        value={(localConfig as CoovaChilliConfig).radiusSecret}
                        onChange={(e) => setLocalConfig({ ...localConfig, radiusSecret: e.target.value } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                      />
                    </div>
                  </section>
                )}

                {adapter === 'Mock' && (
                  <section className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">simulated latency (ms)</label>
                      <input
                        type="number"
                        min="0"
                        value={(localConfig as MockConfig).latencyMs}
                        onChange={(e) => setLocalConfig({ ...localConfig, latencyMs: parseInt(e.target.value, 10) || 0 } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">simulated failure rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={(localConfig as MockConfig).failureRate}
                        onChange={(e) => setLocalConfig({ ...localConfig, failureRate: parseInt(e.target.value, 10) || 0 } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                      />
                    </div>
                    <div className="space-y-2 flex items-center gap-2">
                      <button
                        onClick={() =>
                          setLocalConfig({
                            ...localConfig,
                            autoApprove: !(localConfig as MockConfig).autoApprove,
                          } as AdapterConfig[AdapterId])
                        }
                        className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                          (localConfig as MockConfig).autoApprove ? 'border-lime/30 bg-lime/10 text-lime' : 'border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {(localConfig as MockConfig).autoApprove ? 'auto-approve on' : 'auto-approve off'}
                      </button>
                      <span className="text-xs text-slate-500">m-pesa stk / voucher sessions</span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">mock connected clients</label>
                      <input
                        type="number"
                        min="0"
                        value={(localConfig as MockConfig).connectedClients}
                        onChange={(e) => setLocalConfig({ ...localConfig, connectedClients: parseInt(e.target.value, 10) || 0 } as AdapterConfig[AdapterId])}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                      />
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="h-4 w-4 text-yellow" />
                        <div>
                          <div className="text-xs text-slate-400">mock sandbox</div>
                          <div className="text-xs font-medium text-white">no real router credentials required</div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-6">
                  <button
                    type="button"
                    disabled={testResult?.loading}
                    onClick={handleTest}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${
                      testResult?.loading
                        ? 'border-white/10 text-slate-400'
                        : credentialsValid
                          ? 'border-network/30 bg-network/10 text-network hover:bg-network/20'
                          : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {testResult?.loading ? (
                      <Activity className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {testResult?.loading ? 'testing…' : 'test connection'}
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-electric px-5 py-2 text-sm font-semibold text-ink"
                  >
                    <ArrowRight className="h-4 w-4" /> apply config
                  </button>
                </div>
              </form>

              {testResult && !testResult.loading && (
                <section className="mt-6 rounded-xl border border-white/10 bg-white/[.02] p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">connection test result</h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">status</span>
                      <span className={`font-medium ${testResult.status === 'reachable' || testResult.status === 'simulated' ? 'text-network' : 'text-signal'}`}>
                        {testResult.status === 'reachable' ? 'reachable' : testResult.status === 'simulated' ? 'simulated ok' : 'unreachable'}
                      </span>
                    </div>
                    {testResult.latencyMs !== null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">latency</span>
                        <span className="font-medium text-white">{testResult.latencyMs} ms</span>
                      </div>
                    )}
                    {testResult.version && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">version</span>
                        <span className="font-mono text-slate-300">{testResult.version}</span>
                      </div>
                    )}
                    {testResult.checkedAt && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">checked at</span>
                        <span className="font-mono text-slate-300 text-[10px]">{new Date(testResult.checkedAt).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {!credentialsValid && adapter !== 'Mock' && (
                <section className="mt-4 rounded-xl border border-signal/30 bg-signal/10 p-4">
                  <ShieldAlert className="h-4 w-4 text-signal" />
                  <div className="ml-1 mt-1 text-xs text-slate-400">
                    no credentials configured for {adapter}. switching to this adapter may disrupt hotspot services.
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
