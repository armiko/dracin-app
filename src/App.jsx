import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, X, Search, Home, Clock, Flame, 
  ChevronRight, SkipBack, SkipForward, AlertTriangle, 
  Loader2, Trophy, Star, Filter, Plus,
  Pause, Volume2, VolumeX, Share2, ChevronLeft,
  Volume1, Gamepad2, CheckCircle2, ExternalLink,
  LogOut, LogIn, User as UserIcon, AlertCircle,
  Bookmark, BookmarkCheck, History, Trash2, 
  ChevronDown, Zap, ShoppingCart
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
  PROMO_DISMISSED: `dracin_promo_v1_${appId}`
};

const CONFIG = {
  SCRIPT_URL: "https://cdn.jsdelivr.net/gh/armiko/dracin-app@169efe4fc99586d445cbf8780629c5ac210ca929/js/dramabox-core.js",
  HLS_URL: "https://cdn.jsdelivr.net/npm/hls.js@latest",
  API_BASE: "https://drachin.dicky.app",
  LOCALE_API: "in",
  FEED_IDS: { POPULAR: 1, LATEST: 2, TRENDING: 3 },
  PER_PAGE: 24
};

const apiCache = { home: null, timestamp: 0 };

/**
 * --- UTILS ---
 */
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

/**
 * --- KOMPONEN UI ---
 */
const Section = React.memo(({ title, icon: IconComponent, onSeeAll, children }) => (
  <section className="mb-12">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-slate-900 rounded-lg border border-white/5 shadow-inner">
           {IconComponent && <IconComponent size={16} className="text-blue-400" />}
        </div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight">{title}</h2>
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} className="flex items-center gap-1 text-[10px] font-black text-blue-500 hover:text-white uppercase tracking-widest transition-all bg-white/5 px-3 py-1 rounded-full border border-white/5">
          Lihat Semua <ChevronRight size={12}/>
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
      <div className="cursor-pointer" onClick={() => onClick(item)}>
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shadow-md mb-2 border border-white/5">
          <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/30 transform translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
              <Play size={18} fill="white" className="text-white" />
            </div>
          </div>
          {rank && <div className="absolute top-0 left-0 bg-blue-600 text-white font-black text-[9px] px-2 py-0.5 rounded-br-lg shadow-lg">#{rank}</div>}
          <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-md text-white text-[7px] font-black px-1.5 py-0.5 rounded border border-white/10 uppercase">
            {isHistory ? `EPS ${lastEpisode}` : `${item.chapterCount || '?'} EPS`}
          </div>
        </div>
        <h3 className="text-[10px] font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors px-0.5">{title}</h3>
      </div>
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(bid); }}
          className="absolute -top-2 -right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110 z-10"
        >
          <Trash2 size={12} />
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

/**
 * --- MODAL PROMOSI SANPOI STORE ---
 */
const SanPoiPromoModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-sm bg-[#1e293b] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors z-10">
          <X size={18} />
        </button>
        
        <div className="p-8 pt-10">
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
                { icon: Star, text: "Harga Paling Murah se-Indonesia" },
                { icon: Zap, text: "Proses Kilat (Otomatis 24 Jam)" },
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

          <a 
            href="https://sanpoi.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-3 w-full py-4 bg-white text-black hover:bg-blue-600 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95"
          >
            Top Up Sekarang <ExternalLink size={16} />
          </a>
          
          <p className="mt-4 text-center text-slate-500 text-[9px] font-bold uppercase tracking-widest">WWW.SANPOI.COM</p>
        </div>
      </div>
    </div>
  );
};

/**
 * --- COMPONENT: PROFILE DROPDOWN MENU ---
 * Dipisahkan agar render lebih aman
 */
