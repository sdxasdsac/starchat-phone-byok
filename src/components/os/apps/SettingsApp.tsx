'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { usePhone } from '../PhoneContext';
import type { Settings, TtsProvider } from '@/lib/types';
import { VOICE_PRESETS } from '@/lib/defaults';
import { compressImage } from '@/lib/image-utils';
import { exportAll, importAll, clearAll } from '@/lib/store';
import { generateImage, synthesizeSpeech, testTextApi } from '@/lib/api';
import { Avatar, ErrorNote, Field, ICONS, Mdi, Screen, Spinner } from '../ui';

type TestState = { busy: boolean; ok?: string; fail?: string };

const IDLE: TestState = { busy: false };

export function SettingsApp({ onClose }: { onClose: () => void }) {
  const { settings, setSettings, personas } = usePhone();
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [textTest, setTextTest] = useState<TestState>(IDLE);
  const [ttsTest, setTtsTest] = useState<TestState>(IDLE);
  const [imgTest, setImgTest] = useState<TestState>(IDLE);
  const [imgPreview, setImgPreview] = useState('');
  const avatarRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const set = (patch: Partial<Settings>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };
  const setText = (patch: Partial<Settings['text']>) => set({ text: { ...draft.text, ...patch } });
  const setImage = (patch: Partial<Settings['image']>) => set({ image: { ...draft.image, ...patch } });
  const setTts = (patch: Partial<Settings['tts']>) => set({ tts: { ...draft.tts, ...patch } });
  const setStt = (patch: Partial<Settings['stt']>) => set({ stt: { ...draft.stt, ...patch } });
  const setUser = (patch: Partial<Settings['user']>) => set({ user: { ...draft.user, ...patch } });

  const save = () => {
    setSettings(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const runTextTest = async () => {
    setTextTest({ busy: true });
    try {
      const reply = await testTextApi(draft.text, draft.apiMode);
      setTextTest({ busy: false, ok: `连接成功：${reply.slice(0, 40)}` });
    } catch (err) {
      setTextTest({ busy: false, fail: err instanceof Error ? err.message : '连接失败' });
    }
  };

  const runTtsTest = async () => {
    setTtsTest({ busy: true });
    try {
      if (draft.tts.provider === 'browser') {
        window.speechSynthesis?.cancel();
        const u = new SpeechSynthesisUtterance('你好，我是你的小手机。');
        u.lang = 'zh-CN';
        window.speechSynthesis?.speak(u);
        setTtsTest({ busy: false, ok: '已用系统朗读播放' });
        return;
      }
      const blob = await synthesizeSpeech(draft, '你好，我是你的小手机。');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setTtsTest({ busy: false, ok: '播放成功' });
    } catch (err) {
      setTtsTest({ busy: false, fail: err instanceof Error ? err.message : '语音测试失败' });
    }
  };

  const runImageTest = async () => {
    setImgTest({ busy: true });
    setImgPreview('');
    try {
      const result = await generateImage(draft, '一只坐在窗台上的橘猫，水彩插画，柔和阳光');
      setImgPreview(result.dataUrl ?? result.url ?? '');
      setImgTest({ busy: false, ok: '生图成功' });
    } catch (err) {
      setImgTest({ busy: false, fail: err instanceof Error ? err.message : '生图测试失败' });
    }
  };

  const onAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setUser({ avatar: await compressImage(file, 240) });
    } catch {
      /* ignore */
    }
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      importAll(await file.text());
      window.location.reload();
    } catch {
      window.alert('备份文件解析失败');
    }
  };

  return (
    <Screen
      title="设置"
      subtitle="API Key 只保存在本机浏览器"
      onBack={onClose}
      right={
        <button type="button" className="text-btn" onClick={save}>
          {saved ? '已保存' : '保存'}
        </button>
      }
    >
      <section className="settings-hero">
        <Avatar name={draft.user.name || '我'} avatar={draft.user.avatar} size={56} />
        <div>
          <input
            className="input bare"
            value={draft.user.name}
            onChange={(e) => setUser({ name: e.target.value })}
            placeholder="你的名字"
          />
          <textarea
            className="textarea bare"
            rows={2}
            value={draft.user.bio}
            onChange={(e) => setUser({ bio: e.target.value })}
            placeholder="介绍一下你自己，角色会据此称呼你"
          />
        </div>
        <button type="button" className="icon-btn-plain" onClick={() => avatarRef.current?.click()} aria-label="换头像">
          <Mdi path={ICONS.upload} size={18} />
        </button>
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => void onAvatar(e)} />
      </section>

      <details className="settings-group">
        <summary>剧情预设</summary>
        <Field
          label="MUFY 剧情预设"
          hint="从 starchat 复制过来的内置预设，约 2 万字；开启后每次请求都会附带，token 消耗会明显增加。"
        >
          <button
            type="button"
            className={draft.presetEnabled ? 'primary-btn' : 'soft-btn'}
            onClick={() => set({ presetEnabled: !draft.presetEnabled })}
          >
            {draft.presetEnabled ? '已启用（点击关闭）' : '启用预设'}
          </button>
        </Field>
        <Field
          label="我的预设"
          hint="自己写的剧情/风格指令，每次请求都会附带；支持 {{char}} 和 {{user}} 占位符。"
        >
          <textarea
            className="textarea"
            rows={4}
            value={draft.presetText ?? ''}
            onChange={(e) => set({ presetText: e.target.value })}
            placeholder="例如：回复要短，多用语气词，偶尔发emoji…"
          />
        </Field>
        <Field label="角色主动发消息" hint="进入聊天时，如果很久没聊，角色会先给你发一条。">
          <button
            type="button"
            className={draft.proactive ? 'primary-btn' : 'soft-btn'}
            onClick={() => set({ proactive: !draft.proactive })}
          >
            {draft.proactive ? '已开启（点击关闭）' : '开启'}
          </button>
        </Field>
      </details>

      <details className="settings-group" open>
        <summary>文字模型</summary>
        <Field label="Base URL" hint="OpenAI 兼容地址，例如 https://api.deepseek.com/v1">
          <input className="input" value={draft.text.baseUrl} onChange={(e) => setText({ baseUrl: e.target.value })} placeholder="https://api.deepseek.com/v1" />
        </Field>
        <Field label="API Key">
          <input className="input" type="password" value={draft.text.apiKey} onChange={(e) => setText({ apiKey: e.target.value })} placeholder="sk-..." />
        </Field>
        <Field label="模型名">
          <input className="input" value={draft.text.model} onChange={(e) => setText({ model: e.target.value })} placeholder="deepseek-chat" />
        </Field>
        <div className="field-row">
          <Field label="温度">
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={draft.text.temperature}
              onChange={(e) => setText({ temperature: Number(e.target.value) })}
            />
          </Field>
          <Field label="最大 tokens">
            <input
              className="input"
              type="number"
              min="64"
              max="8192"
              value={draft.text.maxTokens}
              onChange={(e) => setText({ maxTokens: Number(e.target.value) })}
            />
          </Field>
        </div>
        <TestRow state={textTest} onTest={() => void runTextTest()} label="测试连接" />
      </details>

      <details className="settings-group">
        <summary>图像 API</summary>
        <Field label="Base URL" hint="OpenAI 兼容 /images/generations">
          <input className="input" value={draft.image.baseUrl} onChange={(e) => setImage({ baseUrl: e.target.value })} />
        </Field>
        <Field label="API Key">
          <input className="input" type="password" value={draft.image.apiKey} onChange={(e) => setImage({ apiKey: e.target.value })} />
        </Field>
        <Field label="模型名">
          <input className="input" value={draft.image.model} onChange={(e) => setImage({ model: e.target.value })} placeholder="gpt-image-1 / dall-e-3" />
        </Field>
        <Field label="尺寸">
          <select className="input" value={draft.image.size} onChange={(e) => setImage({ size: e.target.value })}>
            <option value="1024x1024">1024×1024</option>
            <option value="1024x1536">1024×1536</option>
            <option value="1536x1024">1536×1024</option>
            <option value="512x512">512×512</option>
          </select>
        </Field>
        <TestRow state={imgTest} onTest={() => void runImageTest()} label="测试生图（会消耗额度）" />
        {imgPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="test-preview" src={imgPreview} alt="生图测试" />
        ) : null}
      </details>

      <details className="settings-group">
        <summary>语音合成</summary>
        <Field label="服务商">
          <select
            className="input"
            value={draft.tts.provider}
            onChange={(e) => setTts({ provider: e.target.value as TtsProvider })}
          >
            <option value="volc">火山引擎 · 豆包语音合成 2.0</option>
            <option value="minimax">MiniMax</option>
            <option value="openai">OpenAI 兼容 /audio/speech</option>
            <option value="browser">浏览器自带朗读（免费）</option>
          </select>
        </Field>

        {draft.tts.provider !== 'browser' ? (
          <Field label="API Key">
            <input className="input" type="password" value={draft.tts.apiKey} onChange={(e) => setTts({ apiKey: e.target.value })} />
          </Field>
        ) : (
          <p className="field-hint">使用系统 TTS，不消耗 API，音色取决于手机系统。</p>
        )}

        {draft.tts.provider === 'volc' ? (
          <Field label="音色" hint="对应火山 X-Api-Resource-Id: seed-tts-2.0">
            <select className="input" value={draft.tts.voiceId} onChange={(e) => setTts({ voiceId: e.target.value })}>
              {VOICE_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.gender} · {v.style}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {draft.tts.provider === 'minimax' ? (
          <>
            <Field label="GroupId">
              <input className="input" value={draft.tts.groupId} onChange={(e) => setTts({ groupId: e.target.value })} />
            </Field>
            <Field label="模型">
              <input className="input" value={draft.tts.model} onChange={(e) => setTts({ model: e.target.value })} placeholder="speech-02-hd" />
            </Field>
            <Field label="音色 ID">
              <input className="input" value={draft.tts.voiceId} onChange={(e) => setTts({ voiceId: e.target.value })} placeholder="female-shaonv" />
            </Field>
          </>
        ) : null}

        {draft.tts.provider === 'openai' ? (
          <>
            <Field label="Base URL">
              <input className="input" value={draft.tts.baseUrl} onChange={(e) => setTts({ baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
            </Field>
            <Field label="模型 / 音色">
              <div className="field-row">
                <input className="input" value={draft.tts.model} onChange={(e) => setTts({ model: e.target.value })} placeholder="tts-1" />
                <input className="input" value={draft.tts.voiceId} onChange={(e) => setTts({ voiceId: e.target.value })} placeholder="alloy" />
              </div>
            </Field>
          </>
        ) : null}

        <div className="field-row">
          <Field label="语速">
            <input
              className="input"
              type="number"
              step="0.1"
              min="0.5"
              max="2"
              value={draft.tts.speed}
              onChange={(e) => setTts({ speed: Number(e.target.value) })}
            />
          </Field>
          <Field label="音高">
            <input
              className="input"
              type="number"
              step="1"
              min="-12"
              max="12"
              value={draft.tts.pitch}
              onChange={(e) => setTts({ pitch: Number(e.target.value) })}
            />
          </Field>
        </div>

        <label className="switch-row">
          <span>收到回复后自动朗读</span>
          <input type="checkbox" checked={draft.autoRead} onChange={(e) => set({ autoRead: e.target.checked })} />
        </label>

        <TestRow state={ttsTest} onTest={() => void runTtsTest()} label="试听一句" />
      </details>

      <details className="settings-group">
        <summary>语音识别（可选）</summary>
        <p className="field-hint">
          浏览器支持 Web Speech 时直接用系统识别；不支持时走这里的 OpenAI 兼容接口。
        </p>
        <Field label="Base URL">
          <input className="input" value={draft.stt.baseUrl} onChange={(e) => setStt({ baseUrl: e.target.value })} />
        </Field>
        <Field label="API Key">
          <input className="input" type="password" value={draft.stt.apiKey} onChange={(e) => setStt({ apiKey: e.target.value })} />
        </Field>
        <Field label="模型">
          <input className="input" value={draft.stt.model} onChange={(e) => setStt({ model: e.target.value })} placeholder="whisper-1" />
        </Field>
      </details>

      <details className="settings-group">
        <summary>请求方式</summary>
        <div className="radio-row">
          <label>
            <input
              type="radio"
              name="apiMode"
              checked={draft.apiMode === 'proxy'}
              onChange={() => set({ apiMode: 'proxy' })}
            />
            <span>经当前 Vercel 函数透传（推荐，绕过 CORS）</span>
          </label>
          <label>
            <input
              type="radio"
              name="apiMode"
              checked={draft.apiMode === 'direct'}
              onChange={() => set({ apiMode: 'direct' })}
            />
            <span>浏览器直连第三方 API</span>
          </label>
        </div>
        <p className="field-hint">
          透传只发生在你自己部署的这个站点里，服务端不写日志、不存 Key；换成 direct 后请求不经过任何服务器。
        </p>
      </details>

      <details className="settings-group">
        <summary>数据与 PWA</summary>
        <p className="field-hint">角色、聊天、设置全部存在当前浏览器。换设备前请先导出备份。</p>
        <div className="settings-btn-row">
          <button
            type="button"
            className="soft-btn"
            onClick={() => {
              const blob = new Blob([exportAll()], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `starchat-phone-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Mdi path={ICONS.download} size={16} /> 导出备份
          </button>
          <button type="button" className="soft-btn" onClick={() => importRef.current?.click()}>
            <Mdi path={ICONS.upload} size={16} /> 导入备份
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e)} />
          <button
            type="button"
            className="danger-btn"
            onClick={() => {
              if (!window.confirm('清空所有本地数据？建议先导出备份。')) return;
              clearAll();
              window.location.reload();
            }}
          >
            <Mdi path={ICONS.trash} size={16} /> 清空数据
          </button>
        </div>
        <div className="pwa-tip">
          <strong>装到手机桌面</strong>
          <p>iPhone：Safari 分享 → 添加到主屏幕。Android：浏览器菜单 → 安装应用 / 添加到主屏幕。之后会全屏运行，像原生 App。</p>
        </div>
      </details>

      <p className="list-foot">
        当前共 {personas.length} 个角色。API Key 不会上传到任何服务器，只随请求发给对应的模型服务商。
      </p>

      <button type="button" className="primary-btn sticky-save" onClick={save}>
        {saved ? '已保存' : '保存设置'}
      </button>
    </Screen>
  );
}

function TestRow({ state, onTest, label }: { state: TestState; onTest: () => void; label: string }) {
  return (
    <div className="test-row">
      <button type="button" className="soft-btn" onClick={onTest} disabled={state.busy}>
        {state.busy ? <Spinner size={16} /> : <Mdi path={ICONS.refresh} size={16} />}
        {label}
      </button>
      {state.ok ? <span className="test-ok">{state.ok}</span> : null}
      {state.fail ? <ErrorNote>{state.fail}</ErrorNote> : null}
    </div>
  );
}
