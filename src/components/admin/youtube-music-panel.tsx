'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  ListMusic,
  Loader2,
  LogOut,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  Youtube,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';
const TOKEN_KEY = 'albatros-youtube-token-v1';
const CONNECTION_REMEMBERED_KEY = 'albatros-youtube-connection-remembered-v1';
const PLAYER_COLLAPSED_KEY = 'albatros-youtube-player-collapsed-v1';

type TokenState = {
  accessToken: string;
  expiresAt: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  callback: (response: GoogleTokenResponse) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type YoutubePlayer = {
  destroy: () => void;
  getPlayerState: () => number;
  getVideoData: () => { title?: string; author?: string; video_id?: string };
  loadPlaylist: (options: { playlist: string[]; index?: number }) => void;
  nextVideo: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  previousVideo: () => void;
  setVolume: (volume: number) => void;
};

type YoutubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      height: string;
      width: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YoutubePlayer }) => void;
        onStateChange: (event: { data: number; target: YoutubePlayer }) => void;
        onError: (event: { data: number }) => void;
      };
    },
  ) => YoutubePlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
          }) => GoogleTokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
    YT?: YoutubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Playlist = {
  id: string;
  title: string;
  thumbnail: string;
  count: number;
};

type PlaylistApiItem = {
  id?: string;
  snippet?: { title?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } };
  contentDetails?: { itemCount?: number };
};

type PlaylistItemsResponse = {
  items?: Array<{ contentDetails?: { videoId?: string }; snippet?: { resourceId?: { videoId?: string } } }>;
  nextPageToken?: string;
};
type ChannelApiResponse = {
  items?: Array<{ contentDetails?: { relatedPlaylists?: { likes?: string } } }>;
};

export type YouTubeNowPlaying = {
  title: string;
  artist: string;
  videoId: string;
  thumbnail: string;
  playing: boolean;
  hasTrack: boolean;
  connected: boolean;
};

export type YouTubeMusicController = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  fullscreen: () => Promise<void>;
};

type Props = {
  effectiveVolume: number;
  volume: number;
  onVolumeChange: (value: number) => void;
  onNowPlaying: (state: YouTubeNowPlaying) => void;
  tvMode?: boolean;
  wallClock: string;
  wallClockDate: string;
  timerHasPriority: boolean;
  timerStatus: string;
  timerRemaining: number;
  timerPhase: 'idle' | 'work' | 'rest' | 'finished';
  timerRunning: boolean;
  onEnterTvMode: () => void;
  onExitTvMode: () => void;
  onToggleTimer: () => void;
  onResetTimer: () => void;
};

let googleScriptPromise: Promise<void> | null = null;
let youtubeScriptPromise: Promise<void> | null = null;

function loadScript(src: string, id: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }
    const script = existing || document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('No se pudo cargar el servicio de Google.'));
    if (!existing) document.head.appendChild(script);
  });
}

function loadGoogleIdentity() {
  googleScriptPromise ||= loadScript('https://accounts.google.com/gsi/client', 'google-identity-services');
  return googleScriptPromise;
}

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  youtubeScriptPromise ||= new Promise<void>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };
    void loadScript('https://www.youtube.com/iframe_api', 'youtube-iframe-api').catch(reject);
  });
  return youtubeScriptPromise;
}

function readStoredToken(): TokenState | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null') as TokenState | null;
    if (!value?.accessToken || value.expiresAt <= Date.now() + 30_000) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function thumbnailFor(videoId: string) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
}