const ProfileDropdown = ({ isOpen, onClose, user, setView, handleLogout }) => {
  if (!isOpen) return null;

  const handleLoginPopup = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (e) {
      console.error("Login failed", e);
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
            <button 
              onClick={handleLoginPopup}
              className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
            >
              Masuk Google
            </button>
          </div>
        )}
        <div className="p-2">
          <button 
            onClick={() => { setView('watchlist'); onClose(); }} 
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-white/5 rounded-xl text-left group transition-colors"
          >
            <Bookmark size={16} className="text-slate-500 group-hover:text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest">Favorit Saya</span>
          </button>
          <button 
            onClick={() => { setView('history'); onClose(); }} 
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-white/5 rounded-xl text-left group transition-colors"
          >
            <History size={16} className="text-slate-500 group-hover:text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sudah Ditonton</span>
          </button>
          <div className="my-2 h-[1px] bg-white/5 mx-2"></div>
          {user && !user.isAnonymous && (
            <button 
              onClick={handleLogout} 
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors text-left group"
            >
              <LogOut size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

/**
 * --- MAIN APP ---
 */
export default function App() {
  const [view, setView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [user, setUser] = useState(null);
  
  const [homeData, setHomeData] = useState({ popular: [], latest: [], trending: [] });
  const [rankData, setRankData] = useState([]);
  const [rankPage, setRankPage] = useState(1);
  const [allDramaData, setAllDramaData] = useState([]);
  const [searchData, setSearchData] = useState([]);
  
  // Persistence States
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
  
  const [loading, setLoading] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankTab, setRankTab] = useState('popular');
  const [activeFilters, setActiveFilters] = useState({ voice: '', category: '', sort: 'popular' });
  const [playerState, setPlayerState] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [showPromo, setShowPromo] = useState(false);

  const { loaded: scriptLoaded } = useExternalScript(CONFIG.SCRIPT_URL);

  const [audioSettings, setAudioSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? JSON.parse(saved) : { volume: 1, isMuted: false, playbackRate: 1, autoNext: true };
    } catch (e) { return { volume: 1, isMuted: false, playbackRate: 1, autoNext: true }; }
  });

  /**
   * --- FIREBASE AUTH & PROMO LOGIC ---
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        const dismissed = localStorage.getItem(STORAGE_KEYS.PROMO_DISMISSED);
        if (!dismissed) {
          setTimeout(() => setShowPromo(true), 3500);
        }
      } else {
        signInAnonymously(auth).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchHome = useCallback(async () => {
    if (!window.DramaboxCore) return;
    if (apiCache.home && Date.now() - apiCache.timestamp < 300000) {
      setHomeData(apiCache.home);
      return;
    }
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenRes = await fetchWithRetry(() => core.getToken(CONFIG.API_BASE, 'in', device, false));
      const [pop, lat, trd] = await Promise.all([
        core.doClassify(CONFIG.API_BASE, 'in', device, tokenRes.token, CONFIG.FEED_IDS.POPULAR, 18),
        core.doClassify(CONFIG.API_BASE, 'in', device, tokenRes.token, CONFIG.FEED_IDS.LATEST, 12),
        core.doClassify(CONFIG.API_BASE, 'in', device, tokenRes.token, CONFIG.FEED_IDS.TRENDING, 12)
      ]);
      const data = { popular: pop || [], latest: lat || [], trending: trd || [] };
      setHomeData(data);
      apiCache.home = data;
      apiCache.timestamp = Date.now();
      setAllDramaData([...(pop || []), ...(lat || []), ...(trd || [])].filter((v, i, a) => a.findIndex(t => (t.bookId || t.id) === (v.bookId || v.id)) === i));
    } catch (e) { console.error("Fetch home error:", e); }
  }, []);

  const fetchRank = useCallback(async (tab, page = 1) => {
    if (!window.DramaboxCore) return;
    setLoading(true);
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenRes = await core.getToken(CONFIG.API_BASE, 'in', device, false);
      const fid = tab === 'popular' ? CONFIG.FEED_IDS.POPULAR : tab === 'latest' ? CONFIG.FEED_IDS.LATEST : CONFIG.FEED_IDS.TRENDING;
      const count = page * CONFIG.PER_PAGE;
      const res = await core.doClassify(CONFIG.API_BASE, 'in', device, tokenRes.token, fid, count);
      setRankData(res || []);
    } catch (e) { console.error("Rank error:", e); } finally { setLoading(false); }
  }, []);

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

  const closePromo = useCallback(() => {
    setShowPromo(false);
    localStorage.setItem(STORAGE_KEYS.PROMO_DISMISSED, 'true');
  }, []);

  const handleLogout = useCallback(() => {
    signOut(auth).then(() => { setView('home'); setProfileOpen(false); });
  }, []);

  useEffect(() => { if (scriptLoaded) fetchHome(); }, [scriptLoaded, fetchHome]);
  useEffect(() => { if (view === 'rank') fetchRank(rankTab, rankPage); }, [view, rankTab, rankPage, fetchRank]);

  const filteredItems = useMemo(() => {
    let result = [...allDramaData];
    if (activeFilters.voice === '1') result = result.filter(i => (i.bookName || i.title || '').toLowerCase().includes('(sulih suara)'));
    else if (activeFilters.voice === '2') result = result.filter(i => !(i.bookName || i.title || '').toLowerCase().includes('(sulih suara)'));
    if (activeFilters.category) result = result.filter(i => {
      const tags = [...(i.typeTwoNames || []), ...(i.tags || [])].map(t => String(t).toLowerCase());
      return tags.some(tag => tag.includes(activeFilters.category.toLowerCase()));
    });
    return result;
  }, [allDramaData, activeFilters]);

  if (playerState) return (
    <CustomPlayerPage 
      book={playerState.book} initialEp={playerState.ep} 
      onBack={handlePlayerBack}
      onEpisodeChange={handleEpisodeChange}
      audioSettings={audioSettings}
      setAudioSettings={handleAudioSettingsUpdate}
    />
  );

  return (
    <div className="bg-[#0f172a] h-screen text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <nav className="flex-none h-16 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 flex items-center z-40 px-4 sm:px-8">
        <div className="container mx-auto flex justify-between items-center">
          <button onClick={() => setView('home')} className="flex items-center gap-2 group transition-all active:scale-95">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-blue-600/20">D</div>
            <span className="text-base font-black text-white hidden xs:block tracking-tighter">NontonDracin</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
              {[ {id:'home', icon:Home}, {id:'rank', icon:Trophy}, {id:'filter', icon:Filter} ].map(m => (
                <button key={m.id} onClick={() => setView(m.id)} className={`p-2 rounded-full transition-all ${view === m.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}><m.icon size={16} /></button>
              ))}
            </div>
            <button onClick={() => setSearchModalOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors"><Search size={20} /></button>
            <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
            
            {/* Profil Button Container */}
            <div className="relative">
              <button 
                onClick={() => setProfileOpen(!profileOpen)} 
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
              >
                {user && !user.isAnonymous && user.photoURL ? 
                  <img src={user.photoURL} alt="User" className="w-7 h-7 rounded-full border border-white/20" /> : 
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><UserIcon size={14}/></div>
                }
                <ChevronDown size={14} className={`text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Menu Profil Terpisah */}
              <ProfileDropdown 
                isOpen={profileOpen} 
                onClose={() => setProfileOpen(false)} 
                user={user} 
                setView={setView} 
                handleLogout={handleLogout} 
              />
            </div>
          </div>
        </div>
      </nav>

      {authError && (
        <div className="bg-orange-600/20 border-b border-orange-500/20 px-6 py-2 flex items-center justify-between animate-in slide-in-from-top-full">
           <div className="flex items-center gap-2 text-orange-400 text-[9px] font-bold uppercase tracking-widest"><AlertCircle size={14}/> {authError}</div>
           <button onClick={() => setAuthError(null)} className="text-orange-400/50 hover:text-orange-400"><X size={14}/></button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pt-6 pb-20 px-4 sm:px-8 no-scrollbar">
        <div className="container mx-auto max-w-7xl text-left">
          {view === 'home' && (
            <div className="animate-in fade-in duration-700">
               {homeData.popular[0] && (
                 <div className="mb-10 relative rounded-[2rem] overflow-hidden min-h-[350px] flex items-center bg-slate-900 border border-white/5 shadow-2xl">
                   <div className="absolute inset-0">
                     <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover opacity-30 blur-sm scale-105" alt="" />
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent"></div>
                   </div>
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 p-10 sm:p-14 w-full">
                     <div className="hidden lg:block w-[200px] shrink-0 transform -rotate-2 hover:rotate-0 transition-all duration-500">
                       <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 cursor-pointer" onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }}>
                         <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover" alt="" />
                       </div>
                     </div>
                     <div className="flex-1 text-center md:text-left">
                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[8px] font-black rounded-full mb-5 uppercase tracking-widest"><Flame size={12} fill="white" /> Rekomendasi Hari Ini</div>
                       <h1 className="text-3xl sm:text-6xl font-black text-white mb-6 leading-tight tracking-tighter">{homeData.popular[0].bookName || homeData.popular[0].title}</h1>
                       <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                        <button onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }} className="bg-white text-black hover:bg-blue-600 hover:text-white px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl flex items-center gap-2">MULAI TONTON <Play size={16} fill="currentColor"/></button>
                        <button onClick={() => handleToggleWatchlist(homeData.popular[0])} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all backdrop-blur-md border border-white/10 flex items-center gap-2">
                           {watchlist.some(i => String(i.bookId || i.id) === String(homeData.popular[0].bookId || homeData.popular[0].id)) ? <BookmarkCheck size={18} className="text-blue-400" /> : <Bookmark size={18} />} SIMPAN
                        </button>
                       </div>
                     </div>
                   </div>
                 </div>
               )}
               <Section icon={Flame} title="Drama Populer" onSeeAll={() => { setView('rank'); setRankTab('popular'); }}>
                 <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                   {homeData.popular.slice(1, 7).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                 </div>
               </Section>
               {watchHistory.length > 0 && (
                 <Section icon={History} title="Lanjut Tonton">
                   <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                     {watchHistory.slice(0, 6).map((item, idx) => (
                       <DramaCard key={idx} item={item} isHistory lastEpisode={item.lastEpisode} onRemove={clearHistoryItem} onClick={(it) => { setSelectedBookId(it.bookId); setView('detail'); }} />
                     ))}
                   </div>
                 </Section>
               )}
               <Section icon={Zap} title="Sedang Trending" onSeeAll={() => { setView('rank'); setRankTab('trending'); }}>
                 <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                   {homeData.trending.slice(0, 6).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                 </div>
               </Section>
               <Section icon={Clock} title="Update Terbaru" onSeeAll={() => { setView('rank'); setRankTab('latest'); }}>
                 <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                   {homeData.latest.slice(0, 6).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                 </div>
               </Section>
            </div>
          )}

          {view === 'rank' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex justify-center gap-3 mb-10 overflow-x-auto no-scrollbar py-1">
                 {[ { id: 'popular', label: 'Populer' }, { id: 'trending', label: 'Trending' }, { id: 'latest', label: 'Terbaru' } ].map(t => (
                    <button key={t.id} onClick={() => { setRankTab(t.id); setRankPage(1); }} className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${rankTab === t.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>{t.label}</button>
                 ))}
               </div>
               <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {rankData.map((item, idx) => <DramaCard key={idx} item={item} rank={idx+1} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />)}
               </div>
               <div className="mt-12 flex justify-center">
                  <button onClick={() => setRankPage(p => p + 1)} disabled={loading} className="px-10 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center gap-3 disabled:opacity-50 transition-all">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} MUAT LEBIH BANYAK
                  </button>
               </div>
            </div>
          )}

          {view === 'detail' && (
            <DramaDetailPage 
              bookId={selectedBookId} onBack={() => setView(previousView)} 
              user={user} watchlist={watchlist} history={watchHistory} onToggleWatchlist={handleToggleWatchlist}
              onPlayEpisode={(ep, b, c) => { setPlayerState({ book: b, chapters: c, ep }); updateHistory(b, ep); }} 
            />
          )}

          {view === 'watchlist' && (
            <div className="animate-in fade-in duration-500">
              <Section icon={Bookmark} title="Koleksi Favorit">
                {watchlist.length > 0 ? (
                  <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {watchlist.map((item, idx) => <DramaCard key={idx} item={item} onRemove={() => handleToggleWatchlist(item)} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />)}
                  </div>
                ) : <EmptyState icon={Bookmark} title="Favorit Kosong" message="Ayo simpan drama favorit Anda agar mudah ditemukan kembali." actionText="CARI DRAMA" onAction={() => setView('home')} />}
              </Section>
            </div>
          )}

          {view === 'history' && (
            <div className="animate-in fade-in duration-500">
              <Section icon={History} title="Riwayat Tontonan">
                {watchHistory.length > 0 ? (
                  <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {watchHistory.map((item, idx) => <DramaCard key={idx} item={item} isHistory lastEpisode={item.lastEpisode} onRemove={clearHistoryItem} onClick={(it) => { setSelectedBookId(it.bookId); setView('detail'); }} />)}
                  </div>
                ) : <EmptyState icon={History} title="Riwayat Kosong" message="Anda belum menonton drama apapun baru-baru ini." actionText="MULAI NONTON" onAction={() => setView('home')} />}
              </Section>
            </div>
          )}

          {view === 'search-results' && (
            <div className="animate-in fade-in duration-700">
               <Section title={`Hasil Cari: ${searchQuery}`} icon={Search} onSeeAll={() => setView('home')}>
                 <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                   {searchData.map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('search-results'); setView('detail'); }} />)}
                 </div>
               </Section>
            </div>
          )}
        </div>
      </main>

      {/* Navigasi Mobile Bawah */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex justify-between items-center z-50">
        {[ {id:'home', icon:Home, label:'Home'}, {id:'rank', icon:Trophy, label:'Top'}, {id:'watchlist', icon:Bookmark, label:'Favorit'} ].map(m => (
          <button key={m.id} onClick={() => setView(m.id)} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${view === m.id ? 'text-blue-500' : 'text-slate-500'}`}><m.icon size={20} /><span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span></button>
        ))}
      </div>

      {searchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md" onClick={() => setSearchModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl animate-in slide-in-from-top-8 duration-500">
             <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={24} />
                <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    window.DramaboxCore.searchBooks(CONFIG.API_BASE, 'in', searchQuery, 1, 30).then(res => {
                      setSearchData(res.items || []); setView('search-results'); setSearchModalOpen(false);
                    });
                  }
                }} placeholder="Cari drama favorit..." className="w-full bg-slate-900 border border-white/10 rounded-3xl pl-16 pr-8 py-5 text-lg font-bold text-white outline-none focus:border-blue-600 transition-all shadow-2xl" />
             </div>
          </div>
        </div>
      )}

      {showPromo && <SanPoiPromoModal onClose={closePromo} />}
    </div>
  );
}

