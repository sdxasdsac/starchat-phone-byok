'use client';

import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import type { Persona } from '@/lib/types';
import { usePhone } from '../PhoneContext';
import { parseCardFile } from '@/lib/card-import';
import { compressImage, dataUrlToBlob } from '@/lib/image-utils';
import { VOICE_PRESETS } from '@/lib/defaults';
import { uid } from '@/lib/store';
import { Avatar, ErrorNote, Field, ICONS, Mdi, Screen, Spinner } from '../ui';

function blankPersona(voiceId: string): Persona {
  const now = Date.now();
  return {
    id: uid('p_'),
    name: '',
    avatar: '🌙',
    tagline: '',
    description: '',
    style: '',
    scenario: '',
    firstMes: '',
    example: '',
    worldbook: '',
    forbidden: '',
    voiceId,
    createdAt: now,
    updatedAt: now,
  };
}

export function PersonaApp({ onClose }: { onClose: () => void }) {
  const { personas, settings, activePersona, upsertPersona, deletePersona, setActivePersonaId } = usePhone();
  const [editing, setEditing] = useState<Persona | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const avatarRef = useRef<HTMLInputElement | null>(null);

  const startNew = () => {
    setError('');
    setEditing(blankPersona(settings.tts.voiceId));
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const parsed = await parseCardFile(file);
      const base = blankPersona(settings.tts.voiceId);
      let avatar = parsed.draft.avatar ?? base.avatar;
      if (parsed.avatarSource) {
        try {
          const blob = dataUrlToBlob(parsed.avatarSource);
          const compressed = await compressImage(new File([blob], 'avatar.png', { type: blob.type }), 320);
          avatar = compressed;
        } catch {
          /* 立绘压缩失败就保留 emoji */
        }
      }
      setEditing({ ...base, ...parsed.draft, avatar, id: base.id, createdAt: Date.now(), updatedAt: Date.now() });
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败，请检查卡片格式');
    } finally {
      setImporting(false);
    }
  };

  const onPickAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editing) return;
    try {
      const compressed = await compressImage(file, 320);
      setEditing({ ...editing, avatar: compressed });
    } catch (err) {
      setError(err instanceof Error ? err.message : '头像处理失败');
    }
  };

  if (editing) {
    return (
      <PersonaEditor
        persona={editing}
        onChange={setEditing}
        onBack={() => setEditing(null)}
        onSave={() => {
          if (!editing.name.trim()) {
            setError('先给角色起个名字');
            return;
          }
          const next = { ...editing, name: editing.name.trim(), updatedAt: Date.now() };
          upsertPersona(next);
          if (!activePersona) setActivePersonaId(next.id);
          setEditing(null);
        }}
        onDelete={
          personas.some((p) => p.id === editing.id)
            ? () => {
                if (!window.confirm(`删除「${editing.name}」？聊天记录也会一起删除。`)) return;
                deletePersona(editing.id);
                setEditing(null);
              }
            : undefined
        }
        onPickAvatar={() => avatarRef.current?.click()}
        error={error}
      >
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => void onPickAvatar(e)} />
      </PersonaEditor>
    );
  }

  return (
    <Screen
      title="人设"
      subtitle={`${personas.length} 个角色`}
      onBack={onClose}
      right={
        <button type="button" className="icon-btn-plain" onClick={startNew} aria-label="新建人设">
          <Mdi path={ICONS.plus} size={22} />
        </button>
      }
    >
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="persona-actions">
        <button type="button" className="soft-btn" onClick={startNew}>
          <Mdi path={ICONS.plus} size={16} /> 新建
        </button>
        <button type="button" className="soft-btn" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Spinner size={16} /> : <Mdi path={ICONS.upload} size={16} />}
          导入角色卡
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,.md,.png,application/json,text/plain,image/png"
          hidden
          onChange={(e) => void onImport(e)}
        />
      </div>

      <div className="persona-list">
        {personas.map((p) => (
          <div key={p.id} className={`persona-card${p.id === activePersona?.id ? ' active' : ''}`}>
            <Avatar persona={p} size={52} />
            <div className="persona-card-main">
              <div className="persona-card-name">
                {p.name}
                {p.id === activePersona?.id ? <span className="tag">当前</span> : null}
              </div>
              <div className="persona-card-tagline">{p.tagline || p.description.slice(0, 32) || '还没有填写设定'}</div>
            </div>
            <div className="persona-card-actions">
              <button type="button" className="icon-btn-plain" onClick={() => setEditing(p)} aria-label="编辑">
                <Mdi path={ICONS.edit} size={18} />
              </button>
              <button
                type="button"
                className="icon-btn-plain"
                onClick={() => setActivePersonaId(p.id)}
                aria-label="设为当前"
              >
                <Mdi path={ICONS.check} size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="list-foot">
        支持导入 SillyTavern JSON / PNG 角色卡、纯文本人设。PNG 卡会自动读取 chara 数据。
      </p>
    </Screen>
  );
}

function PersonaEditor({
  persona,
  onChange,
  onBack,
  onSave,
  onDelete,
  onPickAvatar,
  error,
  children,
}: {
  persona: Persona;
  onChange: (next: Persona) => void;
  onBack: () => void;
  onSave: () => void;
  onDelete?: () => void;
  onPickAvatar: () => void;
  error: string;
  children?: ReactNode;
}) {
  const set = (patch: Partial<Persona>) => onChange({ ...persona, ...patch });

  return (
    <Screen
      title={persona.name ? `编辑 ${persona.name}` : '新建人设'}
      onBack={onBack}
      right={
        <button type="button" className="text-btn" onClick={onSave}>
          保存
        </button>
      }
    >
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="avatar-editor">
        <Avatar persona={persona} size={76} />
        <div className="avatar-editor-side">
          <button type="button" className="soft-btn" onClick={onPickAvatar}>
            <Mdi path={ICONS.upload} size={15} /> 上传头像
          </button>
          <input
            className="emoji-input"
            value={persona.avatar && !/^(data:|https?:|blob:)/.test(persona.avatar) ? persona.avatar : ''}
            maxLength={4}
            placeholder="或填 emoji"
            onChange={(e) => set({ avatar: e.target.value })}
          />
        </div>
      </div>

      <Field label="名字">
        <input className="input" value={persona.name} onChange={(e) => set({ name: e.target.value })} placeholder="角色名" />
      </Field>
      <Field label="一句话定位">
        <input className="input" value={persona.tagline ?? ''} onChange={(e) => set({ tagline: e.target.value })} placeholder="例如：嘴硬心软的青梅竹马" />
      </Field>
      <Field label="人设" hint="性格、经历、和你的关系，写得越具体越像">
        <textarea className="textarea" rows={4} value={persona.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="说话风格">
        <textarea className="textarea" rows={2} value={persona.style ?? ''} onChange={(e) => set({ style: e.target.value })} placeholder="例如：句子短，爱用「。」，偶尔怼人" />
      </Field>
      <Field label="当前情境">
        <textarea className="textarea" rows={2} value={persona.scenario ?? ''} onChange={(e) => set({ scenario: e.target.value })} />
      </Field>
      <Field label="开场白">
        <textarea className="textarea" rows={2} value={persona.firstMes ?? ''} onChange={(e) => set({ firstMes: e.target.value })} placeholder="第一次打开聊天时 TA 说的第一句话" />
      </Field>
      <Field label="对话示例" hint="用 {{char}} / {{user}} 指代角色和你">
        <textarea className="textarea" rows={3} value={persona.example ?? ''} onChange={(e) => set({ example: e.target.value })} />
      </Field>
      <Field label="世界书 / 背景">
        <textarea className="textarea" rows={3} value={persona.worldbook ?? ''} onChange={(e) => set({ worldbook: e.target.value })} />
      </Field>
      <Field label="禁止事项">
        <textarea className="textarea" rows={2} value={persona.forbidden ?? ''} onChange={(e) => set({ forbidden: e.target.value })} placeholder="不希望角色说的话、八股句式" />
      </Field>

      <Field label="语音音色" hint="火山引擎豆包 2.0 音色；也可以直接在设置里改默认音色">
        <select className="input" value={persona.voiceId ?? ''} onChange={(e) => set({ voiceId: e.target.value })}>
          <option value="">跟随全局默认</option>
          {VOICE_PRESETS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.gender} · {v.style}
            </option>
          ))}
        </select>
      </Field>

      <div className="editor-actions">
        <button type="button" className="primary-btn" onClick={onSave}>
          保存人设
        </button>
        <button
          type="button"
          className="soft-btn"
          onClick={() => {
            const data = JSON.stringify(persona, null, 2);
            const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${persona.name || 'persona'}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Mdi path={ICONS.download} size={16} /> 导出
        </button>
        {onDelete ? (
          <button type="button" className="danger-btn" onClick={onDelete}>
            <Mdi path={ICONS.trash} size={16} /> 删除
          </button>
        ) : null}
      </div>
      {children}
    </Screen>
  );
}
