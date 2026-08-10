'use client';

import NextImage from 'next/image';

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
  Maximize2,
  Minimize2,
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
  source?: 'stored' | 'folder' | 'session';
  folderId?: string;
  relativePath?: string;
  metadataReady?: boolean;
};

type LegacyStoredTrack = MusicTrack & { blob?: Blob };
type StoredAudio = { id: string; blob: Blob };

type LocalFileHandle = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
};

type LocalDirectoryHandle = {
  kind: 'directory';
  name: string;
  entries: () => AsyncIterableIterator<[string, LocalFileHandle | LocalDirectoryHandle]>;
  getDirectoryHandle: (name: string) => Promise<LocalDirectoryHandle>;
  getFileHandle: (name: string) => Promise<LocalFileHandle>;
  queryPermission?: (options?: { mode: 'read' }) => Promise<PermissionState>;
  requestPermission?: (options?: { mode: 'read' }) => Promise<PermissionState>;
};

type StoredFolderSource = {
  id: string;
  name: string;
  handle: LocalDirectoryHandle;
  linkedAt: string;
};

type LocalPlaylist = {
  id: string;
  name: string;
  trackIds: string[];
};

type MusicView = 'library' | 'favorites' | 'playlist';
type TimerPhase = 'idle' | 'work' | 'rest' | 'finished';

type TimerPreset = {
  id: string;
  name: string;
  rounds: number;
  workSeconds: number;
  restEnabled: boolean;
  restSeconds: number;
  custom?: boolean;
};

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type ClassDiagnostics = {
  online: boolean;
  serviceWorker: boolean;
  installed: boolean;
  wakeLockSupported: boolean;
  folderSupported: boolean;
  fullscreenSupported: boolean;
  webmSupported: boolean;
  persistentStorage: boolean;
  checkedAt: number;
};

const MUSIC_DB_NAME = 'albatros-local-music-v1';
const MUSIC_STORE_NAME = 'tracks';
const MUSIC_AUDIO_STORE_NAME = 'audio-files';
const MUSIC_SOURCE_STORE_NAME = 'source-handles';
const MUSIC_DATABASE_VERSION = 3;
const PRIMARY_FOLDER_ID = 'primary-music-folder';
const PLAYLISTS_KEY = 'albatros-local-playlists-v1';
const FAVORITES_KEY = 'albatros-local-favorites-v1';
const TIMER_PRESETS_KEY = 'albatros-class-timer-presets-v1';
const TIMER_AUTOMATION_KEY = 'albatros-class-timer-automation-v1';
const ACTIVITY_PROGRESS_KEY = 'albatros-class-activity-progress-v1';
const TRACK_PAGE_SIZE = 80;
const DEFAULT_PLAYLIST: LocalPlaylist = {
  id: 'entrenamiento',
  name: 'Entrenamiento',
  trackIds: [],
};

