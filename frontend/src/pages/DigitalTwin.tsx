import React, { useEffect, useRef, useState } from 'react';
import { useLiveTwin } from '../hooks/useLiveTwin';
import { AssetRead, AssetType } from '../types';
import { BuildingCard } from '../components/BuildingCard';
import { AssetDetailModal } from '../components/AssetDetailModal';
import { QualityBadge, OperationalStatusBadge } from '../components/StatusBadge';
import { FreshnessIndicator } from '../components/FreshnessIndicator';
import { MLTelemetryController } from '../components/MLTelemetryController';
import {
  RefreshCw,
  Sun,
  Wind,
  Battery,
  Building2,
  UtilityPole,
  Search,
  Box,
  Maximize2,
  Minimize2,
  ExternalLink,
} from 'lucide-react';

// 3D campus simulator, served as a static build from public/simulator.
const SIMULATOR_URL = '/simulator/index.html?embed=1#prestige-university';

export const DigitalTwin: React.FC = () => {
  const { site, assets, isStale, stalenessSeconds, refresh, isLoading } = useLiveTwin(1);
  const [selectedAsset, setSelectedAsset] = useState<AssetRead | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [simulatorFullscreen, setSimulatorFullscreen] = useState(false);
  const simulatorRef = useRef<HTMLDivElement>(null);

  // Real browser full screen: only the simulator is visible, with no navbar, page or browser chrome.
  useEffect(() => {
    const sync = () => setSimulatorFullscreen(document.fullscreenElement === simulatorRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleSimulatorFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    try {
      await simulatorRef.current?.requestFullscreen();
    } catch {
      // Full Screen API unavailable: cover the window instead.
      setSimulatorFullscreen((value) => !value);
    }
  };

  const buildingAssets = assets.filter((a) => a.asset_type === 'building');

  const filteredAssets = assets.filter((asset) => {
    const matchesType =
      filterType === 'all'
        ? true
        : filterType === 'renewables'
        ? asset.asset_type === 'solar' || asset.asset_type === 'wind'
        : filterType === 'battery'
        ? asset.asset_type === 'battery'
        : filterType === 'building'
        ? asset.asset_type === 'building'
        : filterType === 'grid'
        ? asset.asset_type === 'grid_interconnection' || asset.asset_type === 'meter' || asset.asset_type === 'substation'
        : true;

    const matchesSearch =
      searchQuery === ''
        ? true
        : asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          asset.id.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesType && matchesSearch;
  });

  const getAssetIcon = (type: AssetType) => {
    switch (type) {
      case 'solar':
        return <Sun className="h-4 w-4 text-amber-400" />;
      case 'wind':
        return <Wind className="h-4 w-4 text-cyan-400" />;
      case 'battery':
        return <Battery className="h-4 w-4 text-purple-400" />;
      case 'building':
        return <Building2 className="h-4 w-4 text-rose-400" />;
      default:
        return <UtilityPole className="h-4 w-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Campus Digital Twin</h1>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono text-emerald-400 border border-slate-700">
              Config v{site?.config_version || 1}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {site?.name || 'Prestige University, Indore (Malwa Microgrid)'} • Madhya Pradesh, India (Asia/Kolkata)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <FreshnessIndicator isStale={isStale} stalenessSeconds={stalenessSeconds} />
          <button
            onClick={() => refresh()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>
        </div>
      </div>

      {/* 3D Campus Simulator */}
      <div
        ref={simulatorRef}
        className={
          simulatorFullscreen
            ? 'fixed inset-0 z-[100] bg-black'
            : 'overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60 shadow-xl'
        }
      >
        {!simulatorFullscreen && (
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
                <Box className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">3D Campus Simulator</h2>
                <p className="text-[11px] text-slate-400">
                  Prestige University, Indore • drag to orbit, scroll to zoom, use the top bar to jump to buildings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={SIMULATOR_URL.replace('embed=1', 'embed=0')}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Tab</span>
              </a>
              <button
                onClick={toggleSimulatorFullscreen}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Full Screen</span>
              </button>
            </div>
          </div>
        )}
        <iframe
          title="Prestige University 3D campus simulator"
          src={SIMULATOR_URL}
          className={simulatorFullscreen ? 'block h-full w-full border-0' : 'block h-[75vh] min-h-[560px] w-full border-0'}
          allow="fullscreen"
        />
        {simulatorFullscreen && (
          <button
            onClick={toggleSimulatorFullscreen}
            title="Exit full screen (Esc)"
            aria-label="Exit full screen"
            className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-950/60 text-slate-200 opacity-60 backdrop-blur-md transition-opacity hover:opacity-100"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ML Telemetry Digital Twin State Estimation Controller */}
      <MLTelemetryController
        siteId={1}
        category="twin"
        onRefreshState={refresh}
      />

      {/* Buildings Criticality Tiers Section */}
      {buildingAssets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Campus Buildings & Criticality Tiers
              </h2>
              <p className="text-xs text-slate-400">
                Tier 1 Critical loads protected from automated curtailment during grid stress
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {buildingAssets.length} Monitored Facilities
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {buildingAssets.map((bldg) => (
              <BuildingCard key={bldg.id} asset={bldg} onClick={() => setSelectedAsset(bldg)} />
            ))}
          </div>
        </div>
      )}

      {/* Asset Fleet Table & Filters */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Fleet' },
              { id: 'renewables', label: 'Solar & Wind' },
              { id: 'battery', label: 'Battery BESS' },
              { id: 'building', label: 'Buildings' },
              { id: 'grid', label: 'Grid / Meters' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  filterType === tab.id
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search asset name or ID..."
                className="w-full sm:w-60 rounded-xl border border-slate-700 bg-slate-800/80 py-1.5 pl-9 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Fleet Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase font-bold text-slate-400">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Rated Power</th>
                <th className="px-4 py-3">Active Power</th>
                <th className="px-4 py-3">State / SoC</th>
                <th className="px-4 py-3">Operational</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredAssets.length > 0 ? (
                filteredAssets.map((asset) => {
                  const state = asset.state;
                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
                            {getAssetIcon(asset.asset_type)}
                          </div>
                          <div>
                            <div className="font-bold text-white">{asset.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{asset.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-300 font-sans">
                        {asset.asset_type.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-bold">
                        {asset.rated_capacity_kw.toFixed(1)} kW
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {state?.active_power_kw !== undefined ? `${state.active_power_kw.toFixed(1)} kW` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {asset.asset_type === 'battery' && state?.soc_percent !== null && state?.soc_percent !== undefined
                          ? `${state.soc_percent.toFixed(0)}% SoC`
                          : state?.temperature_celsius !== null && state?.temperature_celsius !== undefined
                          ? `${state.temperature_celsius.toFixed(1)} °C`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <OperationalStatusBadge status={state?.operational_status || 'online'} />
                      </td>
                      <td className="px-4 py-3 font-sans">
                        <QualityBadge quality={state?.telemetry_quality || 'good'} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAsset(asset);
                          }}
                          className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-slate-700 transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-slate-500 font-sans">
                    No matching assets found for filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Inspection Modal */}
      {selectedAsset && (
        <AssetDetailModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
};
