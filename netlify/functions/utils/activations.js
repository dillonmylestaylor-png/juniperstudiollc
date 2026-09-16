const { getStore } = require('@netlify/blobs');
const { licenseId, MAX_ACTIVATIONS } = require('./license');

async function store() {
  return getStore('plugin-activations');
}

async function activate({ key, machine, master }) {
  if (master) return { ok: true, remaining: null, master: true };
  if (!machine) return { ok: true, remaining: MAX_ACTIVATIONS, deferred: true };

  const id = licenseId(key);
  const s = await store();
  const current = (await s.get(id, { type: 'json' })) || { machines: [] };
  const machines = Array.isArray(current.machines) ? current.machines : [];

  if (machines.includes(machine)) {
    return { ok: true, remaining: MAX_ACTIVATIONS - machines.length, reused: true };
  }
  if (machines.length >= MAX_ACTIVATIONS) {
    return { ok: false, reason: 'activation_limit', remaining: 0 };
  }

  machines.push(machine);
  await s.setJSON(id, { machines, updated: Date.now() });
  return { ok: true, remaining: MAX_ACTIVATIONS - machines.length };
}

async function deactivate({ key, machine, master }) {
  if (master) return { ok: true, remaining: null, master: true, deactivated: true };
  if (!machine) return { ok: false, reason: 'missing_machine' };

  const id = licenseId(key);
  const s = await store();
  const current = (await s.get(id, { type: 'json' })) || { machines: [] };
  const before = Array.isArray(current.machines) ? current.machines : [];
  const machines = before.filter((m) => m !== machine);
  await s.setJSON(id, { machines, updated: Date.now() });
  return {
    ok: true,
    remaining: MAX_ACTIVATIONS - machines.length,
    deactivated: true,
    found: before.length !== machines.length,
  };
}

module.exports = { activate, deactivate };
