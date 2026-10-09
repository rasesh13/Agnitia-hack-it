// SURYA background runner. Executed headlessly by @capacitor/background-runner
// (about every 15 minutes, the Android WorkManager minimum) while the app is closed.
// The app sends its server, token and thresholds through the "syncConfig" event.

function read(key, fallback) {
  try {
    const stored = CapacitorKV.get(key);
    return stored && stored.value ? JSON.parse(stored.value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function write(key, value) {
  CapacitorKV.set(key, JSON.stringify(value));
}

function idFor(key) {
  let hash = 7;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2000000000;
}

function conditions(twin, policy, settings) {
  const found = [];
  const aggregate = twin.aggregate || {};
  const soc = aggregate.average_battery_soc_percent;
  if (typeof soc === 'number' && soc < settings.batteryCriticalSoc) {
    found.push({ key: 'battery-soc', critical: true, title: 'Battery critically low', body: 'Fleet state of charge is ' + soc.toFixed(1) + '%.' });
  } else if (typeof soc === 'number' && soc < settings.batteryLowSoc) {
    found.push({ key: 'battery-soc', critical: false, title: 'Battery running low', body: 'Fleet state of charge is ' + soc.toFixed(1) + '%.' });
  }
  if ((aggregate.grid_import_kw || 0) > settings.gridImportKw) {
    found.push({ key: 'grid-import', critical: false, title: 'High grid import', body: 'Importing ' + Math.round(aggregate.grid_import_kw) + ' kW from the grid.' });
  }
  (twin.assets || []).forEach(function (asset) {
    const status = String(asset.operational_status || '').toLowerCase();
    if (status === 'offline' || status === 'fault' || status === 'tripped') {
      found.push({ key: 'asset-' + asset.asset_id, critical: true, title: asset.name + ' is ' + status, body: asset.asset_id + ' stopped reporting as online.' });
    }
  });
  if (policy && policy.emergency_stop_active) {
    found.push({ key: 'emergency-stop', critical: true, title: 'Emergency stop engaged', body: 'Automated dispatch is frozen.' });
  }
  return found;
}

addEventListener('syncConfig', function (resolve, reject, args) {
  try {
    write('config', { serverUrl: args.serverUrl || '', token: args.token || '', settings: args.settings || {} });
    write('activeKeys', args.activeKeys || []);
    resolve();
  } catch (error) {
    reject(error);
  }
});

addEventListener('checkAlerts', async function (resolve, reject) {
  try {
    const config = read('config', null);
    if (!config || !config.serverUrl || !config.token || config.settings.notifications === false) {
      resolve();
      return;
    }
    // The runner's fetch has no default method, so it is always passed explicitly.
    const headers = { Authorization: 'Bearer ' + config.token, Accept: 'application/json' };
    const twinResponse = await fetch(config.serverUrl + '/api/v1/twin/live?site_id=1', { method: 'GET', headers: headers });
    if (twinResponse.status === 401) {
      if (!read('expiredNotified', false)) {
        CapacitorNotifications.schedule([{ id: 4343, title: 'SURYA session expired', body: 'Open the app and sign in again to keep receiving alerts.', channelId: 'surya-updates' }]);
        write('expiredNotified', true);
      }
      resolve();
      return;
    }
    write('expiredNotified', false);
    if (!twinResponse.ok) {
      resolve();
      return;
    }
    const twin = await twinResponse.json();
    let policy = null;
    try {
      const policyResponse = await fetch(config.serverUrl + '/api/v1/settings/control-policy?site_id=1', { method: 'GET', headers: headers });
      if (policyResponse.ok) policy = await policyResponse.json();
    } catch (error) {
      policy = null;
    }

    const previous = read('activeKeys', []);
    const current = conditions(twin, policy, config.settings);
    const fresh = current.filter(function (item) {
      return previous.indexOf(item.key) === -1 && (item.critical || config.settings.notifyWarnings !== false);
    });
    if (fresh.length) {
      CapacitorNotifications.schedule(
        fresh.map(function (item) {
          return {
            id: idFor(item.key),
            title: (item.critical ? '🔴 ' : '🟠 ') + item.title,
            body: item.body,
            channelId: item.critical ? 'surya-critical' : 'surya-warning',
            smallIcon: 'ic_stat_surya',
          };
        }),
      );
    }
    write('activeKeys', current.map(function (item) { return item.key; }));
    resolve();
  } catch (error) {
    reject(error);
  }
});
