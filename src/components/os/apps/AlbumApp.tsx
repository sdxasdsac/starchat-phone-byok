'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { localUid, readLocal, writeLocal } from '@/lib/local-data';
import { compressImage } from '@/lib/image-utils';
import { deleteMedia, readMedia, saveMedia } from '@/lib/media-db';
import { EmptyState, ICONS, Mdi, Screen } from '../ui';

type Photo = { id: string; mediaId: string; caption: string; createdAt: number };

const KEY = 'sp.album.v1';

function PhotoThumb({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    readMedia(photo.mediaId).then((data) => {
      if (alive) setSrc(data ?? '');
    });
    return () => {
      alive = false;
    };
  }, [photo.mediaId]);

  return (
    <button type="button" className="album-cell" onClick={onOpen} title={photo.caption || '照片'}>
      {src ? <img src={src} alt={photo.caption || '照片'} loading="lazy" /> : <span>…</span>}
    </button>
  );
}

export function AlbumApp({ onClose }: { onClose: () => void }) {
  const [photos, setPhotos] = useState<Photo[]>(() => readLocal<Photo[]>(KEY, []));
  const [viewing, setViewing] = useState<{ photo: Photo; src: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const persist = (next: Photo[]) => {
    setPhotos(next);
    writeLocal(KEY, next);
  };

  const importFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    const next = [...photos];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await compressImage(file, 1280);
        const mediaId = await saveMedia(dataUrl);
        next.unshift({ id: localUid('ph_'), mediaId, caption: file.name.replace(/\.[^.]+$/, ''), createdAt: Date.now() });
      } catch {
        /* 单张失败跳过 */
      }
    }
    persist(next);
  };

  const open = async (photo: Photo) => {
    const src = await readMedia(photo.mediaId);
    setViewing(src ? { photo, src } : null);
  };

  const remove = async (photo: Photo) => {
    if (!window.confirm('删除这张照片？')) return;
    await deleteMedia(photo.mediaId).catch(() => {});
    setViewing(null);
    persist(photos.filter((item) => item.id !== photo.id));
  };

  if (viewing) {
    return (
      <Screen
        title={viewing.photo.caption || '照片'}
        onBack={() => setViewing(null)}
        right={
          <button type="button" className="icon-btn-plain" onClick={() => void remove(viewing.photo)} aria-label="删除">
            <Mdi path={ICONS.trash} size={18} />
          </button>
        }
      >
        <img className="album-viewer" src={viewing.src} alt={viewing.photo.caption || '照片'} />
      </Screen>
    );
  }

  return (
    <Screen
      title="相册"
      subtitle={`${photos.length} 张 · 存在本机`}
      onBack={onClose}
      right={
        <button type="button" className="icon-btn-plain" onClick={() => fileRef.current?.click()} aria-label="导入照片">
          <Mdi path={ICONS.plus} size={22} />
        </button>
      }
    >
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void importFiles(e)} />
      {photos.length === 0 ? (
        <EmptyState
          title="相册是空的"
          hint="导入本机照片，只保存在这台设备上"
          action={
            <button type="button" className="primary-btn" onClick={() => fileRef.current?.click()}>
              导入照片
            </button>
          }
        />
      ) : (
        <div className="album-grid">
          {photos.map((photo) => (
            <PhotoThumb key={photo.id} photo={photo} onOpen={() => void open(photo)} />
          ))}
        </div>
      )}
    </Screen>
  );
}
