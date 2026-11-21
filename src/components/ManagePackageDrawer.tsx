'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Circle,
  Copy,
  Delete,
  Plus,
  Save,
  Settings2,
  X,
} from 'lucide-react';
import type { PackageRecord } from '@/lib/admin-api';

type StatusValue = 'active' | 'inactive' | 'hidden';
type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';
type DataCapMode = 'unlimited' | 'capped';
type DataUnit = 'MB' | 'GB';
type ValidityMode = 'continuous' | 'active-connection';

const SPEED_PRESETS = [5, 10, 15, 25] as const;

type PackageFormData = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  status: StatusValue;
  price: number;
  currency: string;
  speedMbps: number;
  downloadMbps: number;
  uploadMbps: number;
  durationValue: number;
  durationUnit: DurationUnit;
  dataCap: DataCapMode;
  dataCapValue: number;
  dataCapUnit: DataUnit;
  maxDevices: number;
  radiusProfileName: string;
  burstSpeed: number | null;
  burstThreshold: number | null;
  fupEnabled: boolean;
  featured: boolean;
  badgeLabel: string;
  sortOrder: number;
  validityMode: ValidityMode;
  autoDisconnect: boolean;
};

type ManagePackageDrawerProps = {
  packageItem: PackageRecord;
  isOpen: boolean;
  onClose: () => void;
  onSave: (next: PackageRecord) => void;
  onDuplicate: (next: PackageRecord) => void;
  onDelete: (id: string) => void;
};

const emptyForm: PackageFormData = {
  id: '',
  name: '',
  subtitle: '',
  description: '',
  status: 'active',
  price: 0,
  currency: 'KES',
  speedMbps: 5,
  downloadMbps: 5,
  uploadMbps: 5,
  durationValue: 60,
  durationUnit: 'minutes',
  dataCap: 'unlimited',
  dataCapValue: 0,
  dataCapUnit: 'MB',
  maxDevices: 1,
  radiusProfileName: '',
  burstSpeed: null,
  burstThreshold: null,
  fupEnabled: false,
  featured: false,
  badgeLabel: 'Best Value',
  sortOrder: 0,
  validityMode: 'continuous',
  autoDisconnect: false,
};

function fromRecord(record: PackageRecord): PackageFormData {
  const durationUnit: DurationUnit =
    record.durationMin >= 10080 ? 'weeks' : record.durationMin >= 1440 ? 'days' : record.durationMin >= 60 ? 'hours' : 'minutes';
  let durationValue = record.durationMin;
  if (durationUnit === 'weeks') durationValue = record.durationMin / 10080;
  else if (durationUnit === 'days') durationValue = record.durationMin / 1440;
  else if (durationUnit === 'hours') durationValue = record.durationMin / 60;

  return {
    id: record.id,
    name: record.name,
    subtitle: record.description,
    description: record.description,
    status: record.isActive ? 'active' : 'inactive',
    price: record.price,
    currency: record.currency,
    speedMbps: record.speedMbps,
    downloadMbps: record.speedMbps,
    uploadMbps: record.speedMbps,
    durationValue,
    durationUnit,
    dataCap: record.dataLimitMB === null ? 'unlimited' : 'capped',
    dataCapValue: record.dataLimitMB ?? 0,
    dataCapUnit: 'MB',
    maxDevices: record.maxDevices,
    radiusProfileName: '',
    burstSpeed: null,
    burstThreshold: null,
    fupEnabled: false,
    featured: false,
    badgeLabel: 'Best Value',
    sortOrder: 0,
    validityMode: 'continuous',
    autoDisconnect: false,
  };
}

function toRecord(form: PackageFormData): PackageRecord {
  let durationMin = 0;
  if (form.durationUnit === 'minutes') durationMin = Math.max(1, Math.round(form.durationValue));
  else if (form.durationUnit === 'hours') durationMin = Math.max(1, Math.round(form.durationValue * 60));
  else if (form.durationUnit === 'days') durationMin = Math.max(1, Math.round(form.durationValue * 1440));
  else if (form.durationUnit === 'weeks') durationMin = Math.max(1, Math.round(form.durationValue * 10080));

  const dataLimitMB = form.dataCap === 'capped' ? Math.max(0, Math.round(form.dataCapValue * (form.dataCapUnit === 'GB' ? 1024 : 1))) : null;

  return {
    id: form.id,
    name: form.name,
    description: form.subtitle || form.description,
    dataLimitMB,
    durationMin,
    speedMbps: form.speedMbps,
    maxDevices: Math.max(1, Math.min(10, form.maxDevices)),
    price: Math.max(0, Math.round(form.price)),
    currency: form.currency,
    isActive: form.status === 'active',
  };
}