/**
 * --- DETAIL PAGE COMPONENT ---
 */
const DramaDetailPage = ({ bookId, onBack, user, watchlist, history, onToggleWatchlist, onPlayEpisode }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!window.DramaboxCore) return;
      try {
        const res = await window.DramaboxCore.loadDetailWithRecommend({ apiBase: CONFIG.API_BASE, localeApi: 'in', bookId, webficBase: 'https://www.webfic.com' });
        setData(res);
      } catch (e) { console.error("Detail error:", e); } finally { setLoading(false); }
    };
    fetch();
  }, [bookId]);

  const isBookmarked = useMemo(() => watchlist.some(i => String(i.bookId || i.id) === String(bookId)), [watchlist, bookId]);
  const lastWatched = useMemo(() => history.find(i => String(i.bookId) === String(bookId))?.lastEpisode, [history, bookId]);

  if (loading) return <div className="flex flex-col items-center justify-center p-20 gap-4"><Loader2 className="animate-spin text-blue-500" size={40} /><p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Memuat Drama...</p></div>;

  return (
    <div className="animate-in fade-in duration-700">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-white transition-colors text-[10px] uppercase tracking-widest mb-8"><ChevronLeft size={18}/> Kembali</button>

      <div className="flex flex-col lg:flex-row gap-10 bg-slate-900/40 rounded-[2.5rem] p-6 sm:p-10 border border-white/5 backdrop-blur-xl shadow-2xl">
        <div className="w-full lg:w-[320px] shrink-0">
          <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <img src={data.book.cover} className="w-full h-full object-cover" alt="" />
            <div className="absolute top-4 left-4 flex gap-2">
               <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg uppercase tracking-wider">{data.book.chapterCount} EPS</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center text-left">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 leading-tight tracking-tighter">{data.book.bookName}</h2>
          
          <div className="flex flex-wrap gap-3 mb-8">
            <button onClick={() => onPlayEpisode(lastWatched || 1, data.book, data.chapters)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2 group active:scale-95">
              <Play size={18} fill="currentColor" /> {lastWatched ? `LANJUT EPS ${lastWatched}` : 'TONTON SEKARANG'}
            </button>
            <button onClick={() => onToggleWatchlist(data.book)} className={`px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border flex items-center gap-2 active:scale-95 ${isBookmarked ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
              {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {isBookmarked ? 'FAVORIT' : 'SIMPAN'}
            </button>
          </div>

          <div className="mb-10">
            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">SINOPSIS</h4>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-slate-400 text-xs leading-relaxed italic line-clamp-4 hover:line-clamp-none transition-all duration-300">
               {cleanIntro(data.book.introduction)}
            </div>
          </div>

          <div>
             <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 text-slate-400">DAFTAR EPISODE</h4>
             <div className="grid grid-cols-4 xs:grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2 max-h-[160px] overflow-y-auto pr-3 no-scrollbar pb-2">
              {data.chapters?.map((ch, i) => {
                const num = ch.num || (ch.index + 1);
                return (
                  <button key={i} onClick={() => onPlayEpisode(num, data.book, data.chapters)} className={`aspect-square rounded-xl text-[10px] font-black flex items-center justify-center transition-all border ${num === lastWatched ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-800 border-white/5 text-slate-500 hover:text-white'}`}>
                    {num}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * --- PREMIUM PLAYER MODULE ---
 */
const CustomPlayerPage = ({ book, initialEp, onBack, onEpisodeChange, audioSettings, setAudioSettings }) => {
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(audioSettings.volume);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const timerRef = useRef(null);
  const lastUrlRef = useRef('');
  const currentEpRef = useRef(initialEp);

  const loadVideo = useCallback(async (ep) => {
    setLoading(true);
    try {
      const res = await fetchWithRetry(() => window.DramaboxCore.loadViaBatch({ 
        apiBase: CONFIG.API_BASE, 
        localeApi: 'in', 
        bookId: book.bookId || book.id, 
        index: ep 
      }));
      const list = res?.data?.chapterList || res?.chapters || [];
      const chapter = list.find(c => String(c.num) === String(ep)) || list[0];
      const url = extractVideoUrlFromChapter(chapter);
      
      if (url && url !== lastUrlRef.current) { 
        lastUrlRef.current = url;
        setVideoUrl(url); 
        currentEpRef.current = ep;
        if (onEpisodeChange) onEpisodeChange(ep); 
      } else {
        setLoading(false);
      }
    } catch (e) { 
      console.error("Player error:", e); 
      if (e.message.includes('500')) onBack();
    }
  }, [book.bookId, book.id, onBack, onEpisodeChange]);

  useEffect(() => { 
    if (currentEp !== currentEpRef.current || !videoUrl) {
      loadVideo(currentEp); 
    }
  }, [currentEp, loadVideo, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const applyInitialSettings = () => {
      if(video) {
        video.playbackRate = audioSettings.playbackRate;
        video.volume = volume;
        setLoading(false);
        video.play().catch(() => {});
      }
    };

    if (videoUrl.includes('.m3u8')) {
      // @ts-ignore
      if (window.Hls && window.Hls.isSupported()) {
        // @ts-ignore
        const hls = new window.Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          backBufferLength: 60
        }); 

        hls.on(window.Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch(data.type) {
              case window.Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
              case window.Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
              default: hls.destroy(); break;
            }
          }
        });

        hls.loadSource(videoUrl); 
        hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, applyInitialSettings); 
        hlsRef.current = hls;
      } else { video.src = videoUrl; video.oncanplay = applyInitialSettings; }
    } else { video.src = videoUrl; video.oncanplay = applyInitialSettings; }
    
    return () => {
       if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [videoUrl]); 

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = audioSettings.playbackRate;
      video.volume = volume;
    }
  }, [audioSettings.playbackRate, volume]);

  const togglePlay = () => isPlaying ? videoRef.current.pause() : videoRef.current.play();

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center group" onMouseMove={() => { setShowControls(true); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setShowControls(false), 3000); }}>
      <div className={`absolute top-0 left-0 right-0 p-6 flex items-center justify-between bg-gradient-to-b from-black/95 to-transparent z-50 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={onBack} className="text-white p-2 rounded-full hover:bg-white/10 transition-all"><ChevronLeft size={24}/></button>
        <div className="text-center flex-1 mx-4">
          <h2 className="text-white text-xs font-black uppercase tracking-widest truncate max-w-[250px]">{book.bookName || book.title}</h2>
          <p className="text-blue-500 text-[9px] font-black uppercase tracking-[0.2em]">Episode {currentEp}</p>
        </div>
        <button className="text-white p-2 transition-transform active:scale-90"><Share2 size={20}/></button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center" onClick={togglePlay}>
        <video ref={videoRef} className="w-full h-full object-contain cursor-pointer" playsInline 
          onPlay={() => setIsPlaying(true)} 
          onPause={() => setIsPlaying(false)} 
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)} 
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} 
          onEnded={() => audioSettings.autoNext && setCurrentEp(e => e + 1)} 
          onWaiting={() => setLoading(true)} 
          onPlaying={() => setLoading(false)} 
        />
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}
        {!isPlaying && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="p-8 rounded-full bg-blue-600/20 backdrop-blur-xl border border-blue-500/30 shadow-2xl animate-in zoom-in duration-300"><Play size={48} fill="white" className="text-white ml-2"/></div>
          </div>
        )}
      </div>

      <div className={`absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-50 transition-all duration-500 ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <div className="flex flex-col gap-2">
             <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={(e) => {
               if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
             }} className="w-full accent-blue-600 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer hover:scale-y-125 transition-all" />
             <div className="flex justify-between text-[10px] font-mono font-bold text-white/40 tracking-tighter"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <button disabled={currentEp <= 1} onClick={() => setCurrentEp(e => e - 1)} className="text-white/40 hover:text-white transition-colors disabled:opacity-10"><SkipBack size={28} fill="currentColor"/></button>
              <button onClick={togglePlay} className="text-white transform active:scale-90 transition-transform">{isPlaying ? <Pause size={42} fill="white" /> : <Play size={42} fill="white" />}</button>
              <button onClick={() => setCurrentEp(e => e + 1)} className="text-white/40 hover:text-white transition-colors"><SkipForward size={28} fill="currentColor"/></button>
            </div>
            <div className="flex items-center gap-6">
               <div className="hidden sm:flex items-center gap-3 group/vol bg-white/5 p-2 rounded-xl border border-white/5 transition-all hover:bg-white/10">
                  <button onClick={() => setVolume(v => v === 0 ? 1 : 0)} className="text-white/70 hover:text-white transition-colors">{volume === 0 ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
                  <div className="w-0 group-hover/vol:w-24 overflow-hidden transition-all duration-300 flex items-center"><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-24 accent-white h-1 rounded-full appearance-none cursor-pointer" /></div>
               </div>
               <button onClick={() => {
                 const rates = [1, 1.25, 1.5, 2];
                 const currentIdx = rates.indexOf(audioSettings.playbackRate);
                 const nextRate = rates[(currentIdx + 1) % rates.length];
                 setAudioSettings(prev => ({...prev, playbackRate: nextRate}));
               }} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] tracking-widest shadow-xl shadow-blue-600/30 active:scale-95 transition-all">
                 {audioSettings.playbackRate}X SPEED
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
