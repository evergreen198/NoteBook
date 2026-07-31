/**
 * API 端到端测试脚本(一次性,验证后可删除)
 * 运行: node scripts/test-api.mjs  (需服务器已在 :3001 运行)
 */
const BASE = 'http://localhost:3001';

let cookie = '';
async function call(method, path, body, useCookie = true) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (useCookie && cookie) headers['Cookie'] = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const salt = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const iv = '00112233445566778899aabb';
const ct = 'deadbeef'.repeat(8);
const rand = Math.random().toString(36).slice(2, 8);
const user = `test_${rand}`;

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name} ${detail}`); }
}

console.log('===== API 端到端测试 =====\n');

// 1. 未登录访问 → 401
let r = await call('GET', '/api/notes', null, false);
check('未登录访问笔记返回 401', r.status === 401, JSON.stringify(r));

// 2. 注册
r = await call('POST', '/api/auth/register', { username: user, password: 'testpassword123', salt });
check('注册成功并写入 Cookie', r.status === 201 && cookie.includes('token='), JSON.stringify(r));
check('注册返回 salt', r.data?.salt === salt);

// 3. /me
r = await call('GET', '/api/auth/me');
check('已登录状态 /me 返回用户名', r.status === 200 && r.data?.username === user);

// 4. 新建笔记
r = await call('POST', '/api/notes', { ciphertext: ct, iv });
check('新建笔记成功', r.status === 201 && r.data?.note?.id, JSON.stringify(r));
const noteId = r.data?.note?.id;

// 5. 列表
r = await call('GET', '/api/notes');
check('列表包含新笔记(密文形态)', r.data?.notes?.[0]?.ciphertext === ct && r.data?.notes?.[0]?.iv === iv);

// 6. 更新
const ct2 = 'cafebabe'.repeat(8);
r = await call('PUT', `/api/notes/${noteId}`, { ciphertext: ct2, iv });
check('更新笔记成功', r.status === 200 && r.data?.note?.ciphertext === ct2);

// 7. 错误密码登录 → 401
const savedCookie = cookie; cookie = '';
r = await call('POST', '/api/auth/login', { username: user, password: 'wrong-password' });
check('错误密码登录返回 401', r.status === 401);

// 8. 正确密码登录
r = await call('POST', '/api/auth/login', { username: user, password: 'testpassword123' });
check('正确密码登录成功并返回 salt', r.status === 200 && r.data?.salt === salt);

// 9. 注册第二个用户,验证数据隔离
const user2 = `test2_${rand}`;
r = await call('POST', '/api/auth/register', { username: user2, password: 'testpassword456', salt });
check('第二个用户注册成功', r.status === 201);
r = await call('GET', '/api/notes');
check('第二用户看不到第一用户的笔记(隔离)', r.status === 200 && r.data?.notes?.length === 0);
r = await call('PUT', `/api/notes/${noteId}`, { ciphertext: ct, iv });
check('第二用户无法修改他人笔记(404)', r.status === 404);
r = await call('DELETE', `/api/notes/${noteId}`);
check('第二用户无法删除他人笔记(404)', r.status === 404);

// 10. 切回用户1,删除笔记
cookie = '';
await call('POST', '/api/auth/login', { username: user, password: 'testpassword123' });
r = await call('DELETE', `/api/notes/${noteId}`);
check('删除笔记成功', r.status === 200);
r = await call('GET', '/api/notes');
check('删除后列表为空', r.data?.notes?.length === 0);

// 11. 重复用户名 → 409
r = await call('POST', '/api/auth/register', { username: user, password: 'whatever123', salt });
check('重复用户名返回 409', r.status === 409);

// 12. 非法 salt → 400
r = await call('POST', '/api/auth/register', { username: 'x'.repeat(4), password: 'whatever123', salt: 'bad' });
check('非法 salt 返回 400', r.status === 400);

// 13. 登出
r = await call('POST', '/api/auth/logout');
check('登出成功', r.status === 200);

console.log(`\n===== 结果: ${pass} 通过, ${fail} 失败 =====`);
process.exit(fail > 0 ? 1 : 0);