const BUILTIN_TIMER_PRESETS: TimerPreset[] = [
  { id: 'bjj-3x5', name: 'BJJ · 3 × 5', rounds: 3, workSeconds: 300, restEnabled: true, restSeconds: 30 },
  { id: 'mma-5x3', name: 'MMA · 5 × 3', rounds: 5, workSeconds: 180, restEnabled: true, restSeconds: 60 },
  { id: 'tecnica-10x1', name: 'Técnica · 10 × 1', rounds: 10, workSeconds: 60, restEnabled: true, restSeconds: 20 },
  { id: 'tabata-8x20', name: 'Tabata · 8 × 20 s', rounds: 8, workSeconds: 20, restEnabled: true, restSeconds: 10 },
];

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
      if (!database.objectStoreNames.contains(MUSIC_SOURCE_STORE_NAME)) {
        database.createObjectStore(MUSIC_SOURCE_STORE_NAME, { keyPath: 'id' });
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
        const track = { ...(cursor.value as LegacyStoredTrack) };
        delete track.blob;
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

async function saveTrackMetadata(metadata: MusicTrack) {
  const database = await openMusicDatabase();
  try {
    const transaction = database.transaction(MUSIC_STORE_NAME, 'readwrite');
    const finished = transactionFinished(transaction);
    transaction.objectStore(MUSIC_STORE_NAME).put(metadata);
    await finished;
  } finally {
    database.close();
  }
}

async function replaceFolderCatalog(folderId: string, tracks: MusicTrack[]) {
  const database = await openMusicDatabase();
  try {
    const removeTransaction = database.transaction(MUSIC_STORE_NAME, 'readwrite');
    const removeFinished = transactionFinished(removeTransaction);
    const store = removeTransaction.objectStore(MUSIC_STORE_NAME);
    await new Promise<void>((resolve, reject) => {
      const request = store.openCursor();
      request.onerror = () => reject(request.error || new Error('No se pudo actualizar la carpeta.'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        const track = cursor.value as MusicTrack;
        if (track.source === 'folder' && track.folderId === folderId) cursor.delete();
        cursor.continue();
      };
    });
    await removeFinished;

    if (!tracks.length) return;
    const saveTransaction = database.transaction(MUSIC_STORE_NAME, 'readwrite');
    const saveFinished = transactionFinished(saveTransaction);
    const saveStore = saveTransaction.objectStore(MUSIC_STORE_NAME);
    tracks.forEach((track) => saveStore.put(track));
    await saveFinished;
  } finally {
    database.close();
  }
}

async function saveFolderSource(handle: LocalDirectoryHandle) {
  const database = await openMusicDatabase();
  try {
    const transaction = database.transaction(MUSIC_SOURCE_STORE_NAME, 'readwrite');
    const finished = transactionFinished(transaction);
    transaction.objectStore(MUSIC_SOURCE_STORE_NAME).put({
      id: PRIMARY_FOLDER_ID,
      name: handle.name,
      handle,
      linkedAt: new Date().toISOString(),
    } satisfies StoredFolderSource);
    await finished;
  } finally {
    database.close();
  }
}

async function readFolderSource() {
  const database = await openMusicDatabase();
  try {
    const transaction = database.transaction(MUSIC_SOURCE_STORE_NAME, 'readonly');
    const finished = transactionFinished(transaction);
    const source = await requestResult(
      transaction.objectStore(MUSIC_SOURCE_STORE_NAME).get(PRIMARY_FOLDER_ID) as IDBRequest<StoredFolderSource | undefined>,
    );
    await finished;
    return source;
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

function createTrackId(file: File, identity = file.name) {
  const seed = `${identity}|${file.size}|${file.lastModified}`;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `local-${(hash >>> 0).toString(36)}-${file.size.toString(36)}`;
}

function fallbackMetadataFromFile(file: File, id = createTrackId(file)): MusicTrack {
  const cleanName = file.name.replace(/\.[^.]+$/, '').trim() || 'Canción local';
  const separator = cleanName.indexOf(' - ');
  const artist = separator > 0 ? cleanName.slice(0, separator).trim() : 'Archivo local';
  const title = separator > 0 ? cleanName.slice(separator + 3).trim() : cleanName;
  return {
    id,
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

function isSupportedMusicFile(file: File) {
  return file.type.startsWith('audio/') ||
    file.type === 'video/webm' ||
    /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)$/i.test(file.name);
}

async function folderPermission(handle: LocalDirectoryHandle, request: boolean) {
  if (!handle.queryPermission && !handle.requestPermission) return true;
  const current = handle.queryPermission
    ? await handle.queryPermission({ mode: 'read' })
    : 'prompt';
  if (current === 'granted') return true;
  if (!request || !handle.requestPermission) return false;
  return (await handle.requestPermission({ mode: 'read' })) === 'granted';
}

async function collectFolderMusic(
  directory: LocalDirectoryHandle,
  path: string[] = [],
): Promise<Array<{ file: File; relativePath: string }>> {
  const files: Array<{ file: File; relativePath: string }> = [];
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'directory') {
      files.push(...await collectFolderMusic(handle, [...path, name]));
      continue;
    }
    const file = await handle.getFile();
    if (!isSupportedMusicFile(file)) continue;
    files.push({ file, relativePath: [...path, name].join('/') });
  }
  return files;
}

async function resolveFolderFile(
  root: LocalDirectoryHandle,
  relativePath: string,
) {
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return null;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part);
  const handle = await directory.getFileHandle(fileName);
  return handle.getFile();
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

function clampInteger(value: string, minimum: number, maximum: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return minimum;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function activityBlockKey(index: number, range: string, title: string) {
  return `${index}:${range}:${title}`;
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
  const sessionInputRef = useRef<HTMLInputElement | null>(null);
  const playbackUrlRef = useRef('');
  const directFilesRef = useRef(new Map<string, File>());
  const folderHandleRef = useRef<LocalDirectoryHandle | null>(null);
  const enrichingTracksRef = useRef(new Set<string>());
  const timerEndAtRef = useRef(0);
  const timerAudioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

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
  const [folderName, setFolderName] = useState('');
  const [folderConnected, setFolderConnected] = useState(false);
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
  const [playerCollapsed, setPlayerCollapsed] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  const [timerExpanded, setTimerExpanded] = useState(false);
  const [itineraryExpanded, setItineraryExpanded] = useState(true);
  const [timerRounds, setTimerRounds] = useState(3);
  const [workMinutes, setWorkMinutes] = useState(5);
  const [workSecondsPart, setWorkSecondsPart] = useState(0);
  const [restEnabled, setRestEnabled] = useState(true);
  const [restMinutes, setRestMinutes] = useState(0);
  const [restSecondsPart, setRestSecondsPart] = useState(30);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [timerRound, setTimerRound] = useState(1);
  const [timerRemaining, setTimerRemaining] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [customTimerPresets, setCustomTimerPresets] = useState<TimerPreset[]>([]);
  const [duckMusicOnRest, setDuckMusicOnRest] = useState(true);
  const [pauseMusicOnFinish, setPauseMusicOnFinish] = useState(true);

  const [completedBlocks, setCompletedBlocks] = useState<string[]>([]);
  const [classMode, setClassMode] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ClassDiagnostics>({
    online: true,
    serviceWorker: false,
    installed: false,
    wakeLockSupported: false,
    folderSupported: false,
    fullscreenSupported: false,
    webmSupported: false,
    persistentStorage: false,
    checkedAt: 0,
  });

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
    const storedPresets = safeParse<TimerPreset[]>(localStorage.getItem(TIMER_PRESETS_KEY), []);
    const storedAutomation = safeParse<{ duckMusicOnRest?: boolean; pauseMusicOnFinish?: boolean }>(
      localStorage.getItem(TIMER_AUTOMATION_KEY),
      {},
    );
    const normalizedPlaylists = storedPlaylists.length ? storedPlaylists : [DEFAULT_PLAYLIST];
    setPlaylists(normalizedPlaylists);
    setSelectedPlaylistId(normalizedPlaylists[0].id);
    setFavorites(storedFavorites);
    setCustomTimerPresets(storedPresets.filter((preset) => preset.custom));
    setDuckMusicOnRest(storedAutomation.duckMusicOnRest ?? true);
    setPauseMusicOnFinish(storedAutomation.pauseMusicOnFinish ?? true);
    setActiveDate(getClosestTrainingDate(getMeridaISODate()));
    setMounted(true);
    void loadLocalCatalog();
    void readFolderSource().then(async (source) => {
      if (!source) return;
      folderHandleRef.current = source.handle;
      setFolderName(source.name);
      setFolderConnected(await folderPermission(source.handle, false).catch(() => false));
    }).catch(() => undefined);
  }, [loadLocalCatalog]);

  useEffect(() => {
    if (mounted) localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  }, [mounted, playlists]);

  useEffect(() => {
    if (mounted) localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites, mounted]);

  useEffect(() => {
    if (mounted) localStorage.setItem(TIMER_PRESETS_KEY, JSON.stringify(customTimerPresets));
  }, [customTimerPresets, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(TIMER_AUTOMATION_KEY, JSON.stringify({
      duckMusicOnRest,
      pauseMusicOnFinish,
    }));
  }, [duckMusicOnRest, mounted, pauseMusicOnFinish]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = duckMusicOnRest && timerPhase === 'rest'
      ? Math.max(0.04, volume * 0.25)
      : volume;
  }, [duckMusicOnRest, timerPhase, volume]);

  useEffect(() => {
    const updateClock = () => setClockNow(new Date());
    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, []);

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

  const refreshDiagnostics = useCallback(async () => {
    const audio = document.createElement('audio');
    const persistentStorage = navigator.storage?.persisted
      ? await navigator.storage.persisted().catch(() => false)
      : false;
    setDiagnostics({
      online: navigator.onLine,
      serviceWorker: Boolean(navigator.serviceWorker?.controller),
      installed: window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      wakeLockSupported: 'wakeLock' in navigator,
      folderSupported: 'showDirectoryPicker' in window,
      fullscreenSupported: document.fullscreenEnabled,
      webmSupported: Boolean(
        audio.canPlayType('audio/webm; codecs="opus"') ||
        audio.canPlayType('video/webm; codecs="opus"'),
      ),
      persistentStorage,
      checkedAt: Date.now(),
    });
    await refreshStorageUsage();
  }, [refreshStorageUsage]);

  useEffect(() => {
    if (!mounted) return;
    const update = () => void refreshDiagnostics();
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    navigator.serviceWorker?.addEventListener('controllerchange', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      navigator.serviceWorker?.removeEventListener('controllerchange', update);
    };
  }, [mounted, refreshDiagnostics]);

  const requestWakeLock = useCallback(async () => {
    const wakeLock = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    }).wakeLock;
    if (!wakeLock) {
      setWakeLockActive(false);
      return false;
    }
    try {
      const sentinel = await wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setWakeLockActive(true);
      sentinel.addEventListener('release', () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        setWakeLockActive(false);
      });
      return true;
    } catch {
      setWakeLockActive(false);
      return false;
    }
  }, []);

  const enterClassMode = async () => {
    setClassMode(true);
    await requestWakeLock();
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // El modo clase continúa dentro de la pestaña si fullscreen no está permitido.
    }
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (value: 'landscape') => Promise<void>;
      };
      await orientation.lock?.('landscape');
    } catch {
      // La orientación puede bloquearse manualmente en el dispositivo.
    }
  };

  const exitClassMode = async () => {
    setClassMode(false);
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      await wakeLockRef.current.release().catch(() => undefined);
    }
    wakeLockRef.current = null;
    setWakeLockActive(false);
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void }).unlock?.();
    } catch {
      // No todos los navegadores permiten desbloquear orientación por código.
    }
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  };

  useEffect(() => {
    if (!classMode) return;
    const restoreWakeLock = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', restoreWakeLock);
    return () => document.removeEventListener('visibilitychange', restoreWakeLock);
  }, [classMode, requestWakeLock]);

  useEffect(() => () => {
    void timerAudioContextRef.current?.close().catch(() => undefined);
    if (wakeLockRef.current && !wakeLockRef.current.released) {
      void wakeLockRef.current.release().catch(() => undefined);
    }
  }, []);

  const timerWorkDuration = useMemo(
    () => workMinutes * 60 + workSecondsPart,
    [workMinutes, workSecondsPart],
  );
  const timerRestDuration = useMemo(
    () => restMinutes * 60 + restSecondsPart,
    [restMinutes, restSecondsPart],
  );
  const timerTotalDuration = useMemo(
    () => timerRounds * timerWorkDuration +
      (restEnabled ? Math.max(0, timerRounds - 1) * timerRestDuration : 0),
    [restEnabled, timerRestDuration, timerRounds, timerWorkDuration],
  );
  const timerPhaseDuration = timerPhase === 'rest' ? timerRestDuration : timerWorkDuration;
  const timerProgress = timerPhaseDuration > 0
    ? Math.min(100, Math.max(0, (timerRemaining / timerPhaseDuration) * 100))
    : 0;
  const timerLocked = timerPhase === 'work' || timerPhase === 'rest';

  const signalTimer = useCallback((finished: boolean) => {
    if ('vibrate' in navigator) navigator.vibrate(finished ? [240, 100, 240] : [180]);
    const context = timerAudioContextRef.current;
    if (!context || context.state === 'closed') return;
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = finished ? 920 : 720;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.36);
    } catch {
      // La vibración y el contador siguen funcionando si el navegador bloquea el tono.
    }
  }, []);

  const startOrResumeTimer = () => {
    if (timerWorkDuration <= 0) {
      toast({ variant: 'destructive', title: 'Define un tiempo de roleo mayor a cero' });
      return;
    }
    try {
      if (!timerAudioContextRef.current && 'AudioContext' in window) {
        timerAudioContextRef.current = new AudioContext();
      }
      void timerAudioContextRef.current?.resume().catch(() => undefined);
    } catch {
      // El temporizador puede funcionar sin sonido.
    }

    let nextRemaining = timerRemaining;
    if (timerPhase === 'idle' || timerPhase === 'finished') {
      nextRemaining = timerWorkDuration;
      setTimerRound(1);
      setTimerPhase('work');
    } else if (nextRemaining <= 0) {
      nextRemaining = timerPhase === 'rest' ? timerRestDuration : timerWorkDuration;
    }
    timerEndAtRef.current = Date.now() + nextRemaining * 1000;
    setTimerRemaining(nextRemaining);
    setTimerRunning(true);
    setTimerExpanded(true);
  };

  const pauseTimer = () => {
    const remaining = Math.max(0, Math.ceil((timerEndAtRef.current - Date.now()) / 1000));
    setTimerRemaining(remaining);
    setTimerRunning(false);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerPhase('idle');
    setTimerRound(1);
    setTimerRemaining(timerWorkDuration);
    timerEndAtRef.current = 0;
  };

  const timerPresets = useMemo(
    () => [...BUILTIN_TIMER_PRESETS, ...customTimerPresets],
    [customTimerPresets],
  );

  const applyTimerPreset = (preset: TimerPreset) => {
    if (timerLocked) {
      toast({ title: 'Reinicia el temporizador para cambiar de preset' });
      return;
    }
    setTimerRounds(preset.rounds);
    setWorkMinutes(Math.floor(preset.workSeconds / 60));
    setWorkSecondsPart(preset.workSeconds % 60);
    setRestEnabled(preset.restEnabled);
    setRestMinutes(Math.floor(preset.restSeconds / 60));
    setRestSecondsPart(preset.restSeconds % 60);
    setTimerRound(1);
    setTimerPhase('idle');
    setTimerRemaining(preset.workSeconds);
    timerEndAtRef.current = 0;
  };

  const saveCurrentTimerPreset = () => {
    const name = window.prompt('Nombre del preset:', `${timerRounds} × ${formatTime(timerWorkDuration)}`)?.trim();
    if (!name) return;
    const preset: TimerPreset = {
      id: `custom-${Date.now()}`,
      name: name.slice(0, 36),
      rounds: timerRounds,
      workSeconds: timerWorkDuration,
      restEnabled,
      restSeconds: timerRestDuration,
      custom: true,
    };
    setCustomTimerPresets((current) => [...current, preset]);
    toast({ title: `Preset “${preset.name}” guardado` });
  };

  const deleteTimerPreset = (preset: TimerPreset) => {
    if (!preset.custom || !window.confirm(`¿Eliminar el preset “${preset.name}”?`)) return;
    setCustomTimerPresets((current) => current.filter((item) => item.id !== preset.id));
  };

  useEffect(() => {
    if (timerPhase === 'idle') setTimerRemaining(timerWorkDuration);
  }, [timerPhase, timerWorkDuration]);

  useEffect(() => {
    if (!timerRunning) return;
    const tick = () => {
      const now = Date.now();
      let phase = timerPhase;
      let round = timerRound;
      let endAt = timerEndAtRef.current;
      let transitioned = false;
      let guard = 0;

      while (now >= endAt && phase !== 'finished' && guard < timerRounds * 2 + 4) {
        transitioned = true;
        guard += 1;
        if (phase === 'work') {
          if (round >= timerRounds) {
            phase = 'finished';
            break;
          }
          if (restEnabled && timerRestDuration > 0) {
            phase = 'rest';
            endAt += timerRestDuration * 1000;
          } else {
            round += 1;
            endAt += timerWorkDuration * 1000;
          }
        } else if (phase === 'rest') {
          round += 1;
          phase = 'work';
          endAt += timerWorkDuration * 1000;
        } else {
          break;
        }
      }

      if (phase === 'finished') {
        timerEndAtRef.current = 0;
        setTimerRemaining(0);
        setTimerPhase('finished');
        setTimerRunning(false);
        if (pauseMusicOnFinish) audioRef.current?.pause();
        signalTimer(true);
        return;
      }

      if (transitioned) {
        timerEndAtRef.current = endAt;
        setTimerPhase(phase);
        setTimerRound(round);
        signalTimer(false);
      }
      setTimerRemaining(Math.max(0, Math.ceil((endAt - now) / 1000)));
    };

    tick();
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [pauseMusicOnFinish, restEnabled, signalTimer, timerRestDuration, timerRound, timerRounds, timerRunning, timerWorkDuration, timerPhase]);

  const activity = useMemo(
    () => getActivityForDate(activeDate, discipline),
    [activeDate, discipline],
  );
  const activityKeys = useMemo(
    () => activity?.blocks.map((block, index) => activityBlockKey(index, block.range, block.title)) || [],
    [activity],
  );
  const completedBlockSet = useMemo(() => new Set(completedBlocks), [completedBlocks]);
  const nextBlockIndex = activityKeys.findIndex((key) => !completedBlockSet.has(key));
  const nextActivityBlock = activity && nextBlockIndex >= 0
    ? activity.blocks[nextBlockIndex]
    : null;

  useEffect(() => {
    if (!mounted || !activity) return;
    const progress = safeParse<Record<string, string[]>>(
      localStorage.getItem(ACTIVITY_PROGRESS_KEY),
      {},
    );
    setCompletedBlocks((progress[activity.id] || []).filter((key) => activityKeys.includes(key)));
  }, [activity, activityKeys, mounted]);

  const toggleActivityBlock = (index: number) => {
    if (!activity) return;
    const block = activity.blocks[index];
    const key = activityBlockKey(index, block.range, block.title);
    setCompletedBlocks((current) => {
      const next = current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key];
      const progress = safeParse<Record<string, string[]>>(
        localStorage.getItem(ACTIVITY_PROGRESS_KEY),
        {},
      );
      progress[activity.id] = next;
      localStorage.setItem(ACTIVITY_PROGRESS_KEY, JSON.stringify(progress));
      return next;
    });
  };

  const resetActivityProgress = () => {
    if (!activity || !completedBlocks.length) return;
    const progress = safeParse<Record<string, string[]>>(
      localStorage.getItem(ACTIVITY_PROGRESS_KEY),
      {},
    );
    progress[activity.id] = [];
    localStorage.setItem(ACTIVITY_PROGRESS_KEY, JSON.stringify(progress));
    setCompletedBlocks([]);
  };
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

  const enrichDirectTrack = useCallback(async (track: MusicTrack, file: File) => {
    if (track.metadataReady || enrichingTracksRef.current.has(track.id)) return;
    enrichingTracksRef.current.add(track.id);
    try {
      const parsed = await metadataFromFile(file);
      const enriched: MusicTrack = {
        ...track,
        ...parsed,
        id: track.id,
        source: track.source,
        folderId: track.folderId,
        relativePath: track.relativePath,
        metadataReady: true,
      };
      if (track.source === 'folder') await saveTrackMetadata(enriched);
      setTracks((current) => current.map((item) => item.id === track.id ? enriched : item));
      setCurrentTrack((current) => current?.id === track.id ? enriched : current);
    } catch {
      // El archivo continúa disponible aunque no tenga etiquetas o portada.
    } finally {
      enrichingTracksRef.current.delete(track.id);
    }
  }, []);

  const playTrack = useCallback(async (track: MusicTrack, queue?: string[]) => {
    if (loadingTrackId) return;
    setLoadingTrackId(track.id);
    try {
      let blob: Blob | null = null;
      let directFile = directFilesRef.current.get(track.id);
      if (!directFile && track.source === 'folder' && track.relativePath) {
        const savedSource = folderHandleRef.current
          ? { handle: folderHandleRef.current, name: folderHandleRef.current.name }
          : await readFolderSource();
        if (!savedSource) throw new Error('Vuelve a vincular la carpeta de música.');
        const permitted = await folderPermission(savedSource.handle, true);
        if (!permitted) throw new Error('Autoriza el acceso o vuelve a elegir la carpeta de música.');
        folderHandleRef.current = savedSource.handle;
        setFolderName(savedSource.name);
        setFolderConnected(true);
        directFile = await resolveFolderFile(savedSource.handle, track.relativePath) || undefined;
        if (directFile) directFilesRef.current.set(track.id, directFile);
      }
      if (directFile) blob = directFile;
      else if (track.source !== 'session' && track.source !== 'folder') {
        blob = await readLocalTrackBlob(track.id);
      }
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
      if (directFile) void enrichDirectTrack(track, directFile);
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
  }, [enrichDirectTrack, loadingTrackId, toast, visibleTracks]);

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

  const importStoredFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter(isSupportedMusicFile);
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

  const selectSessionFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter(isSupportedMusicFile);
    event.target.value = '';
    if (!files.length || importing) return;

    setImporting(true);
    setImportProgress(`Preparando ${files.length} canciones sin copiarlas…`);
    try {
      const sessionTracks = files.map((file) => {
        const track: MusicTrack = {
          ...fallbackMetadataFromFile(file, `session-${createTrackId(file)}`),
          source: 'session',
          metadataReady: false,
        };
        directFilesRef.current.set(track.id, file);
        return track;
      });
      setTracks((current) => {
        const byId = new Map(current.map((track) => [track.id, track]));
        sessionTracks.forEach((track) => byId.set(track.id, track));
        return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title, 'es-MX'));
      });
      toast({
        title: 'Música lista para esta sesión',
        description: `${sessionTracks.length} canciones disponibles sin ocupar espacio adicional en el navegador.`,
      });
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  const linkMusicFolder = async () => {
    if (importing) return;
    const picker = (window as Window & {
      showDirectoryPicker?: (options?: { id?: string; mode?: 'read' }) => Promise<LocalDirectoryHandle>;
    }).showDirectoryPicker;
    if (!picker) {
      toast({
        title: 'Usa selección por sesión',
        description: 'Este navegador no permite elegir carpetas. Selecciona tus canciones y se reproducirán directamente.',
      });
      sessionInputRef.current?.click();
      return;
    }

    setImporting(true);
    setImportProgress('Esperando la carpeta de música…');
    try {
      const handle = await picker.call(window, { id: 'albatros-music', mode: 'read' });
      if (!await folderPermission(handle, true)) throw new Error('No se autorizó el acceso a la carpeta.');
      setImportProgress('Buscando canciones en la carpeta…');
      const files = await collectFolderMusic(handle);
      if (!files.length) throw new Error('No se encontraron archivos de música compatibles.');

      const previousFolderTracks = new Map(
        tracks.filter((track) => track.source === 'folder').map((track) => [track.id, track]),
      );
      tracks.filter((track) => track.source === 'folder')
        .forEach((track) => directFilesRef.current.delete(track.id));

      const folderTracks = files.map(({ file, relativePath }) => {
        const id = `folder-${createTrackId(file, relativePath)}`;
        const previous = previousFolderTracks.get(id);
        const fallback = fallbackMetadataFromFile(file, id);
        const track: MusicTrack = {
          ...(previous || fallback),
          id,
          fileName: file.name,
          contentType: file.type || previous?.contentType || fallback.contentType,
          size: file.size,
          source: 'folder',
          folderId: PRIMARY_FOLDER_ID,
          relativePath,
          metadataReady: previous?.metadataReady || false,
        };
        directFilesRef.current.set(id, file);
        return track;
      }).sort((a, b) => a.title.localeCompare(b.title, 'es-MX'));

      setImportProgress(`Vinculando ${folderTracks.length} canciones sin copiarlas…`);
      let handleSaved = true;
      try {
        await saveFolderSource(handle);
      } catch {
        handleSaved = false;
      }
      await replaceFolderCatalog(PRIMARY_FOLDER_ID, folderTracks);
      folderHandleRef.current = handle;
      setFolderName(handle.name);
      setFolderConnected(true);
      setTracks((current) => [
        ...current.filter((track) => track.source !== 'folder'),
        ...folderTracks,
      ].sort((a, b) => a.title.localeCompare(b.title, 'es-MX')));
      toast({
        title: 'Carpeta de música vinculada',
        description: handleSaved
          ? `${folderTracks.length} canciones listas sin duplicar los archivos.`
          : `${folderTracks.length} canciones listas. Tendrás que volver a elegir la carpeta al reabrir la web.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({
        variant: 'destructive',
        title: 'No se pudo vincular la carpeta',
        description: error instanceof Error ? error.message : 'Usa la selección de archivos por sesión.',
      });
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  const deleteTrack = async (track: MusicTrack) => {
    const directTrack = track.source === 'folder' || track.source === 'session';
    if (!window.confirm(directTrack
      ? `¿Quitar “${track.title}” de esta lista? El archivo original no se eliminará.`
      : `¿Eliminar la copia local de “${track.title}”?`)) return;
    try {
      if (track.source !== 'session') await removeLocalTrack(track.id);
      directFilesRef.current.delete(track.id);
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
      toast({ title: directTrack ? 'Canción retirada de la lista' : 'Copia local eliminada' });
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
  const timerStatus = timerPhase === 'work'
    ? `Roleo ${timerRound} de ${timerRounds}`
    : timerPhase === 'rest'
      ? `Descanso · sigue el roleo ${timerRound + 1}`
      : timerPhase === 'finished'
        ? 'Serie terminada'
        : `${timerRounds} roleos · ${formatTime(timerWorkDuration)} cada uno`;
  const timerHasPriority = timerPhase === 'work' || timerPhase === 'rest';
  const wallClock = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(clockNow);
  const wallClockDate = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(clockNow);

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
      <input ref={fileInputRef} type="file" multiple accept="audio/*,video/webm,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.webm" onChange={(event) => void importStoredFiles(event)} className="sr-only" />
      <input ref={sessionInputRef} type="file" multiple accept="audio/*,video/webm,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.webm" onChange={(event) => void selectSessionFiles(event)} className="sr-only" />

      {classMode && (
        <div className="fixed inset-0 z-[120] overflow-y-auto bg-[#050608] text-white [color-scheme:dark] [overscroll-behavior:none]" style={{ color: '#ffffff' }}>
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(239,68,68,0.22),transparent_48%)]" />
          <div className="relative flex min-h-dvh flex-col p-3 sm:p-5 lg:p-7">
            <header className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.32em] text-red-400">Albatros Studio · Modo TV</p>
                <p className="mt-1 truncate text-sm font-bold text-white/80">{timerHasPriority ? timerStatus : currentTrack?.title || 'Clase en vivo'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={cn('hidden rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-wider sm:inline-flex', wakeLockActive ? 'border-green-400/25 bg-green-400/10 text-green-300' : 'border-amber-400/25 bg-amber-400/10 text-amber-300')}>{wakeLockActive ? 'Pantalla activa' : 'Evita bloquear la TV'}</span>
                <button type="button" onClick={() => void exitClassMode()} className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-white text-[#050608] shadow-xl transition hover:scale-105" style={{ color: '#050608' }} aria-label="Salir de pantalla completa"><Minimize2 className="h-5 w-5" /></button>
              </div>
            </header>

            {timerHasPriority ? (
              <main className="flex min-h-[34rem] flex-1 flex-col items-center justify-center py-4 text-center">
                <p className={cn('text-sm font-black uppercase tracking-[0.38em] sm:text-base', timerPhase === 'rest' ? 'text-amber-300' : 'text-red-400')}>{timerPhase === 'rest' ? 'Descanso' : `Roleo ${timerRound} de ${timerRounds}`}</p>
                <p className="mt-2 text-[clamp(7rem,28vw,22rem)] font-black leading-[0.82] tabular-nums tracking-[-0.09em] text-white drop-shadow-[0_0_70px_rgba(239,68,68,0.28)]">{formatTime(timerRemaining)}</p>
                <p className="mt-5 text-[clamp(1rem,2.2vw,2rem)] font-bold uppercase tracking-[0.18em] text-white/75">{timerStatus}</p>
                <div className="mt-7 flex items-center justify-center gap-3">
                  <button type="button" onClick={resetTimer} className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-white/[0.08] text-white transition hover:bg-white/15" aria-label="Reiniciar temporizador"><SkipBack className="h-6 w-6" /></button>
                  <button type="button" onClick={timerRunning ? pauseTimer : startOrResumeTimer} className={cn('flex h-16 min-w-48 items-center justify-center gap-3 rounded-full px-8 text-sm font-black uppercase tracking-wider shadow-2xl transition hover:scale-[1.02]', timerRunning ? 'bg-amber-300 text-[#140d00]' : 'bg-red-600 text-white')} style={{ color: timerRunning ? '#140d00' : '#ffffff' }}>{timerRunning ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}{timerRunning ? 'Pausar' : 'Continuar'}</button>
                </div>
              </main>
            ) : (
              <main className="grid min-h-[35rem] flex-1 items-center gap-6 py-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(28rem,1.2fr)] lg:gap-10">
                <div className="mx-auto w-full max-w-[min(52vh,34rem)]">
                  <div className="relative aspect-square overflow-hidden rounded-[clamp(1.75rem,4vw,3.5rem)] border border-white/15 shadow-[0_35px_100px_rgba(0,0,0,0.65)]" style={{ background: coverGradient }}>
                    {currentArtworkUrl ? <NextImage src={currentArtworkUrl} alt={`Portada de ${currentTrack?.title || 'la canción'}`} fill sizes="50vw" unoptimized className="object-cover" /> : <div className="grid h-full place-items-center"><Music2 className="h-24 w-24 text-white/75" /></div>}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/[0.06]" />
                  </div>
                </div>

                <div className="min-w-0 text-center lg:text-left">
                  <p className="text-[clamp(4.5rem,12vw,10rem)] font-black leading-[0.82] tabular-nums tracking-[-0.08em] text-white">{wallClock}</p>
                  <p className="mt-4 capitalize text-[clamp(1rem,2vw,1.65rem)] font-bold text-white/70">{wallClockDate}</p>
                  <div className="mt-8">
                    <p className="truncate text-[clamp(1.5rem,3vw,3.25rem)] font-black tracking-tight text-white">{currentTrack?.title || 'Selecciona una canción'}</p>
                    <p className="mt-2 truncate text-[clamp(1rem,1.7vw,1.5rem)] font-semibold text-white/65">{currentTrack?.artist || 'Biblioteca local'}</p>
                  </div>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                    <button type="button" onClick={() => void playPrevious()} disabled={!currentTrack} className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white transition hover:bg-white/15 disabled:opacity-30"><SkipBack className="h-7 w-7 fill-current" /></button>
                    <button type="button" onClick={() => void togglePlayback()} disabled={!currentTrack} className="grid h-20 w-20 place-items-center rounded-full bg-white text-[#050608] shadow-[0_18px_50px_rgba(255,255,255,0.2)] transition hover:scale-105 disabled:opacity-35" style={{ color: '#050608' }}>{playing ? <Pause className="h-9 w-9 fill-current" /> : <Play className="ml-1 h-9 w-9 fill-current" />}</button>
                    <button type="button" onClick={() => void playNext()} disabled={!currentTrack} className="grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white transition hover:bg-white/15 disabled:opacity-30"><SkipForward className="h-7 w-7 fill-current" /></button>
                    <div className="flex min-w-48 items-center gap-3 rounded-full border border-white/15 bg-white/[0.07] px-5 py-4"><Volume2 className="h-5 w-5 shrink-0 text-white/75" /><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="h-1 min-w-0 flex-1 accent-red-500" aria-label="Volumen" /></div>
                  </div>
                  <button type="button" onClick={startOrResumeTimer} className="mt-6 rounded-full border border-red-400/30 bg-red-500/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-red-300 transition hover:bg-red-500/20">Iniciar temporizador · {formatTime(timerWorkDuration)}</button>
                </div>
              </main>
            )}

            <footer className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-3 shadow-2xl backdrop-blur-xl sm:grid-cols-[1fr_auto] sm:items-center sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15" style={{ background: coverGradient }}>{currentArtworkUrl ? <NextImage src={currentArtworkUrl} alt="" fill sizes="48px" unoptimized className="object-cover" /> : <Music2 className="m-3 h-6 w-6 text-white/75" />}</div>
                <div className="min-w-0"><p className="truncate text-sm font-black text-white">{currentTrack?.title || 'Sin canción seleccionada'}</p><p className="truncate text-xs font-medium text-white/65">{currentTrack?.artist || 'Elige música desde la vista principal'}</p></div>
              </div>
              <div className="min-w-0 text-left sm:text-right"><p className="text-[8px] font-black uppercase tracking-[0.22em] text-red-400">Siguiente en el plan</p><p className="mt-1 truncate text-xs font-bold text-white/80">{nextActivityBlock ? `${nextActivityBlock.range} · ${nextActivityBlock.title}` : activity ? 'Clase completada' : 'Sin actividad programada'}</p></div>
            </footer>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Albatros Studio</p>
          <h1 className="mt-1 text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Clase en vivo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Música y dirección técnica, en perfecta sincronía.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void enterClassMode()} className="h-10 rounded-full bg-red-600 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white shadow-[0_10px_30px_rgba(220,38,38,0.2)] transition hover:scale-[1.02]">Modo clase</button>
          <div className="flex w-fit items-center gap-2 rounded-full border border-green-400/15 bg-green-400/[0.07] px-3.5 py-2 text-[9px] font-black uppercase tracking-wider text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
            {folderName
              ? `${folderConnected ? 'Carpeta directa' : 'Carpeta por reconectar'} · ${folderName}`
              : `Biblioteca local · ${formatBytes(storageUsage)}${storageQuota > 0 ? ` de ${formatBytes(storageQuota)}` : ''}`}
          </div>
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
            {playerCollapsed ? (
              <div className="relative flex min-h-28 flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:gap-4 sm:p-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/15 shadow-xl" style={{ background: coverGradient }}>
                  {currentArtworkUrl ? <NextImage src={currentArtworkUrl} alt="" fill sizes="80px" unoptimized className="object-cover" /> : <Music2 className="m-5 h-10 w-10 text-white/80" />}
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <button type="button" onClick={() => void playPrevious()} disabled={!currentTrack} className="grid h-11 w-11 place-items-center rounded-full text-white/85 transition hover:bg-white/10 disabled:opacity-30" aria-label="Canción anterior"><SkipBack className="h-6 w-6 fill-current" /></button>
                  <button type="button" onClick={() => void togglePlayback()} disabled={!currentTrack} className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#050608] shadow-xl transition hover:scale-105 disabled:opacity-35" style={{ color: '#050608' }} aria-label={playing ? 'Pausar' : 'Reproducir'}>{playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}</button>
                  <button type="button" onClick={() => void playNext()} disabled={!currentTrack} className="grid h-11 w-11 place-items-center rounded-full text-white/85 transition hover:bg-white/10 disabled:opacity-30" aria-label="Siguiente canción"><SkipForward className="h-6 w-6 fill-current" /></button>
                </div>
                <div className="flex min-w-40 flex-1 items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-4 py-3"><Volume2 className="h-5 w-5 shrink-0 text-white/75" /><input type="range" min={0} max={1} step={0.05} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="h-1 min-w-0 flex-1 accent-red-500" aria-label="Volumen" /></div>
                <button type="button" onClick={() => setPlayerCollapsed(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white transition hover:bg-white/15" aria-label="Mostrar reproductor completo"><Maximize2 className="h-5 w-5" /></button>
              </div>
            ) : (
            <div className="relative p-4 sm:p-6 xl:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-400">Reproduciendo ahora</p><p className="mt-1 text-xs text-white/35">Directo desde este dispositivo</p></div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button onClick={() => void linkMusicFolder()} disabled={importing} className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[9px] font-black uppercase text-black shadow-lg transition hover:scale-[1.02] disabled:opacity-45">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Library className="h-4 w-4" />} Carpeta</button>
                  <button onClick={() => sessionInputRef.current?.click()} disabled={importing} className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[9px] font-black uppercase text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-45"><Music2 className="h-4 w-4" /> Sesión</button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[9px] font-black uppercase text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-45" title="Guardar una copia permanente dentro del navegador"><Plus className="h-4 w-4" /> Guardar</button>
                  <button type="button" onClick={() => setPlayerCollapsed(true)} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 transition hover:bg-white/10 hover:text-white" aria-label="Minimizar reproductor"><Minimize2 className="h-4 w-4" /></button>
                </div>
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
                        <NextImage
                          src={currentArtworkUrl}
                          alt={`Portada de ${currentTrack?.title || 'la canción'}`}
                          fill
                          sizes="(min-width: 1024px) 40vw, 80vw"
                          unoptimized
                          className="object-cover"
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
                  <div className="grid min-h-52 place-items-center text-center"><div><Disc3 className="mx-auto h-10 w-10 text-white/15" /><p className="mt-3 text-sm font-black uppercase">{tracks.length ? 'Sin resultados' : 'Tu biblioteca está vacía'}</p><p className="mt-1 max-w-xs text-xs text-white/30">{tracks.length ? 'Prueba otra búsqueda o playlist.' : 'Vincula tu carpeta para escuchar sin copiar ni subir los archivos.'}</p>{!tracks.length && <button onClick={() => void linkMusicFolder()} className="mt-4 h-9 rounded-full bg-white px-5 text-[10px] font-black uppercase text-black">Elegir carpeta</button>}</div></div>
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
                            {artworkUrl && <NextImage src={artworkUrl} alt="" fill sizes="40px" unoptimized className="object-cover" />}
                            {artworkUrl && <span className="absolute inset-0 bg-black/25 opacity-0 transition group-hover:opacity-100" />}
                            <span className="relative z-10">
                              {loadingTrackId === track.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent && playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current opacity-60 transition sm:opacity-0 sm:group-hover:opacity-100" />}
                            </span>
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={cn('truncate text-xs font-bold', isCurrent ? 'text-red-400' : 'text-white/85')}>{track.title}</p>
                            <p className="mt-0.5 truncate text-[10px] text-white/30">{track.artist} · {track.album} · {track.source === 'folder' ? 'Carpeta' : track.source === 'session' ? 'Sesión' : formatBytes(track.size)}</p>
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
            )}
          </section>

          <section
            className="relative min-w-0 overflow-hidden rounded-[2rem] border border-white/[0.08] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.38)] sm:rounded-[2.25rem] sm:p-6 xl:p-8"
            style={{ background: 'radial-gradient(circle at 100% 0%, rgba(239,68,68,0.08), transparent 35%), #0a0b0f' }}
          >
            <div className="overflow-hidden rounded-[1.75rem] border border-red-500/15 bg-gradient-to-br from-red-500/[0.09] via-white/[0.025] to-transparent">
              <button
                type="button"
                onClick={() => setTimerExpanded((value) => !value)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"
                aria-expanded={timerExpanded}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl border', timerRunning ? 'border-red-400/30 bg-red-500/15 text-red-400 shadow-[0_0_24px_rgba(239,68,68,0.16)]' : 'border-white/[0.08] bg-white/[0.045] text-white/45')}><Clock3 className={cn('h-5 w-5', timerRunning && 'animate-pulse')} /></span>
                  <span className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-[0.22em] text-red-400">Temporizador</span><span className="mt-1 block truncate text-sm font-black uppercase text-white/85">{timerStatus}</span></span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {(timerPhase === 'work' || timerPhase === 'rest') && <span className="text-xl font-black tabular-nums text-white">{formatTime(timerRemaining)}</span>}
                  <ChevronRight className={cn('h-5 w-5 text-white/30 transition-transform duration-300', timerExpanded && 'rotate-90')} />
                </span>
              </button>

              {timerExpanded && (
                <div className="border-t border-white/[0.07] p-4 sm:p-5">
                  <div className="mb-5">
                    <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Presets rápidos</p><button type="button" onClick={saveCurrentTimerPreset} disabled={timerLocked || timerWorkDuration <= 0} className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] font-black uppercase text-white/45 transition hover:bg-white/5 hover:text-white disabled:opacity-30">Guardar actual</button></div>
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">{timerPresets.map((preset) => <div key={preset.id} className="flex shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-white/[0.035]"><button type="button" onClick={() => applyTimerPreset(preset)} disabled={timerLocked} className="h-9 px-3 text-[8px] font-black uppercase text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-35">{preset.name}</button>{preset.custom && <button type="button" onClick={() => deleteTimerPreset(preset)} className="grid h-9 w-8 place-items-center border-l border-white/[0.07] text-white/25 hover:bg-red-500/10 hover:text-red-400" aria-label={`Eliminar ${preset.name}`}><X className="h-3 w-3" /></button>}</div>)}</div>
                  </div>
                  <div className="grid items-center gap-5 sm:grid-cols-[11rem_1fr]">
                    <div className="mx-auto text-center">
                      <div className="relative grid h-40 w-40 place-items-center rounded-full p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)]" style={{ background: `conic-gradient(#ef4444 ${timerProgress}%, rgba(255,255,255,0.07) 0)` }}>
                        <div className="grid h-full w-full place-items-center rounded-full border border-white/[0.07] bg-[#0d0e13]">
                          <div><p className={cn('text-[9px] font-black uppercase tracking-[0.2em]', timerPhase === 'rest' ? 'text-amber-400' : timerPhase === 'finished' ? 'text-green-400' : 'text-red-400')}>{timerPhase === 'rest' ? 'Descanso' : timerPhase === 'finished' ? 'Terminado' : `Roleo ${timerRound}/${timerRounds}`}</p><p className="mt-1 text-4xl font-black tabular-nums tracking-[-0.06em]">{formatTime(timerRemaining)}</p></div>
                        </div>
                      </div>
                      <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-white/25">Total de la serie · {formatTime(timerTotalDuration)}</p>
                    </div>

                    <div className="min-w-0">
                      <div className="grid grid-cols-3 gap-2">
                        <label className="rounded-2xl border border-white/[0.08] bg-black/20 p-3"><span className="block text-[8px] font-black uppercase tracking-wider text-white/30">Roleos</span><input type="number" inputMode="numeric" min={1} max={99} value={timerRounds} disabled={timerLocked} onChange={(event) => setTimerRounds(clampInteger(event.target.value, 1, 99))} className="mt-1 w-full bg-transparent text-xl font-black tabular-nums text-white outline-none disabled:opacity-45" /></label>
                        <label className="rounded-2xl border border-white/[0.08] bg-black/20 p-3"><span className="block text-[8px] font-black uppercase tracking-wider text-white/30">Minutos</span><input type="number" inputMode="numeric" min={0} max={99} value={workMinutes} disabled={timerLocked} onChange={(event) => setWorkMinutes(clampInteger(event.target.value, 0, 99))} className="mt-1 w-full bg-transparent text-xl font-black tabular-nums text-white outline-none disabled:opacity-45" /></label>
                        <label className="rounded-2xl border border-white/[0.08] bg-black/20 p-3"><span className="block text-[8px] font-black uppercase tracking-wider text-white/30">Segundos</span><input type="number" inputMode="numeric" min={0} max={59} value={workSecondsPart} disabled={timerLocked} onChange={(event) => setWorkSecondsPart(clampInteger(event.target.value, 0, 59))} className="mt-1 w-full bg-transparent text-xl font-black tabular-nums text-white outline-none disabled:opacity-45" /></label>
                      </div>

                      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-wider text-white/65">Descanso entre roleos</p><p className="mt-0.5 text-[9px] text-white/25">No se añade después del último.</p></div><button type="button" role="switch" aria-checked={restEnabled} disabled={timerLocked} onClick={() => setRestEnabled((value) => !value)} className={cn('relative h-7 w-12 shrink-0 rounded-full border transition disabled:opacity-45', restEnabled ? 'border-red-400/30 bg-red-500' : 'border-white/10 bg-white/5')}><span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform', restEnabled ? 'translate-x-5' : 'translate-x-1')} /></button></div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label className={cn('rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2', !restEnabled && 'opacity-35')}><span className="block text-[8px] font-black uppercase text-white/25">Minutos</span><input type="number" inputMode="numeric" min={0} max={30} value={restMinutes} disabled={!restEnabled || timerLocked} onChange={(event) => setRestMinutes(clampInteger(event.target.value, 0, 30))} className="mt-0.5 w-full bg-transparent text-base font-black tabular-nums outline-none" /></label>
                          <label className={cn('rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2', !restEnabled && 'opacity-35')}><span className="block text-[8px] font-black uppercase text-white/25">Segundos</span><input type="number" inputMode="numeric" min={0} max={59} value={restSecondsPart} disabled={!restEnabled || timerLocked} onChange={(event) => setRestSecondsPart(clampInteger(event.target.value, 0, 59))} className="mt-0.5 w-full bg-transparent text-base font-black tabular-nums outline-none" /></label>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" role="switch" aria-checked={duckMusicOnRest} onClick={() => setDuckMusicOnRest((value) => !value)} className={cn('rounded-2xl border p-3 text-left transition', duckMusicOnRest ? 'border-red-500/20 bg-red-500/[0.08]' : 'border-white/[0.07] bg-white/[0.025]')}><span className="block text-[8px] font-black uppercase tracking-wider text-white/35">Música en descanso</span><span className={cn('mt-1 block text-[10px] font-black uppercase', duckMusicOnRest ? 'text-red-400' : 'text-white/30')}>{duckMusicOnRest ? 'Bajar al 25 %' : 'Sin cambios'}</span></button>
                        <button type="button" role="switch" aria-checked={pauseMusicOnFinish} onClick={() => setPauseMusicOnFinish((value) => !value)} className={cn('rounded-2xl border p-3 text-left transition', pauseMusicOnFinish ? 'border-red-500/20 bg-red-500/[0.08]' : 'border-white/[0.07] bg-white/[0.025]')}><span className="block text-[8px] font-black uppercase tracking-wider text-white/35">Al terminar</span><span className={cn('mt-1 block text-[10px] font-black uppercase', pauseMusicOnFinish ? 'text-red-400' : 'text-white/30')}>{pauseMusicOnFinish ? 'Pausar música' : 'Seguir sonando'}</span></button>
                      </div>

                      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                        <button type="button" onClick={timerRunning ? pauseTimer : startOrResumeTimer} className={cn('flex h-12 items-center justify-center gap-2 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-lg transition hover:scale-[1.01]', timerRunning ? 'bg-amber-400 text-black' : 'bg-red-600 text-white shadow-red-950/30')}>{timerRunning ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}{timerRunning ? 'Pausar' : timerPhase === 'idle' || timerPhase === 'finished' ? 'Iniciar serie' : 'Continuar'}</button>
                        <button type="button" onClick={resetTimer} disabled={timerPhase === 'idle' && !timerRunning} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.09] bg-white/[0.04] text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-25" aria-label="Reiniciar temporizador"><SkipBack className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-start justify-between gap-4">
              <button type="button" onClick={() => setItineraryExpanded((value) => !value)} className="min-w-0 flex-1 text-left" aria-expanded={itineraryExpanded}><p className="text-[9px] font-black uppercase tracking-[0.24em] text-red-400">Itinerario</p><h2 className="mt-1 text-2xl font-black uppercase italic tracking-tighter sm:text-3xl">Plan del día</h2><p className="mt-1 capitalize text-xs text-white/35">{formatClassDate(activeDate)}</p></button>
              <div className="flex items-center gap-1.5">
                {itineraryExpanded && <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.035] p-1"><button onClick={() => moveDate(-1)} disabled={activeDate === TRAINING_DATES[0]} className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-20"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setActiveDate(getClosestTrainingDate(today))} className="h-8 rounded-full px-3 text-[9px] font-black uppercase text-white/55 hover:bg-white/10 hover:text-white">Hoy</button><button onClick={() => moveDate(1)} disabled={activeDate === TRAINING_DATES[TRAINING_DATES.length - 1]} className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white disabled:opacity-20"><ChevronRight className="h-4 w-4" /></button></div>}
                <button type="button" onClick={() => setItineraryExpanded((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/35 transition hover:bg-white/10 hover:text-white" aria-label={itineraryExpanded ? 'Contraer itinerario' : 'Mostrar itinerario'}><ChevronRight className={cn('h-5 w-5 transition-transform duration-300', itineraryExpanded && 'rotate-90')} /></button>
              </div>
            </div>

            {itineraryExpanded && <>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">{TRAINING_DATES.map((date) => { const parts = getClassDateParts(date); return <button key={date} onClick={() => setActiveDate(date)} className={cn('relative flex h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-[8px] font-black uppercase transition', activeDate === date ? 'border-white bg-white text-black shadow-xl' : 'border-white/[0.07] bg-white/[0.025] text-white/35 hover:border-white/15 hover:text-white', date === today && activeDate !== date && 'after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-red-500')}><span>{parts.weekday}</span><span className="mt-0.5 text-base leading-none">{parts.day}</span></button>; })}</div>

            <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.07] bg-black/20 p-1">{(['BJJ', 'MMA'] as Discipline[]).map((item) => <button key={item} onClick={() => setDiscipline(item)} className={cn('h-10 rounded-xl text-[10px] font-black uppercase tracking-wider transition', discipline === item ? 'bg-red-600 text-white shadow-[0_8px_25px_rgba(220,38,38,0.25)]' : 'text-white/35 hover:text-white')}>{item === 'BJJ' ? 'Jiu Jitsu' : 'MMA'}</button>)}</div>

            {activity && <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[9px] font-black uppercase text-red-400">Sesión {String(activity.session).padStart(2, '0')}</span><span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[9px] font-black uppercase text-white/40">{activity.focus}</span><span className={cn('rounded-full border px-3 py-1 text-[9px] font-black uppercase', rpeClass)}>RPE {activity.rpe}</span></div>
              <h3 className="mt-4 text-3xl font-black uppercase italic leading-[0.92] tracking-[-0.04em] sm:text-4xl">{activity.title}</h3>
              <p className="mt-3 text-xs font-medium leading-relaxed text-white/40">{activity.emphasis}</p>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/30">Progreso de la clase</p><p className="mt-1 text-xs font-black text-white/75">{completedBlocks.length} de {activity.blocks.length} secciones completadas</p></div>{completedBlocks.length > 0 && <button type="button" onClick={resetActivityProgress} className="rounded-full border border-white/10 px-3 py-1.5 text-[8px] font-black uppercase text-white/35 hover:bg-white/5 hover:text-white">Reiniciar</button>}</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-red-600 to-green-400 transition-all duration-500" style={{ width: `${activity.blocks.length ? (completedBlocks.length / activity.blocks.length) * 100 : 0}%` }} /></div>
                <p className={cn('mt-3 rounded-xl border px-3 py-2 text-[10px] font-bold', nextActivityBlock ? 'border-red-500/15 bg-red-500/[0.07] text-red-300' : 'border-green-400/15 bg-green-400/[0.07] text-green-300')}>{nextActivityBlock ? <>Siguiente: <span className="font-black uppercase">{nextActivityBlock.title}</span> · {nextActivityBlock.range} min</> : 'Todas las secciones de esta clase están completadas.'}</p>
              </div>

              <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] divide-x divide-white/[0.07]"><div className="p-3.5"><Clock3 className="h-4 w-4 text-red-400" /><p className="mt-2 text-lg font-black">{getActivityDuration(activity)}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/25">Minutos</p></div><div className="p-3.5"><Dumbbell className="h-4 w-4 text-red-400" /><p className="mt-2 truncate text-lg font-black">{activity.focus}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/25">Enfoque</p></div><div className="p-3.5"><Activity className="h-4 w-4 text-red-400" /><p className="mt-2 text-lg font-black">{activity.blocks.length}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/25">Bloques</p></div></div>

              <div className="relative mt-6 max-h-[38rem] space-y-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] before:absolute before:bottom-5 before:left-[3.15rem] before:top-5 before:w-px before:bg-gradient-to-b before:from-red-500/60 before:via-white/10 before:to-transparent">
                {activity.blocks.map((block, index) => {
                  const key = activityBlockKey(index, block.range, block.title);
                  const completed = completedBlockSet.has(key);
                  const isNext = index === nextBlockIndex;
                  return (
                    <div key={key} className="group relative grid grid-cols-[4.6rem_1fr] gap-3">
                      <div className="relative z-10 flex items-start justify-between pt-4"><span className={cn('text-[9px] font-black tabular-nums', completed ? 'text-green-400/50' : isNext ? 'text-red-400' : 'text-white/30')}>{block.range}</span><span className={cn('mr-1.5 mt-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0a0b0f] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] transition', completed ? 'bg-green-400' : isNext ? 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.8)]' : 'bg-white/25 group-hover:bg-red-400')} /></div>
                      <div className={cn('rounded-2xl border p-3.5 transition duration-300', completed ? 'border-green-400/15 bg-green-400/[0.045]' : isNext ? 'border-red-500/25 bg-red-500/[0.08] shadow-[0_14px_35px_rgba(127,29,29,0.12)]' : 'border-white/[0.07] bg-white/[0.03] hover:-translate-y-0.5 hover:border-red-500/20 hover:bg-white/[0.055]')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className={cn('text-xs font-black uppercase tracking-tight', completed ? 'text-green-300/70 line-through' : 'text-white/85')}>{block.title}</p>{isNext && <span className="rounded-full bg-red-500/15 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-red-400">Siguiente</span>}</div><p className={cn('mt-1.5 text-[11px] leading-relaxed', completed ? 'text-white/22' : 'text-white/35')}>{block.detail}</p></div>
                          <div className="flex shrink-0 items-center gap-1.5"><span className="rounded-full bg-white/[0.06] px-2 py-1 text-[8px] font-black text-white/35">{block.minutes} min</span><button type="button" onClick={() => toggleActivityBlock(index)} className={cn('grid h-8 w-8 place-items-center rounded-full border transition', completed ? 'border-green-400/25 bg-green-400/15 text-green-400' : 'border-white/10 bg-white/[0.03] text-white/25 hover:border-green-400/25 hover:text-green-400')} aria-label={completed ? `Marcar ${block.title} como pendiente` : `Marcar ${block.title} como completado`}><Check className="h-4 w-4" /></button></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-green-400/10 bg-green-400/[0.045] p-4"><div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" /><p className="text-[9px] font-black uppercase tracking-[0.18em] text-green-400">Meta de la sesión</p></div><p className="mt-2 text-[11px] leading-relaxed text-white/38">{SUCCESS_CRITERION}</p></div>
            </div>}
            </>}
          </section>
        </div>

        <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0a0b0f] text-white shadow-[0_20px_55px_rgba(0,0,0,0.25)]">
          <button type="button" onClick={() => setDiagnosticsExpanded((value) => !value)} className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5" aria-expanded={diagnosticsExpanded}><span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04]"><Activity className="h-4 w-4 text-red-400" /></span><span><span className="block text-[9px] font-black uppercase tracking-[0.22em] text-red-400">Centro de diagnóstico</span><span className="mt-1 block text-xs font-bold text-white/45">Estado de clase, música y modo offline</span></span></span><span className="flex items-center gap-3"><span className={cn('h-2 w-2 rounded-full', diagnostics.online ? 'bg-green-400' : 'bg-red-400')} /><ChevronRight className={cn('h-5 w-5 text-white/30 transition-transform', diagnosticsExpanded && 'rotate-90')} /></span></button>
          {diagnosticsExpanded && <div className="border-t border-white/[0.07] p-4 sm:p-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{[
              { label: 'Internet', ok: diagnostics.online, detail: diagnostics.online ? 'Conectado' : 'Modo sin conexión' },
              { label: 'Uso offline', ok: diagnostics.serviceWorker, detail: diagnostics.serviceWorker ? 'Servicio activo' : 'Disponible tras publicar y recargar' },
              { label: 'Instalación', ok: diagnostics.installed, detail: diagnostics.installed ? 'Abierta como app' : 'Abierta en navegador' },
              { label: 'Pantalla activa', ok: diagnostics.wakeLockSupported, detail: wakeLockActive ? 'Activa ahora' : diagnostics.wakeLockSupported ? 'Compatible' : 'Control manual' },
              { label: 'Carpeta local', ok: diagnostics.folderSupported, detail: folderConnected ? `Conectada · ${folderName}` : diagnostics.folderSupported ? 'Compatible' : 'Usar modo Sesión' },
              { label: 'WEBM Opus', ok: diagnostics.webmSupported, detail: diagnostics.webmSupported ? 'Reproducción compatible' : 'Convertir a MP3/M4A' },
              { label: 'Pantalla completa', ok: diagnostics.fullscreenSupported, detail: diagnostics.fullscreenSupported ? 'Disponible' : 'Modo interno disponible' },
              { label: 'Almacenamiento', ok: diagnostics.persistentStorage, detail: diagnostics.persistentStorage ? 'Persistente' : `${formatBytes(storageUsage)} usados` },
            ].map((item) => <div key={item.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', item.ok ? 'bg-green-400' : 'bg-amber-400')} /><p className="text-[8px] font-black uppercase tracking-wider text-white/40">{item.label}</p></div><p className="mt-2 truncate text-[10px] font-bold text-white/70">{item.detail}</p></div>)}</div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[9px] text-white/25">Biblioteca: {tracks.length} canciones · {formatBytes(storageUsage)}{storageQuota > 0 ? ` de ${formatBytes(storageQuota)}` : ''}</p><button type="button" onClick={() => void refreshDiagnostics()} className="h-9 rounded-full border border-white/10 px-4 text-[8px] font-black uppercase text-white/45 transition hover:bg-white/5 hover:text-white">Actualizar diagnóstico</button></div>
          </div>}
        </section>
      </div>
    </div>
  );
}
