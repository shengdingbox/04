// ActivationDialog.jsx - 激活授权弹窗：展示机器码、输入激活码；可取消（浏览/下载不受限，播放会被主进程拦截）。
import React, { useEffect, useState } from 'react';
import { Play, X } from './icons';
import { getLicenseStatus, submitActivation } from '../activation.mjs';
import './ActivationDialog.css';

export default function ActivationDialog({ open, onClose, reason }) {
  const [machineCode, setMachineCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setError('');
      setCode('');
      const s = getLicenseStatus();
      setMachineCode(s?.machineCode || '');
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await submitActivation(code.trim());
      if (result?.success) onClose(true);
      else setError(result?.error || '激活失败，请重试');
    } catch (_) {
      setError('激活失败，请重试');
    } finally { setBusy(false); }
  };

  return (
    <div className="activation-overlay" role="dialog" aria-modal="true" aria-label="软件激活">
      <div className="activation-dialog">
        <button className="activation-close" aria-label="关闭" onClick={() => onClose(false)}><X size={18} /></button>
        <div className="activation-head">
          <div className="activation-logo"><Play size={20} /></div>
          <div>
            <div className="activation-title">软件激活</div>
            <div className="activation-sub">{reason || '本设备需要激活后才能使用播放功能；浏览与下载不受影响。'}</div>
          </div>
        </div>
        <label className="activation-field">
          <span>本机机器码</span>
          <div className="activation-machine" aria-readonly="true">{machineCode || '读取中…'}</div>
          <button type="button" className="btn btn-outline btn-sm activation-copy"
            onClick={() => { navigator.clipboard?.writeText(machineCode).catch(() => {}); }}>复制机器码</button>
        </label>
        <label className="activation-field">
          <span>激活码</span>
          <input className="activation-input" value={code} autoFocus
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX" spellCheck={false}
            onChange={event => setCode(event.target.value.toUpperCase())}
            onKeyDown={event => { if (event.key === 'Enter') submit(); }} />
        </label>
        {error && <div className="activation-error" role="alert">{error}</div>}
        <div className="activation-actions">
          <button className="btn btn-outline" onClick={() => onClose(false)}>取消</button>
          <button className="btn btn-primary" disabled={busy || code.trim().length < 20} onClick={submit}>
            {busy ? '激活中…' : '激活'}
          </button>
        </div>
      </div>
    </div>
  );
}
