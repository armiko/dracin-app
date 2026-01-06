import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, X, Search, Home, Clock, Flame, 
  ChevronRight, SkipBack, SkipForward, AlertTriangle, 
  Loader2, Trophy, Star, Filter, Plus,
  Pause, Volume2, VolumeX, Share2, ChevronLeft,
  Volume1, Gamepad2, CheckCircle2, ExternalLink,
  LogOut, LogIn, User as UserIcon, AlertCircle,
  Bookmark, BookmarkCheck, History, Trash2, 
  ChevronDown, Zap, ShoppingCart, Info, Tag, Languages,
  Maximize, List, Settings, RotateCcw
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore,
} from 'firebase/firestore';

/**
 * --- KONFIGURASI ENVIRONMENT ---
 */
const getSafeEnv = (key, fallback = '') => {
  try {
    if (key === 'VITE_APP_ID' && typeof __app_id !== 'undefined') return __app_id;
    // @ts-ignore
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};
    return env[key] || fallback;
  } catch (e) {
    return fallback;
  }
};

const defaultFirebaseConfig = {
  apiKey: "AIzaSyDm5JBMP_NZTpiM-EmgvXNwRCLNtdROy8s",
  authDomain: "nontondracin-f5065.firebaseapp.com",
  projectId: "nontondracin-f5065",
  storageBucket: "nontondracin-f5065.firebasestorage.app",
  messagingSenderId: "166957230434",
  appId: "1:166957230434:web:dc20d828a59048765da43b",
  measurementId: "G-6B89Y55E2F"
};

const firebaseConfig = {
  apiKey: getSafeEnv('VITE_FIREBASE_API_KEY', defaultFirebaseConfig.apiKey),
  authDomain: getSafeEnv('VITE_FIREBASE_AUTH_DOMAIN', defaultFirebaseConfig.authDomain),
  projectId: getSafeEnv('VITE_FIREBASE_PROJECT_ID', defaultFirebaseConfig.projectId),
  storageBucket: getSafeEnv('VITE_FIREBASE_STORAGE_BUCKET', defaultFirebaseConfig.storageBucket),
  messagingSenderId: getSafeEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', defaultFirebaseConfig.messagingSenderId),
  appId: getSafeEnv('VITE_FIREBASE_APP_ID', defaultFirebaseConfig.appId),
  measurementId: getSafeEnv('VITE_FIREBASE_MEASUREMENT_ID', defaultFirebaseConfig.measurementId)
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = getSafeEnv('VITE_APP_ID', '3KNDH1p5iIG6U7FmuGTS');

const STORAGE_KEYS = {
  SETTINGS: `dracin_settings_${appId}`,
  WATCHLIST: `dracin_watchlist_${appId}`,
  HISTORY: `dracin_history_${appId}`,
  LOCALE: `dracin_locale_${appId}`
};

const CONFIG = {
  SCRIPT_URL: "https://cdn.jsdelivr.net/gh/armiko/dracin-app@169efe4fc99586d445cbf8780629c5ac210ca929/js/dramabox-core.js",
  HLS_URL: "https://cdn.jsdelivr.net/npm/hls.js@latest",
  API_BASE: "https://drachin.dicky.app",
  LOCALE_API: "in",
  FEED_IDS: { POPULAR: 1, LATEST: 2, TRENDING: 3 },
  PER_PAGE: 24
};

const SUPPORTED_LANGUAGES = [
  { code: 'in', label: 'Indonesia', flag: 'id' },
  { code: 'en', label: 'English', flag: 'us' },
  { code: 'ko', label: 'Korean', flag: 'kr' },
  { code: 'ja', label: 'Japanese', flag: 'jp' }
];

const apiCache = { home: {}, timestamp: {} };

const fetchWithRetry = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 2);
  }
};

