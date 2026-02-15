const os = require('os');
const onvif = require('node-onvif');
const pLimit = require('p-limit');
const { logger } = require('./logger');
const { sadpProbe } = require('./sadp');
const { activateHikvision } = require('./hikvision');

let cachedProbe = null;             // Promise | null
let probeStartedAt = 0;             // unix ms

const scanOnvifDevices = async (interfaceAddress) => {
  const now = Date.now();
  // refresh cache after 15s so successive "Scan" clicks are fresh
  if (!cachedProbe || now - probeStartedAt > 15000) {
    logger.info('Starting ONE global ONVIF probe (5s)');
    probeStartedAt = now;
    cachedProbe = onvif.startProbe({ timeout: 5000 })
      .catch(err => {
        logger.warn('ONVIF probe failed:', err.message);
        return [];
      });
  }

  try {
    const deviceInfoList = await cachedProbe;
    logger.info(`ONVIF probe complete, found ${deviceInfoList.length} devices`);

    const subnet = interfaceAddress.split('.').slice(0, 3).join('.');
    const devices = deviceInfoList
      .filter(info => info.address && info.address.startsWith(subnet))
      .map(info => ({
        ip: info.address,
        manufacturer: info.manufacturer || 'Unknown',
        model: info.model || 'Unknown',
        onvifUrl: info.xaddrs?.[0] ?? null
      }));

    return devices;
  } catch (error) {
    logger.error(`ONVIF discovery error on ${interfaceAddress}: ${error.message}`);
    return [];
  }
}; 

/**
 * Scan ONVIF + SADP globally, then filter by subnet
 */
const scanAllDevices = async () => {
  const [onvifDevices, sadpCams] = await Promise.all([
    scanOnvifDevices(),   // uses cached ONVIF probe
    sadpProbe()           // ONE SADP socket, binds 37020 once
  ]);

  // Merge on MAC/IP; prefer ONVIF details where overlap
  const deviceMap = new Map();
  [...sadpCams, ...onvifDevices].forEach((d) => {
    const key = d.ip;                    // IP wins, then merge MAC/other fields
    deviceMap.set(key, { ...deviceMap.get(key), ...d });
  });
  return Array.from(deviceMap.values());
}; 