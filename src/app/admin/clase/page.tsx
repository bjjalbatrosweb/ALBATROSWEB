'use client';

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Disc3,
  Dumbbell,
  Heart,
  Library,
  ListMusic,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Discipline,
  SUCCESS_CRITERION,
  TRAINING_DATES,
  getActivityDuration,
  getActivityForDate,
  getClosestTrainingDate,
} from '@/data/class-activities';

type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork?: Blob;
  sourceFormat?: string;
  fileName: string;
  contentType: string;
  size: number;
  addedAt: string;
};

type LegacyStoredTrack = MusicTrack & { blob?: Blob };
type StoredAudio = { id: string; blob: Blob };

type LocalPlaylist = {
  id: string;
  name: string;
  trackIds: string[];
};

type MusicView = 'library' | 'favorites' | 'playlist';

const MUSIC_DB_NAME = 'albatros-local-music-v1';
const MUSIC_STORE_NAME = 'tracks';
const MUSIC_AUDIO_STORE_NAME = 'audio-files';
const MUSIC_DATABASE_VERSION = 2;
const PLAYLISTS_KEY = 'albatros-local-playlists-v1';
const FAVORITES_KEY = 'albatros-local-favorites-v1';
const TRACK_PAGE_SIZE = 80;
const DEFAULT_PLAYLIST: LocalPlaylist = {
  id: 'entrenamiento',
  name: 'Entrenamiento',
  trackIds: [],
};

function openMusicDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(MUSIC_DB_NAME, MUSIC_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MUSIC_STORE_NAME)) {
        database.createObjectStore(MUSIC_STORE_NAME, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(MUSIC_AUDIO_STORE_NAME)) {
        database.createObjectStore(MUSIC_AUDIO_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local.'));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falló una operación local.'));
  });
}

function transactionFinished(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('No se guardaron los cambios.'));
    transaction.onabort = () => reject(transaction.error || new Error('Se canceló la operación.'));
  });
}

async function readLocalTracks() {
  const database = await openMusicDatabase();
  try {
    const transaction = database.transaction(MUSIC_STORE_NAME, 'readonly');
    const finished = transactionFinished(transaction);
    const records = await new Promise<MusicTrack[]>((resolve, reject) => {
      const result: MusicTrack[] = [];
      const request = transaction.objectStore(MUSIC_STORE_NAME).openCursor();
      request.onerror = () => reject(request.error || new Error('No se pudo leer la biblioteca local.'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(result);
          return;
        }
        const { blob: _legacyBlob, ...track } = cursor.value as LegacyStoredTrack;
        result.push(track);
        cursor.continue();
      };
    });
    await finished;
    return records.sort((a, b) => a.title.localeCompare(b.title, 'es-MX'));
  } finally {
    database.close();
  }
}

async function readLocalTrackBlob(trackId: string) {
  const database = await openMusicDatabase();
  try {
    const transaction = database.transaction(
      [MUSIC_STORE_NAME, MUSIC_AUDIO_STORE_NAME],
      'readonly',
    );
    const finished = transactionFinished(transaction);
    const audioRequest = requestResult(
      transaction.objectStore(MUSIC_AUDIO_STORE_NAME).get(trackId) as IDBRequest<StoredAudio | undefined>,
    );
    const legacyRequest = requestResult(
      transaction.objectStore(MUSIC_STORE_NAME).get(trackId) as IDBRequest<LegacyStoredTrack | undefined>,
    );
    const [audioRecord, legacyRecord] = await Promise.all([audioRequest, legacyRequest]);
    await finished;
    if (audioRecord?.blob) return audioRecord.blob;
    if (!legacyRecord?.blob) return null;

    const { blob, ...metadata } = legacyRecord;
    await saveLocalTrack(metadata, blob).catch(() => undefined);
    return blob;
  } finally {
    database.close();
  }
}

async function saveLocalTrack(metadata: MusicTrack, blob: Blob) {
  const database = await openMusicDatabase();
  try {
    const transaction = database.transaction(
      [MUSIC_STORE_NAME, MUSIC_AUDIO_STORE_NAME],
      'readwrite',
    );
    const finished = transactionFinished(transaction);
    transaction.objectStore(MUSIC_STORE_NAME).put(metadata);
    transaction.objectStore(MUSIC_AUDIO_STORE_NAME).put({ id: metadata.id, blob });
    await finished;
  } finally {
    database.close();
  }
}

