'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { fileToRawDataUrl, localUid, readLocal, writeLocal } from '@/lib/local-data';
import { deleteMedia, readMedia, saveMedia } from '@/lib/media-db';
import { EmptyState, ErrorNote, ICONS, Mdi, Screen } from '../ui';

type Track = { id: string; mediaId: string; name: string; size: number; createdAt: number };

const KEY = 'sp.music.v1';

export function MusicApp({ onClose }: { onClose: () => void }) {
  const [tracks, setTracks] = useState<Track[]>(() => readLocal<Track[]>(KEY, []));
  const [current, setCurrent] = useState<Track | null>(null);
  const [src, setSrc] = useState('');
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!current) {
      setSrc('');
      return;
    }
    let alive = true;
    readMedia(current.mediaId).then((data) => {
      if (alive) setSrc(data ?? '');
    });
    return () => {
      alive = false;
    };
  }, [current]);

  const persist = (next: Track[]) => {
    setTracks(next);
    writeLocal(KEY, next);
  };

  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    setError('');
    const next = [...tracks];
    for (const file of files) {
      if (!file.type.startsWith('audio/')) {
        setError('只能导入音频文件');
        continue;
      }
      try {
        const dataUrl = await fileToRawDataUrl(file);
        const mediaId = await saveMedia(dataUrl);
        next.unshift({
          id: localUid('mu_'),
          mediaId,
          name: file.name.replace(/\.[^.]+$/, ''),
          size: file.size,
          createdAt: Date.now(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : '导入失败');
      }
    }
    persist(next);
  };

  const play = (track: Track) => {
    if (current?.id === track.id) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) void audio.play();
      else audio.pause();
      return;
    }
    setCurrent(track);
  };

  const remove = async (track: Track) => {
    if (!window.confirm(`删除「${track.name}」？`)) return;
    await deleteMedia(track.mediaId).catch(() => {});
    if (current?.id === track.id) {
      setCurrent(null);
      setPlaying(false);
    }
    persist(tracks.filter((item) => item.id !== track.id));
  };

  return (
    <Screen
      title="音乐"
      subtitle={`${tracks.length} 首 · 存在本机`}
      onBack={onClose}
      right={
        <button type="button" className="icon-btn-plain" onClick={() => fileRef.current?.click()} aria-label="导入音乐">
          <Mdi path={ICONS.plus} size={22} />
        </button>
      }
    >
      <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={(e) => void importFiles(e)} />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          autoPlay
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          style={{ display: 'none' }}
        />
      ) : null}

      {tracks.length === 0 ? (
        <EmptyState
          title="还没有音乐"
          hint="点右上角 + 导入本机音频，离线也能听"
          action={
            <button type="button" className="primary-btn" onClick={() => fileRef.current?.click()}>
              导入音乐
            </button>
          }
        />
      ) : (
        <div className="simple-list">
          {tracks.map((track) => (
            <div key={track.id} className={`simple-row${current?.id === track.id ? ' active' : ''}`}>
              <button type="button" className="simple-main" onClick={() => play(track)}>
                <span className="simple-icon">
                  <Mdi path={ICONS.volume} size={18} />
                </span>
                <span className="simple-text">
                  <strong>{track.name}</strong>
                  <small>{(track.size / 1024 / 1024).toFixed(1)} MB</small>
                </span>
                <span className="simple-state">
                  {current?.id === track.id ? (playing ? '播放中' : '已暂停') : '播放'}
                </span>
              </button>
              <button type="button" className="icon-btn-plain" onClick={() => void remove(track)} aria-label="删除">
                <Mdi path={ICONS.trash} size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}
