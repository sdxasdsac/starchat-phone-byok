/* ==================================================================
 * BYOK 本地适配层：插件里的 /api/* 请求不再打到服务端，而是读写本机
 * localStorage，并把 AI / 生图 / 语音转发到 BYOK 的 /api/llm|image|tts。
 * 这样插件不需要账号、数据库，也不需要部署者付 API 费用。
 * ================================================================== */
(function () {
  'use strict';
  if (window.__byokPluginShim) return;
  window.__byokPluginShim = true;

  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  var KEYS = {
    settings: 'sp.settings.v1',
    personas: 'sp.personas.v1',
    conversations: 'sp.conversations.v1',
    wallet: 'sp.wallet.v1',
  };
  var QS = new URLSearchParams(location.search || '');

  function rd(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function wr(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[BYOK] 本地存储写入失败', e);
    }
  }
  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  function readBody(init) {
    if (!init || init.body == null) return {};
    if (typeof init.body === 'string') {
      try {
        return JSON.parse(init.body);
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  function settings() {
    return rd(KEYS.settings, {}) || {};
  }
  function personas() {
    var list = rd(KEYS.personas, []);
    return Array.isArray(list) ? list : [];
  }
  function personaOf(id) {
    var list = personas();
    for (var i = 0; i < list.length; i += 1) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function personaToChar(p) {
    return {
      id: p.id,
      name: p.name || '角色',
      avatarUrl: p.avatar || '',
      avatar: p.avatar || '',
      personality: p.description || '',
      description: p.description || '',
      gender: '',
      tags: [],
      hasAvatar: false,
    };
  }
  function convs() {
    var list = rd(KEYS.conversations, []);
    return Array.isArray(list) ? list : [];
  }
  function personaIdFromConv(convId) {
    var s = String(convId || '');
    return s.indexOf('conv_') === 0 ? s.slice(5) : null;
  }
  function appendLocalMessage(convId, role, text) {
    var pid = personaIdFromConv(convId);
    if (!pid || !text) return;
    var list = convs();
    var idx = -1;
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].personaId === pid && list[i].channel === 'chat') {
        idx = i;
        break;
      }
    }
    var msg = {
      id: uid('m_'),
      role: role === 'assistant' ? 'assistant' : 'user',
      text: String(text),
      createdAt: Date.now(),
    };
    if (idx === -1) {
      list.unshift({ id: uid('c_'), personaId: pid, channel: 'chat', messages: [msg], updatedAt: Date.now() });
    } else {
      var old = list[idx];
      list[idx] = Object.assign({}, old, {
        messages: (Array.isArray(old.messages) ? old.messages : []).concat([msg]),
        updatedAt: Date.now(),
      });
    }
    wr(KEYS.conversations, list);
  }

  function personaPrompt(pid) {
    var p = personaOf(pid);
    if (!p) return '你正在用小手机里的应用和用户互动，请用第一人称、自然口语回复。';
    var parts = ['你叫' + (p.name || 'TA') + '，正在用小手机里的应用和用户互动。'];
    if (p.description) parts.push('角色设定：' + p.description);
    if (p.style) parts.push('说话风格：' + p.style);
    if (p.scenario) parts.push('当前场景：' + p.scenario);
    if (p.worldbook) parts.push('世界观：' + p.worldbook);
    parts.push('请保持第一人称、自然口语，不要解释你是 AI，不要输出 JSON 或 Markdown 代码块。');
    return parts.join('\n');
  }

  /** 走 BYOK 的文字接口（非流式，便于插件一次拿结果） */
  function callText(messages, maxTokens) {
    var s = settings();
    var cfg = s.text || {};
    if (!cfg.baseUrl || !cfg.model) {
      return Promise.reject(new Error('请先在「设置 → 文字 API」填写 Base URL 和模型名'));
    }
    var payload = {
      config: { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey || '', model: cfg.model },
      model: cfg.model,
      messages: messages,
      temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.9,
      max_tokens: maxTokens || cfg.maxTokens || 1200,
      stream: false,
    };
    return nativeFetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.text().then(function (text) {
        if (!res.ok) throw new Error(text.slice(0, 240) || '文字接口 HTTP ' + res.status);
        try {
          var d = JSON.parse(text);
          var c = d && d.choices && d.choices[0];
          return (c && ((c.message && c.message.content) || c.text)) || '';
        } catch (e) {
          return text;
        }
      });
    });
  }

  function replyInBackground(characterId, conversationId, userText) {
    var pid = characterId || personaIdFromConv(conversationId) || QS.get('charId') || '';
    var convId = conversationId || QS.get('convId') || ('conv_' + pid);
    if (!pid) return;
    if (userText) appendLocalMessage(convId, 'user', userText);
    var history = [];
    var list = convs();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].personaId === pid && list[i].channel === 'chat') {
        history = (list[i].messages || []).slice(-12);
        break;
      }
    }
    var messages = [{ role: 'system', content: personaPrompt(pid) }];
    history.forEach(function (m) {
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text || '' });
    });
    if (!history.length) messages.push({ role: 'user', content: userText || '（继续）' });
    callText(messages, 600)
      .then(function (text) {
        if (text) appendLocalMessage(convId, 'assistant', text);
      })
      .catch(function (e) {
        console.warn('[BYOK] 插件触发回复失败', e);
      });
  }

  function handleApi(pathWithQuery, init) {
    var url = new URL(pathWithQuery, location.href);
    var path = url.pathname;
    var method = String(init.method || 'GET').toUpperCase();
    var body = readBody(init);

    // 角色
    if (path === '/api/characters' && method === 'GET') {
      return Promise.resolve(jsonResponse({ ok: true, characters: personas().map(personaToChar) }));
    }
    var charMatch = /^\/api\/characters\/([^/]+)(\/.*)?$/.exec(path);
    if (charMatch) {
      var cid = decodeURIComponent(charMatch[1]);
      var p = personaOf(cid);
      if (!p) return Promise.resolve(jsonResponse({ ok: false, message: '角色不存在' }, 404));
      if (method === 'GET') return Promise.resolve(jsonResponse({ ok: true, character: personaToChar(p) }));
      return Promise.resolve(jsonResponse({ ok: true, character: personaToChar(p) }));
    }
    if (path === '/api/personas' && method === 'GET') {
      return Promise.resolve(jsonResponse({ ok: true, personas: personas() }));
    }

    // 用户
    if (path === '/api/auth/me') {
      var user = settings().user || {};
      return Promise.resolve(
        jsonResponse({
          ok: true,
          user: {
            id: 'self',
            username: user.name || QS.get('userName') || '你',
            name: user.name || QS.get('userName') || '你',
            avatarUrl: user.avatar || QS.get('userAvatar') || '',
            bio: user.bio || '',
            gender: '',
            age: '',
            occupation: '',
          },
        }),
      );
    }

    // 会话
    if (path === '/api/conversations' && method === 'GET') {
      var list = convs().map(function (c) {
        var pp = personaOf(c.personaId);
        return {
          id: 'conv_' + c.personaId,
          characterId: c.personaId,
          characterName: (pp && pp.name) || '角色',
          title: (pp && pp.name) || '角色',
          updatedAt: c.updatedAt || Date.now(),
        };
      });
      return Promise.resolve(jsonResponse({ ok: true, conversations: list }));
    }
    var msgMatch = /^\/api\/conversations\/([^/]+)\/messages$/.exec(path);
    if (msgMatch) {
      var convId = decodeURIComponent(msgMatch[1]);
      var pid = personaIdFromConv(convId);
      var rows = [];
      convs().forEach(function (c) {
        if (c.personaId === pid) {
          rows = (c.messages || []).map(function (m) {
            return {
              id: m.id,
              role: m.role,
              content: m.text || '',
              createdAt: new Date(m.createdAt || Date.now()).toISOString(),
            };
          });
        }
      });
      return Promise.resolve(jsonResponse({ ok: true, messages: rows }));
    }
    var scriptMatch = /^\/api\/conversations\/([^/]+)\/script-message$/.exec(path);
    if (scriptMatch) {
      appendLocalMessage(decodeURIComponent(scriptMatch[1]), body.role, body.content);
      return Promise.resolve(jsonResponse({ ok: true }));
    }

    // 聊天（插件让角色自己开口）：立即返回，后台生成
    if (path === '/api/chat/send') {
      replyInBackground(body.characterId, body.conversationId, body.panelTrigger ? '' : body.message);
      return Promise.resolve(jsonResponse({ ok: true }));
    }

    // 插件 AI
    if (path === '/api/phone/apps/ai') {
      var pid2 = body.characterId || QS.get('charId') || '';
      var messages = [{ role: 'system', content: body.system || personaPrompt(pid2) }];
      if (Array.isArray(body.messages) && body.messages.length) {
        body.messages.forEach(function (m) {
          if (!m || !m.content) return;
          messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) });
        });
      } else {
        messages.push({ role: 'user', content: String(body.instruction || body.prompt || '') });
      }
      return callText(messages, body.maxTokens).then(function (text) {
        return jsonResponse({ ok: true, text: text });
      });
    }

    // 生图
    if (path === '/api/image/generate' || path === '/api/image') {
      var s = settings();
      var cfg = s.image || {};
      if (!cfg.baseUrl || !cfg.model) {
        return Promise.resolve(jsonResponse({ ok: false, message: '请先在设置里填写图像 API' }, 400));
      }
      return nativeFetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: cfg,
          model: cfg.model,
          prompt: body.prompt || body.instruction || '',
          size: cfg.size || '1024x1024',
          n: 1,
        }),
      }).then(function (res) {
        return res.json().then(function (d) {
          var src = (d && (d.dataUrl || d.url)) || '';
          if (!res.ok || !src) {
            return jsonResponse({ ok: false, message: (d && (d.error || d.message)) || '生图失败' }, 500);
          }
          return jsonResponse({ ok: true, url: src, dataUrl: src, imageUrl: src });
        });
      });
    }

    // 语音合成：把 BYOK 的 TTS 配置注入后原样返回音频
    if (path === '/api/tts') {
      var st = settings();
      var tts = st.tts || {};
      if (!tts.provider || tts.provider === 'browser') {
        return Promise.resolve(jsonResponse({ ok: false, message: '请先在设置 → 语音里选择在线语音服务' }, 400));
      }
      return nativeFetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: tts, text: body.text || body.input || '' }),
      });
    }

    // 钱包
    if (path === '/api/phone/wallet') {
      var wallet = rd(KEYS.wallet, { balance: 520 });
      if (method === 'POST') {
        wallet = { balance: Math.max(0, Number(body.balance) || 0) };
        wr(KEYS.wallet, wallet);
      }
      return Promise.resolve(jsonResponse({ ok: true, balance: Number(wallet.balance) || 0 }));
    }

    // 记忆：插件自己已存 localStorage，这里只回成功
    if (path === '/api/memories') return Promise.resolve(jsonResponse({ ok: true, entries: [] }));

    // 其它 phone 接口：给出空成功，避免插件因 404 崩溃
    if (path.indexOf('/api/') === 0) return Promise.resolve(jsonResponse({ ok: true }));
    return null;
  }

  var patchedFetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var pathWithQuery = url;
    try {
      var u = new URL(url, location.href);
      if (u.origin === location.origin) pathWithQuery = u.pathname + u.search;
    } catch (e) {
      /* 相对地址按原样处理 */
    }
    if (pathWithQuery.indexOf('/api/') === 0) {
      var handled = null;
      try {
        handled = handleApi(pathWithQuery, init || {});
      } catch (e) {
        handled = Promise.resolve(jsonResponse({ ok: false, message: e && e.message ? e.message : '本地接口出错' }, 500));
      }
      if (handled) {
        return handled.catch(function (e) {
          return jsonResponse({ ok: false, message: e && e.message ? e.message : '本地接口出错' }, 500);
        });
      }
    }
    return nativeFetch ? nativeFetch(input, init) : Promise.reject(new Error('fetch 不可用'));
  };
  try {
    window.fetch = patchedFetch;
  } catch (e) {
    /* 某些沙盒不允许改写 fetch，插件仍可用 db / 本地功能 */
  }
})();

