import { useState, useEffect, useCallback } from 'react';
import { api } from './api.js';
import { deriveKey, cacheKey, loadCachedKey, clearCachedKey } from './crypto.js';
import AuthPage from './pages/AuthPage.jsx';
import NotesPage from './pages/NotesPage.jsx';

export default function App() {
  const [state, setState] = useState({
    status: 'loading', // loading | auth | ready
    username: null,
    salt: null,
    cryptoKey: null,
    registrationOpen: false,
  });

  // 启动:探测登录状态;已登录则尝试从会话缓存恢复密钥
  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        const cached = await loadCachedKey();
        if (cached) {
          setState({
            status: 'ready',
            username: me.username,
            salt: me.salt,
            cryptoKey: cached,
            registrationOpen: me.registrationOpen,
          });
        } else {
          // Cookie 有效但密钥已随会话清除,需要重新登录派生密钥
          await api.logout().catch(() => {});
          setState((s) => ({ ...s, status: 'auth', registrationOpen: me.registrationOpen }));
        }
      } catch {
        let registrationOpen = false;
        try {
          // 未登录时无法调 /me,注册开关由登录接口失败前的探测给出;默认按开放处理,
          // 真正的拦截在服务器端(注册接口会拒绝)。
          registrationOpen = true;
        } catch { /* ignore */ }
        setState((s) => ({ ...s, status: 'auth', registrationOpen }));
      }
    })();
  }, []);

  /** 登录/注册成功:派生密钥并缓存 */
  const handleAuthed = useCallback(async ({ username, salt }, password) => {
    const key = await deriveKey(password, salt);
    await cacheKey(key);
    setState((s) => ({ ...s, status: 'ready', username, salt, cryptoKey: key }));
  }, []);

  const handleLogout = useCallback(async () => {
    await api.logout().catch(() => {});
    clearCachedKey();
    setState((s) => ({
      ...s,
      status: 'auth',
      username: null,
      salt: null,
      cryptoKey: null,
    }));
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="boot">
        <div className="boot-mark" />
      </div>
    );
  }

  if (state.status === 'auth') {
    return <AuthPage onAuthed={handleAuthed} />;
  }

  return (
    <NotesPage
      username={state.username}
      cryptoKey={state.cryptoKey}
      onLogout={handleLogout}
    />
  );
}
