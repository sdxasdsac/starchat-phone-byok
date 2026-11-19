'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { mdiStickerEmoji } from '@mdi/js';
import type { Channel, ChatMessage, Persona } from '@/lib/types';
import { usePhone } from './PhoneContext';
import { chatComplete, generateImage, synthesizeSpeech, transcribe, browserSpeak } from '@/lib/api';
import { greetingFor, toApiMessages } from '@/lib/prompt';
import { saveMedia, readMedia } from '@/lib/media-db';
import { fileToDataUrl } from '@/lib/image-utils';
import { extractTranscript, getRecognitionCtor, stripForSpeech, type SpeechRecognitionLike } from '@/lib/speech';
import { uid } from '@/lib/store';
import { buildHtmlDocument, splitHtmlBlocks } from '@/lib/html-blocks';
import { STICKER_PACKS, stickerUrl } from '@/lib/nannan-stickers';
import { Avatar, ErrorNote, ICONS, Mdi, Spinner } from './ui';

export function useMediaSrc(imageId?: string, imageUrl?: string): string | null {
  const [src, setSrc] = useState<string | null>(imageUrl ?? null);
  useEffect(() => {
    if (imageUrl) {
      setSrc(imageUrl);
      return;
    }
    if (!imageId) {
      setSrc(null);
      return;
    }
    let alive = true;
    readMedia(imageId)
      .then((value) => {
        if (alive) setSrc(value);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [imageId, imageUrl]);
  return src;
}

export function MediaImage({ imageId, imageUrl, alt = '图片' }: { imageId?: string; imageUrl?: string; alt?: string }) {
  const src = useMediaSrc(imageId, imageUrl);
  if (!src) return <div className="media-loading">图片加载中…</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="chat-image" src={src} alt={alt} />
  );
}

/** 把正文里的 [表情:名称] 渲染成表情包图片，未知名称保持原文 */
function renderWithStickers(text: string) {
  const segments = text.split(/(\[表情[:：]\s*[^\]\n]{1,40}?\s*\])/g);
  return segments.map((segment, index) => {
    const match = /^\[表情[:：]\s*([^\]\n]{1,40}?)\s*\]$/.exec(segment);
    const url = match ? stickerUrl(match[1]) : null;
    if (url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={index} className="chat-sticker" src={url} alt={match![1]} loading="lazy" />
      );
    }
    return <span key={index}>{segment}</span>;
  });
}

type Variant = 'chat' | 'wechat' | 'line';