/* 小手机 · 插件宿主 SDK
 * 插件（public/phone-apps/<slug>/index.html）里调用的 window.AiPhone 由这里提供，
 * 数据/角色/钱包/聊天/AI 全部落到星聊自己的后端，不需要 小手机 宿主。
 * 由 PhonePluginApp 在 iframe 地址上带 convId / charId / charName / userName / userAvatar。
 */
(function () {
  'use strict';
  if (window.AiPhone && window.AiPhone.__starchatHost) return;

  var qs = new URLSearchParams(location.search || '');
  var pathHit = /\/phone-apps\/([^/]+)\//.exec(location.pathname || '');
  var APP_ID = qs.get('appId') || (pathHit ? pathHit[1] : 'app');
  var CONV_ID = qs.get('convId') || null;
  var CHAR_ID = qs.get('charId') || null;
  var CHAR_NAME = qs.get('charName') || '';
  var USER_NAME = qs.get('userName') || '';
  var USER_AVATAR = qs.get('userAvatar') || '';
  // 游戏厅/共筑小窝等 iframe 会带服务端签发的入场票：带上即可免按次计费
  var GAME_TICKET = qs.get('gameTicket') || '';
  var GAME_ID = qs.get('gameId') || '';

  var NS = 'fp.plugin.' + APP_ID + '.';

  /* ---------------- 基础工具 ---------------- */

  function httpJson(path, opts) {
    var o = opts || {};
    var init = {
      method: o.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: Object.assign({ 'Content-Type': 'application/json' }, o.headers || {}),
    };
    if (o.body !== undefined && o.body !== null) {
      init.body = typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
    }
    return fetch(path, init).then(function (res) {
      return res
        .json()
        .catch(function () {
          return null;
        })
        .then(function (data) {
          if (!res.ok || (data && data.ok === false)) {
            var msg = (data && (data.message || data.error)) || '请求失败（' + res.status + '）';
            throw new Error(msg);
          }
          return data || {};
        });
    });
  }

  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('[AiPhone] 本地存储写入失败', e);
      return false;
    }
  }

  function rid(v) {
    var t = String(v == null ? '' : v).trim().slice(0, 120);
    return t || 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function clampText(v, max) {
    return typeof v === 'string' ? v.slice(0, max) : '';
  }

  /* ---------------- 轻提示 ---------------- */

  var toastEl = null;
  var toastTimer = 0;
  /** 当前播放的语音（voice.play / stopPlayback 用） */
  var currentAudio = null;
  var embeddedInHost = window.parent && window.parent !== window;
  function showToast(message) {
    var text = String(message == null ? '' : message);
    if (!text) return;
    if (embeddedInHost) {
      // 嵌在小手机里时交给父页弹提示（与 App 内其它提示样式一致）
      try {
        parent.postMessage({ source: 'starchat-phone-app', type: 'toast', message: text }, '*');
        return;
      } catch (e) {
        /* 父页不可达时退回流内提示 */
      }
    }
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute(
        'style',
        [
          'position:fixed',
          'left:50%',
          'bottom:calc(64px + env(safe-area-inset-bottom,0px))',
          'transform:translateX(-50%)',
          'max-width:78%',
          'padding:8px 14px',
          'border-radius:14px',
          'background:rgba(20,20,22,.88)',
          'color:#fff',
          'font-size:13px',
          'line-height:1.45',
          'text-align:center',
          'box-shadow:0 8px 24px rgba(0,0,0,.22)',
          'z-index:2147483647',
          'pointer-events:none',
          'opacity:0',
          'transition:opacity .18s ease',
          'white-space:pre-wrap',
          'word-break:break-word',
        ].join(';'),
      );
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (toastEl) toastEl.style.opacity = '0';
    }, 2200);
  }

  /* ---------------- 启动上下文 ---------------- */

  var launchContext = {
    appId: APP_ID,
    conversationId: CONV_ID,
    sessionId: CONV_ID,
    characterId: CHAR_ID,
    characterName: CHAR_NAME,
    userName: USER_NAME,
    userAvatar: USER_AVATAR,
  };

  /* ---------------- 角色 ---------------- */

  function charRecord(c) {
    var id = c && typeof c.id === 'string' ? c.id : '';
    var avatar = (c && (c.avatarUrl || c.avatar)) || (c && c.hasAvatar ? '/api/characters/' + id + '/avatar' + (c.avatarVersion ? '?v=' + c.avatarVersion : '') : '');
    return {
      id: id,
      name: (c && c.name) || '角色',
      avatar: avatar,
      avatarUrl: avatar,
      persona: (c && (c.personality || c.description)) || '',
      description: (c && c.description) || '',
      personality: (c && c.personality) || '',
      gender: (c && c.gender) || '',
      tags: (c && c.tags) || [],
      hasAvatar: !!(c && c.hasAvatar),
    };
  }

  var charactersPromise = null;
  function loadCharacters() {
    if (!charactersPromise) {
      charactersPromise = httpJson('/api/characters')
        .then(function (d) {
          var list = Array.isArray(d.characters) ? d.characters : [];
          return list.map(charRecord);
        })
        .catch(function () {
          return [];
        });
    }
    return charactersPromise;
  }

  function getCharacter(id) {
    if (!id) return Promise.resolve(null);
    return httpJson('/api/characters/' + encodeURIComponent(id) + '?peek=1')
      .then(function (d) {
        return d && d.character ? charRecord(d.character) : null;
      })
      .catch(function () {
        return null;
      });
  }

  /* ---------------- 用户信息 ---------------- */

  var profilePromise = null;
  function loadProfile() {
    if (!profilePromise) {
      profilePromise = httpJson('/api/auth/me')
        .then(function (d) {
          var u = (d && d.user) || {};
          return {
            id: u.id || 'self',
            name: u.username || USER_NAME || '你',
            username: u.username || USER_NAME || '',
            avatarUrl: USER_AVATAR || '',
            gender: u.gender || '',
            age: u.age || '',
            occupation: u.occupation || '',
            bio: u.bio || '',
          };
        })
        .catch(function () {
          return { id: 'self', name: USER_NAME || '你', avatarUrl: USER_AVATAR || '', bio: '' };
        });
    }
    return profilePromise;
  }

  /* ---------------- 本地数据库（每个插件、每个集合独立） ---------------- */

  function readCollection(collection) {
    var rows = lsGet(NS + 'db.' + collection, []);
    return Array.isArray(rows) ? rows : [];
  }

  function writeCollection(collection, rows) {
    lsSet(NS + 'db.' + collection, rows.slice(0, 500));
  }

  var db = {
    create: function (collection, data) {
      var name = String(collection || '').trim();
      if (!name) return Promise.reject(new Error('db.create 需要 collection'));
      var payload = data && typeof data === 'object' ? data : {};
      var row = Object.assign({}, payload, {
        id: rid(payload.id),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      var rows = readCollection(name);
      rows.unshift(row);
      writeCollection(name, rows);
      return Promise.resolve(row);
    },
    update: function (collection, id, patch) {
      var name = String(collection || '').trim();
      var target = String(id || '');
      var body = patch && typeof patch === 'object' ? patch : {};
      var rows = readCollection(name);
      var updated = null;
      var next = rows.map(function (row) {
        if (String(row.id) !== target) return row;
        updated = Object.assign({}, row, body, { id: target, updatedAt: nowIso() });
        return updated;
      });
      writeCollection(name, next);
      return Promise.resolve(updated);
    },
    get: function (collection, id) {
      var target = String(id || '');
      var rows = readCollection(String(collection || '').trim());
      var hit = null;
      for (var i = 0; i < rows.length; i += 1) {
        if (String(rows[i].id) === target) {
          hit = rows[i];
          break;
        }
      }
      return Promise.resolve(hit);
    },
    list: function (collection, query) {
      var rows = readCollection(String(collection || '').trim());
      var limit = Math.max(1, Math.min(500, Number(query && query.limit) || 100));
      return Promise.resolve(rows.slice(0, limit));
    },
    delete: function (collection, id) {
      var name = String(collection || '').trim();
      var target = String(id || '');
      var rows = readCollection(name).filter(function (row) {
        return String(row.id) !== target;
      });
      writeCollection(name, rows);
      return Promise.resolve(true);
    },
  };

  /* ---------------- 钱包 ---------------- */

  function walletSnapshot(d) {
    var balance = Number(d && d.balance) || 0;
    var label = '￥' + balance.toFixed(2);
    return {
      balance: balance,
      balanceLabel: label,
      totalBalance: balance,
      totalBalanceLabel: label,
      defaultAccountId: 'default',
      accounts: [
        { id: 'default', type: 'balance', title: '小手机钱包', balance: balance, balanceLabel: label, isDefault: true },
      ],
    };
  }

  function payWallet(p) {
    var amount = Math.max(0, Number(p && p.amount) || 0);
    if (!amount) return Promise.resolve({ ok: false, error: '付款金额不正确' });
    return httpJson('/api/phone/wallet')
      .then(function (d) {
        var balance = Number(d.balance) || 0;
        if (balance < amount) {
          return { ok: false, error: '余额不足', wallet: walletSnapshot(d) };
        }
        var nextBalance = Math.round((balance - amount) * 100) / 100;
        return httpJson('/api/phone/wallet', { method: 'POST', body: { balance: nextBalance } })
          .then(function () {
            return httpJson('/api/phone/wallet')
              .then(function (fresh) {
                return {
                  ok: true,
                  transaction: { amount: amount, title: (p && p.title) || '', detail: (p && p.detail) || '' },
                  wallet: walletSnapshot(fresh),
                };
              })
              .catch(function () {
                return { ok: true, transaction: { amount: amount }, wallet: walletSnapshot({ balance: nextBalance }) };
              });
          })
          .catch(function (e) {
            return { ok: false, error: e && e.message ? e.message : '付款失败' };
          });
      })
      .catch(function (e) {
        return { ok: false, error: e && e.message ? e.message : '读取钱包失败' };
      });
  }

  /* ---------------- 聊天 ---------------- */

  function findConversation(characterId) {
    if (characterId && CHAR_ID && characterId === CHAR_ID && CONV_ID) return Promise.resolve(CONV_ID);
    if (!characterId && CONV_ID) return Promise.resolve(CONV_ID);
    return httpJson('/api/conversations')
      .then(function (d) {
        var list = Array.isArray(d.conversations) ? d.conversations : [];
        for (var i = 0; i < list.length; i += 1) {
          if (list[i] && list[i].characterId === characterId) return list[i].id;
        }
        return CONV_ID;
      })
      .catch(function () {
        return CONV_ID;
      });
  }

  function cardToText(p) {
    var card = p && p.card;
    var lines = [];
    if (p && p.summary) lines.push(String(p.summary));
    if (card && typeof card === 'object') {
      if (card.title) lines.push(String(card.title));
      if (card.subtitle) lines.push(String(card.subtitle));
      if (card.status) lines.push('状态：' + String(card.status));
      var sections = Array.isArray(card.sections) ? card.sections : [];
      for (var i = 0; i < sections.length; i += 1) {
        var s = sections[i] || {};
        if (s.title) lines.push('· ' + String(s.title));
        var rows = Array.isArray(s.rows) ? s.rows : [];
        for (var j = 0; j < rows.length; j += 1) {
          var r = rows[j] || {};
          if (r.label || r.value) lines.push('  ' + (r.label || '') + '：' + (r.value || ''));
        }
      }
      var acts = Array.isArray(card.actions) ? card.actions : [];
      if (acts.length) {
        lines.push(
          acts
            .map(function (a) {
              return a && a.label ? '[' + a.label + ']' : '';
            })
            .filter(Boolean)
            .join(' '),
        );
      }
    }
    var text = lines.filter(Boolean).join('\n');
    return (text || '（卡片消息）').slice(0, 500);
  }

  function sendChatText(characterId, content, role) {
    if (!content) return Promise.reject(new Error('消息内容为空'));
    return findConversation(characterId).then(function (convId) {
      if (!convId) throw new Error('还没有和这个角色的会话');
      return httpJson('/api/conversations/' + encodeURIComponent(convId) + '/script-message', {
        method: 'POST',
        body: { content: content.slice(0, 500), channel: 'phone', role: role === 'assistant' ? 'assistant' : 'user' },
      });
    });
  }

  function requestReply(p) {
    var characterId = (p && p.characterId) || CHAR_ID;
    if (!characterId) return Promise.resolve({ ok: false });
    return findConversation(characterId).then(function (convId) {
      if (!convId) return { ok: false };
      // panelTrigger：不落用户消息，让角色基于刚写入的卡片/历史自己开口
      fetch('/api/chat/send', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: characterId,
          conversationId: convId,
          message: '（继续）',
          panelTrigger: true,
          channel: 'phone',
        }),
      })
        .then(function (res) {
          if (res.body && res.body.getReader) {
            var reader = res.body.getReader();
            var pump = function () {
              reader.read().then(function (r) {
                if (!r.done) pump();
              }).catch(function () {});
            };
            pump();
          }
        })
        .catch(function () {});
      return { ok: true, conversationId: convId };
    });
  }

  function readHistory(p) {
    var convId = (p && p.sessionId) || (p && p.conversationId) || CONV_ID;
    if (!convId) return Promise.resolve({ sessionId: null, messages: [] });
    var limit = Math.max(1, Math.min(200, Number(p && p.limit) || 30));
    // 默认读小手机线程；显式传 mode 时可读剧情（story）/短信/QQ，供「TA的手机」这类应用
    // 从剧情里找角色亲口说过的密码，避免应用自己生成的密码与剧情对不上
    var mode = p && p.mode;
    var q = mode === 'story' || mode === 'sms' || mode === 'qq' || mode === 'phone' ? mode : 'phone';
    return httpJson('/api/conversations/' + encodeURIComponent(convId) + '/messages?mode=' + q)
      .then(function (d) {
        var all = Array.isArray(d.messages) ? d.messages : [];
        return { sessionId: convId, messages: all.slice(-limit) };
      })
      .catch(function () {
        return { sessionId: convId, messages: [] };
      });
  }

  /* ---------------- 记忆 ---------------- */

  var memKey = function (characterId) {
    return NS + 'memory.' + (characterId || 'all');
  };

  function memList(characterId) {
    var rows = lsGet(memKey(characterId), []);
    return Array.isArray(rows) ? rows : [];
  }

  var memory = {
    add: function (p) {
      var characterId = (p && p.characterId) || CHAR_ID || '';
      var content = clampText(p && (p.content || p.text || p.summary), 2000).trim();
      if (!content) return Promise.resolve(null);
      var row = {
        id: rid(p && p.id),
        characterId: characterId,
        type: (p && p.type) || 'long_term',
        content: content,
        importance: Number(p && p.importance) || 0.5,
        reason: (p && p.reason) || '',
        createdAt: nowIso(),
      };
      var rows = memList(characterId);
      rows.unshift(row);
      lsSet(memKey(characterId), rows.slice(0, 300));
      // 同步进星聊的记忆库（免费档有条数上限，失败就不阻塞插件）
      httpJson('/api/memories', {
        method: 'POST',
        body: {
          title: clampText((p && (p.title || p.reason)) || content.slice(0, 12), 40) || '插件记忆',
          content: content,
          characterId: characterId || undefined,
        },
      }).catch(function () {});
      return Promise.resolve(row);
    },
    /** 部分插件用 memory.write 记一条记忆，等价于 add */
    write: function (p) {
      return memory.add(p);
    },
    addTimeline: function (p) {
      var characterId = (p && p.characterId) || CHAR_ID || '';
      var summary = clampText(p && (p.summary || p.content || p.text), 600).trim();
      if (!summary) return Promise.resolve({ entry: null });
      var entry = {
        id: rid(p && p.id),
        characterId: characterId,
        appLabel: (p && p.appLabel) || APP_ID,
        summary: summary,
        detail: clampText(p && p.detail, 1200),
        createdAt: nowIso(),
      };
      var rows = memList(characterId);
      rows.unshift(entry);
      lsSet(memKey(characterId), rows.slice(0, 300));
      return Promise.resolve({ entry: entry });
    },
    deleteTimeline: function (p) {
      var characterId = (p && p.characterId) || CHAR_ID || '';
      var target = String((p && (p.entryId || p.id)) || '');
      var rows = memList(characterId).filter(function (row) {
        return String(row.id) !== target;
      });
      lsSet(memKey(characterId), rows);
      return Promise.resolve(true);
    },
    readCore: function (p) {
      var characterId = (p && p.characterId) || CHAR_ID || '';
      var rows = memList(characterId).slice(0, 20);
      return Promise.resolve({
        characterId: characterId,
        entries: rows,
        items: rows,
        text: rows.map(function (r) { return '· ' + r.content; }).join('\n'),
      });
    },
    readLongTerm: function (p) {
      var characterId = (p && p.characterId) || CHAR_ID || '';
      var query = clampText(p && p.query, 200).toLowerCase();
      var rows = memList(characterId);
      if (query) {
        rows = rows.filter(function (r) {
          return String(r.content || '').toLowerCase().indexOf(query) >= 0;
        });
      }
      rows = rows.slice(0, 20);
      return Promise.resolve({
        characterId: characterId,
        entries: rows,
        items: rows,
        text: rows.map(function (r) { return '· ' + r.content; }).join('\n'),
      });
    },
    readShortTerm: function () {
      return Promise.resolve({ entries: [], items: [], text: '' });
    },
    search: function (p) {
      return memory.readLongTerm(p);
    },
    suggest: function () {
      return Promise.resolve({ ok: true });
    },
  };

  /* ---------------- 媒体库（IndexedDB，失败退回内存） ---------------- */

  var mediaMem = {};
  var mediaDbPromise = null;

  function openMediaDb() {
    if (mediaDbPromise) return mediaDbPromise;
    mediaDbPromise = new Promise(function (resolve, reject) {
      try {
        var req = indexedDB.open('starchat-phone-media', 1);
        req.onupgradeneeded = function () {
          var d = req.result;
          if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
        };
        req.onsuccess = function () {
          resolve(req.result);
        };
        req.onerror = function () {
          reject(req.error || new Error('媒体库不可用'));
        };
      } catch (e) {
        reject(e);
      }
    }).catch(function () {
      return null;
    });
    return mediaDbPromise;
  }

  function mediaPutDataUrl(dataUrl) {
    var id = 'm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    return openMediaDb().then(function (db) {
      if (!db) {
        mediaMem[id] = dataUrl;
        return { ref: 'media://' + id, id: id };
      }
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction('blobs', 'readwrite');
          tx.objectStore('blobs').put(dataUrl, id);
          tx.oncomplete = function () {
            resolve({ ref: 'media://' + id, id: id });
          };
          tx.onerror = function () {
            mediaMem[id] = dataUrl;
            resolve({ ref: 'media://' + id, id: id });
          };
        } catch (e) {
          mediaMem[id] = dataUrl;
          resolve({ ref: 'media://' + id, id: id });
        }
      });
    });
  }

  function mediaGetRef(ref) {
    var id = String(ref || '').replace(/^media:\/\//, '');
    if (!id) return Promise.resolve(null);
    if (mediaMem[id]) return Promise.resolve({ ref: 'media://' + id, id: id, dataUrl: mediaMem[id] });
    return openMediaDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction('blobs', 'readonly');
          var req = tx.objectStore('blobs').get(id);
          req.onsuccess = function () {
            var url = req.result || mediaMem[id] || null;
            resolve(url ? { ref: 'media://' + id, id: id, dataUrl: url } : null);
          };
          req.onerror = function () {
            resolve(null);
          };
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  function pickFile(accept) {
    return new Promise(function (resolve, reject) {
      var input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = String(accept);
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.onchange = function () {
        var file = input.files && input.files[0];
        document.body.removeChild(input);
        if (!file) {
          resolve(null);
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          resolve({ file: { name: file.name, type: file.type, size: file.size, dataUrl: String(reader.result || '') } });
        };
        reader.onerror = function () {
          reject(new Error('文件读取失败'));
        };
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  /* ---------------- 任务 / 通知（本地） ---------------- */

  function taskKey() {
    return NS + 'tasks';
  }

  /* ---------------- AI ---------------- */

  function aiText(payload) {
    var p = payload || {};
    var body = {
      characterId: p.characterId || undefined,
      appTags: p.appTags || undefined,
      instruction: p.instruction || p.prompt || undefined,
      messages: Array.isArray(p.messages) ? p.messages : undefined,
      system: p.system || undefined,
      maxTokens: p.maxTokens || undefined,
      phoneGame: GAME_TICKET ? true : undefined,
      gameTicket: GAME_TICKET || undefined,
      gameId: GAME_ID || undefined,
    };
    return httpJson('/api/phone/apps/ai', { method: 'POST', body: body });
  }

  /** 本地文本向量（64 维哈希），用于没有嵌入接口时的相似度兜底 */
  function localEmbed(text) {
    var v = [];
    var i;
    for (i = 0; i < 64; i += 1) v.push(0);
    var s = String(text || '');
    for (i = 0; i < s.length; i += 1) {
      var code = s.charCodeAt(i);
      v[code % 64] += 1;
      v[(code * 7 + i) % 64] += 0.5;
    }
    var norm = Math.sqrt(
      v.reduce(function (a, b) {
        return a + b * b;
      }, 0),
    ) || 1;
    return v.map(function (x) {
      return Math.round((x / norm) * 10000) / 10000;
    });
  }

  var ai = {
    generate: function (payload) {
      return aiText(payload);
    },
    chat: function (payload) {
      return aiText(payload).then(function (d) {
        return { text: d.text, message: { role: 'assistant', content: d.text } };
      });
    },
    generateImage: function (payload) {
      var p = payload || {};
      var prompt = clampText(p.prompt || p.instruction, 480).trim();
      if (!prompt) return Promise.reject(new Error('缺少图片描述'));
      return httpJson('/api/image/generate', { method: 'POST', body: { prompt: prompt } }).then(function (d) {
        return { url: d.url, dataUrl: d.url, imageUrl: d.url };
      });
    },
    classify: function (p) {
      var o = p || {};
      var text = clampText(o.text || o.input || o.content, 800).trim();
      var labels = (Array.isArray(o.labels) ? o.labels : []).map(String).slice(0, 20);
      if (!labels.length) return Promise.reject(new Error('ai.classify 需要 labels'));
      if (!text) return Promise.resolve({ label: labels[0], labels: labels, scores: {} });
      return aiText({
        instruction:
          '把下面的内容归到给定标签之一，只输出标签原文，不要解释、不要标点。\n标签：' +
          labels.join('、') +
          '\n内容：' +
          text,
        maxTokens: 32,
      }).then(function (d) {
        var t = String(d.text || '').trim();
        var hit = labels.filter(function (l) {
          return t.indexOf(l) >= 0;
        })[0] || labels[0];
        var scores = {};
        labels.forEach(function (l) {
          scores[l] = l === hit ? 1 : 0;
        });
        return { label: hit, labels: labels, scores: scores };
      });
    },
    embed: function (p) {
      var t = clampText((p && (p.text || p.input || p.content)) || '', 2000);
      return Promise.resolve({ vector: localEmbed(t), dimension: 64 });
    },
  };

  /* ---------------- 其它模块（有就用，没有的给出明确报错） ---------------- */

  function unsupported(name) {
    return function () {
      return Promise.reject(new Error('当前小手机暂不支持 ' + name));
    };
  }

  var noopOk = function () {
    return Promise.resolve({ ok: true });
  };

  var events = {};
  var eventHandlers = {};
  var toolHandlers = {};

  function onEvent(name, handler) {
    var key = String(name || '').trim();
    if (!key || typeof handler !== 'function') return function () {};
    (eventHandlers[key] || (eventHandlers[key] = [])).push(handler);
    return function () {
      var list = eventHandlers[key] || [];
      eventHandlers[key] = list.filter(function (h) {
        return h !== handler;
      });
    };
  }

  function emitEvent(name, payload) {
    var list = (eventHandlers[name] || []).slice();
    var wildcard = (eventHandlers['*'] || []).slice();
    list.concat(wildcard).forEach(function (handler) {
      try {
        handler(payload, name);
      } catch (e) {
        console.warn('[AiPhone] 事件处理出错：' + name, e);
      }
    });
  }

  /* ---------------- 本地房间：联机位由小手机里的角色来坐 ----------------
   * 没有真人联机后端时，room.create / join 会开一间本地房间，
   * 席位 = 你 + 角色列表里的角色（AI），这样「联机游戏」也能和角色一起玩。
   */
  var roomState = null;

  function roomPublic() {
    if (!roomState) return null;
    return {
      code: roomState.code,
      title: roomState.title,
      isHost: true,
      selfUserId: 'self',
      local: true,
      maxPlayers: roomState.maxPlayers,
      players: roomState.players.slice(),
      createdAt: roomState.createdAt,
    };
  }

  function pushRoomPlayers() {
    emitEvent('room.players', { players: roomState ? roomState.players.slice() : [] });
  }

  function createLocalRoom(p) {
    return loadCharacters().then(function (chars) {
      var maxPlayers = Math.max(2, Math.min(12, Number(p && p.maxPlayers) || 8));
      var me = {
        userId: 'self',
        name: USER_NAME || '我',
        isHost: true,
        isAI: false,
        avatar: USER_AVATAR || '',
      };
      var aiPlayers = chars.slice(0, Math.max(0, maxPlayers - 1)).map(function (c) {
        return {
          userId: 'ai_' + c.id,
          name: c.name,
          isHost: false,
          isAI: true,
          characterId: c.id,
          avatar: c.avatar || '',
        };
      });
      roomState = {
        code: String(Math.floor(1000 + Math.random() * 9000)),
        title: (p && p.title) || '小手机房间',
        isHost: true,
        selfUserId: 'self',
        maxPlayers: maxPlayers,
        players: [me].concat(aiPlayers),
        state: null,
        createdAt: nowIso(),
      };
      setTimeout(pushRoomPlayers, 30);
      return roomPublic();
    });
  }

  var api = {
    __starchatHost: true,
    on: onEvent,
    off: function (name, handler) {
      var key = String(name || '').trim();
      if (!key) return false;
      if (!handler) {
        delete eventHandlers[key];
        return true;
      }
      eventHandlers[key] = (eventHandlers[key] || []).filter(function (h) {
        return h !== handler;
      });
      return true;
    },
    app: {
      getManifest: function () {
        return fetch('/phone-apps/' + APP_ID + '/manifest.json', { cache: 'force-cache' })
          .then(function (r) {
            return r.ok ? r.json() : {};
          })
          .catch(function () {
            return {};
          });
      },
      getCapabilities: function () {
        return Promise.resolve({ sdkVersion: '1.0', platform: 'starchat-phone', permissions: [] });
      },
      getLaunchContext: function () {
        return Promise.resolve(launchContext);
      },
      getAssetUrl: function (path) {
        try {
          return Promise.resolve(new URL(String(path || ''), location.href).href);
        } catch (e) {
          return Promise.resolve(String(path || ''));
        }
      },
      close: function () {
        try {
          parent.postMessage({ source: 'starchat-phone-app', type: 'close' }, '*');
        } catch (e) {
          /* ignore */
        }
        return Promise.resolve(true);
      },
    },
    db: db,
    ai: ai,
    image: { generate: ai.generateImage },
    user: {
      getProfile: function () {
        return loadProfile();
      },
      getPersona: function (p) {
        var characterId = (p && p.characterId) || CHAR_ID;
        return httpJson('/api/personas' + (characterId ? '?characterId=' + encodeURIComponent(characterId) : ''))
          .then(function (d) {
            return { characterId: characterId || '', text: (d && (d.text || d.persona)) || '' };
          })
          .catch(function () {
            return { characterId: characterId || '', text: '' };
          });
      },
      getPreferences: function () {
        return Promise.resolve({ id: 'self', text: '', customSettings: '' });
      },
      listIdentities: function () {
        return Promise.resolve([]);
      },
    },
    characters: {
      list: function () {
        return loadCharacters();
      },
      get: function (id) {
        return getCharacter(id);
      },
      open: unsupported('characters.open'),
      create: unsupported('characters.create'),
      update: unsupported('characters.update'),
      getBindings: function () {
        return Promise.resolve({});
      },
      listWorlds: function () {
        return Promise.resolve([]);
      },
      readState: function (p) {
        var id = (p && (p.characterId || p.id)) || CHAR_ID || '';
        return Promise.resolve(lsGet(NS + 'charstate.' + id, {}));
      },
      writeState: function (p) {
        var id = (p && (p.characterId || p.id)) || CHAR_ID || '';
        var key = NS + 'charstate.' + id;
        var next = Object.assign({}, lsGet(key, {}), (p && (p.state || p.data)) || {});
        lsSet(key, next);
        return Promise.resolve(next);
      },
      readRelations: function () {
        return loadCharacters().then(function (list) {
          return list.map(function (c) {
            return {
              characterId: c.id,
              id: c.id,
              name: c.name,
              relation: '',
              affinity: 0,
              messageCount: 0,
            };
          });
        });
      },
    },
    wallet: {
      get: function () {
        return httpJson('/api/phone/wallet')
          .then(function (d) {
            return walletSnapshot(d);
          })
          .catch(function () {
            return walletSnapshot({ balance: 0 });
          });
      },
      pay: payWallet,
    },
    chat: {
      getCurrentSession: function () {
        return Promise.resolve({ sessionId: CONV_ID, conversationId: CONV_ID, characterId: CHAR_ID, characterName: CHAR_NAME });
      },
      readHistory: readHistory,
      sendMessage: function (p) {
        var characterId = (p && (p.characterId || p.charId)) || CHAR_ID;
        return sendChatText(characterId, clampText(p && (p.text || p.content || p.message), 500), p && p.role);
      },
      sendCard: function (p) {
        var characterId = (p && p.characterId) || CHAR_ID;
        return sendChatText(characterId, cardToText(p), (p && p.role) || 'user');
      },
      writeHistory: function (p) {
        var characterId = (p && p.characterId) || CHAR_ID;
        var list = Array.isArray(p && p.messages) ? p.messages : null;
        if (list && list.length) {
          var jobs = list.map(function (m) {
            return sendChatText(characterId, clampText(m && m.content, 500), m && m.role).catch(function () {});
          });
          return Promise.all(jobs).then(function () {
            return { ok: true };
          });
        }
        return sendChatText(characterId, clampText(p && (p.content || p.text), 500), p && p.role);
      },
      requestReply: requestReply,
      updateCard: noopOk,
      openConversation: noopOk,
      setContactState: noopOk,
      block: noopOk,
      unblock: noopOk,
      mute: noopOk,
      unmute: noopOk,
      /** 联系人状态：本地记录免打扰/拉黑等标记，供插件读写 */
      contacts: {
        write: function (p) {
          var o = p || {};
          var id = String(o.characterId || o.id || '');
          if (!id) return Promise.resolve(false);
          var key = NS + 'contacts';
          var map = lsGet(key, {});
          map[id] = Object.assign({}, map[id] || {}, o);
          lsSet(key, map);
          return Promise.resolve(true);
        },
        read: function (p) {
          var map = lsGet(NS + 'contacts', {});
          var id = String((p && (p.characterId || p.id)) || '');
          return Promise.resolve(id ? map[id] || null : map);
        },
        list: function () {
          return Promise.resolve(lsGet(NS + 'contacts', {}));
        },
      },
    },
    memory: memory,
    media: {
      pick: pickFile,
      /** 部分应用把「生图」挂在 media 下，直接复用统一生图通道 */
      generateImage: function (p) {
        return ai.generateImage(p);
      },
      put: function (p) {
        var dataUrl = p && (p.dataUrl || p.data || p.url);
        if (typeof dataUrl !== 'string' || !dataUrl) return Promise.reject(new Error('media.put 需要 dataUrl'));
        if (dataUrl.length > 34 * 1000 * 1000) return Promise.reject(new Error('文件太大'));
        return mediaPutDataUrl(dataUrl);
      },
      get: function (p) {
        return mediaGetRef(p && (p.ref || p.id));
      },
      save: function (p) {
        var dataUrl = p && (p.dataUrl || p.data);
        return mediaPutDataUrl(dataUrl);
      },
      revoke: function () {
        return Promise.resolve(true);
      },
      delete: function () {
        return Promise.resolve(true);
      },
    },
    tasks: {
      schedule: function (p) {
        var rows = lsGet(taskKey(), []);
        var row = {
          id: rid(p && p.id),
          title: clampText(p && (p.title || p.name), 80),
          payload: (p && p.payload) || null,
          runAt: (p && (p.runAt || p.delayMs)) || null,
          createdAt: nowIso(),
        };
        rows.unshift(row);
        lsSet(taskKey(), rows.slice(0, 100));
        return Promise.resolve(row);
      },
      list: function () {
        return Promise.resolve(lsGet(taskKey(), []));
      },
      cancel: function (id) {
        var target = String((id && id.id) || id || '');
        var rows = lsGet(taskKey(), []).filter(function (row) {
          return String(row.id) !== target;
        });
        lsSet(taskKey(), rows);
        return Promise.resolve(true);
      },
    },
    notifications: {
      create: noopOk,
      list: function () {
        return Promise.resolve([]);
      },
      markRead: noopOk,
      markAllRead: noopOk,
      getBadge: function () {
        return Promise.resolve(Number(lsGet(NS + 'badge', 0)) || 0);
      },
      setBadge: function (count) {
        var n = Math.max(0, Math.min(999, Math.floor(Number(count) || 0)));
        lsSet(NS + 'badge', n);
        return Promise.resolve(n);
      },
      incrementBadge: function (delta) {
        var n = Math.max(0, Math.min(999, (Number(lsGet(NS + 'badge', 0)) || 0) + (Number(delta) || 1)));
        lsSet(NS + 'badge', n);
        return Promise.resolve(n);
      },
      clearBadge: function () {
        lsSet(NS + 'badge', 0);
        return Promise.resolve(0);
      },
    },
    ui: {
      toast: function (message) {
        showToast(message);
        return Promise.resolve(true);
      },
      showNotification: function (p) {
        showToast((p && (p.title || p.message)) || '');
        return Promise.resolve(true);
      },
      confirm: function (p) {
        var title = (p && p.title) || '提示';
        var message = (p && (p.message || p.content)) || '';
        try {
          return Promise.resolve(window.confirm(title + (message ? '\n\n' + message : '')));
        } catch (e) {
          return Promise.resolve(false);
        }
      },
      showSmsThread: noopOk,
      showCallScreen: noopOk,
    },
    network: {
      fetch: function (p) {
        var o = p || {};
        var url = o.url || o.input;
        if (!url) return Promise.reject(new Error('network.fetch 需要 url'));
        return fetch(url, {
          method: o.method || 'GET',
          headers: o.headers || {},
          body: o.body === undefined ? undefined : typeof o.body === 'string' ? o.body : JSON.stringify(o.body),
        }).then(function (res) {
          return res.text().then(function (text) {
            var json = null;
            try {
              json = JSON.parse(text);
            } catch (e) {
              /* 不是 JSON 就只返回文本 */
            }
            return { ok: res.ok, status: res.status, text: text, json: json, data: json };
          });
        });
      },
    },
    calendar: {
      read: function () {
        return Promise.resolve({ events: lsGet(NS + 'calendar', []) });
      },
      list: function () {
        return Promise.resolve(lsGet(NS + 'calendar', []));
      },
      write: function (p) {
        var rows = lsGet(NS + 'calendar', []);
        rows.push(Object.assign({ id: rid(p && p.id), createdAt: nowIso() }, p || {}));
        lsSet(NS + 'calendar', rows.slice(0, 500));
        return Promise.resolve({ ok: true });
      },
    },
    world: {
      read: function () {
        return Promise.resolve([]);
      },
      list: function () {
        return Promise.resolve([]);
      },
      get: function () {
        return Promise.resolve(null);
      },
      write: unsupported('world.write'),
      activate: noopOk,
    },
    voice: {
      readProfiles: function () {
        return Promise.resolve({ profiles: [], selected: null });
      },
      /** 用角色音色把文字读出来：走星聊的 /api/tts，返回 dataUrl 供 voice.play 播放 */
      tts: function (p) {
        var o = p || {};
        var text = clampText(o.text || o.input, 500).trim();
        if (!text) return Promise.reject(new Error('voice.tts 需要 text'));
        return fetch('/api/tts', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: text,
            characterId: o.characterId || CHAR_ID || undefined,
          }),
        }).then(function (res) {
          if (!res.ok) {
            return res
              .json()
              .catch(function () {
                return {};
              })
              .then(function (d) {
                throw new Error((d && d.message) || '语音合成失败（' + res.status + '）');
              });
          }
          return res.blob();
        }).then(function (blob) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              resolve({ ok: true, dataUrl: String(reader.result || ''), contentType: blob.type || 'audio/mpeg' });
            };
            reader.onerror = function () {
              reject(new Error('语音读取失败'));
            };
            reader.readAsDataURL(blob);
          });
        });
      },
      stt: unsupported('voice.stt'),
      record: unsupported('voice.record'),
      stopRecord: noopOk,
      clone: unsupported('voice.clone'),
      play: function (p) {
        var src = (p && (p.dataUrl || p.src || p.url)) || '';
        if (!src) return Promise.reject(new Error('voice.play 需要 dataUrl'));
        try {
          if (currentAudio) {
            try {
              currentAudio.pause();
            } catch (e) {
              /* ignore */
            }
          }
          var audio = new Audio(src);
          currentAudio = audio;
          var pr = audio.play();
          if (pr && typeof pr.catch === 'function') pr.catch(function () {});
          return Promise.resolve({ ok: true });
        } catch (e) {
          return Promise.reject(e);
        }
      },
      stopPlayback: function () {
        if (currentAudio) {
          try {
            currentAudio.pause();
          } catch (e) {
            /* ignore */
          }
          currentAudio = null;
        }
        return Promise.resolve(true);
      },
      pausePlayback: function () {
        if (currentAudio) {
          try {
            currentAudio.pause();
          } catch (e) {
            /* ignore */
          }
        }
        return Promise.resolve(true);
      },
      resumePlayback: function () {
        if (currentAudio) {
          try {
            currentAudio.play();
          } catch (e) {
            /* ignore */
          }
        }
        return Promise.resolve(true);
      },
    },
    bridge: {
      send: noopOk,
      readState: function () {
        return Promise.resolve({});
      },
    },
    room: {
      /** 本地房间：席位自动由「你 + 角色列表」组成，不需要真人联机 */
      create: function (p) {
        return createLocalRoom(p);
      },
      join: function () {
        if (roomState) return Promise.resolve(roomPublic());
        return createLocalRoom({ title: '小手机房间', maxPlayers: 8 });
      },
      current: function () {
        return Promise.resolve(roomPublic());
      },
      send: function () {
        // 本地房间里没有别的真机，广播只当回声；角色互动由各应用自己的 AI 通道完成
        return Promise.resolve({ ok: true, local: true });
      },
      setState: function (state) {
        if (roomState) roomState.state = state;
        return Promise.resolve(true);
      },
      getState: function () {
        return Promise.resolve(roomState ? roomState.state : null);
      },
      players: function () {
        return Promise.resolve(roomState ? roomState.players.slice() : []);
      },
      kick: function (userId) {
        if (!roomState) return Promise.resolve(false);
        var target = String((userId && userId.userId) || userId || '');
        roomState.players = roomState.players.filter(function (p) {
          return String(p.userId) !== target;
        });
        setTimeout(pushRoomPlayers, 0);
        return Promise.resolve(true);
      },
      close: function () {
        if (!roomState) return Promise.resolve(false);
        roomState = null;
        setTimeout(function () {
          emitEvent('room.closed', { reason: 'host_closed' });
        }, 0);
        return Promise.resolve(true);
      },
      leave: function () {
        if (!roomState) return Promise.resolve(false);
        roomState = null;
        setTimeout(function () {
          emitEvent('room.closed', { reason: 'left' });
        }, 0);
        return Promise.resolve(true);
      },
      report: noopOk,
    },
    cloud: {
      put: function (p) {
        var o = p || {};
        var id = rid(o.id);
        var row = Object.assign({}, o, { id: id, createdAt: nowIso() });
        var rows = lsGet(NS + 'cloud', []);
        rows.unshift(row);
        lsSet(NS + 'cloud', rows.slice(0, 200));
        return Promise.resolve({ ok: true, id: id, item: row });
      },
      get: function (p) {
        var id = String((p && (p.id || p.ref)) || '');
        var rows = lsGet(NS + 'cloud', []);
        var hit =
          rows.filter(function (r) {
            return String(r.id) === id;
          })[0] || null;
        return Promise.resolve(hit);
      },
      list: function () {
        return Promise.resolve(lsGet(NS + 'cloud', []));
      },
      update: function (p) {
        var o = p || {};
        var id = String(o.id || '');
        var rows = lsGet(NS + 'cloud', []).map(function (r) {
          return String(r.id) === id ? Object.assign({}, r, o, { updatedAt: nowIso() }) : r;
        });
        lsSet(NS + 'cloud', rows);
        return Promise.resolve(true);
      },
      delete: function (p) {
        var id = String((p && (p.id || p.ref)) || '');
        lsSet(
          NS + 'cloud',
          lsGet(NS + 'cloud', []).filter(function (r) {
            return String(r.id) !== id;
          }),
        );
        return Promise.resolve(true);
      },
      takeRandom: function () {
        var rows = lsGet(NS + 'cloud', []);
        return Promise.resolve(rows.length ? rows[Math.floor(Math.random() * rows.length)] : null);
      },
      report: noopOk,
    },
    regex: {
      list: function () {
        return Promise.resolve([]);
      },
      get: function () {
        return Promise.resolve(null);
      },
      create: unsupported('regex.create'),
      update: unsupported('regex.update'),
      delete: unsupported('regex.delete'),
    },
    story: {
      listOpeningSets: function () {
        return Promise.resolve([]);
      },
      getBindings: function () {
        return Promise.resolve({});
      },
    },
    tools: {
      /** 插件里的 tools.register 与 handle 等价 */
      register: function (name, fn) {
        var key = String(name || '');
        if (!key || typeof fn !== 'function') return function () {};
        toolHandlers[key] = fn;
        return function () {
          if (toolHandlers[key] === fn) delete toolHandlers[key];
        };
      },
      handle: function (name, fn) {
        var key = String(name || '');
        if (!key || typeof fn !== 'function') return function () {};
        toolHandlers[key] = fn;
        return function () {
          if (toolHandlers[key] === fn) delete toolHandlers[key];
        };
      },
      invoke: function (name, args, context) {
        var key = String(name || '');
        var fn = toolHandlers[key];
        if (typeof fn !== 'function') return Promise.reject(new Error('没有这个工具：' + key));
        return Promise.resolve().then(function () {
          return fn(args || {}, context || {});
        });
      },
      list: function () {
        return Promise.resolve(Object.keys(toolHandlers));
      },
    },
    /** 一次性拿齐启动上下文 / 用户资料 / 角色列表（部分应用用 context.get） */
    context: {
      get: function () {
        return Promise.all([loadProfile(), loadCharacters()]).then(function (arr) {
          return {
            appId: APP_ID,
            conversationId: CONV_ID,
            characterId: CHAR_ID,
            characterName: CHAR_NAME,
            userName: USER_NAME,
            userAvatar: USER_AVATAR,
            launch: launchContext,
            user: arr[0] || null,
            characters: arr[1] || [],
          };
        });
      },
    },
    /** 环境自检：插件据此决定是否开启某些功能 */
    env: {
      check: function () {
        return Promise.resolve({
          ok: true,
          platform: 'starchat-phone',
          sdkVersion: '1.0',
          appId: APP_ID,
          features: {
            ai: true,
            image: true,
            media: true,
            voice: true,
            room: true,
            cloud: true,
            memory: true,
            wallet: true,
          },
        });
      },
    },
    events: {
      subscribe: noopOk,
      unsubscribe: noopOk,
    },
  };

  /* ---------------- 游戏 SDK（AiPhoneGame） ----------------
   * 供「谁是卧底」这类游戏型插件直接调用：拿角色、拿玩家资料、按角色调用模型。
   */
  var gameApi = {
    listAvailableCharacters: function () {
      return loadCharacters();
    },
    getPlayerProfile: function () {
      return loadProfile().then(function (p) {
        return { id: p.id, name: p.name, avatar: p.avatarUrl, avatarUrl: p.avatarUrl };
      });
    },
    getRoleLightPackage: function (characterId) {
      return getCharacter(characterId).then(function (c) {
        if (!c) return null;
        var system = [
          '你正在扮演「' + c.name + '」。',
          c.personality ? '性格：' + c.personality : '',
          c.description ? '人设：' + c.description : '',
        ]
          .filter(Boolean)
          .join('\n');
        return {
          id: c.id,
          characterId: c.id,
          name: c.name,
          avatar: c.avatar,
          avatarUrl: c.avatar,
          tags: c.tags,
          persona: c.persona,
          messages: [{ role: 'system', content: system }],
        };
      });
    },
    callLLM: function (p) {
      var o = p || {};
      return aiText({
        characterId: o.characterId,
        messages: o.messages,
        system: o.system,
        maxTokens: o.maxTokens,
      }).then(function (d) {
        return { content: d.text, text: d.text };
      });
    },
    callGlobalLLM: function (p) {
      var o = p || {};
      return aiText({ messages: o.messages, system: o.system, maxTokens: o.maxTokens }).then(function (d) {
        return { content: d.text, text: d.text };
      });
    },
    /** 一局打完：把战报写进参与角色的记忆里，下次聊天他们能想起来 */
    recordGameEvent: function (p) {
      var o = p || {};
      var summary = clampText(o.summary, 400).trim();
      var ids = Array.isArray(o.characterIds) ? o.characterIds : [];
      if (!summary) return Promise.resolve({ ok: true });
      ids.slice(0, 6).forEach(function (characterId) {
        if (typeof characterId !== 'string' || !characterId) return;
        var row = {
          id: rid(),
          characterId: characterId,
          type: 'long_term',
          content: summary,
          importance: 0.6,
          reason: '一起玩游戏',
          createdAt: nowIso(),
        };
        var rows = memList(characterId);
        rows.unshift(row);
        lsSet(memKey(characterId), rows.slice(0, 300));
        httpJson('/api/memories', {
          method: 'POST',
          body: { title: '一起玩了一局游戏', content: summary, characterId: characterId },
        }).catch(function () {});
      });
      return Promise.resolve({ ok: true });
    },
    // 部分游戏会顺手存一下自己的状态
    saveState: function (state) {
      lsSet(NS + 'game.state', state);
      return Promise.resolve(true);
    },
    loadState: function () {
      return Promise.resolve(lsGet(NS + 'game.state', null));
    },
  };

  window.AiPhone = api;
  window.AiPhoneApp = api;
  window.AiPhoneGame = gameApi;
  // 让插件里的自定义事件（如果有）也能被宿主统一转发
  window.AiPhoneEvents = events;
})();