async function removeLocalTrack(trackId: string) {
  const database = await openMusicDatabase();
  try {
    const transaction = database.transaction(
      [MUSIC_STORE_NAME, MUSIC_AUDIO_STORE_NAME],
      'readwrite',
    );
    const finished = transactionFinished(transaction);
    transaction.objectStore(MUSIC_STORE_NAME).delete(trackId);
    transaction.objectStore(MUSIC_AUDIO_STORE_NAME).delete(trackId);
    await finished;
  } finally {
    database.close();
  }
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function createTrackId(file: File) {
  const seed = `${file.name}|${file.size}|${file.lastModified}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `local-${(hash >>> 0).toString(36)}-${file.size.toString(36)}`;
}

function fallbackMetadataFromFile(file: File): MusicTrack {
  const cleanName = file.name.replace(/\.[^.]+$/, '').trim() || 'Canción local';
  const separator = cleanName.indexOf(' - ');
  const artist = separator > 0 ? cleanName.slice(0, separator).trim() : 'Archivo local';
  const title = separator > 0 ? cleanName.slice(separator + 3).trim() : cleanName;
  return {
    id: createTrackId(file),
    title,
    artist,
    album: 'Este dispositivo',
    sourceFormat: file.name.split('.').pop()?.toUpperCase() || 'Audio',
    fileName: file.name,
    contentType: file.type || (/\.webm$/i.test(file.name) ? 'audio/webm' : 'audio/mpeg'),
    size: file.size,
    addedAt: new Date().toISOString(),
  };
}

function normalizedPictureType(value: string) {
  const format = value.trim().toLowerCase();
  if (format === 'jpg' || format === 'jpeg' || format === 'image/jpg') return 'image/jpeg';
  if (format === 'png' || format === 'image/png') return 'image/png';
  if (format === 'webp' || format === 'image/webp') return 'image/webp';
  return format.startsWith('image/') ? format : 'image/jpeg';
}

function pictureToBlob(picture: { data: Uint8Array; format: string }) {
  const bytes = new Uint8Array(picture.data.byteLength);
  bytes.set(picture.data);
  return new Blob([bytes], { type: normalizedPictureType(picture.format) });
}

async function optimizeArtwork(source: Blob) {
  const url = URL.createObjectURL(source);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('La portada no se pudo procesar.'));
      element.src = url;
    });
    const maximumSide = 720;
    const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) return source.size <= 1_500_000 ? source : undefined;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob || (source.size <= 1_500_000 ? source : undefined)),
        'image/webp',
        0.82,
      );
    });
  } catch {
    return source.size <= 1_500_000 ? source : undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extractWebmFrame(file: File) {
  if (!/\.webm$/i.test(file.name) && file.type !== 'video/webm') return undefined;

  return new Promise<Blob | undefined>((resolve) => {
    const video = document.createElement('video');
    const source = URL.createObjectURL(file);
    let finished = false;
    const timeout = window.setTimeout(() => finish(), 6500);

    const cleanUp = () => {
      window.clearTimeout(timeout);
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(source);
    };

    const finish = (value?: Blob) => {
      if (finished) return;
      finished = true;
      cleanUp();
      resolve(value);
    };

    const capture = () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish();
        return;
      }
      const maximumSide = 900;
      const scale = Math.min(1, maximumSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        finish();
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(blob || undefined), 'image/jpeg', 0.88);
    };

    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.addEventListener('error', () => finish(), { once: true });
    video.addEventListener('loadeddata', () => {
      if (!video.videoWidth || !video.videoHeight) {
        finish();
        return;
      }
      const target = Number.isFinite(video.duration) && video.duration > 1
        ? Math.min(1, video.duration * 0.08)
        : 0;
      if (target > 0.05) {
        video.addEventListener('seeked', capture, { once: true });
        video.currentTime = target;
      } else {
        capture();
      }
    }, { once: true });
    video.src = source;
    video.load();
  });
}

async function metadataFromFile(file: File): Promise<MusicTrack> {
  const fallback = fallbackMetadataFromFile(file);

  try {
    const { parseBlob } = await import('music-metadata');
    const metadata = await parseBlob(file, { duration: false });
    const embeddedPicture = metadata.common.picture?.[0];
    const rawArtwork = embeddedPicture
      ? pictureToBlob(embeddedPicture)
      : await extractWebmFrame(file);
    const artwork = rawArtwork ? await optimizeArtwork(rawArtwork) : undefined;

    return {
      ...fallback,
      title: metadata.common.title?.trim() || fallback.title,
      artist:
        metadata.common.artist?.trim() ||
        metadata.common.albumartist?.trim() ||
        fallback.artist,
      album: metadata.common.album?.trim() || fallback.album,
      artwork,
      sourceFormat:
        metadata.format.container ||
        metadata.format.codec ||
        fallback.sourceFormat,
    };
  } catch {
    const rawArtwork = await extractWebmFrame(file);
    return {
      ...fallback,
      artwork: rawArtwork ? await optimizeArtwork(rawArtwork) : undefined,
    };
  }
}

function getMeridaISODate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Merida',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatClassDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function getClassDateParts(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' })
      .format(date)
      .replace('.', ''),
    day: new Intl.DateTimeFormat('es-MX', { day: 'numeric', timeZone: 'UTC' }).format(date),
  };
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 MB';
  const megabytes = value / 1024 / 1024;
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

const COVER_GRADIENTS = [
  'linear-gradient(145deg, #ff375f 0%, #9f1239 42%, #20020b 100%)',
  'linear-gradient(145deg, #fb7185 0%, #7f1d1d 46%, #140507 100%)',
  'linear-gradient(145deg, #f43f5e 0%, #6d28d9 48%, #160725 100%)',
  'linear-gradient(145deg, #ef4444 0%, #b45309 48%, #1c0b03 100%)',
];

function getCoverGradient(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
}

export default function ClassMusicPage() {
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const playbackUrlRef = useRef('');

  const [mounted, setMounted] = useState(false);
  const [activeDate, setActiveDate] = useState(TRAINING_DATES[0] || '2026-08-04');
  const [discipline, setDiscipline] = useState<Discipline>('BJJ');

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [storageUsage, setStorageUsage] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [searchValue, setSearchValue] = useState('');
  const [musicView, setMusicView] = useState<MusicView>('library');
  const [playlists, setPlaylists] = useState<LocalPlaylist[]>([DEFAULT_PLAYLIST]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(DEFAULT_PLAYLIST.id);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
  const [playQueue, setPlayQueue] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [shuffle, setShuffle] = useState(false);
  const [artworkUrls, setArtworkUrls] = useState<Record<string, string>>({});
  const [visibleTrackLimit, setVisibleTrackLimit] = useState(TRACK_PAGE_SIZE);

  const refreshStorageUsage = useCallback(async () => {
    if (!navigator.storage?.estimate) return;
    const estimate = await navigator.storage.estimate();
    setStorageUsage(estimate.usage || 0);
    setStorageQuota(estimate.quota || 0);
  }, []);

  const loadLocalCatalog = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const catalog = await readLocalTracks();
      setTracks(catalog);
      await refreshStorageUsage();
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : 'No se pudo abrir la música local.');
    } finally {
      setLibraryLoading(false);
    }
  }, [refreshStorageUsage]);

  useEffect(() => {
    const storedPlaylists = safeParse<LocalPlaylist[]>(
      localStorage.getItem(PLAYLISTS_KEY),
      [DEFAULT_PLAYLIST],
    );
    const storedFavorites = safeParse<string[]>(localStorage.getItem(FAVORITES_KEY), []);
    const normalizedPlaylists = storedPlaylists.length ? storedPlaylists : [DEFAULT_PLAYLIST];
    setPlaylists(normalizedPlaylists);
    setSelectedPlaylistId(normalizedPlaylists[0].id);
    setFavorites(storedFavorites);
    setActiveDate(getClosestTrainingDate(getMeridaISODate()));
    setMounted(true);
    void loadLocalCatalog();
  }, [loadLocalCatalog]);

  useEffect(() => {
    if (mounted) localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  }, [mounted, playlists]);

  useEffect(() => {
    if (mounted) localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites, mounted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => () => {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
  }, []);

  useEffect(() => {
    const urls: Record<string, string> = {};
    tracks.forEach((track) => {
      if (track.artwork) urls[track.id] = URL.createObjectURL(track.artwork);
    });
    setArtworkUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [tracks]);

  const activity = useMemo(
    () => getActivityForDate(activeDate, discipline),
    [activeDate, discipline],
  );
  const today = useMemo(() => getMeridaISODate(), []);
  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) || playlists[0],
    [playlists, selectedPlaylistId],
  );

  const visibleTracks = useMemo(() => {
    let result = tracks;
    if (musicView === 'favorites') {
      const ids = new Set(favorites);
      result = result.filter((track) => ids.has(track.id));
    } else if (musicView === 'playlist') {
      const ids = new Set(selectedPlaylist?.trackIds || []);
      result = result.filter((track) => ids.has(track.id));
    }
    const query = searchValue.trim().toLocaleLowerCase('es-MX');
    if (query) {
      result = result.filter((track) =>
        [track.title, track.artist, track.album, track.fileName]
          .join(' ')
          .toLocaleLowerCase('es-MX')
          .includes(query),
      );
    }
    return result;
  }, [favorites, musicView, searchValue, selectedPlaylist, tracks]);

  const displayedTracks = useMemo(
    () => visibleTracks.slice(0, visibleTrackLimit),
    [visibleTrackLimit, visibleTracks],
  );

  useEffect(() => {
    setVisibleTrackLimit(TRACK_PAGE_SIZE);
  }, [musicView, searchValue, selectedPlaylistId]);

  const playTrack = useCallback(async (track: MusicTrack, queue?: string[]) => {
    if (loadingTrackId) return;
    setLoadingTrackId(track.id);
    try {
      const blob = await readLocalTrackBlob(track.id);
      if (!blob) throw new Error('El archivo ya no está disponible en este dispositivo.');
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
      const url = URL.createObjectURL(blob);
      playbackUrlRef.current = url;
      setCurrentTrack(track);
      setPlayQueue(queue?.length ? queue : visibleTracks.map((item) => item.id));
      setCurrentTime(0);
      setDuration(0);
      audio.src = url;
      audio.load();
      await audio.play();
    } catch (error) {
      setPlaying(false);
      toast({
        variant: 'destructive',
        title: 'No se pudo reproducir',
        description: error instanceof Error ? error.message : 'Selecciona nuevamente el archivo.',
      });
    } finally {
      setLoadingTrackId('');
    }
  }, [loadingTrackId, toast, visibleTracks]);

  const playNext = useCallback(async () => {
    if (!currentTrack || !playQueue.length) return;
    let nextId: string | undefined;
    if (shuffle && playQueue.length > 1) {
      const alternatives = playQueue.filter((id) => id !== currentTrack.id);
      nextId = alternatives[Math.floor(Math.random() * alternatives.length)];
    } else {
      const index = playQueue.indexOf(currentTrack.id);
      nextId = playQueue[(index + 1 + playQueue.length) % playQueue.length];
    }
    const track = tracks.find((item) => item.id === nextId);
    if (track) await playTrack(track, playQueue);
  }, [currentTrack, playQueue, playTrack, shuffle, tracks]);

  const playPrevious = useCallback(async () => {
    if (!currentTrack || !playQueue.length) return;
    if (audioRef.current && audioRef.current.currentTime > 4) {
      audioRef.current.currentTime = 0;
      return;
    }
    const index = playQueue.indexOf(currentTrack.id);
    const previousId = playQueue[(index - 1 + playQueue.length) % playQueue.length];
    const track = tracks.find((item) => item.id === previousId);
    if (track) await playTrack(track, playQueue);
  }, [currentTrack, playQueue, playTrack, tracks]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      toast({ variant: 'destructive', title: 'Toca reproducir nuevamente' });
    }
  };

  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;
    const artworkUrl = artworkUrls[currentTrack.id];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: artworkUrl
        ? [{ src: artworkUrl, type: currentTrack.artwork?.type || 'image/jpeg' }]
        : undefined,
    });
    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void audioRef.current?.play()],
      ['pause', () => audioRef.current?.pause()],
      ['nexttrack', () => void playNext()],
      ['previoustrack', () => void playPrevious()],
    ];
    actions.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* No disponible. */ }
    });
    return () => actions.forEach(([action]) => {
      try { navigator.mediaSession.setActionHandler(action, null); } catch { /* Sin acción. */ }
    });
  }, [artworkUrls, currentTrack, playNext, playPrevious]);

  const importLocalFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith('audio/') ||
      file.type === 'video/webm' ||
      /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)$/i.test(file.name),
    );
    event.target.value = '';
    if (!files.length || importing) return;

    const selectedBytes = files.reduce((total, file) => total + file.size, 0);
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      const availableBytes = Math.max(0, (estimate.quota || 0) - (estimate.usage || 0));
      if (availableBytes > 0 && selectedBytes > availableBytes * 0.85) {
        toast({
          variant: 'destructive',
          title: 'No hay espacio suficiente',
          description: `Seleccionaste ${formatBytes(selectedBytes)} y el navegador dispone aproximadamente de ${formatBytes(availableBytes)}. Importa menos canciones o libera espacio.`,
        });
        return;
      }
    }

    setImporting(true);
    let completed = 0;
    try {
      if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
      for (const file of files) {
        setImportProgress(`${completed + 1} de ${files.length} · ${file.name}`);
        const metadata = await metadataFromFile(file);
        await saveLocalTrack(metadata, file);
        completed += 1;
        if (completed % 8 === 0) {
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        }
      }
      await loadLocalCatalog();
      toast({
        title: 'Música disponible',
        description: `${completed} canción${completed === 1 ? '' : 'es'} guardada${completed === 1 ? '' : 's'} solamente en este dispositivo.`,
      });
    } catch (error) {
      const quotaError = error instanceof DOMException && error.name === 'QuotaExceededError';
      toast({
        variant: 'destructive',
        title: 'No se completó la importación',
        description: quotaError
          ? 'El navegador no tiene espacio local suficiente. Elimina algunas canciones e inténtalo de nuevo.'
          : error instanceof Error ? error.message : 'No se pudo guardar el archivo.',
      });
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  const deleteTrack = async (track: MusicTrack) => {
    if (!window.confirm(`¿Eliminar “${track.title}” de este dispositivo?`)) return;
    try {
      await removeLocalTrack(track.id);
      setTracks((current) => current.filter((item) => item.id !== track.id));
      setFavorites((current) => current.filter((id) => id !== track.id));
      setPlaylists((current) => current.map((playlist) => ({
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => id !== track.id),
      })));
      if (currentTrack?.id === track.id) {
        audioRef.current?.pause();
        audioRef.current?.removeAttribute('src');
        if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
        playbackUrlRef.current = '';
        setCurrentTrack(null);
      }
      await refreshStorageUsage();
      toast({ title: 'Canción eliminada del dispositivo' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar',
        description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      });
    }
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((current) => current.includes(trackId)
      ? current.filter((id) => id !== trackId)
      : [...current, trackId]);
  };

  const addToSelectedPlaylist = (trackId: string) => {
    if (!selectedPlaylist) return;
    setPlaylists((current) => current.map((playlist) =>
      playlist.id === selectedPlaylist.id && !playlist.trackIds.includes(trackId)
        ? { ...playlist, trackIds: [...playlist.trackIds, trackId] }
        : playlist));
    toast({ title: `Agregada a ${selectedPlaylist.name}` });
  };

  const removeFromSelectedPlaylist = (trackId: string) => {
    if (!selectedPlaylist) return;
    setPlaylists((current) => current.map((playlist) =>
      playlist.id === selectedPlaylist.id
        ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
        : playlist));
  };

  const createPlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newPlaylistName.trim();
    if (!name) return;
    const playlist: LocalPlaylist = {
      id: `playlist-${Date.now()}`,
      name: name.slice(0, 40),
      trackIds: [],
    };
    setPlaylists((current) => [...current, playlist]);
    setSelectedPlaylistId(playlist.id);
    setMusicView('playlist');
    setNewPlaylistName('');
  };

  const deleteSelectedPlaylist = () => {
    if (!selectedPlaylist || playlists.length <= 1) return;
    if (!window.confirm(`¿Eliminar la playlist “${selectedPlaylist.name}”?`)) return;
    const next = playlists.filter((playlist) => playlist.id !== selectedPlaylist.id);
    setPlaylists(next);
    setSelectedPlaylistId(next[0].id);
  };

  const moveDate = (direction: -1 | 1) => {
    const index = TRAINING_DATES.indexOf(activeDate);
    const nextIndex = Math.min(TRAINING_DATES.length - 1, Math.max(0, index + direction));
    setActiveDate(TRAINING_DATES[nextIndex]);
  };

  if (!mounted) {
    return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  const rpeClass = activity?.rpe.startsWith('8')
    ? 'border-red-500/25 bg-red-500/10 text-red-400'
    : activity?.rpe.startsWith('7')
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
      : 'border-green-500/25 bg-green-500/10 text-green-400';
  const coverGradient = getCoverGradient(currentTrack?.id || 'albatros-music');
  const currentArtworkUrl = currentTrack ? artworkUrls[currentTrack.id] : '';

  return (
    <div className="pb-8">
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => void playNext()}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onError={(event) => {
          setPlaying(false);
          if (!event.currentTarget.src || !currentTrack) return;
          toast({
            variant: 'destructive',
            title: 'Formato de audio no compatible',
            description: 'El archivo se importó, pero este navegador no puede reproducir su pista de audio. En WebM usa Opus o Vorbis.',
          });
        }}
      />
      <input ref={fileInputRef} type="file" multiple accept="audio/*,video/webm,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.webm" onChange={(event) => void importLocalFiles(event)} className="sr-only" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Albatros Studio</p>
          <h1 className="mt-1 text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Clase en vivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Música y dirección técnica, en perfecta sincronía.</p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-green-400/15 bg-green-400/[0.07] px-3.5 py-2 text-[9px] font-black uppercase tracking-wider text-green-400">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
          Biblioteca local · {formatBytes(storageUsage)}{storageQuota > 0 ? ` de ${formatBytes(storageQuota)}` : ''}
        </div>
      </div>

      <div className="relative text-white">
        <div
          className="grid items-start gap-4 sm:gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 23rem), 1fr))' }}
        >
          <section className="relative min-w-0 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#08090d] shadow-[0_30px_80px_rgba(0,0,0,0.38)] sm:rounded-[2.25rem]">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-600/20 blur-[110px]" />
            <div className="pointer-events-none absolute -bottom-48 right-0 h-96 w-96 rounded-full bg-fuchsia-700/10 blur-[120px]" />
            <div className="relative p-4 sm:p-6 xl:p-8">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-400">Reproduciendo ahora</p><p className="mt-1 text-xs text-white/35">Archivos de este dispositivo</p></div>
                <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[10px] font-black uppercase text-black shadow-lg transition hover:scale-[1.02] disabled:opacity-45">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Música</button>
              </div>
              {importProgress && <p className="mt-3 truncate rounded-full bg-red-500/10 px-3 py-2 text-center text-[10px] font-bold text-red-300">{importProgress}</p>}

              <div className="mx-auto mt-7 max-w-sm px-3">
                <div className="relative mx-auto aspect-square w-full max-w-[19rem]">
                  <div
                    className="absolute inset-6 rounded-[2.2rem] opacity-60 blur-3xl transition-all duration-700"
                    style={{
                      background: currentArtworkUrl
                        ? `url("${currentArtworkUrl}") center / cover no-repeat`
                        : coverGradient,
                    }}
                  />
                  <div className={cn('relative grid h-full w-full place-items-center overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_35px_70px_rgba(0,0,0,0.55)] transition-all duration-700', playing ? 'scale-100' : 'scale-[0.94]')} style={{ background: coverGradient }}>
                    {currentArtworkUrl ? (
                      <>
                        <img
                          src={currentArtworkUrl}
                          alt={`Portada de ${currentTrack?.title || 'la canción'}`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/[0.05]" />
                      </>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.32),transparent_28%),linear-gradient(155deg,transparent_45%,rgba(0,0,0,0.38))]" />
                        <div className="absolute inset-7 rounded-full border border-white/10" />
                        <div className="absolute inset-14 rounded-full border border-white/[0.07]" />
                        <div className="relative grid h-24 w-24 place-items-center rounded-full border border-white/20 bg-black/25 shadow-2xl backdrop-blur-md"><Music2 className="h-10 w-10 text-white/90" /></div>
                      </>
                    )}
                    <div className="absolute bottom-5 left-5 right-5 flex h-6 items-end justify-center gap-1 opacity-65">{[10, 18, 13, 22, 16, 26, 12, 20, 14, 24, 11, 17].map((height, index) => <span key={index} className={cn('w-1 rounded-full bg-white transition-opacity', playing ? 'animate-pulse' : 'opacity-45')} style={{ height }} />)}</div>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="truncate text-xl font-black tracking-tight sm:text-2xl">{currentTrack?.title || 'Tu música, lista para entrenar'}</p>
                  <p className="mt-1 truncate text-sm font-medium text-white/45">{currentTrack?.artist || 'Selecciona una canción de la biblioteca'}</p>
                  {currentTrack && <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">{currentTrack.album} · {currentTrack.sourceFormat || 'Audio local'}</p>}
                </div>

                <div className="mt-6">
                  <input type="range" min={0} max={duration || 0} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }} className="h-1 w-full cursor-pointer accent-white" aria-label="Posición de reproducción" />
                  <div className="mt-1.5 flex justify-between text-[9px] font-semibold tabular-nums text-white/35"><span>{formatTime(currentTime)}</span><span>-{formatTime(Math.max(0, duration - currentTime))}</span></div>
                </div>

                <div className="mt-3 flex items-center justify-center gap-3 sm:gap-4 xl:gap-6">
                  <button onClick={() => setShuffle((value) => !value)} className={cn('grid h-10 w-10 place-items-center rounded-full transition', shuffle ? 'bg-red-500/15 text-red-400' : 'text-white/35 hover:text-white')} aria-label="Reproducción aleatoria"><Shuffle className="h-4 w-4" /></button>
                  <button onClick={() => void playPrevious()} disabled={!currentTrack} className="grid h-12 w-12 place-items-center text-white/75 transition hover:scale-110 hover:text-white disabled:opacity-20"><SkipBack className="h-7 w-7 fill-current" /></button>
                  <button onClick={() => void togglePlayback()} disabled={!currentTrack} className="grid h-16 w-16 place-items-center rounded-full bg-white text-black shadow-[0_15px_35px_rgba(255,255,255,0.16)] transition hover:scale-105 disabled:opacity-35">{playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-1 h-7 w-7 fill-current" />}</button>
                  <button onClick={() => void playNext()} disabled={!currentTrack} className="grid h-12 w-12 place-items-center text-white/75 transition hover:scale-110 hover:text-white disabled:opacity-20"><SkipForward className="h-7 w-7 fill-current" /></button>
                  <button onClick={() => currentTrack && toggleFavorite(currentTrack.id)} disabled={!currentTrack} className={cn('grid h-10 w-10 place-items-center rounded-full transition disabled:opacity-20', currentTrack && favorites.includes(currentTrack.id) ? 'bg-red-500/15 text-red-400' : 'text-white/35 hover:text-white')} aria-label="Favorita"><Heart className={cn('h-4 w-4', currentTrack && favorites.includes(currentTrack.id) && 'fill-current')} /></button>
                </div>
                <div className="mx-auto mt-4 flex max-w-[15rem] items-center gap-3"><Volume2 className="h-3.5 w-3.5 text-white/30" /><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="h-1 min-w-0 flex-1 accent-white" aria-label="Volumen" /></div>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.045] p-3 backdrop-blur-2xl sm:p-4">
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-black/25 p-1">
                  {[
                    { id: 'library' as const, label: 'Biblioteca', icon: Library, count: tracks.length },
                    { id: 'favorites' as const, label: 'Favoritas', icon: Heart, count: favorites.length },
                    { id: 'playlist' as const, label: 'Playlists', icon: ListMusic, count: playlists.length },
                  ].map((item) => <button key={item.id} onClick={() => setMusicView(item.id)} className={cn('flex h-10 items-center justify-center gap-1.5 rounded-xl text-[9px] font-black uppercase transition', musicView === item.id ? 'bg-white text-black shadow-lg' : 'text-white/35 hover:text-white')}><item.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{item.label}</span><span className="opacity-45">{item.count}</span></button>)}
                </div>

                {musicView === 'playlist' && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]"><div className="flex gap-2"><select value={selectedPlaylistId} onChange={(event) => setSelectedPlaylistId(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#121319] px-3 text-xs font-bold text-white outline-none">{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name} · {playlist.trackIds.length}</option>)}</select>{playlists.length > 1 && <button onClick={deleteSelectedPlaylist} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-white/35 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}</div><form onSubmit={createPlaylist} className="flex gap-2"><input value={newPlaylistName} onChange={(event) => setNewPlaylistName(event.target.value)} maxLength={40} className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-white outline-none focus:border-red-500/50" placeholder="Nueva playlist" /><button type="submit" disabled={!newPlaylistName.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-600 text-white disabled:opacity-35"><Plus className="h-4 w-4" /></button></form></div>}

                <div className="relative mt-3"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" /><input type="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} className="h-11 w-full rounded-2xl border border-white/[0.08] bg-black/20 pl-10 pr-10 text-xs text-white outline-none placeholder:text-white/25 focus:border-red-500/35" placeholder="Buscar en tu música" />{searchValue && <button onClick={() => setSearchValue('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><X className="h-4 w-4" /></button>}</div>

                {libraryLoading ? (
                  <div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>
                ) : libraryError ? (
                  <div className="grid min-h-52 place-items-center text-center"><div><Disc3 className="mx-auto h-9 w-9 text-red-500" /><p className="mt-3 text-sm font-black uppercase">Biblioteca no disponible</p><p className="mt-1 max-w-xs text-xs text-white/35">{libraryError}</p><button onClick={() => void loadLocalCatalog()} className="mt-4 h-9 rounded-full border border-white/10 px-4 text-[10px] font-black uppercase">Reintentar</button></div></div>
                ) : visibleTracks.length === 0 ? (
                  <div className="grid min-h-52 place-items-center text-center"><div><Disc3 className="mx-auto h-10 w-10 text-white/15" /><p className="mt-3 text-sm font-black uppercase">{tracks.length ? 'Sin resultados' : 'Tu biblioteca está vacía'}</p><p className="mt-1 max-w-xs text-xs text-white/30">{tracks.length ? 'Prueba otra búsqueda o playlist.' : 'Agrega canciones del teléfono o PC. Se quedarán solo aquí.'}</p>{!tracks.length && <button onClick={() => fileInputRef.current?.click()} className="mt-4 h-9 rounded-full bg-white px-5 text-[10px] font-black uppercase text-black">Elegir música</button>}</div></div>
                ) : (
                  <div className="mt-3 max-h-[19rem] space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {displayedTracks.map((track, index) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isFavorite = favorites.includes(track.id);
                      const isInPlaylist = Boolean(selectedPlaylist?.trackIds.includes(track.id));
                      const artworkUrl = artworkUrls[track.id];
                      return (
                        <div key={track.id} className={cn('group flex items-center gap-2.5 rounded-2xl p-2 transition', isCurrent ? 'bg-white/[0.09]' : 'hover:bg-white/[0.05]')}>
                          <span className="w-5 text-center text-[9px] font-bold tabular-nums text-white/20">{String(index + 1).padStart(2, '0')}</span>
                          <button
                            onClick={() => { if (isCurrent) void togglePlayback(); else void playTrack(track, visibleTracks.map((item) => item.id)); }}
                            disabled={loadingTrackId === track.id}
                            className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl text-white shadow-md"
                            style={{ background: getCoverGradient(track.id) }}
                            aria-label={`${isCurrent && playing ? 'Pausar' : 'Reproducir'} ${track.title}`}
                          >
                            {artworkUrl && <img src={artworkUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />}
                            {artworkUrl && <span className="absolute inset-0 bg-black/25 opacity-0 transition group-hover:opacity-100" />}
                            <span className="relative z-10">
                              {loadingTrackId === track.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent && playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current opacity-60 transition sm:opacity-0 sm:group-hover:opacity-100" />}
                            </span>
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn('truncate text-xs font-bold', isCurrent ? 'text-red-400' : 'text-white/85')}>{track.title}</p>
                            <p className="mt-0.5 truncate text-[10px] text-white/30">{track.artist} · {track.album} · {formatBytes(track.size)}</p>
                          </div>
                          <button onClick={() => toggleFavorite(track.id)} className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full transition', isFavorite ? 'text-red-400' : 'text-white/20 hover:bg-white/5 hover:text-white')}><Heart className={cn('h-3.5 w-3.5', isFavorite && 'fill-current')} /></button>
                          {musicView === 'playlist' ? <button onClick={() => removeFromSelectedPlaylist(track.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/20 hover:bg-white/5 hover:text-red-400"><X className="h-3.5 w-3.5" /></button> : <button onClick={() => addToSelectedPlaylist(track.id)} disabled={isInPlaylist} className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', isInPlaylist ? 'text-green-400/70' : 'text-white/20 hover:bg-white/5 hover:text-white')}>{isInPlaylist ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</button>}
                          <button onClick={() => void deleteTrack(track)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/15 opacity-100 hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      );
                    })}
                    {displayedTracks.length < visibleTracks.length && (
                      <button
                        type="button"
                        onClick={() => setVisibleTrackLimit((current) => current + TRACK_PAGE_SIZE)}
                        className="mt-2 h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] text-[9px] font-black uppercase tracking-wider text-white/45 transition hover:border-white/15 hover:text-white"
                      >
                        Mostrar {Math.min(TRACK_PAGE_SIZE, visibleTracks.length - displayedTracks.length)} más · {displayedTracks.length} de {visibleTracks.length}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section
            className="relative min-w-0 overflow-hidden rounded-[2rem] border border-white/[0.08] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.38)] sm:rounded-[2.25rem] sm:p-6 xl:p-8"
            style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.08), transparent 35%), #0a0b0f' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-400">Itinerario</p><h2 className="mt-1 text-2xl font-black uppercase italic tracking-tighter sm:text-3xl">Plan del día</h2><p className="mt-1 capitalize text-xs text-white/35">{formatClassDate(activeDate)}</p></div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] p-1"><button onClick={() => moveDate(-1)} disabled={activeDate === TRAINING_DATES[0]} className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-20"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setActiveDate(getClosestTrainingDate(today))} className="h-8 rounded-full px-3 text-[9px] font-black uppercase text-white/55 hover:bg-white/10 hover:text-white">Hoy</button><button onClick={() => moveDate(1)} disabled={activeDate === TRAINING_DATES[TRAINING_DATES.length - 1]} className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-20"><ChevronRight className="h-4 w-4" /></button></div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">{TRAINING_DATES.map((date) => { const parts = getClassDateParts(date); return <button key={date} onClick={() => setActiveDate(date)} className={cn('relative flex h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-[8px] font-black uppercase transition', activeDate === date ? 'border-white bg-white text-black shadow-xl' : 'border-white/[0.07] bg-white/[0.025] text-white/35 hover:border-white/15 hover:text-white', date === today && activeDate !== date && 'after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-red-500')}><span>{parts.weekday}</span><span className="mt-0.5 text-base leading-none">{parts.day}</span></button>; })}</div>

            <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.07] bg-black/20 p-1">{(['BJJ', 'MMA'] as Discipline[]).map((item) => <button key={item} onClick={() => setDiscipline(item)} className={cn('h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition', discipline === item ? 'bg-red-600 text-white shadow-[0_8px_25px_rgba(220,38,38,0.25)]' : 'text-white/35 hover:text-white')}>{item === 'BJJ' ? 'Jiu Jitsu' : 'MMA'}</button>)}</div>

            {activity && <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[9px] font-black uppercase text-red-400">Sesión {String(activity.session).padStart(2, '0')}</span><span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[9px] font-black uppercase text-white/40">{activity.focus}</span><span className={cn('rounded-full border px-3 py-1 text-[9px] font-black uppercase', rpeClass)}>RPE {activity.rpe}</span></div>
              <h3 className="mt-4 text-3xl font-black uppercase italic leading-[0.92] tracking-[-0.04em] sm:text-4xl">{activity.title}</h3>
              <p className="mt-3 text-xs font-medium leading-relaxed text-white/40">{activity.emphasis}</p>

              <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] divide-x divide-white/[0.07]"><div className="p-3.5"><Clock3 className="h-4 w-4 text-red-400" /><p className="mt-2 text-lg font-black">{getActivityDuration(activity)}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/25">Minutos</p></div><div className="p-3.5"><Dumbbell className="h-4 w-4 text-red-400" /><p className="mt-2 truncate text-lg font-black">{activity.focus}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/25">Enfoque</p></div><div className="p-3.5"><Activity className="h-4 w-4 text-red-400" /><p className="mt-2 text-lg font-black">{activity.blocks.length}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/25">Bloques</p></div></div>

              <div className="relative mt-6 max-h-[38rem] space-y-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] before:absolute before:bottom-5 before:left-[3.15rem] before:top-5 before:w-px before:bg-gradient-to-b before:from-red-500/60 before:via-white/10 before:to-transparent">{activity.blocks.map((block, index) => <div key={`${block.range}-${block.title}`} className="group relative grid grid-cols-[4.6rem_1fr] gap-3"><div className="relative z-10 flex items-start justify-between pt-4"><span className="text-[9px] font-black tabular-nums text-white/30">{block.range}</span><span className={cn('mr-1.5 mt-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0b0f] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] transition', index === 0 ? 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.8)]' : 'bg-white/25 group-hover:bg-red-400')} /></div><div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-red-500/20 hover:bg-white/[0.055]"><div className="flex items-start justify-between gap-3"><p className="text-xs font-black uppercase tracking-tight text-white/85">{block.title}</p><span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[8px] font-black text-white/35">{block.minutes} min</span></div><p className="mt-1.5 text-[11px] leading-relaxed text-white/35">{block.detail}</p></div></div>)}</div>

              <div className="mt-5 rounded-2xl border border-green-400/10 bg-green-400/[0.045] p-4"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /><p className="text-[9px] font-black uppercase tracking-[0.18em] text-green-400">Meta de la sesión</p></div><p className="mt-2 text-[11px] leading-relaxed text-white/38">{SUCCESS_CRITERION}</p></div>
            </div>}
          </section>
        </div>
      </div>
    </div>
  );
}
