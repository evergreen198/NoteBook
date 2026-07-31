import { useState } from 'react';
import { api } from '../api.js';
import { generateSalt } from '../crypto.js';

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState('login'); // login | register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (password.length < 8) {
        setError('密码至少 8 位(它将用于加密你的笔记,请设置强密码并牢记)');
        return;
      }
      if (password !== confirm) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const salt = generateSalt();
        const res = await api.register({ username: username.trim(), password, salt });
        await onAuthed(res, password);
      } else {
        const res = await api.login({ username: username.trim(), password });
        await onAuthed(res, password);
      }
    } catch (err) {
      setError(err.message || '操作失败,请重试');
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setConfirm('');
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <div className="auth-brand">
          <h1 className="auth-title">Notebook</h1>
          <div className="rule-accent" />
          <p className="auth-sub">端到端加密的私人笔记</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            注册
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">用户名</span>
            <input
              className="field-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              minLength={3}
              maxLength={32}
              placeholder="3-32 位字母、数字、_ 或 -"
            />
          </label>

          <label className="field">
            <span className="field-label">密码</span>
            <input
              className="field-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 8 : 1}
              maxLength={128}
              placeholder={mode === 'register' ? '至少 8 位,忘记将无法找回笔记' : ''}
            />
          </label>

          {mode === 'register' && (
            <label className="field">
              <span className="field-label">确认密码</span>
              <input
                className="field-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                maxLength={128}
              />
            </label>
          )}

          {error && <p className="form-error">{error}</p>}

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? '处理中…' : mode === 'login' ? '登 录' : '注册并进入'}
          </button>

          {mode === 'register' && (
            <p className="form-hint">
              密码将用于在本地派生加密密钥,服务器永不存储明文。
              <br />
              忘记密码 = 笔记永久无法恢复。
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