function formatSeconds(value: number) {
  const safeValue = Math.max(0, Math.floor(value));
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const EMPTY_NOW_PLAYING: YouTubeNowPlaying = {
  title: '',
  artist: '',
  videoId: '',
  thumbnail: '',
  playing: false,
  hasTrack: false,
  connected: false,
};

export const YouTubeMusicPanel = forwardRef<YouTubeMusicController, Props>(function YouTubeMusicPanel(
  {
    effectiveVolume,
    volume,
    onVolumeChange,
    onNowPlaying,
    tvMode = false,
    wallClock,
    wallClockDate,
    timerHasPriority,
    timerStatus,
    timerRemaining,
    timerPhase,
    timerRunning,
    onEnterTvMode,
    onExitTvMode,
    onToggleTimer,
    onResetTimer,
  },
  ref,
) {
  const clientId = process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID || '';
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YoutubePlayer | null>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const effectiveVolumeRef = useRef(effectiveVolume);
  const tokenRef = useRef<TokenState | null>(null);
  const onNowPlayingRef = useRef(onNowPlaying);
  const [token, setToken] = useState<TokenState | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [loading, setLoading] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [connectionRemembered, setConnectionRemembered] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<YouTubeNowPlaying>(EMPTY_NOW_PLAYING);
  const connected = Boolean(token);

  const publishPlayerState = useCallback((player: YoutubePlayer, state?: number) => {
    const data = player.getVideoData();
    const videoId = data.video_id || '';
    const next = {
      title: data.title || '',
      artist: data.author || 'YouTube',
      videoId,
      thumbnail: thumbnailFor(videoId),
      playing: state === window.YT?.PlayerState.PLAYING,
      hasTrack: Boolean(videoId),
      connected: Boolean(tokenRef.current),
    };
    setNowPlaying(next);
    onNowPlayingRef.current(next);
  }, []);

  effectiveVolumeRef.current = effectiveVolume;
  tokenRef.current = token;
  onNowPlayingRef.current = onNowPlaying;

  useEffect(() => {
    const stored = readStoredToken();
    if (stored) setToken(stored);
    setConnectionRemembered(localStorage.getItem(CONNECTION_REMEMBERED_KEY) === '1');
    setCollapsed(localStorage.getItem(PLAYER_COLLAPSED_KEY) === '1');
  }, []);

  useEffect(() => {
    localStorage.setItem(PLAYER_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadGoogleIdentity(), loadYoutubeApi()]).then(() => {
      if (cancelled || !clientId) return;
      tokenClientRef.current = window.google?.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_SCOPE,
        callback: () => undefined,
      }) || null;

      if (!playerHostRef.current || !window.YT?.Player || playerRef.current) return;
      playerRef.current = new window.YT.Player(playerHostRef.current, {
        height: '100%',
        width: '100%',
        playerVars: { controls: 1, playsinline: 1, rel: 0, fs: 1, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            setPlayerReady(true);
            target.setVolume(Math.round(effectiveVolumeRef.current * 100));
          },
          onStateChange: ({ data, target }) => publishPlayerState(target, data),
          onError: () => setError('YouTube no pudo reproducir este video. Prueba otra lista.'),
        },
      });
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'No se pudo iniciar YouTube.');
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [clientId, connected, publishPlayerState]);

  useEffect(() => {
    playerRef.current?.setVolume(Math.round(effectiveVolume * 100));
  }, [effectiveVolume]);

  useEffect(() => {
    setNowPlaying((current) => {
      const next = { ...current, connected: Boolean(token) };
      onNowPlayingRef.current(next);
      return next;
    });
  }, [token]);

  const apiFetch = useCallback(async <T,>(path: string): Promise<T> => {
    if (!token) throw new Error('Conecta tu cuenta de YouTube.');
    const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (response.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null);
      throw new Error('La sesión de YouTube venció. Pulsa Reconectar; normalmente Google no volverá a pedir tus datos.');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(payload?.error?.message || 'YouTube no pudo completar la consulta.');
    }
    return response.json() as Promise<T>;
  }, [token]);

  const loadPlaylists = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [response, channel] = await Promise.all([
        apiFetch<{ items?: PlaylistApiItem[] }>('playlists?part=snippet,contentDetails&mine=true&maxResults=50'),
        apiFetch<ChannelApiResponse>('channels?part=contentDetails&mine=true'),
      ]);
      const next = (response.items || []).flatMap((item) => {
        if (!item.id) return [];
        return [{
          id: item.id,
          title: item.snippet?.title || 'Lista sin nombre',
          thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
          count: item.contentDetails?.itemCount || 0,
        }];
      });
      const likedPlaylistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.likes || '';
      if (likedPlaylistId && !next.some((item) => item.id === likedPlaylistId)) {
        next.unshift({
          id: likedPlaylistId,
          title: 'Videos que me gustan',
          thumbnail: '',
          count: 0,
        });
      }
      setPlaylists(next);
      setSelectedPlaylistId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron cargar tus playlists.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    if (token) void loadPlaylists();
  }, [loadPlaylists, token]);

  const connect = async () => {
    if (!clientId) {
      setError('Falta configurar NEXT_PUBLIC_YOUTUBE_CLIENT_ID.');
      return;
    }
    setError('');
    await loadGoogleIdentity().catch(() => undefined);
    const client = tokenClientRef.current;
    if (!client) {
      setError('El servicio de acceso de Google todavía no está listo. Intenta de nuevo.');
      return;
    }
    client.callback = (response) => {
      if (!response.access_token) {
        if (response.error === 'consent_required' || response.error === 'interaction_required') {
          localStorage.removeItem(CONNECTION_REMEMBERED_KEY);
          setConnectionRemembered(false);
        }
        setError(response.error_description || response.error || 'No se autorizó la conexión.');
        return;
      }
      const next = {
        accessToken: response.access_token,
        expiresAt: Date.now() + Math.max(60, response.expires_in || 3600) * 1000,
      };
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(next));
      localStorage.setItem(CONNECTION_REMEMBERED_KEY, '1');
      setConnectionRemembered(true);
      setToken(next);
    };
    client.requestAccessToken({ prompt: connectionRemembered || token ? '' : 'consent' });
  };

  const disconnect = () => {
    playerRef.current?.pauseVideo();
    if (token?.accessToken) window.google?.accounts.oauth2.revoke(token.accessToken);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CONNECTION_REMEMBERED_KEY);
    setConnectionRemembered(false);
    setToken(null);
    setPlaylists([]);
    setSelectedPlaylistId('');
    setNowPlaying(EMPTY_NOW_PLAYING);
    onNowPlaying(EMPTY_NOW_PLAYING);
  };

  const playPlaylist = async (playlistId: string) => {
    setLoading(true);
    setError('');
    try {
      const videoIds: string[] = [];
      let pageToken = '';
      let pages = 0;
      do {
        const queryString = new URLSearchParams({
          part: 'contentDetails',
          playlistId,
          maxResults: '50',
        });
        if (pageToken) queryString.set('pageToken', pageToken);
        const page = await apiFetch<PlaylistItemsResponse>(`playlistItems?${queryString}`);
        page.items?.forEach((item) => {
          const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
          if (id) videoIds.push(id);
        });
        pageToken = page.nextPageToken || '';
        pages += 1;
      } while (pageToken && pages < 4);

      if (!videoIds.length) throw new Error('Esta playlist no tiene videos reproducibles.');
      playerRef.current?.loadPlaylist({ playlist: videoIds, index: 0 });
      setSelectedPlaylistId(playlistId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo abrir la playlist.');
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    toggle: () => {
      const player = playerRef.current;
      if (!player) return;
      if (player.getPlayerState() === window.YT?.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
    },
    next: () => playerRef.current?.nextVideo(),
    previous: () => playerRef.current?.previousVideo(),
    fullscreen: async () => {
      onEnterTvMode();
    },
  }), [onEnterTvMode]);

  const visiblePlaylists = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es-MX');
    return normalized ? playlists.filter((item) => item.title.toLocaleLowerCase('es-MX').includes(normalized)) : playlists;
  }, [playlists, query]);

  return (
    <section className={cn(
      'min-w-0 overflow-hidden border border-red-400/15 bg-[#08090d] text-white shadow-[0_30px_80px_rgba(0,0,0,0.38)] [color-scheme:dark]',
      tvMode
        ? 'fixed inset-0 z-[125] h-dvh w-screen rounded-none border-0'
        : 'relative rounded-[1.5rem] sm:rounded-[2.25rem]',
    )}>
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-red-600/20 blur-[110px]" />
      <div className={cn('relative', tvMode ? 'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3 sm:p-5 lg:gap-5 lg:p-7' : 'p-3 sm:p-5 lg:p-6')}>
        {tvMode ? (
          <header className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 backdrop-blur-2xl">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-400">Albatros Studio · YouTube TV</p>
              <p className="mt-1 truncate text-xs font-bold text-white/70">{timerHasPriority ? timerStatus : nowPlaying.title || 'Clase en vivo'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-full border border-green-400/20 bg-green-400/10 px-3 py-2 text-[8px] font-black uppercase tracking-wider text-green-300 sm:inline-flex">Pantalla activa</span>
              <button type="button" onClick={onExitTvMode} className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#08090d] shadow-xl transition hover:scale-105" style={{ color: '#08090d' }} aria-label="Salir del modo TV"><Minimize2 className="h-5 w-5" /></button>
            </div>
          </header>
        ) : (
        <div className="grid gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Youtube className="h-5 w-5 text-red-500" /><p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">YouTube</p></div>
            <p className="mt-1 text-xs text-white/65">Reproductor oficial; tu biblioteca local sigue disponible.</p>
          </div>
          <div className="grid w-full grid-cols-[minmax(0,1fr)_repeat(3,2.75rem)] gap-2 sm:max-w-md">
            {token ? <span className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-green-400/20 bg-green-400/10 px-3 text-[9px] font-black uppercase text-green-300"><CheckCircle2 className="h-4 w-4 shrink-0" /><span className="truncate">Cuenta conectada</span></span> : <span />}
            {token && <button type="button" onClick={() => void loadPlaylists()} disabled={loading} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/10 disabled:opacity-40" aria-label="Actualizar playlists"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></button>}
            <button type="button" onClick={onEnterTvMode} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 hover:bg-white/10" aria-label="Abrir modo TV"><Maximize2 className="h-4 w-4" /></button>
            {token && <button type="button" onClick={disconnect} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/70 hover:text-red-300" aria-label="Desconectar YouTube"><LogOut className="h-4 w-4" /></button>}
          </div>
          {token && <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex h-10 w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-4 text-[9px] font-black uppercase text-white/70 transition hover:bg-white/10 hover:text-white">{collapsed ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}{collapsed ? 'Mostrar completo' : 'Contraer reproductor'}</button>}
        </div>
        )}

        {!clientId ? (
          <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-400/[0.07] p-5">
            <p className="font-black text-amber-200">Falta activar la conexión</p>
            <p className="mt-1 text-sm text-white/70">Agrega <code className="rounded bg-black/30 px-1.5 py-0.5 text-white">NEXT_PUBLIC_YOUTUBE_CLIENT_ID</code> a tu archivo .env.</p>
          </div>
        ) : !token ? (
          <div className="mt-5 grid min-h-[20rem] place-items-center rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 text-center backdrop-blur-xl sm:min-h-[24rem] sm:p-6">
            <div>
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl border border-red-400/20 bg-red-500/10 shadow-[0_20px_60px_rgba(239,68,68,0.16)]"><Youtube className="h-10 w-10 text-red-500" /></div>
              <h2 className="mt-5 text-2xl font-black text-white">Conecta tu cuenta</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/65">Autoriza únicamente lectura para mostrar tus playlists. La sesión se guarda solo en este navegador y nunca reemplaza tu música local.</p>
              <button type="button" onClick={() => void connect()} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#090a0e] shadow-xl transition hover:scale-[1.02]" style={{ color: '#090a0e' }}><Youtube className="h-5 w-5 shrink-0 text-red-600" /> {connectionRemembered ? 'Reconectar YouTube' : 'Conectar con Google'}</button>
              {connectionRemembered && <p className="mx-auto mt-3 max-w-sm text-xs text-white/70">Google ya recuerda el permiso; normalmente no tendrás que volver a escribir tu cuenta.</p>}
              <a href="https://www.youtube.com/account" target="_blank" rel="noreferrer" className="mx-auto mt-4 flex w-fit items-center gap-1 text-xs font-bold text-white/70 hover:text-white">Abrir YouTube <ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
          </div>
        ) : (
          <div className={cn(
            'grid min-w-0 gap-4',
            tvMode
              ? 'h-full min-h-0 overflow-y-auto lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-center lg:overflow-hidden'
              : 'mt-5',
          )}>
            <div className={cn(
              'min-w-0',
              tvMode && 'flex min-h-0 flex-col justify-center',
              collapsed && !tvMode && 'grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center',
            )}>
              <div className={cn(
                'w-full overflow-hidden border border-white/10 bg-black shadow-2xl',
                tvMode
                  ? 'aspect-video min-h-[200px] max-h-[65dvh] rounded-2xl sm:rounded-[1.75rem]'
                  : collapsed
                    ? 'mx-auto aspect-square h-[200px] w-[200px] max-w-full rounded-2xl'
                    : 'aspect-video min-h-[200px] rounded-[1.25rem] sm:rounded-[1.5rem]',
              )}>
                <div ref={playerHostRef} className="h-full w-full" />
              </div>
              <div className={cn(
                'mt-3 grid min-w-0 gap-3 rounded-[1.25rem] border border-white/10 bg-white/[0.055] p-3 shadow-xl backdrop-blur-2xl sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:rounded-[1.5rem]',
                collapsed && !tvMode && 'sm:mt-0 sm:grid-cols-1',
              )}>
                <div className="flex items-center justify-center gap-2 sm:justify-start">
                  <button type="button" onClick={() => playerRef.current?.previousVideo()} disabled={!nowPlaying.hasTrack} className="grid h-11 w-11 place-items-center rounded-full text-white/75 transition hover:bg-white/10 disabled:opacity-25" aria-label="Video anterior"><SkipBack className="h-6 w-6 fill-current" /></button>
                  <button type="button" onClick={() => { if (nowPlaying.playing) playerRef.current?.pauseVideo(); else playerRef.current?.playVideo(); }} disabled={!nowPlaying.hasTrack || !playerReady} className="grid h-14 w-14 place-items-center rounded-full bg-white text-[#08090d] shadow-xl transition hover:scale-105 disabled:opacity-30" style={{ color: '#08090d' }} aria-label={nowPlaying.playing ? 'Pausar' : 'Reproducir'}>{nowPlaying.playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="ml-0.5 h-6 w-6 fill-current" />}</button>
                  <button type="button" onClick={() => playerRef.current?.nextVideo()} disabled={!nowPlaying.hasTrack} className="grid h-11 w-11 place-items-center rounded-full text-white/75 transition hover:bg-white/10 disabled:opacity-25" aria-label="Siguiente video"><SkipForward className="h-6 w-6 fill-current" /></button>
                </div>
                <div className="min-w-0 text-center sm:text-left"><p className="truncate text-sm font-black text-white">{nowPlaying.title || 'Selecciona una playlist'}</p><p className="truncate text-xs text-white/70">{nowPlaying.artist || 'YouTube'}</p></div>
                <label className={cn('flex min-w-0 items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 py-2 sm:col-span-2', collapsed && !tvMode && 'sm:col-span-1')}>
                  <Volume2 className="h-4 w-4 shrink-0 text-white/60" />
                  <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-red-500" aria-label="Volumen de YouTube" />
                  <span className="w-9 text-right text-[10px] font-black text-white/70">{Math.round(volume * 100)}%</span>
                </label>
              </div>
            </div>

            {tvMode && (
              <aside className="flex min-h-[22rem] min-w-0 flex-col justify-between overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-7 lg:max-h-[calc(100dvh-8rem)]">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3"><Clock3 className="h-5 w-5 shrink-0 text-red-300" /><div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[0.24em] text-white/70">Hora actual</p><p className="truncate text-xs font-bold text-white/65">{wallClockDate}</p></div></div>
                  <p className="shrink-0 text-xl font-black tabular-nums text-white sm:text-2xl">{wallClock}</p>
                </div>

                {timerHasPriority ? (
                  <div className="py-6 text-center">
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.28em]', timerPhase === 'rest' ? 'text-amber-300' : 'text-red-300')}>{timerPhase === 'rest' ? 'Descanso' : 'Temporizador activo'}</p>
                    <p className="mt-2 text-[clamp(4.25rem,11vw,9rem)] font-black leading-none tracking-[-0.08em] tabular-nums text-white">{formatSeconds(timerRemaining)}</p>
                    <p className="mx-auto mt-4 max-w-lg text-sm font-bold text-white/60 sm:text-base">{timerStatus}</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <button type="button" onClick={onToggleTimer} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-xs font-black uppercase text-[#08090d] shadow-xl transition hover:scale-[1.02]" style={{ color: '#08090d' }}>{timerRunning ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}{timerRunning ? 'Pausar' : 'Continuar'}</button>
                      <button type="button" onClick={onResetTimer} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-5 text-xs font-black uppercase text-white/75 transition hover:bg-white/10"><RotateCcw className="h-4 w-4" />Reiniciar</button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="mx-auto max-w-full whitespace-nowrap text-[clamp(3.25rem,7vw,7.25rem)] font-black leading-none tracking-[-0.07em] tabular-nums text-white">{wallClock}</p>
                    <p className="mt-6 text-[9px] font-black uppercase tracking-[0.24em] text-green-300">Listo para iniciar el temporizador</p>
                    <button type="button" onClick={onToggleTimer} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-6 text-xs font-black uppercase text-red-200 transition hover:bg-red-500/20"><Play className="h-4 w-4 fill-current" />Iniciar temporizador</button>
                  </div>
                )}

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[8px] font-black uppercase tracking-[0.24em] text-red-300">Reproduciendo en YouTube</p>
                  <p className="mt-2 truncate text-base font-black text-white">{nowPlaying.title || 'Selecciona una canción'}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-white/70">{nowPlaying.artist || 'Biblioteca de YouTube'}</p>
                </div>
              </aside>
            )}

            {!tvMode && !collapsed && <div className="min-w-0 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl sm:rounded-[1.5rem]">
              <div className="flex items-center justify-between gap-2 px-1"><div><p className="text-sm font-black text-white">Tus playlists</p><p className="text-xs text-white/70">{playlists.length} listas</p></div><ListMusic className="h-5 w-5 text-red-400" /></div>
              <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/25 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/70 focus:border-red-400/40" placeholder="Buscar playlist" /></div>
              <div className="mt-3 max-h-[min(42vh,22rem)] space-y-1 overflow-y-auto pr-1 [overscroll-behavior:contain] [scrollbar-width:thin]">
                {loading && !playlists.length ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div> : visiblePlaylists.length ? visiblePlaylists.map((playlist) => (
                  <button key={playlist.id} type="button" onClick={() => void playPlaylist(playlist.id)} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/[0.07]', selectedPlaylistId === playlist.id && 'bg-white/[0.09]')}>
                    <div className="h-12 w-16 shrink-0 rounded-xl bg-cover bg-center shadow-lg" style={{ backgroundImage: playlist.thumbnail ? `url("${playlist.thumbnail}")` : 'linear-gradient(135deg,#ef4444,#450a0a)' }} />
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-white">{playlist.title}</p><p className="mt-0.5 text-[10px] font-bold text-white/70">{playlist.count} videos</p></div>
                    {selectedPlaylistId === playlist.id && nowPlaying.hasTrack ? <Play className="h-4 w-4 fill-current text-red-400" /> : null}
                  </button>
                )) : <div className="grid min-h-40 place-items-center px-4 text-center text-xs text-white/70">{query ? 'No hay coincidencias.' : 'Esta cuenta no tiene playlists visibles.'}</div>}
              </div>
            </div>}
          </div>
        )}

        {error && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</p>}
      </div>
    </section>
  );
});
