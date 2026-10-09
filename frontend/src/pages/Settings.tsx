import React, { useState, useEffect, useCallback } from 'react';
import { apiSettings, apiControl } from '../services/api';
import {
  AlertThreshold,
  BatteryConfig,
  BuildingConfig,
  ControlPolicy,
  VNMSharingRule,
  CriticalityTier,
} from '../types';
import { VNMConfigForm } from '../components/VNMConfigForm';
import { EmergencyStopModal } from '../components/EmergencyStopModal';
import {
  Settings as SettingsIcon,
  ShieldAlert,
  Sliders,
  Bell,
  Building,
  BatteryCharging,
  Scale,
  Save,
  CheckCircle2,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'policy' | 'vnm' | 'alerts' | 'buildings' | 'battery'>('policy');
  const [policy, setPolicy] = useState<ControlPolicy>({
    closed_loop_enabled: false,
    emergency_stop_active: false,
    cost_weight: 0.7,
    carbon_weight: 0.3,
    decision_cycle_seconds: 60,
  });
  const [alertThresholds, setAlertThresholds] = useState<AlertThreshold[]>([]);
  const [buildings, setBuildings] = useState<BuildingConfig[]>([]);
  const [batteryConfigs, setBatteryConfigs] = useState<BatteryConfig[]>([]);
  const [vnmRules, setVnmRules] = useState<VNMSharingRule[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ success: boolean; text: string } | null>(null);

  const fetchAllSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, a, b, bat, v] = await Promise.all([
        apiSettings.getControlPolicy().catch(() => ({
          closed_loop_enabled: false,
          emergency_stop_active: false,
          cost_weight: 0.7,
          carbon_weight: 0.3,
          decision_cycle_seconds: 60,
        })),
        apiSettings.getAlertThresholds().catch(() => [
          {
            id: 1,
            metric_name: 'total_campus_demand_kw',
            threshold_value: 170.0,
            unit: 'kW',
            severity: 'warning' as const,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            id: 2,
            metric_name: 'bess_01.soc_percent',
            threshold_value: 20.0,
            unit: '%',
            severity: 'critical' as const,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            id: 3,
            metric_name: 'inverter_temperature_celsius',
            threshold_value: 65.0,
            unit: '°C',
            severity: 'warning' as const,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
        ]),
        apiSettings.getBuildingTiers().catch(() => [
          {
            id: 1,
            asset_id: 'bldg_academic_a',
            building_name: 'Academic Block A',
            criticality_tier: 'essential' as CriticalityTier,
            peak_load_kw: 60.0,
            updated_at: new Date().toISOString(),
          },
          {
            id: 2,
            asset_id: 'bldg_library',
            building_name: 'Central Library',
            criticality_tier: 'non_critical' as CriticalityTier,
            peak_load_kw: 40.0,
            updated_at: new Date().toISOString(),
          },
          {
            id: 3,
            asset_id: 'bldg_server_room',
            building_name: 'Data Center & Server Room',
            criticality_tier: 'critical' as CriticalityTier,
            peak_load_kw: 30.0,
            updated_at: new Date().toISOString(),
          },
        ]),
        apiSettings.getBatteryConfigs().catch(() => [
          {
            id: 1,
            asset_id: 'bess_01',
            min_soc: 10.0,
            max_soc: 95.0,
            reserve_floor: 20.0,
            max_charge_power_kw: 50.0,
            max_discharge_power_kw: 50.0,
            round_trip_efficiency: 0.92,
            health_floor: 70.0,
            updated_at: new Date().toISOString(),
          },
        ]),
        apiSettings.getVnmRules().catch(() => [
          {
            id: 1,
            building_asset_id: 'bldg_academic_a',
            sharing_ratio: 0.5,
            rule_version: 1,
            jurisdiction: 'India-CEA',
            effective_from: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 2,
            building_asset_id: 'bldg_library',
            sharing_ratio: 0.3,
            rule_version: 1,
            jurisdiction: 'India-CEA',
            effective_from: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 3,
            building_asset_id: 'bldg_server_room',
            sharing_ratio: 0.2,
            rule_version: 1,
            jurisdiction: 'India-CEA',
            effective_from: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]),
      ]);

      setPolicy(p);
      setAlertThresholds(a);
      setBuildings(b);
      setBatteryConfigs(bat);
      setVnmRules(v);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllSettings();
  }, [fetchAllSettings]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      // Send only what this form edits; the emergency stop has its own control and must not be
      // overwritten by a value loaded before someone else triggered it.
      const updated = await apiSettings.updateControlPolicy({
        closed_loop_enabled: policy.closed_loop_enabled,
        cost_weight: policy.cost_weight,
        carbon_weight: policy.carbon_weight,
        decision_cycle_seconds: policy.decision_cycle_seconds,
      });
      setPolicy(updated);
      setStatusMessage({ success: true, text: 'Control policy parameters successfully saved.' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update policy';
      setStatusMessage({ success: false, text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCostWeightChange = (costWeightPct: number) => {
    const cost = Math.max(0, Math.min(100, costWeightPct)) / 100;
    const carbon = Math.round((1.0 - cost) * 100) / 100;
    setPolicy((prev) => ({ ...prev, cost_weight: cost, carbon_weight: carbon }));
  };

  const handleEmergencyStopConfirm = async (active: boolean, reason: string) => {
    setIsSaving(true);
    try {
      const res = await apiControl.setEmergencyStop(active, reason);
      setPolicy((prev) => ({
        ...prev,
        emergency_stop_active: res.emergency_stop_active,
        closed_loop_enabled: res.emergency_stop_active ? false : prev.closed_loop_enabled,
      }));
      setStatusMessage({
        success: true,
        text: active ? 'Emergency Stop Engaged!' : 'Emergency Stop Cleared. Normal Automation Restored.',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVnmRules = async (updatedRules: VNMSharingRule[]) => {
    for (const rule of updatedRules) {
      await apiSettings.updateVnmRule(rule.id, { sharing_ratio: rule.sharing_ratio });
    }
    setVnmRules(updatedRules);
  };

  const handleBuildingTierChange = async (buildingId: string, tier: CriticalityTier) => {
    setBuildings((prev) =>
      prev.map((b) => (b.asset_id === buildingId ? { ...b, criticality_tier: tier } : b))
    );
    try {
      await apiSettings.updateBuildingTier(buildingId, { criticality_tier: tier });
    } catch {
      // ignore
    }
  };

  const handleThresholdValueChange = async (thresholdId: number, val: number) => {
    setAlertThresholds((prev) =>
      prev.map((t) => (t.id === thresholdId ? { ...t, threshold_value: val } : t))
    );
    try {
      await apiSettings.updateAlertThreshold(thresholdId, { threshold_value: val });
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-purple-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Policies</h1>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Administrator configuration for optimization objectives, VNM allocation matrices, and safety bounds
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllSettings}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsEmergencyModalOpen(true)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all active:scale-95 ${
              policy.emergency_stop_active
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>
              {policy.emergency_stop_active ? 'Clear Emergency Stop' : 'EMERGENCY STOP'}
            </span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl border p-4 text-xs font-semibold transition-all ${
            statusMessage.success
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex overflow-x-auto space-x-1 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'policy'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Control Policy</span>
        </button>

        <button
          onClick={() => setActiveTab('vnm')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'vnm'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Virtual Net Metering (VNM)</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'alerts'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Alert Thresholds</span>
        </button>

        <button
          onClick={() => setActiveTab('buildings')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'buildings'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Building Criticality</span>
        </button>

        <button
          onClick={() => setActiveTab('battery')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'battery'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
          }`}
        >
          <BatteryCharging className="h-4 w-4" />
          <span>BESS Operating Limits</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'policy' && (
        <form onSubmit={handleSavePolicy} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Optimization Multi-Objective Weights */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Zap className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Multi-Objective Cost vs Carbon Tradeoff</h3>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between font-bold text-slate-300 mb-1.5">
                    <span>Cost Optimization Weight:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {(policy.cost_weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(policy.cost_weight * 100)}
                    onChange={(e) => handleCostWeightChange(parseInt(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-bold text-slate-300 mb-1.5">
                    <span>Carbon Abatement Weight:</span>
                    <span className="font-mono text-teal-400 font-bold">
                      {(policy.carbon_weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(policy.carbon_weight * 100)}
                    onChange={(e) => handleCostWeightChange(100 - parseInt(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-teal-500"
                  />
                </div>

                <div className="rounded-xl bg-slate-950/60 p-3 text-[11px] text-slate-400 border border-slate-800">
                  Total objective weight constraint: <strong className="text-white">w_cost + w_carbon = 1.00</strong>.
                  Higher cost weight prioritizes TOD tariff arbitrage; higher carbon weight prioritizes local solar self-consumption over grid export.
                </div>
              </div>
            </div>

            {/* Execution Cadence & Closed-Loop Controls */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="h-5 w-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Execution Cadence & Mode</h3>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
                  <div>
                    <div className="font-bold text-slate-200">Closed-Loop Automated Dispatch</div>
                    <div className="text-[11px] text-slate-400">
                      When enabled, inverter setpoints are automatically issued via adapter boundaries.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.closed_loop_enabled}
                    disabled={policy.emergency_stop_active}
                    onChange={(e) =>
                      setPolicy((prev) => ({ ...prev, closed_loop_enabled: e.target.checked }))
                    }
                    className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Decision Cycle Interval (Seconds)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="3600"
                    step="5"
                    value={policy.decision_cycle_seconds}
                    onChange={(e) =>
                      setPolicy((prev) => ({
                        ...prev,
                        decision_cycle_seconds: parseInt(e.target.value) || 60,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/60 p-2.5 font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-teal-400 active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Control Policy'}</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'vnm' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-5">
            <Scale className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Virtual Net Metering (VNM) Sharing Matrix</h2>
          </div>

          <VNMConfigForm initialRules={vnmRules} onSave={handleSaveVnmRules} isSaving={isSaving} />
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Bell className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Configurable Alert Thresholds</h2>
          </div>

          <div className="space-y-3">
            {alertThresholds.map((threshold) => (
              <div
                key={threshold.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-200">{threshold.metric_name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Severity:{' '}
                    <span className="font-bold uppercase text-amber-400">{threshold.severity}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Trigger value:</span>
                  <input
                    type="number"
                    step="0.1"
                    value={threshold.threshold_value}
                    onChange={(e) =>
                      handleThresholdValueChange(threshold.id, parseFloat(e.target.value) || 0)
                    }
                    className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                  <span className="font-mono text-slate-400">{threshold.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'buildings' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Campus Building Criticality Tiers</h2>
          </div>

          <div className="space-y-3">
            {buildings.map((building) => (
              <div
                key={building.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-200">{building.building_name}</div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {building.asset_id} • Peak Load: {building.peak_load_kw} kW
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={building.criticality_tier}
                    onChange={(e) =>
                      handleBuildingTierChange(building.asset_id, e.target.value as CriticalityTier)
                    }
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 font-semibold text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="critical">Tier 1: Critical (No Curtailment)</option>
                    <option value="essential">Tier 2: Essential (Moderate)</option>
                    <option value="non_critical">Tier 3: Non-Critical (Flexible Load)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'battery' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <BatteryCharging className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">BESS Safety Limits & Envelopes</h2>
          </div>

          <div className="space-y-3">
            {batteryConfigs.map((config) => (
              <div
                key={config.id}
                className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs space-y-3"
              >
                <div className="font-bold text-slate-200">Asset: {config.asset_id}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="rounded-xl bg-slate-900 p-2.5 border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-sans font-bold">Min SoC</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">{config.min_soc}%</div>
                  </div>
                  <div className="rounded-xl bg-slate-900 p-2.5 border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-sans font-bold">Max SoC</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">{config.max_soc}%</div>
                  </div>
                  <div className="rounded-xl bg-slate-900 p-2.5 border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-sans font-bold">Reserve Floor</div>
                    <div className="text-sm font-bold text-amber-400 mt-0.5">{config.reserve_floor}%</div>
                  </div>
                  <div className="rounded-xl bg-slate-900 p-2.5 border border-slate-800">
                    <div className="text-[10px] text-slate-500 font-sans font-bold">Efficiency</div>
                    <div className="text-sm font-bold text-emerald-400 mt-0.5">
                      {(config.round_trip_efficiency * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency Stop Confirmation Modal */}
      <EmergencyStopModal
        isOpen={isEmergencyModalOpen}
        isEmergencyStopActive={policy.emergency_stop_active}
        onConfirm={handleEmergencyStopConfirm}
        onClose={() => setIsEmergencyModalOpen(false)}
        isLoading={isSaving}
      />
    </div>
  );
};