export function ChatRoom({
  persona,
  channel,
  variant,
  onBack,
}: {
  persona: Persona;
  channel: Channel;
  variant: Variant;
  onBack: () => void;
}) {
  const { ready, settings, setSettings, messagesOf, appendMessage, clearConversation } = usePhone();
  const messages = messagesOf(channel, persona.id);

  const [input, setInput] = useState('');
  const [streamText, setStreamText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [packIndex, setPackIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const seededRef = useRef(false);

  // 第一次进入：放一句开场白，让对话不是空白
  useEffect(() => {
    if (!ready || seededRef.current || messages.length > 0) return;
    seededRef.current = true;
    appendMessage(channel, persona.id, {
      id: uid('m_'),
      role: 'assistant',
      text: greetingFor(persona),
      createdAt: Date.now(),
    });
  }, [ready, messages.length, channel, persona, appendMessage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, streamText]);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, []);

  const playTts = useCallback(
    async (text: string, id: string) => {
      const clean = stripForSpeech(text);
      if (!clean) return;
      if (speakingId === id) {
        stopAudio();
        return;
      }
      setError('');
      setSpeakingId(id);
      try {
        if (settings.tts.provider === 'browser' || !settings.tts.apiKey.trim()) {
          browserSpeak(clean, {
            rate: settings.tts.speed,
            onEnd: () => setSpeakingId(null),
          });
          return;
        }
        const blob = await synthesizeSpeech(settings, clean);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setSpeakingId(null);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setSpeakingId(null);
          setError('音频播放失败，检查音色 ID 或浏览器限制');
        };
        await audio.play();
      } catch (err) {
        setSpeakingId(null);
        setError(err instanceof Error ? err.message : '语音合成失败');
      }
    },
    [settings, speakingId, stopAudio],
  );

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim();
      if (!text || sending) return;
      setInput('');
      setError('');
      const userMessage: ChatMessage = {
        id: uid('m_'),
        role: 'user',
        text,
        createdAt: Date.now(),
      };
      appendMessage(channel, persona.id, userMessage);
      setSending(true);
      setStreamText('');

      const history = [...messages, userMessage];
      try {
        const full = await chatComplete(settings, toApiMessages(persona, settings, history, channel), (_delta, all) => {
          setStreamText(all);
        });
        const finalText = full.trim();
        if (!finalText) throw new Error('模型没有返回内容');
        appendMessage(channel, persona.id, {
          id: uid('m_'),
          role: 'assistant',
          text: finalText,
          createdAt: Date.now(),
        });
        if (settings.autoRead && (settings.tts.provider === 'browser' || settings.tts.apiKey.trim())) {
          void playTts(finalText, `auto_${Date.now()}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '请求失败';
        setError(message);
        appendMessage(channel, persona.id, {
          id: uid('m_'),
          role: 'assistant',
          text: `（消息发送失败：${message}）`,
          createdAt: Date.now(),
          error: true,
        });
      } finally {
        setSending(false);
        setStreamText('');
      }
    },
    [appendMessage, channel, input, messages, persona, playTts, sending, settings],
  );

  const onPickImage = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        const id = await saveMedia(dataUrl);
        appendMessage(channel, persona.id, {
          id: uid('m_'),
          role: 'user',
          text: '（发送了一张图片）',
          imageId: id,
          createdAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '图片读取失败');
      }
    },
    [appendMessage, channel, persona.id],
  );

  const startListening = useCallback(async () => {
    if (listening) {
      recRef.current?.stop();
      recorderRef.current?.stop();
      setListening(false);
      return;
    }
    setError('');
    const Ctor = getRecognitionCtor();
    if (Ctor) {
      const rec = new Ctor();
      recRef.current = rec;
      rec.lang = 'zh-CN';
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (event) => {
        const text = extractTranscript(event);
        if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
      };
      rec.onerror = () => {
        setError('语音识别失败，可以改用键盘输入');
        setListening(false);
      };
      rec.onend = () => setListening(false);
      rec.start();
      setListening(true);
      return;
    }

    if (!settings.stt.apiKey.trim()) {
      setError('当前浏览器不支持语音输入；可在设置 → 语音识别里配置 OpenAI 兼容接口');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const text = await transcribe(settings, blob);
          if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
        } catch (err) {
          setError(err instanceof Error ? err.message : '语音识别失败');
        }
      };
      recorder.start();
      setListening(true);
    } catch {
      setError('没有拿到麦克风权限');
    }
  }, [listening, settings]);

  const makeImage = useCallback(async () => {
    const prompt = genPrompt.trim();
    if (!prompt || generating) return;
    setGenerating(true);
    setError('');
    try {
      const result = await generateImage(settings, prompt);
      let imageId: string | undefined;
      let imageUrl: string | undefined;
      if (result.dataUrl) imageId = await saveMedia(result.dataUrl);
      else imageUrl = result.url;
      appendMessage(channel, persona.id, {
        id: uid('m_'),
        role: 'assistant',
        text: `（${persona.name}发来一张图）`,
        imageId,
        imageUrl,
        createdAt: Date.now(),
      });
      setShowImagePrompt(false);
      setGenPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生图失败');
    } finally {
      setGenerating(false);
    }
  }, [appendMessage, channel, genPrompt, generating, persona.id, persona.name, settings]);

  const clearChat = useCallback(() => {
    if (!window.confirm('清空这段聊天记录？')) return;
    stopAudio();
    clearConversation(channel, persona.id);
    appendMessage(channel, persona.id, {
      id: uid('m_'),
      role: 'assistant',
      text: greetingFor(persona),
      createdAt: Date.now(),
    });
  }, [appendMessage, channel, clearConversation, persona, stopAudio]);

  const pat = useCallback(
    (target: 'me' | 'them') => {
      const meName = settings.user.name || '我';
      const text =
        target === 'them' ? `${meName} 拍了拍 ${persona.name}` : `${persona.name} 拍了拍 ${meName}`;
      appendMessage(channel, persona.id, {
        id: uid('m_'),
        role: 'system',
        text,
        createdAt: Date.now(),
      });
    },
    [appendMessage, channel, persona.id, persona.name, settings.user.name],
  );

  return (
    <section className={`chat-room ${variant}`}>
      <header className="chat-head">
        <button type="button" className="app-back" onClick={onBack} aria-label="返回">
          {variant === 'wechat' ? <span className="wechat-chevron">‹</span> : <Mdi path={ICONS.close} size={20} />}
        </button>
        <div className="chat-head-main">
          <Avatar persona={persona} size={34} />
          <div>
            <div className="chat-head-name">
              {variant === 'wechat' && sending ? '对方正在输入…' : persona.name}
            </div>
            <div className="chat-head-status">
              {sending ? '对方正在输入…' : listening ? '正在听你说…' : '在线'}
            </div>
          </div>
        </div>
        <button type="button" className="icon-btn-plain" onClick={clearChat} aria-label="清空聊天">
          {variant === 'wechat' ? <span className="wechat-more">⋯</span> : <Mdi path={ICONS.trash} size={18} />}
        </button>
      </header>

      <div className="chat-messages" ref={scrollRef}>
        {messages.map((message) => {
          if (message.role === 'system') {
            return (
              <div key={message.id} className="msg-system">
                {message.text}
              </div>
            );
          }
          const html = message.role === 'assistant' ? splitHtmlBlocks(message.text) : null;
          const shownText = html ? html.plain : message.text;
          return (
            <div key={message.id} className={`msg-row ${message.role}${message.error ? ' failed' : ''}`}>
              {variant === 'wechat' ? (
                <span
                  className="msg-avatar-hit"
                  onDoubleClick={() => pat(message.role === 'assistant' ? 'them' : 'me')}
                  title="双击拍一拍"
                >
                  <Avatar
                    name={message.role === 'assistant' ? persona.name : settings.user.name || '我'}
                    avatar={message.role === 'assistant' ? persona.avatar : settings.user.avatar}
                    size={40}
                  />
                </span>
              ) : message.role === 'assistant' ? (
                <Avatar persona={persona} size={30} />
              ) : null}
              <div className="msg-main">
                <div className="bubble">
                  {shownText ? <p>{renderWithStickers(shownText)}</p> : null}
                  {html?.blocks.map((block, index) => (
                    <iframe
                      key={index}
                      className="html-card"
                      title="互动卡片"
                      sandbox="allow-scripts allow-forms"
                      referrerPolicy="no-referrer"
                      srcDoc={buildHtmlDocument(block)}
                    />
                  ))}
                  {message.imageId || message.imageUrl ? (
                    <MediaImage imageId={message.imageId} imageUrl={message.imageUrl} />
                  ) : null}
                </div>
                {message.role === 'assistant' && !message.error && shownText ? (
                  <button
                    type="button"
                    className={`tts-btn${speakingId === message.id ? ' on' : ''}`}
                    onClick={() => void playTts(shownText, message.id)}
                    aria-label="朗读"
                  >
                    <Mdi path={ICONS.volume} size={14} />
                    {speakingId === message.id ? '停止' : '朗读'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}

        {streamText ? (
          <div className="msg-row assistant">
            <Avatar persona={persona} size={30} />
            <div className="msg-main">
              <div className="bubble">
                <p>{streamText}</p>
                <span className="typing-caret" />
              </div>
            </div>
          </div>
        ) : sending ? (
          <div className="msg-row assistant">
            <Avatar persona={persona} size={30} />
            <div className="msg-main">
              <div className="bubble typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="chat-error">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      <div className="chat-composer">
        {stickerOpen ? (
          <div className="sticker-panel">
            <div className="sticker-pack-tabs">
              {STICKER_PACKS.map((pack, index) => (
                <button
                  key={pack.label}
                  type="button"
                  className={`sticker-pack-tab${index === packIndex ? ' on' : ''}`}
                  onClick={() => setPackIndex(index)}
                >
                  {pack.label}
                </button>
              ))}
              <button type="button" className="sticker-pack-close" onClick={() => setStickerOpen(false)}>
                收起
              </button>
            </div>
            <div className="sticker-grid">
              {(STICKER_PACKS[packIndex]?.items ?? []).map((item) => (
                <button
                  type="button"
                  key={item.name}
                  className="sticker-cell"
                  title={item.name}
                  onClick={() => {
                    setStickerOpen(false);
                    void send(`[表情:${item.name}]`);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.name} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="composer-tools">
          <button type="button" className="tool-btn" onClick={() => fileRef.current?.click()} aria-label="发送图片">
            <Mdi path={ICONS.image} size={20} />
          </button>
          <button
            type="button"
            className={`tool-btn${stickerOpen ? ' on' : ''}`}
            onClick={() => setStickerOpen((prev) => !prev)}
            aria-label="表情包"
          >
            <Mdi path={mdiStickerEmoji} size={20} />
          </button>
          <button type="button" className="tool-btn" onClick={() => setShowImagePrompt(true)} aria-label="生成图片">
            <Mdi path={ICONS.comment} size={20} />
          </button>
          <button
            type="button"
            className={`tool-btn${listening ? ' on' : ''}`}
            onClick={() => void startListening()}
            aria-label="语音输入"
          >
            <Mdi path={ICONS.mic} size={20} />
          </button>
          <button
            type="button"
            className={`tool-btn${settings.autoRead ? ' on' : ''}`}
            onClick={() => setSettings({ ...settings, autoRead: !settings.autoRead })}
            aria-label="自动朗读"
            title={settings.autoRead ? '自动朗读：开' : '自动朗读：关'}
          >
            <Mdi path={ICONS.volume} size={20} />
          </button>
        </div>
        <div className="composer-input">
          <textarea
            value={input}
            rows={1}
            placeholder={listening ? '正在听…' : `和${persona.name}说点什么`}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button
            type="button"
            className="send-btn"
            disabled={sending || !input.trim()}
            onClick={() => void send()}
            aria-label="发送"
          >
            {variant === 'wechat' ? <span className="send-text">发送</span> : <Mdi path={ICONS.send} size={18} />}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onPickImage(e)} />
      </div>

      {showImagePrompt ? (
        <div className="sheet-mask" onClick={() => !generating && setShowImagePrompt(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-title">
              <span>生成一张图</span>
              <button type="button" className="icon-btn-plain" onClick={() => setShowImagePrompt(false)}>
                <Mdi path={ICONS.close} size={18} />
              </button>
            </div>
            <textarea
              className="sheet-textarea"
              value={genPrompt}
              onChange={(e) => setGenPrompt(e.target.value)}
              placeholder="描述画面，例如：傍晚的便利店门口，暖黄色灯光，电影感"
              rows={3}
            />
            <button type="button" className="primary-btn" disabled={generating || !genPrompt.trim()} onClick={() => void makeImage()}>
              {generating ? <Spinner /> : <Mdi path={ICONS.image} size={18} />}
              {generating ? '生成中…' : '生成并发送'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