const useExternalScript = (url) => {
  const [state, setState] = useState({ loaded: false, error: false });
  useEffect(() => {
    let script = document.querySelector(`script[src="${url}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = url; script.async = true;
      document.body.appendChild(script);
    }
    const onScriptLoad = () => setState({ loaded: true, error: false });
    const onScriptError = () => setState({ loaded: true, error: true });
    script.addEventListener("load", onScriptLoad);
    script.addEventListener("error", onScriptError);
    return () => {
      script.removeEventListener("load", onScriptLoad);
      script.removeEventListener("error", onScriptError);
    };
  }, [url]);
  return state;
};

const cleanIntro = (h) => h ? String(h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim() : '';

const extractVideoUrlFromChapter = (chapter) => {
  if (!chapter) return '';
  let src = chapter.raw || chapter;
  if (typeof src.m3u8Url === 'string' && src.m3u8Url) return src.m3u8Url;
  const cdnList = src.cdnList || [];
  let candidates = [];
  cdnList.forEach((cdn) => {
    (cdn.videoPathList || []).forEach((v) => {
      const path = v.videoPath || v.path || v.url || '';
      if (path) candidates.push({ url: path, domain: cdn.cdnDomain || '' });
    });
  });
  if (candidates.length > 0) {
    let finalUrl = candidates[0].url;
    if (finalUrl && !/^https?:\/\//i.test(finalUrl) && candidates[0].domain) {
      const base = candidates[0].domain.startsWith('http') ? candidates[0].domain : 'https://' + candidates[0].domain;
      finalUrl = base.replace(/\/+$/, '') + '/' + finalUrl.replace(/^\/+/, '');
    }
    return finalUrl;
  }
  return '';
};

const formatTime = (seconds) => {
  if (isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const STATIC_FILTERS = [
  {
    title: "Tipe Suara",
    key: "voice",
    options: [
      { display: "Semua", value: "" },
      { display: "Dubbing", value: "1" },
      { display: "Subtitle", value: "2" }
    ]
  },
  {
    title: "Genre & Tema",
    key: "category",
    options: [
      { display: "Semua", value: "" },
      { display: "Romansa", value: "romansa" },
      { display: "Wanita Kuat", value: "wanita kuat" },
      { display: "Pria Dominan", value: "pria dominan" },
      { display: "Balas Dendam", value: "balas dendam" },
      { display: "CEO", value: "ceo" },
      { display: "Keluarga", value: "keluarga" },
      { display: "Kekuatan Khusus", value: "keluatan khusus" },
      { display: "Pembalikan Identitas", value: "pembalikan identitas" },
      { display: "Perselingkuhan", value: "perselingkuhan" },
      { display: "Terlahir Kembali", value: "terlahir kembali" },
      { display: "Sejarah", value: "sejarah" },
      { display: "Tokoh Legendaris", value: "tokoh legendaris" },
      { display: "Cinta Rahasia", value: "cinta rahasia" },
      { display: "Intrik Keluarga", value: "intrik keluarga" },
      { display: "Cinta Setelah Menikah", value: "cinta setelah menikah" },
      { display: "Takdir Cinta", value: "takdir cinta" },
      { display: "Kesempatan Kedua", value: "kesempatan kedua" }
    ]
  },
  {
    title: "Urutan",
    key: "sort",
    options: [
      { display: "Terpopuler", value: "popular" },
      { display: "Terbaru", value: "latest" }
    ]
  }
];

const Section = React.memo(({ title, icon: IconComponent, onSeeAll, children }) => (
  <section className="mb-8 md:mb-12 text-left">
    <div className="flex items-center justify-between mb-4 md:mb-6">
      <div className="flex items-center gap-2">
        <div className="p-1 md:p-1.5 bg-slate-900 rounded-lg border border-white/5 shadow-inner">
           {IconComponent && <IconComponent size={14} className="text-blue-400 md:w-4 md:h-4" />}
        </div>
        <h2 className="text-sm md:text-lg font-black text-white uppercase tracking-tight">{title}</h2>
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} className="flex items-center gap-1 text-[8px] md:text-[10px] font-black text-blue-500 hover:text-white uppercase tracking-widest transition-all bg-white/5 px-2 md:px-3 py-1 rounded-full border border-white/5">
          Lihat Semua <ChevronRight size={10} className="md:w-3 md:h-3"/>
        </button>
      )}
    </div>
    {children}
  </section>
));

const DramaCard = React.memo(({ item, onClick, rank, onRemove, isHistory, lastEpisode }) => {
  const title = item.bookName || item.title || 'Drama';
  const cover = item.coverWap || item.cover || item.coverUrl || 'https://via.placeholder.com/300x450';
  const bid = item.bookId || item.id;

  return (
    <div className="group relative animate-in fade-in duration-300">
      <div className="cursor-pointer text-left" onClick={() => onClick(item)}>
        <div className="relative aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden bg-slate-800 shadow-md mb-2 border border-white/5">
          <img src={cover} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-md p-2 md:p-3 rounded-full border border-white/30 transform translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
              <Play size={14} fill="white" className="text-white md:w-[18px] md:h-[18px]" />
            </div>
          </div>
          {rank && <div className="absolute top-0 left-0 bg-blue-600 text-white font-black text-[7px] md:text-[9px] px-1.5 md:px-2 py-0.5 rounded-br-lg shadow-lg">#{rank}</div>}
          <div className="absolute bottom-1 right-1 md:bottom-1.5 md:right-1.5 bg-black/60 backdrop-blur-md text-white text-[6px] md:text-[7px] font-black px-1 md:px-1.5 py-0.5 rounded border border-white/10 uppercase">
            {isHistory ? `EPS ${lastEpisode}` : `${item.chapterCount || '?'} EPS`}
          </div>
        </div>
        <h3 className="text-[9px] md:text-[10px] font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors px-0.5">{title}</h3>
      </div>
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(bid); }}
          className="absolute -top-1 -right-1 md:-top-2 md:-right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110 z-10"
        >
          <Trash2 size={10} className="md:w-3 md:h-3" />
        </button>
      )}
    </div>
  );
});

const EmptyState = ({ icon: Icon, title, message, actionText, onAction }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in zoom-in duration-500">
    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 border border-white/5">
      <Icon size={32} className="text-slate-600" />
    </div>
    <h3 className="text-white font-black text-lg mb-2">{title}</h3>
    <p className="text-slate-500 text-xs max-w-xs mb-6 leading-relaxed uppercase tracking-wider font-bold">{message}</p>
    {onAction && (
      <button onClick={onAction} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
        {actionText}
      </button>
    )}
  </div>
);

const SanPoiPromoModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-sm bg-[#1e293b] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500 text-left">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors z-10">
          <X size={18} />
        </button>
        <div className="p-8 pt-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-600/40 transform -rotate-6">
              <Gamepad2 size={40} className="text-white" />
            </div>
          </div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-white mb-2 tracking-tight">SanPoi Store</h2>
            <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Top Up Game Termurah</p>
            <div className="space-y-3 text-left">
              {[
                { icon: Star, text: "Harga Termurah se-Indonesia" },
                { icon: Zap, text: "Proses Cepat (Otomatis 24 Jam)" },
                { icon: CheckCircle2, text: "100% Aman & Terpercaya" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="p-1.5 bg-blue-600/20 rounded-lg">
                    <item.icon size={14} className="text-blue-400" />
                  </div>
                  <span className="text-slate-300 text-[11px] font-bold">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <a href="https://sanpoi.com" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-center gap-3 w-full py-4 bg-white text-black hover:bg-blue-600 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95">
            Top Up Sekarang <ExternalLink size={16} />
          </a>
          <p className="mt-4 text-center text-slate-500 text-[9px] font-bold uppercase tracking-widest">WWW.SANPOI.COM</p>
        </div>
      </div>
    </div>
  );
};

const ProfileDropdown = ({ isOpen, onClose, user, setView, handleLogout }) => {
  if (!isOpen) return null;
  const handleLoginPopup = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (e) {
      console.error("Login gagal", e);
    }
  };
  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose}></div>
      <div className="absolute right-0 mt-3 w-64 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[101] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {user && !user.isAnonymous ? (
          <div className="p-5 border-b border-white/5 bg-gradient-to-br from-blue-600/10 to-transparent text-left">
            <p className="text-white font-black text-xs truncate mb-0.5">{user.displayName || "User"}</p>
            <p className="text-slate-500 text-[10px] font-bold truncate uppercase tracking-widest">{user.email || ""}</p>
          </div>
        ) : (
          <div className="p-5 border-b border-white/5 text-center">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Fitur Terbatas</p>
            <button onClick={handleLoginPopup} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Masuk Google</button>
          </div>
        )}
        <div className="p-2 text-left">
          <button onClick={() => { setView('watchlist'); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-white/5 rounded-xl text-left group transition-colors">
            <Bookmark size={16} className="text-slate-500 group-hover:text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest">Favorit Saya</span>
          </button>
          <button onClick={() => { setView('history'); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-white/5 rounded-xl text-left group transition-colors">
            <History size={16} className="text-slate-500 group-hover:text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sudah Ditonton</span>
          </button>
          <div className="my-2 h-[1px] bg-white/5 mx-2"></div>
          {user && !user.isAnonymous && (
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors text-left group">
              <LogOut size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Logout Akun</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default function App() {
  const [view, setView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [user, setUser] = useState(null);
  const [homeData, setHomeData] = useState({ popular: [], latest: [], trending: [] });
  const [rankData, setRankData] = useState([]);
  const [rankPage, setRankPage] = useState(1);
  const [allDramaData, setAllDramaData] = useState([]);
  const [searchData, setSearchData] = useState([]);
  const [currentLocale, setCurrentLocale] = useState(() => localStorage.getItem(STORAGE_KEYS.LOCALE) || 'in');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [activeTag, setActiveTag] = useState('');
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [watchHistory, setWatchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(watchlist)); }, [watchlist]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(watchHistory)); }, [watchHistory]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.LOCALE, currentLocale); }, [currentLocale]);
  const [loading, setLoading] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankTab, setRankTab] = useState('popular');
  const [activeFilters, setActiveFilters] = useState({ voice: '', category: '', sort: 'popular' });
  const [playerState, setPlayerState] = useState(null);
  const [showPromo, setShowPromo] = useState(false);
  const [showAppleBanner, setShowAppleBanner] = useState(true);
  const { loaded: scriptLoaded } = useExternalScript(CONFIG.SCRIPT_URL);
  const [audioSettings, setAudioSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : { volume: 1, isMuted: false, playbackRate: 1, autoNext: true, autoPlay: true };
    } catch (e) { return { volume: 1, isMuted: false, playbackRate: 1, autoNext: true, autoPlay: true }; }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setTimeout(() => setShowPromo(true), 3500);
      } else {
        signInAnonymously(auth).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchHome = useCallback(async () => {
    if (!window.DramaboxCore) return;
    const cacheKey = `home_${currentLocale}`;
    if (apiCache.home[cacheKey] && Date.now() - apiCache.timestamp[cacheKey] < 300000) {
      setHomeData(apiCache.home[cacheKey]);
      return;
    }
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenRes = await fetchWithRetry(() => core.getToken(CONFIG.API_BASE, currentLocale, device, false));
      const [pop, lat, trd] = await Promise.all([
        core.doClassify(CONFIG.API_BASE, currentLocale, device, tokenRes.token, CONFIG.FEED_IDS.POPULAR, 18),
        core.doClassify(CONFIG.API_BASE, currentLocale, device, tokenRes.token, CONFIG.FEED_IDS.LATEST, 12),
        core.doClassify(CONFIG.API_BASE, currentLocale, device, tokenRes.token, CONFIG.FEED_IDS.TRENDING, 12)
      ]);
      const data = { popular: pop || [], latest: lat || [], trending: trd || [] };
      setHomeData(data);
      apiCache.home[cacheKey] = data;
      apiCache.timestamp[cacheKey] = Date.now();
      const merged = [...(pop || []), ...(lat || []), ...(trd || [])];
      setAllDramaData(merged.filter((v, i, a) => a.findIndex(t => (t.bookId || t.id) === (v.bookId || v.id)) === i));
    } catch (e) { console.error("Fetch home error:", e); }
  }, [currentLocale]);

  const fetchRank = useCallback(async (tab, page = 1) => {
    if (!window.DramaboxCore) return;
    setLoading(true);
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenRes = await fetchWithRetry(() => core.getToken(CONFIG.API_BASE, currentLocale, device, false));
      const fid = tab === 'popular' ? CONFIG.FEED_IDS.POPULAR : tab === 'latest' ? CONFIG.FEED_IDS.LATEST : CONFIG.FEED_IDS.TRENDING;
      const count = page * CONFIG.PER_PAGE;
      const res = await core.doClassify(CONFIG.API_BASE, currentLocale, device, tokenRes.token, fid, count);
      setRankData(res || []);
    } catch (e) { console.error("Rank error:", e); } finally { setLoading(false); }
  }, [currentLocale]);

  const handleToggleWatchlist = useCallback((book) => {
    const bid = String(book.bookId || book.id);
    setWatchlist(prev => {
      const exists = prev.find(i => String(i.bookId || i.id) === bid);
      if (exists) return prev.filter(i => String(i.bookId || i.id) !== bid);
      return [{ ...book, bookId: bid, addedAt: Date.now() }, ...prev];
    });
  }, []);

  const updateHistory = useCallback((book, episode) => {
    const bid = String(book.bookId || book.id);
    setWatchHistory(prev => {
      const filtered = prev.filter(i => String(i.bookId) !== bid);
      const newItem = {
        bookId: bid,
        bookName: book.bookName || book.title,
        cover: book.cover || book.coverWap,
        lastEpisode: episode,
        updatedAt: Date.now()
      };
      return [newItem, ...filtered].slice(0, 20);
    });
  }, []);

  const clearHistoryItem = useCallback((bid) => {
    setWatchHistory(prev => prev.filter(i => String(i.bookId) !== String(bid)));
  }, []);

  const handlePlayerBack = useCallback(() => {
    setPlayerState(null);
    setView('detail');
  }, []);

  const handleAudioSettingsUpdate = useCallback((s) => {
    setAudioSettings(s);
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
  }, []);

  const handleEpisodeChange = useCallback((ep) => {
    if (playerState?.book) {
      updateHistory(playerState.book, ep);
    }
  }, [playerState?.book, updateHistory]);

  const closePromo = useCallback(() => { setShowPromo(false); }, []);
  const closeAppleBanner = () => { setShowAppleBanner(false); };

  const handleLogout = useCallback(() => {
    signOut(auth).then(() => { setView('home'); setProfileOpen(false); });
  }, []);

  const handleTagClick = useCallback((tagName) => {
    setActiveTag(tagName);
    setActiveFilters(prev => ({ ...prev, category: tagName.toLowerCase() }));
    setPreviousView(view);
    setView('filter');
  }, [view]);

  useEffect(() => { if (scriptLoaded) fetchHome(); }, [scriptLoaded, fetchHome]);
  useEffect(() => { if (view === 'rank') fetchRank(rankTab, rankPage); }, [view, rankTab, rankPage, fetchRank]);

  const filteredItems = useMemo(() => {
    let result = [...allDramaData];
    if (activeFilters.voice === '1') result = result.filter(i => (i.bookName || i.title || '').toLowerCase().includes('(sulih suara)'));
    else if (activeFilters.voice === '2') result = result.filter(i => !(i.bookName || i.title || '').toLowerCase().includes('(sulih suara)'));
    if (activeFilters.category) {
      result = result.filter(i => {
        const tags = [...(i.typeTwoNames || []), ...(i.tags || [])].map(t => String(t).toLowerCase());
        return tags.some(tag => tag.includes(activeFilters.category.toLowerCase()));
      });
    }
    if (activeFilters.sort === 'popular') {
      result.sort((a, b) => (b.score || b.popularScore || 0) - (a.score || a.popularScore || 0));
    } else if (activeFilters.sort === 'latest') {
      result.sort((a, b) => (b.bookId || b.id || 0) - (a.bookId || a.id || 0));
    }
    return result;
  }, [allDramaData, activeFilters]);

  const LanguageSelector = () => (
    <div className="relative">
      <button onClick={() => setLangMenuOpen(!langMenuOpen)} className="p-1.5 hover:bg-white/10 transition-all flex items-center justify-center bg-white/5 rounded-full border border-white/10 w-10 h-10 active:scale-95" title="Ganti Bahasa">
        <div className="w-6 h-4 overflow-hidden rounded-[2px] shadow-sm flex-shrink-0">
          <img src={`https://flagcdn.com/w40/${SUPPORTED_LANGUAGES.find(l => l.code === currentLocale)?.flag}.png`} alt="Current flag" className="w-full h-full object-cover" />
        </div>
      </button>
      {langMenuOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setLangMenuOpen(false)}></div>
          <div className="absolute right-0 mt-3 w-44 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[101] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 text-left">
              <p className="px-3 py-2 text-[8px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 mb-1">Pilih Bahasa</p>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button key={lang.code} onClick={() => { setCurrentLocale(lang.code); setLangMenuOpen(false); setHomeData({ popular: [], latest: [], trending: [] }); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${currentLocale === lang.code ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
                  <div className="w-6 h-4 overflow-hidden rounded-[2px] flex-shrink-0">
                    <img src={`https://flagcdn.com/w40/${lang.flag}.png`} alt={lang.label} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest">{lang.label}</span>
                  {currentLocale === lang.code && <CheckCircle2 size={12} className="ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="bg-[#0f172a] h-screen text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-blue-600 selection:text-white text-left">
      {showAppleBanner && (
        <div className="flex-none bg-amber-500/15 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-3 justify-center flex-1 text-left">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <p className="text-[10px] md:text-xs font-bold text-amber-200 leading-tight">Kami mohon maaf atas ketidaknyamanannya, saat ini isi website belum dapat ditampilkan bagi pengguna ekosistem Apple.</p>
          </div>
          <button onClick={closeAppleBanner} className="p-1.5 text-amber-500/50 hover:text-amber-500 hover:bg-white/5 rounded-full transition-all"><X size={16} /></button>
        </div>
      )}

      {/* HEADER: PERSISTEN */}
      <nav className="flex-none h-16 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 flex items-center z-40 px-4 sm:px-8">
        <div className="container mx-auto flex justify-between items-center">
          <button onClick={() => { setPlayerState(null); setView('home'); }} className="flex items-center gap-2 group transition-all active:scale-95 text-left">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-blue-600/20">D</div>
            <span className="text-base font-black text-white hidden xs:block tracking-tighter">NontonDracin</span>
          </button>
          <div className="flex items-center gap-2 text-left">
            <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10 mr-1">
              {[ {id:'home', icon:Home}, {id:'rank', icon:Trophy}, {id:'filter', icon:Filter} ].map(m => (
                <button key={m.id} onClick={() => { setPlayerState(null); setView(m.id); }} className={`p-2 rounded-full transition-all ${(view === m.id && !playerState) ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}><m.icon size={16} /></button>
              ))}
            </div>
            <LanguageSelector />
            <button onClick={() => setSearchModalOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors active:scale-90"><Search size={20} /></button>
            <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95">
                {user && !user.isAnonymous && user.photoURL ? <img src={user.photoURL} alt="User" className="w-7 h-7 rounded-full border border-white/20" /> : <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><UserIcon size={14}/></div>}
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              <ProfileDropdown isOpen={profileOpen} onClose={() => setProfileOpen(false)} user={user} setView={(v) => { setPlayerState(null); setView(v); }} handleLogout={handleLogout} />
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto pt-4 md:pt-6 pb-20 px-4 sm:px-8 no-scrollbar text-left">
        <div className="container mx-auto max-w-7xl">
          {playerState ? (
            <CustomPlayerPage 
              book={playerState.book} initialEp={playerState.ep} 
              onBack={handlePlayerBack}
              onEpisodeChange={handleEpisodeChange}
              audioSettings={audioSettings}
              setAudioSettings={handleAudioSettingsUpdate}
              locale={currentLocale}
              onTagClick={handleTagClick}
            />
          ) : (
            <>
              {view === 'home' && (
                <div className="animate-in fade-in duration-700">
                   {homeData.popular[0] && (
                     <div className="mb-8 md:mb-10 relative rounded-[1.5rem] md:rounded-[2rem] overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center bg-slate-900 border border-white/5 shadow-2xl">
                       <div className="absolute inset-0">
                         <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover opacity-20 blur-sm" alt="" />
                         <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent"></div>
                       </div>
                       <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10 p-6 md:p-12 w-full text-left">
                         <div className="hidden md:block w-[180px] shrink-0 transform -rotate-2 hover:rotate-0 transition-all duration-500">
                           <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/10 cursor-pointer" onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }}>
                             <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover" alt="" />
                           </div>
                         </div>
                         <div className="flex-1 text-center md:text-left">
                           <div className="inline-flex items-center gap-1.5 px-2 py-0.5 md:px-3 md:py-1 bg-blue-600 text-white text-[7px] md:text-[8px] font-black rounded-full mb-3 md:mb-5 uppercase tracking-widest"><Flame size={12} fill="white" /> Rekomendasi</div>
                           <h1 className="text-2xl md:text-5xl font-black text-white mb-4 md:mb-6 leading-tight tracking-tighter line-clamp-2">{homeData.popular[0].bookName || homeData.popular[0].title}</h1>
                           <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4">
                            <button onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }} className="bg-white text-black hover:bg-blue-600 hover:text-white px-5 md:px-8 py-2.5 md:py-3.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all shadow-xl flex items-center gap-2">MULAI TONTON <Play size={14} fill="currentColor"/></button>
                            <button onClick={() => handleToggleWatchlist(homeData.popular[0])} className="bg-white/10 hover:bg-white/20 text-white px-4 md:px-6 py-2.5 md:py-3.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all backdrop-blur-md border border-white/10 flex items-center gap-2">
                               {watchlist.some(i => String(i.bookId || i.id) === String(homeData.popular[0].bookId || homeData.popular[0].id)) ? <BookmarkCheck size={16} className="text-blue-400" /> : <Bookmark size={16} />} SIMPAN
                            </button>
                           </div>
                         </div>
                       </div>
                     </div>
                   )}
                   <Section icon={Flame} title="Drama Populer" onSeeAll={() => { setRankTab('popular'); setView('rank'); }}>
                     <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                       {homeData.popular.slice(1, 7).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                     </div>
                   </Section>
                   {watchHistory.length > 0 && (
                     <Section icon={History} title="Lanjutkan Nonton">
                       <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                         {watchHistory.slice(0, 6).map((item, idx) => (<DramaCard key={idx} item={item} isHistory lastEpisode={item.lastEpisode} onRemove={clearHistoryItem} onClick={(it) => { setSelectedBookId(it.bookId); setView('detail'); }} />))}
                       </div>
                     </Section>
                   )}
                   <Section icon={Zap} title="Sedang Trending" onSeeAll={() => { setRankTab('trending'); setView('rank'); }}>
                     <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                       {homeData.trending.slice(0, 6).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                     </div>
                   </Section>
                   <Section icon={Clock} title="Update Terbaru" onSeeAll={() => { setRankTab('latest'); setView('rank'); }}>
                     <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                       {homeData.latest.slice(0, 6).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                     </div>
                   </Section>
                </div>
              )}
              {view === 'rank' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
                   <div className="flex justify-center gap-2 md:gap-3 mb-8 md:mb-10 overflow-x-auto no-scrollbar py-1">
                     {[ { id: 'popular', label: 'Populer' }, { id: 'trending', label: 'Trending' }, { id: 'latest', label: 'Terbaru' } ].map(t => (
                        <button key={t.id} onClick={() => { setRankTab(t.id); setRankPage(1); }} className={`px-5 md:px-8 py-2 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest border transition-all ${rankTab === t.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>{t.label}</button>
                     ))}
                   </div>
                   <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6 text-left">
                      {rankData.map((item, idx) => <DramaCard key={idx} item={item} rank={idx+1} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />)}
                   </div>
                   <div className="mt-8 md:mt-12 flex justify-center">
                      <button onClick={() => setRankPage(p => p + 1)} disabled={loading} className="px-8 md:px-10 py-3 md:py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center gap-3 disabled:opacity-50 transition-all">
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} MUAT LEBIH BANYAK
                      </button>
                   </div>
                </div>
              )}
              {view === 'filter' && (
                <div className="animate-in fade-in duration-500 text-left">
                   <div className="bg-slate-900/50 p-6 md:p-8 rounded-3xl border border-white/5 mb-8 md:mb-10 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 backdrop-blur-sm">
                      {STATIC_FILTERS.map(f => (
                        <div key={f.key}>
                          <h4 className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2"><div className="w-1 h-1 bg-blue-500 rounded-full"></div> {f.title}</h4>
                          <div className="flex flex-wrap gap-2">
                            {f.options.map(o => (
                              <button key={o.value} onClick={() => setActiveFilters(p => ({...p, [f.key]: p[f.key] === o.value ? '' : o.value}))} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[8px] md:text-[9px] font-bold uppercase tracking-wider border transition-all ${activeFilters[f.key] === o.value ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}>{o.display}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                   </div>
                   <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                      {filteredItems.map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />)}
                   </div>
                </div>
              )}
              {view === 'detail' && (
                <DramaDetailPage bookId={selectedBookId} onBack={() => setView(previousView)} user={user} watchlist={watchlist} history={watchHistory} onToggleWatchlist={handleToggleWatchlist} onTagClick={handleTagClick} locale={currentLocale} onPlayEpisode={(ep, b, c) => { setPlayerState({ book: b, chapters: c, ep }); updateHistory(b, ep); }} />
              )}
              {view === 'watchlist' && (
                <div className="animate-in fade-in duration-700 text-left">
                  <Section icon={Bookmark} title="Koleksi Favorit Saya">
                    {watchlist.length > 0 ? (
                      <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6 text-left">
                        {watchlist.map((item, idx) => <DramaCard key={idx} item={item} onRemove={() => handleToggleWatchlist(item)} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />)}
                      </div>
                    ) : <EmptyState icon={Bookmark} title="Favorit Kosong" message="Ayo simpan drama favoritmu agar mudah ditemukan kembali." actionText="CARI DRAMA" onAction={() => setView('home')} />}
                  </Section>
                </div>
              )}
              {view === 'history' && (
                <div className="animate-in fade-in duration-700 text-left">
                  <Section icon={History} title="Sudah Ditonton">
                    {watchHistory.length > 0 ? (
                      <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6 text-left">
                        {watchHistory.map((item, idx) => <DramaCard key={idx} item={item} isHistory lastEpisode={item.lastEpisode} onRemove={clearHistoryItem} onClick={(it) => { setSelectedBookId(it.bookId); setView('detail'); }} />)}
                      </div>
                    ) : <EmptyState icon={History} title="Riwayat Kosong" message="Anda belum pernah menonton drama apa pun." actionText="NONTON SEKARANG" onAction={() => setView('home')} />}
                  </Section>
                </div>
              )}
              {view === 'search-results' && (
                <div className="animate-in fade-in duration-700 text-left">
                   <Section title={`Hasil Pencarian: ${searchQuery}`} icon={Search} onSeeAll={() => setView('home')}>
                     <div className="grid grid-cols-3 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6">
                       {searchData.map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('search-results'); setView('detail'); }} />)}
                     </div>
                   </Section>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* FOOTER: PERSISTEN */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex justify-between items-center z-50 text-left">
        {[ {id:'home', icon:Home, label:'Home'}, {id:'rank', icon:Trophy, label:'Top'}, {id:'filter', icon:Filter, label:'Saring'}, {id:'watchlist', icon:Bookmark, label:'Favorit'} ].map(m => (
          <button key={m.id} onClick={() => { setPlayerState(null); setView(m.id); }} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${(view === m.id && !playerState) ? 'text-blue-500' : 'text-slate-500'}`}><m.icon size={20} /><span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span></button>
        ))}
      </div>

      {searchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md" onClick={() => setSearchModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl animate-in slide-in-from-top-8 duration-500 text-left">
             <div className="relative group text-left">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && searchQuery.trim()) { window.DramaboxCore.searchBooks(CONFIG.API_BASE, currentLocale, searchQuery, 1, 30).then(res => { setSearchData(res.items || []); setView('search-results'); setSearchModalOpen(false); }); } }} placeholder="Cari drama favorit..." className="w-full bg-slate-900 border border-white/10 rounded-3xl pl-16 pr-8 py-5 text-lg font-bold text-white outline-none focus:border-blue-600 transition-all shadow-2xl" />
             </div>
          </div>
        </div>
      )}
      {showPromo && <SanPoiPromoModal onClose={closePromo} />}
    </div>
  );
}

const DramaDetailPage = ({ bookId, onBack, user, watchlist, history, onToggleWatchlist, onPlayEpisode, onTagClick, locale }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetch = async () => {
      if (!window.DramaboxCore) return;
      try {
        const res = await window.DramaboxCore.loadDetailWithRecommend({ apiBase: CONFIG.API_BASE, localeApi: locale, bookId, webficBase: 'https://www.webfic.com' });
        setData(res);
      } catch (e) { console.error("Detail error:", e); } finally { setLoading(false); }
    };
    fetch();
  }, [bookId, locale]);
  const isBookmarked = useMemo(() => watchlist.some(i => String(i.bookId || i.id) === String(bookId)), [watchlist, bookId]);
  const lastWatched = useMemo(() => history.find(i => String(i.bookId) === String(bookId))?.lastEpisode, [history, bookId]);
  if (loading) return <div className="flex flex-col items-center justify-center p-20 gap-4 text-center"><Loader2 className="animate-spin text-blue-500" size={40} /><p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Memuat Drama...</p></div>;
  return (
    <div className="animate-in fade-in duration-700 text-left">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-white transition-colors text-[9px] md:text-[10px] uppercase tracking-widest mb-6 md:mb-8"><ChevronLeft size={18} /> Kembali</button>
      <div className="flex flex-col lg:flex-row gap-8 md:gap-10 bg-slate-900/40 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 border border-white/5 backdrop-blur-xl shadow-2xl">
        <div className="w-full lg:w-[300px] xl:w-[320px] shrink-0">
          <div className="relative aspect-[2/3] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <img src={data.book.cover} className="w-full h-full object-cover" alt="" />
            <div className="absolute top-3 left-3 md:top-4 md:left-4 flex gap-2">
               <span className="bg-blue-600 text-white text-[7px] md:text-[8px] font-black px-2 py-1 rounded-lg shadow-lg uppercase tracking-wider">{data.book.chapterCount} EPS</span>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center text-left">
          <h2 className="text-2xl md:text-5xl font-black text-white mb-3 md:mb-4 leading-tight tracking-tighter">{data.book.bookName}</h2>
          <div className="mb-4 md:mb-6 flex flex-wrap gap-1.5 md:gap-2 text-left">
             {data.book.typeTwoNames?.map((tag, idx) => (<button key={idx} onClick={() => onTagClick(tag)} className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[8px] md:text-[9px] font-black rounded-xl uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all active:scale-95"><Tag size={10} /> {tag}</button>))}
          </div>
          <div className="flex flex-wrap gap-2.5 md:gap-3 mb-6 md:mb-8">
            <button onClick={() => onPlayEpisode(lastWatched || 1, data.book, data.chapters)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-8 py-3 md:py-3.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2 group active:scale-95"><Play size={18} fill="currentColor"/> {lastWatched ? `EPS ${lastWatched}` : 'TONTON'}</button>
            <button onClick={() => onToggleWatchlist(data.book)} className={`px-5 md:px-6 py-3 md:py-3.5 rounded-2xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all border flex items-center gap-2 active:scale-95 ${isBookmarked ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
              {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {isBookmarked ? 'FAVORIT' : 'SIMPAN'}
            </button>
          </div>
          <div className="mb-8 md:mb-10">
            <h4 className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2 md:mb-3">SINOPSIS</h4>
            <div className="p-4 md:p-5 bg-white/5 rounded-2xl border border-white/5 text-slate-400 text-[11px] md:text-xs leading-relaxed italic line-clamp-4 md:line-clamp-none transition-all duration-300">{cleanIntro(data.book.introduction)}</div>
          </div>
          <div>
             <h4 className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 md:mb-4 text-slate-400">DAFTAR EPISODE</h4>
             <div className="grid grid-cols-5 xs:grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-1.5 md:gap-2 max-h-[160px] overflow-y-auto pr-2 no-scrollbar pb-1">
              {data.chapters?.map((ch, i) => {
                const num = ch.num || (ch.index + 1);
                return (
                  <button key={i} onClick={() => onPlayEpisode(num, data.book, data.chapters)} className={`aspect-square rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black flex items-center justify-center transition-all border ${num === lastWatched ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-800 border-white/5 text-slate-500 hover:text-white'}`}>{num}</button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomPlayerPage = ({ book, initialEp, onBack, onEpisodeChange, audioSettings, setAudioSettings, locale, onTagClick }) => {
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(audioSettings.volume);
  const [localAutoNext, setLocalAutoNext] = useState(audioSettings.autoNext);
  const [details, setDetails] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const timerRef = useRef(null);
  const lastUrlRef = useRef('');
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!window.DramaboxCore) return;
      try {
        const res = await window.DramaboxCore.loadDetailWithRecommend({ apiBase: CONFIG.API_BASE, localeApi: locale, bookId: book.bookId || book.id, webficBase: 'https://www.webfic.com' });
        setDetails(res);
      } catch (e) { console.error("Player detail error:", e); }
    };
    fetchDetails();
  }, [book.bookId, book.id, locale]);

  const loadVideo = useCallback(async (ep) => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(() => window.DramaboxCore.loadViaBatch({ apiBase: CONFIG.API_BASE, localeApi: locale, bookId: book.bookId || book.id, index: ep }));
      const list = res?.data?.chapterList || res?.chapters || [];
      const chapter = list.find(c => String(c.num) === String(ep)) || list[0];
      const url = extractVideoUrlFromChapter(chapter);
      if (url && url !== lastUrlRef.current) { 
        lastUrlRef.current = url;
        setVideoUrl(url); 
        if (onEpisodeChange) onEpisodeChange(ep); 
      } else { setLoading(false); }
    } catch (e) { console.error("Player error:", e); if (e.message.includes('500')) onBack(); }
  }, [book.bookId, book.id, onBack, onEpisodeChange, locale]);

  useEffect(() => { loadVideo(currentEp); }, [currentEp, loadVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const applyInitialSettings = () => {
      if(video) {
        video.playbackRate = audioSettings.playbackRate;
        video.volume = volume;
        setLoading(false);
        if (audioSettings.autoPlay) video.play().catch(() => {});
      }
    };
    if (videoUrl.includes('.m3u8')) {
      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 60 }); 
        hls.on(window.Hls.Events.ERROR, (event, data) => { if (data.fatal) { switch(data.type) { case window.Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break; case window.Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break; default: hls.destroy(); break; } } });
        hls.loadSource(videoUrl); 
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, applyInitialSettings); 
        hlsRef.current = hls;
      } else { video.src = videoUrl; video.oncanplay = applyInitialSettings; }
    } else { video.src = videoUrl; video.oncanplay = applyInitialSettings; }
    return () => { if (hlsRef.current) hlsRef.current.destroy(); };
  }, [videoUrl, audioSettings.autoPlay]); 

  useEffect(() => {
    const video = videoRef.current;
    if (video) { video.playbackRate = audioSettings.playbackRate; video.volume = volume; }
  }, [audioSettings.playbackRate, volume]);

  const togglePlay = () => isPlaying ? videoRef.current.pause() : videoRef.current.play();
  const toggleFullScreen = () => { if (!document.fullscreenElement) { containerRef.current.requestFullscreen().catch(err => console.error(err)); } else { document.exitFullscreen(); } };
  const handleNext = () => { const total = details?.book?.chapterCount || 0; if (currentEp < total) setCurrentEp(prev => prev + 1); };
  const handlePrev = () => { if (currentEp > 1) setCurrentEp(prev => prev - 1); };
  const scrollToTop = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 md:gap-8 items-start">
        
        {/* PLAYER PORTRAIT (9:16) */}
        <div className="lg:col-span-8 w-full max-w-[450px] mx-auto">
          <div 
            ref={containerRef}
            className="relative w-full aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5 group"
            onMouseMove={() => { setShowControls(true); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setShowControls(false), 3000); }}
          >
            <video ref={videoRef} className="w-full h-full object-cover cursor-pointer" playsInline onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} onEnded={() => localAutoNext && handleNext()} onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onClick={togglePlay} />
            
            {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}
            
            <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 flex flex-col justify-between p-5 md:p-8 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex justify-between items-center text-left">
                <button onClick={onBack} className="p-2 md:p-2.5 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all border border-white/10 active:scale-90"><ChevronLeft size={20}/></button>
                <div className="text-center">
                  <h2 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-white">EPS {currentEp}</h2>
                </div>
                <button onClick={toggleFullScreen} className="p-2 md:p-2.5 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all border border-white/10 active:scale-90"><Maximize size={20}/></button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-center gap-8 md:gap-12">
                   <button onClick={handlePrev} disabled={currentEp <= 1} className="text-white/60 hover:text-blue-400 disabled:opacity-20 transition-colors"><SkipBack size={32} fill="currentColor"/></button>
                   <button onClick={togglePlay} className="text-white transform active:scale-90 transition-transform">{isPlaying ? <Pause size={56} fill="white" /> : <Play size={56} fill="white" />}</button>
                   <button onClick={handleNext} disabled={currentEp >= (details?.book?.chapterCount || 0)} className="text-white/60 hover:text-blue-400 disabled:opacity-20 transition-colors"><SkipForward size={32} fill="currentColor"/></button>
                </div>

                <div className="flex flex-col gap-2">
                  <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={(e) => { if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value); }} className="w-full h-1 md:h-1.5 accent-blue-600 bg-white/20 rounded-full appearance-none cursor-pointer" />
                  <div className="flex justify-between text-[8px] font-mono font-black text-white/50 tracking-tighter"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* KONTROL MINIMALIS RESPONSIF */}
          <div className="mt-4 flex gap-2">
             <button onClick={() => setLocalAutoNext(!localAutoNext)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${localAutoNext ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                <RotateCcw size={14} /> Auto {localAutoNext ? 'ON' : 'OFF'}
             </button>
             <button onClick={() => { const rates = [1, 1.25, 1.5, 2]; const next = rates[(rates.indexOf(audioSettings.playbackRate) + 1) % rates.length]; setAudioSettings({...audioSettings, playbackRate: next}); }} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-slate-200 uppercase tracking-widest transition-all active:scale-95 hover:bg-white/10">
                <Settings size={14} /> Speed {audioSettings.playbackRate}x
             </button>
          </div>
        </div>

        {/* SIDEBAR / INFO */}
        <div className="lg:col-span-4 w-full flex flex-col gap-6">
           <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 flex flex-col shadow-2xl">
              <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                 <div className="w-10 h-10 bg-blue-600 rounded-xl shadow-xl shadow-blue-600/20 flex items-center justify-center text-white"><List size={18} /></div>
                 <div>
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Daftar Episode</h3>
                   <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{details?.book?.chapterCount || 0} Total</p>
                 </div>
              </div>
              <div className="grid grid-cols-5 xs:grid-cols-6 sm:grid-cols-8 lg:grid-cols-4 gap-2 max-h-[250px] lg:max-h-[400px] overflow-y-auto no-scrollbar py-1">
                 {details?.chapters?.map((ch, i) => {
                   const num = ch.num || (i + 1);
                   return (<button key={i} onClick={() => { setCurrentEp(num); scrollToTop(); }} className={`aspect-square rounded-xl text-[10px] font-black transition-all border ${num === currentEp ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-slate-800/40 border-white/5 text-slate-500 hover:text-white hover:bg-blue-600/10'}`}>{num}</button>);
                 })}
              </div>
           </div>

           <div className="p-6 bg-white/5 border border-white/5 rounded-[2rem] text-xs text-slate-400 italic leading-relaxed">
              <p className="text-[8px] font-black text-slate-500 uppercase mb-3 tracking-widest">Sinopsis Drama</p>
              <div className="line-clamp-6 hover:line-clamp-none transition-all duration-500">
                {details?.book?.introduction ? cleanIntro(details.book.introduction) : "Memuat sinopsis..."}
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