export default function ManagePackageDrawer({
  packageItem,
  isOpen,
  onClose,
  onSave,
  onDuplicate,
  onDelete,
}: ManagePackageDrawerProps) {
  const [form, setForm] = useState<PackageFormData>(() => fromRecord(packageItem));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(fromRecord(packageItem));
      setErrors({});
    }
  }, [isOpen, packageItem]);

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

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = 'Package name is required';
    if (form.price < 0 || !Number.isInteger(form.price)) next.price = 'Price must be a positive whole number';
    if (form.dataCap === 'capped' && (form.dataCapValue <= 0 || !Number.isInteger(form.dataCapValue)))
      next.dataCapValue = 'Data cap must be a positive whole number';
    if (form.maxDevices < 1 || form.maxDevices > 10 || !Number.isInteger(form.maxDevices))
      next.maxDevices = 'Device slots must be between 1 and 10';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

  const handleInput = useCallback((field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }, [errors]);

  const handleSave = useCallback(() => {
    if (!validate()) return;
    setSaving(true);
    const next = toRecord(form);
    onSave(next);
    setToast({ message: `Package "${next.name}" saved`, type: 'success' });
    setSaving(false);
  }, [form, validate, onSave]);

  const handleDuplicate = useCallback(() => {
    if (!validate()) return;
    const clone = toRecord(form);
    const cloned: PackageRecord = { ...clone, id: `pkg_${Date.now()}`, name: `${clone.name} (Copy)`, isActive: false };
    onDuplicate(cloned);
    setToast({ message: `Package duplicated as "${cloned.name}"`, type: 'success' });
  }, [form, validate, onDuplicate]);

  const handleDelete = useCallback(() => {
    if (window.confirm(`Archive package "${form.name}"? This cannot be undone.`)) {
      onDelete(form.id);
      onClose();
      setToast({ message: `Package "${form.name}" archived`, type: 'success' });
    }
  }, [form.id, form.name, onDelete, onClose]);

  const handleReset = useCallback(() => {
    setForm(fromRecord(packageItem));
    setErrors({});
  }, [packageItem]);

  const closeDrawer = useCallback(() => {
    onClose();
  }, [onClose]);

  const durationUnitLabel = useMemo(() => {
    const labels: Record<DurationUnit, string> = { minutes: 'Minutes', hours: 'Hours', days: 'Days', weeks: 'Weeks' };
    return labels[form.durationUnit];
  }, [form.durationUnit]);

  const speedPresetActive = useMemo(() => SPEED_PRESETS.includes(form.speedMbps as never), [form.speedMbps]);

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
                  <div className="font-semibold text-white">{form.name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{form.id}</div>
                </div>
              </div>
              <button
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-3rem)]">
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                <section className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">package name</label>
                      <input
                        value={form.name}
                        onChange={(e) => handleInput('name', e.target.value)}
                        className={`rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none ${errors.name ? 'border-signal' : 'border-white/10 bg-white/5'}`}
                        placeholder="e.g. 24 Hours 1 Device"
                      />
                      {errors.name && <span className="text-[10px] text-signal">{errors.name}</span>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">display subtitle</label>
                      <input
                        value={form.subtitle}
                        onChange={(e) => handleInput('subtitle', e.target.value)}
                        className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        placeholder="short descriptor"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-slate-500">status</label>
                    <div className="flex gap-2">
                      {(['active', 'inactive', 'hidden'] as const).map((value) => (
                        <button
                          key={value}
                          onClick={() => handleInput('status', value)}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            form.status === value
                              ? 'border-electric/40 bg-electric/10 text-electric'
                              : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          {value.charAt(0).toUpperCase() + value.slice(1)}
                        </button>
                      ))}
                    </div>
                    {errors.status && <span className="text-[10px] text-signal">{errors.status}</span>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-wider text-slate-500">price (KES)</label>
                      <span className={`text-xs font-semibold ${statusTone(form.status === 'active' ? 'ACTIVE' : 'INACTIVE')}`}>
                        {form.currency} {form.price}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={(e) => handleInput('price', parseInt(e.target.value, 10) || 0)}
                      className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                    />
                    {errors.price && <span className="text-[10px] text-signal">{errors.price}</span>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-slate-500">bandwidth speed limit</label>
                    <div className="flex gap-2 wrap-presets">
                      {SPEED_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          onClick={() => {
                            handleInput('speedMbps', preset);
                            handleInput('downloadMbps', preset);
                            handleInput('uploadMbps', preset);
                          }}
                          className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            form.speedMbps === preset
                              ? 'border-electric/40 bg-electric/10 text-electric'
                              : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          {preset} Mbps
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          const custom = window.prompt('Custom Mbps (download/upload):', `${form.downloadMbps}/${form.uploadMbps}`);
                          if (!custom) return;
                          const [down, up] = custom.split('/').map(Number);
                          if (Number.isFinite(down) && Number.isFinite(up)) {
                            handleInput('speedMbps', down);
                            handleInput('downloadMbps', down);
                            handleInput('uploadMbps', up);
                          }
                        }}
                        className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:border-white/20 hover:text-white"
                      >
                        custom
                      </button>
                    </div>
                    {errors.speedMbps && <span className="text-[10px] text-signal">{errors.speedMbps}</span>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">session duration</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={form.durationValue}
                          onChange={(e) => handleInput('durationValue', parseFloat(e.target.value) || 1)}
                          className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5 w-20"
                        />
                        <select
                          value={form.durationUnit}
                          onChange={(e) => handleInput('durationUnit', e.target.value as DurationUnit)}
                          className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                        >
                          {(['minutes', 'hours', 'days', 'weeks'] as const).map((unit) => (
                            <option key={unit} value={unit}>
                              {unit.charAt(0).toUpperCase() + unit.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wider text-slate-500">data cap</label>
                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() => handleInput('dataCap', 'unlimited')}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            form.dataCap === 'unlimited'
                              ? 'border-network/30 bg-network/10 text-network'
                              : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          unlimited
                        </button>
                        <button
                          onClick={() => handleInput('dataCap', 'capped')}
                          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                            form.dataCap === 'capped'
                              ? 'border-signal/30 bg-signal/10 text-signal'
                              : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                          }`}
                        >
                          capped
                        </button>
                      </div>
                      {form.dataCap === 'capped' && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            value={form.dataCapValue}
                            onChange={(e) => handleInput('dataCapValue', parseInt(e.target.value, 10) || 1)}
                            className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5 w-24"
                          />
                          <select
                            value={form.dataCapUnit}
                            onChange={(e) => handleInput('dataCapUnit', e.target.value as DataUnit)}
                            className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                          >
                            <option value="MB">MB</option>
                            <option value="GB">GB</option>
                          </select>
                        </div>
                      )}
                      {errors.dataCapValue && <span className="text-[10px] text-signal">{errors.dataCapValue}</span>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-slate-500">max device slots</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleInput('maxDevices', Math.max(1, form.maxDevices - 1))}
                        className="rounded-xl border border-white/10 p-2 text-slate-300 hover:text-white hover:border-white/20"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-semibold text-white min-w-[2rem] text-center">{form.maxDevices}</span>
                      <button
                        onClick={() => handleInput('maxDevices', Math.min(10, form.maxDevices + 1))}
                        className="rounded-xl border border-white/10 p-2 text-slate-300 hover:text-white hover:border-white/20"
                      >
                        <Plus />
                      </button>
                    </div>
                    {errors.maxDevices && <span className="text-[10px] text-signal">{errors.maxDevices}</span>}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between cursor-pointer group" onClick={() => setAdvancedOpen(!advancedOpen)}>
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded-full border ${advancedOpen ? 'border-electric text-electric' : 'border-white/5 text-slate-500'}`}>
                        {advancedOpen ? <Minus /> : <Plus />}
                      </div>
                      <h3 className="font-semibold text-white">advanced router &amp; captive portal</h3>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {advancedOpen && (
                    <div className="space-y-4 border-t border-white/10 pt-4">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500">mikrotik / radius profile name</label>
                        <input
                          value={form.radiusProfileName}
                          onChange={(e) => handleInput('radiusProfileName', e.target.value)}
                          className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                          placeholder="hotspot profile name"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs uppercase tracking-wider text-slate-500">burst / fup</label>
                          <button
                            onClick={() => handleInput('fupEnabled', !form.fupEnabled)}
                            className={`relative inline-block h-6 w-11 rounded-full transition ${form.fupEnabled ? 'bg-electric' : 'bg-white/10'}`}
                          >
                            <span
                              className={`block h-4 w-4 rounded-full bg-white ${form.fupEnabled ? 'translate-x-5' : 'translate-x-1'}`}
                            />
                          </button>
                        </div>
                        {form.fupEnabled && (
                          <div className="grid gap-2 sm:grid-cols-2 pl-4">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500">burst rate (mbps)</label>
                              <input
                                type="number"
                                value={form.burstSpeed ?? ''}
                                onChange={(e) => handleInput('burstSpeed', parseInt(e.target.value, 10) || null)}
                                className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500">threshold (mb)</label>
                              <input
                                type="number"
                                value={form.burstThreshold ?? ''}
                                onChange={(e) => handleInput('burstThreshold', parseInt(e.target.value, 10) || null)}
                                className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500">captive portal merchandising</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleInput('featured', !form.featured)}
                            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                              form.featured ? 'border-electric/40 bg-electric/10 text-electric' : 'border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            featured / popular
                          </button>
                        </div>
                        {form.featured && (
                          <div className="grid gap-2 sm:grid-cols-2 pl-4">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500">badge label</label>
                              <input
                                value={form.badgeLabel}
                                onChange={(e) => handleInput('badgeLabel', e.target.value)}
                                className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500">sort order</label>
                              <input
                                type="number"
                                value={form.sortOrder}
                                onChange={(e) => handleInput('sortOrder', parseInt(e.target.value, 10) || 0)}
                                className="rounded-xl border px-3 py-2 text-sm text-white focus:border-electric/60 outline-none border-white/10 bg-white/5"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500">validity / grace period</label>
                        <div className="space-y-2">
                          <button
                            onClick={() => handleInput('validityMode', 'continuous')}
                            className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm text-left transition ${
                              form.validityMode === 'continuous'
                                ? 'border-electric/40 bg-electric/10 text-electric'
                                : 'border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>continuous from purchase</span>
                            {form.validityMode === 'continuous' && <Circle className="h-3 w-3 fill-electric" />}
                          </button>
                          <button
                            onClick={() => handleInput('validityMode', 'active-connection')}
                            className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-sm text-left transition ${
                              form.validityMode === 'active-connection'
                                ? 'border-electric/40 bg-electric/10 text-electric'
                                : 'border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>during active connection only</span>
                            {form.validityMode === 'active-connection' && <Circle className="h-3 w-3 fill-electric" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleInput('autoDisconnect', !form.autoDisconnect)}
                            className={`relative inline-block h-5 w-9 rounded-full transition ${form.autoDisconnect ? 'bg-electric' : 'bg-white/10'}`}
                          >
                            <span
                              className={`block h-3 w-3 rounded-full bg-white ${form.autoDisconnect ? 'translate-x-4' : 'translate-x-1'}`}
                            />
                          </button>
                          <label className="text-xs text-slate-400">auto-disconnect on expiry</label>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-6">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 disabled:opacity-50 hover:text-white hover:border-white/20"
                    >
                      <X className="h-4 w-4" /> reset
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplicate}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-yellow disabled:opacity-50 hover:text-yellow hover:border-yellow/20"
                    >
                      <Copy className="h-4 w-4" /> duplicate
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-xl border border-signal/30 px-4 py-2 text-sm text-signal disabled:opacity-50 hover:bg-signal/10 hover:text-signal"
                    >
                      <Delete className="h-4 w-4" /> archive
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-electric px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> {saving ? 'saving…' : 'save changes'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>

          {toast && (
            <motion.div
              initial={{ translateY: 20, opacity: 0 }}
              animate={{ translateY: 0, opacity: 1 }}
              exit={{ translateY: 20, opacity: 0 }}
              className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg border-${toast.type === 'success' ? 'network' : 'signal'}/30 bg-${toast.type === 'success' ? 'network' : 'signal'}/10 text-${toast.type === 'success' ? 'network' : 'signal'}`}
            >
              <div className={`h-3 w-3 rounded-full bg-${toast.type === 'success' ? 'network' : 'signal'}`} />
              <span className="font-medium">{toast.message}</span>
              <button
                className="rounded p-1 text-current hover:bg-white/10"
                onClick={() => setToast(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

function statusTone(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'COMPLETED' || normalized === 'PAID') return 'text-network';
  if (normalized === 'PENDING') return 'text-yellow';
  return 'text-signal';
}

function Minus() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" x2="19" y1="12" y2="12"/></svg>;
}
