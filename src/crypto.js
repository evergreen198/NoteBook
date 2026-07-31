/**
 * 端到端加密模块(零依赖,基于浏览器内置 Web Crypto API)
 *
 * 流程:
 *   注册: 生成随机盐 salt → deriveKey(密码, salt) → 密钥只存在浏览器
 *   登录: 从服务器取回 salt → 重新派生出同一把密钥
 *   写入: encryptNote → { ciphertext, iv } 上传(服务器只见密文)
 *   读取: 下载密文 → decryptNote 在浏览器解密
 *
 * 算法: PBKDF2-SHA256 (600,000 次迭代) 派生 AES-256-GCM 密钥
 * 注意: 密钥不可导出;忘记密码 = 数据永久无法恢复
 */

const PBKDF2_ITERATIONS = 600_000;
const KEY_SESSION_NAME = 'nbk'; // sessionStorage 键名(仅存放原始密钥字节,关闭标签页即清除)

const te = new TextEncoder();
const td = new TextDecoder();

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** 生成 16 字节随机盐(hex 字符串) */
export function generateSalt() {
  return bufToHex(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * 由密码 + 盐派生 AES-256-GCM 密钥
 * @returns {Promise<CryptoKey>} 不可导出的密钥句柄
 */
export async function deriveKey(password, saltHex) {
  const material = await crypto.subtle.importKey(
    'raw',
    te.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBuf(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/** 加密笔记 { title, content } → { ciphertext(hex), iv(hex) } */
export async function encryptNote(key, noteObj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = te.encode(JSON.stringify(noteObj));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return { ciphertext: bufToHex(cipher), iv: bufToHex(iv) };
}

/** 解密 → { title, content };密码/数据错误时抛出异常 */
export async function decryptNote(key, ciphertextHex, ivHex) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBuf(ivHex) },
    key,
    hexToBuf(ciphertextHex)
  );
  return JSON.parse(td.decode(plain));
}

/**
 * 会话密钥缓存:以原始字节存 sessionStorage(关标签页自动清除),
 * 刷新页面时免重新派生;不使用可导出 CryptoKey 以外的明文形态。
 */
export async function cacheKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key);
  sessionStorage.setItem(KEY_SESSION_NAME, bufToHex(raw));
}

export async function loadCachedKey() {
  const hex = sessionStorage.getItem(KEY_SESSION_NAME);
  if (!hex) return null;
  try {
    return await crypto.subtle.importKey('raw', hexToBuf(hex), 'AES-GCM', true, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    return null;
  }
}

export function clearCachedKey() {
  sessionStorage.removeItem(KEY_SESSION_NAME);
}
