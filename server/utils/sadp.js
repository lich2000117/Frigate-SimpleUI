// utils/sadp.js
const dgram   = require('dgram');
const { v4: uuidv4 } = require('uuid');
const { parseStringPromise } = require('xml2js');

const SADP_PORT  = 37020;
const SADP_GROUP = '239.255.255.250';

/**
 * Probe Hikvision cameras via SADP.
 * @param {string} ifaceIp  — the interface IPv4 to talk out of
 * @param {number} timeout  — ms to wait for replies
 */
function sadpProbe(ifaceIp = '0.0.0.0', timeout = 2000) {
  return new Promise((resolve) => {
    const sock    = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const results = new Map();

    const probeXml =
`<?xml version="1.0" encoding="utf-8"?>
<Probe><Uuid>${uuidv4().toUpperCase()}</Uuid><Types>inquiry</Types></Probe>`;
    const probeBuf = Buffer.from(probeXml);

    /* ---------- receive ---------- */
    sock.on('message', async (msg, rinfo) => {
      try {
        const parsed = await parseStringPromise(msg.toString());
        const pm     = parsed?.ProbeMatch;
        if (!pm) return;

        const mac = pm.MAC[0].replace(/-/g, ':').toUpperCase();
        results.set(mac, {
          ip: pm.Ipv4Address?.[0] || rinfo.address,
          mac,
          model: pm.DeviceDescription?.[0] ?? 'Unknown',
          activated: pm.Activated?.[0] === 'true',
          state: pm.Activated?.[0] === 'true' ? 'onvif_ready' : 'inactive_hik',
          vendor: 'HIKVISION'
        });
      } catch (_) {/* ignore */}
    });

    /* ---------- bind & send ---------- */
    const bindAndSend = (port) => {
      sock.bind(port, ifaceIp === '0.0.0.0' ? undefined : ifaceIp, () => {
        try { sock.addMembership(SADP_GROUP, ifaceIp); } catch (_) {}
        sock.setMulticastTTL(1);
        sock.setMulticastLoopback(true);
        // choose outgoing NIC explicitly
        if (ifaceIp !== '0.0.0.0') sock.setMulticastInterface(ifaceIp);

        sock.send(probeBuf, 0, probeBuf.length, SADP_PORT, SADP_GROUP);
      });
    };

    sock.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && sock.address().port !== SADP_PORT) {
        console.warn('SADP port busy, switching to random port fallback');
        bindAndSend(0);
      } else {
        console.warn('SADP socket error:', err.message);
      }
    });

    // first attempt on 37020
    bindAndSend(SADP_PORT);

    setTimeout(() => {
      sock.close();
      resolve([...results.values()]);
    }, timeout);
  });
}

module.exports = { sadpProbe };
