// activation.mjs - 激活授权的前端状态总线：唯一数据源，App 挂钩监听。
const listeners = new Set();
let status = { activated: false, machineCode: '', activatedCode: '' };
let loaded = false;

export async function loadLicenseStatus() {
  try {
    const s = await window.electronAPI.getLicenseStatus();
    if (s) status = s;
  } catch (_) { /* 保持默认未激活 */ }
  loaded = true;
  notify();
  return status;
}

export function getLicenseStatus() { return status; }

export function subscribeLicense(cb) {
  listeners.add(cb);
  if (loaded) cb(status);
  return () => listeners.delete(cb);
}

function notify() { for (const cb of [...listeners]) { try { cb(status); } catch (_) {} } }

/** 提交激活码；成功后刷新状态并广播（弹窗随之关闭）。 */
export async function submitActivation(code) {
  const result = await window.electronAPI.activateLicense(code);
  if (result?.success && result.status) {
    status = result.status;
    notify();
  }
  return result;
}

/** 安装主进程「播放需授权」推送 → 打开激活弹窗。返回解绑函数。 */
export function bindLicenseRequired(openDialog) {
  if (!window.electronAPI.onLicenseRequired) return () => {};
  return window.electronAPI.onLicenseRequired(() => { void loadLicenseStatus(); openDialog(true); });
}
