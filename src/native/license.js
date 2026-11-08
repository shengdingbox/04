/**
 * license.js - 红果短剧激活授权
 *
 * 授权模型：
 *   机器码 = 平台 + 主机名 + Windows MachineGuid（取不到则退化为平台+主机名+MAC）
 *            经 SHA-256 派生，展示为 XXXX-XXXX-XXXX-XXXX。
 *   激活码 = HMAC-SHA256(机器码规范化串, SECRET) 的十六进制前 20 位，
 *            展示为 XXXXX-XXXXX-XXXXX-XXXXX；校验用 timingSafeEqual。
 *   授权状态持久化在 userData/license.json，仅保存激活码本身，每次启动重新校验。
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 激活码签名密钥：与 scripts/license-keygen.cjs 保持一致。更换密钥后所有旧激活码失效。
const LICENSE_SECRET = 'HG::Drama::2026::v1::redguo-license';

let cachedMachineCode = null;
let licenseFilePath = null;
let activatedCache = null;

function init(userDataDir) {
  licenseFilePath = path.join(userDataDir, 'license.json');
  activatedCache = null;
  try {
    const raw = JSON.parse(fs.readFileSync(licenseFilePath, 'utf8'));
    const code = String(raw?.code || '');
    if (code && verifyActivationCode(code)) activatedCache = { code: normalizeCode(code) };
  } catch (_) { activatedCache = null; }
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

function formatGroups(text, size) {
  const clean = normalizeCode(text);
  const groups = [];
  for (let i = 0; i < clean.length; i += size) groups.push(clean.slice(i, i + size));
  return groups.join('-');
}

function machineFingerprint() {
  const parts = [process.platform, os.arch(), os.hostname()];
  if (process.platform === 'win32') {
    try {
      const { execFileSync } = require('child_process');
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', timeout: 3000, windowsHide: true });
      const match = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(out);
      if (match) parts.push(match[1]);
    } catch (_) { /* 退化到主机名 */ }
  }
  try {
    for (const [name, list] of Object.entries(os.networkInterfaces())) {
      if (/loopback|virtual|vmware|vethernet/i.test(name)) continue;
      const mac = list.find(item => item.mac && item.mac !== '00:00:00:00:00:00')?.mac;
      if (mac) { parts.push(name.split(/[^a-z0-9]/i)[0] || '', mac); break; }
    }
  } catch (_) {}
  return parts.join('|');
}

/** 机器码（稳定、展示用）：XXXX-XXXX-XXXX-XXXX */
function getMachineCode() {
  if (cachedMachineCode) return cachedMachineCode;
  cachedMachineCode = formatGroups(crypto.createHash('sha256').update(machineFingerprint()).digest('hex').slice(0, 16), 4);
  return cachedMachineCode;
}

/** 机器码规范化串：HMAC 签名与校验都用它，避免分隔符差异导致验签失败。 */
function machineKey() {
  return 'HG1:' + normalizeCode(getMachineCode());
}

/** 根据机器码生成激活码：XXXXX-XXXXX-XXXXX-XXXXX */
function generateActivationCode(machineCode) {
  const clean = normalizeCode(machineCode);
  if (clean.length !== 16) throw new Error('机器码格式无效（应为 16 位）');
  const digest = crypto.createHmac('sha256', LICENSE_SECRET).update('HG1:' + clean).digest('hex').toUpperCase();
  return formatGroups(digest.slice(0, 20), 5);
}

function verifyActivationCode(code, machineCode) {
  try {
    const expected = generateActivationCode(machineCode ? normalizeCode(machineCode) : getMachineCode());
    const a = Buffer.from(normalizeCode(code));
    const b = Buffer.from(normalizeCode(expected));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) { return false; }
}

function isActivated() {
  if (activatedCache) return true;
  if (licenseFilePath && fs.existsSync(licenseFilePath)) init(path.dirname(licenseFilePath));
  return !!activatedCache;
}

function getStatus() {
  const activated = !!activatedCache;
  return { activated, machineCode: getMachineCode(), activatedCode: activated ? activatedCache.code : '' };
}

/** 校验并保存激活码；成功后返回最新状态。 */
function activate(code) {
  const clean = normalizeCode(code);
  if (clean.length !== 20) return { success: false, error: '激活码格式无效（应为 20 位）' };
  if (!verifyActivationCode(clean)) return { success: false, error: '激活码与本机不匹配，请核对机器码后重新输入' };
  activatedCache = { code: normalizeCode(clean) };
  try {
    fs.writeFileSync(licenseFilePath, JSON.stringify({ code: activatedCache.code, activatedAt: new Date().toISOString() }, null, 2), 'utf8');
  } catch (error) {
    activatedCache = null;
    return { success: false, error: `激活状态保存失败：${error.message}` };
  }
  return { success: true, status: getStatus() };
}

module.exports = { init, getMachineCode, generateActivationCode, verifyActivationCode, isActivated, getStatus, activate, LICENSE_REQUIRED: 'LICENSE_REQUIRED' };
