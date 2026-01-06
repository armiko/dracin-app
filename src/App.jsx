import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, X, Search, Home, Clock, Flame, 
  ChevronRight, SkipBack, SkipForward, AlertTriangle, 
  Loader2, Trophy, Star, Filter, Plus,
  Pause, Volume2, VolumeX, Share2, ChevronLeft,
  Volume1, Gamepad2, CheckCircle2, ExternalLink,
  LogOut, LogIn, User as UserIcon, AlertCircle,
  Bookmark, BookmarkCheck, History, Trash2, 
  ChevronDown
} from 'lucide-react';

/**
 * --- KONFIGURASI PROYEK ---
 */
const CONFIG = {
  SCRIPT_URL: "https://cdn.jsdelivr.net/gh/armiko/dracin-app@169efe4fc99586d445cbf8780629c5ac210ca929/js/dramabox-core.js",
  HLS_URL: "https://cdn.jsdelivr.net/npm/hls.js@latest",
  API_BASE: "https://drachin.dicky.app",
  LOCALE_API: "in",
  FEED_IDS: { POPULAR: 1, LATEST: 2, TRENDING: 3 },
  PER_PAGE: 24,
  // Menggunakan Firebase Compat SDK melalui CDN untuk menghindari kesalahan resolusi Rollup/Vite
  FIREBASE_SCRIPTS: [
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"
  ]
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

const STATIC_FILTERS = [
  {
    title: "Tipe Suara",
    key: "voice",
    options: [
      { display: "Semua", value: "" },
      { display: "Sulih Suara", value: "1" },
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
      { display: "Kekuatan Khusus", value: "keluarga khusus" }
    ]
  }
];

/**
 * --- UTILS ---
 */
const useExternalScript = (urls) => {
  const [state, setState] = useState({ loaded: false, error: false });

  useEffect(() => {
    const scripts = Array.isArray(urls) ? urls : [urls];
    let loadedCount = 0;

    const onScriptLoad = () => {
      loadedCount++;
      if (loadedCount === scripts.length) {
        setState({ loaded: true, error: false });
      }
    };

    const onScriptError = () => setState({ loaded: true, error: true });

    scripts.forEach(url => {
      let script = document.querySelector(`script[src="${url}"]`);
      if (!script) {
        script = document.createElement("script");
        script.src = url;
        script.async = false; // Memastikan urutan pemuatan untuk Firebase
        document.body.appendChild(script);
      }
      
      // Jika sudah ada dan sudah dimuat sebelumnya
      if (script.getAttribute('data-loaded') === 'true') {
        onScriptLoad();
      } else {
        script.addEventListener("load", () => {
          script.setAttribute('data-loaded', 'true');
          onScriptLoad();
        });
        script.addEventListener("error", onScriptError);
      }
    });
  }, [urls]);

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
 * --- KOMPONEN UI SHARED ---
 */

const Section = ({ title, icon: IconComponent, onSeeAll, children }) => (
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
);

const DramaCard = ({ item, onClick, rank, onRemove, isHistory, lastEpisode }) => {
  const title = item.bookName || item.title || 'Drama';
  const cover = item.coverWap || item.cover || item.coverUrl || 'https://via.placeholder.com/300x450';
  const bid = item.bookId || item.id;

  return (
    <div className="group relative">
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
            {isHistory ? `EP ${lastEpisode}` : `${item.chapterCount || '?'} EPS`}
          </div>
        </div>
        <h3 className="text-[10px] font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors px-0.5">{title}</h3>
      </div>
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(bid); }}
          className="absolute -top-2 -right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};

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
 * --- MAIN APP ---
 */
export default function App() {
  const [view, setView] = useState('home');
  const [previousView, setPreviousView] = useState('home');
  const [user, setUser] = useState(null);
  const [fbReady, setFbReady] = useState(false);
  
  // Data States
  const [homeData, setHomeData] = useState({ popular: [], latest: [] });
  const [allDramaData, setAllDramaData] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [watchHistory, setWatchHistory] = useState([]);
  
  // UI States
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankTab, setRankTab] = useState('popular');
  const [activeFilters, setActiveFilters] = useState({ voice: '', category: '', sort: 'popular' });
  const [playerState, setPlayerState] = useState(null);
  const [authError, setAuthError] = useState(null);

  // Memuat Script Eksternal
  const { loaded: scriptLoaded } = useExternalScript(CONFIG.SCRIPT_URL);
  const { loaded: firebaseLoaded } = useExternalScript(CONFIG.FIREBASE_SCRIPTS);

  const [audioSettings, setAudioSettings] = useState(() => {
    const saved = localStorage.getItem('dracin_settings_global');
    return saved ? JSON.parse(saved) : { volume: 1, isMuted: false, playbackRate: 1, autoNext: true };
  });

  // App ID unik untuk Firestore
  const appId = typeof __app_id !== 'undefined' ? __app_id : '3KNDH1p5iIG6U7FmuGTS';

  /**
   * --- FIREBASE INITIALIZATION ---
   */
  useEffect(() => {
    if (!firebaseLoaded || !window.firebase) return;

    const firebase = window.firebase;
    const config = typeof __firebase_config !== 'undefined' 
      ? JSON.parse(__firebase_config) 
      : defaultFirebaseConfig;

    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }

    const auth = firebase.auth();
    
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await auth.signInWithCustomToken(__initial_auth_token);
        } else {
          if (!auth.currentUser) await auth.signInAnonymously();
        }
        setFbReady(true);
      } catch (err) {
        console.error("Autentikasi Firebase gagal:", err);
      }
    };

    initAuth();
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, [firebaseLoaded]);

  /**
   * --- FIRESTORE SYNC ---
   */
  useEffect(() => {
    if (!fbReady || !user || !window.firebase) return;

    const db = window.firebase.firestore();
    
    // Path: /artifacts/{appId}/users/{userId}/{collectionName}
    const watchlistRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('watchlist');
    const historyRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('history');

    const unsubWatchlist = watchlistRef.onSnapshot((snap) => {
      const data = snap.docs.map(doc => doc.data()).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setWatchlist(data);
    }, (err) => console.error("Sinkronisasi Favorit gagal:", err));

    const unsubHistory = historyRef.onSnapshot((snap) => {
      const data = snap.docs.map(doc => doc.data()).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setWatchHistory(data.slice(0, 20));
    }, (err) => console.error("Sinkronisasi Riwayat gagal:", err));

    return () => {
      unsubWatchlist();
      unsubHistory();
    };
  }, [fbReady, user, appId]);

  /**
   * --- CORE ACTIONS ---
   */
  const handleLogin = async () => {
    if (!window.firebase) return;
    setAuthError(null);
    try {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      await window.firebase.auth().signInWithPopup(provider);
      setProfileOpen(false);
    } catch (e) {
      setAuthError("Gagal masuk. Silakan coba kembali.");
    }
  };

  const handleLogout = () => window.firebase.auth().signOut().then(() => { setView('home'); setProfileOpen(false); });

  const fetchHome = useCallback(async () => {
    if (!window.DramaboxCore) return;
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenRes = await core.getToken(CONFIG.API_BASE, 'in', device, false);
      const [pop, lat] = await Promise.all([
        core.doClassify(CONFIG.API_BASE, 'in', device, tokenRes.token, CONFIG.FEED_IDS.POPULAR, 18),
        core.doClassify(CONFIG.API_BASE, 'in', device, tokenRes.token, CONFIG.FEED_IDS.LATEST, 12)
      ]);
      setHomeData({ popular: pop || [], latest: lat || [] });
      setAllDramaData([...(pop || []), ...(lat || [])].filter((v, i, a) => a.findIndex(t => (t.bookId || t.id) === (v.bookId || v.id)) === i));
    } catch (e) { console.error("Fetch home error:", e); }
  }, []);

  const handleToggleWatchlist = async (book) => {
    if (!fbReady || !user || user.isAnonymous) {
      setAuthError("Silakan masuk dengan Google untuk menyimpan drama.");
      return;
    }
    const bid = String(book.bookId || book.id);
    const db = window.firebase.firestore();
    const docRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('watchlist').doc(bid);
    
    if (watchlist.some(i => String(i.bookId || i.id) === bid)) {
      await docRef.delete();
    } else {
      await docRef.set({ 
        ...book, 
        bookId: bid, 
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp() 
      });
    }
  };

  const updateHistory = async (book, episode) => {
    if (!fbReady || !user || user.isAnonymous) return;
    const bid = String(book.bookId || book.id);
    const db = window.firebase.firestore();
    const docRef = db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('history').doc(bid);
    await docRef.set({
      bookId: bid,
      bookName: book.bookName || book.title,
      cover: book.cover || book.coverWap,
      lastEpisode: episode,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  const clearHistoryItem = async (bid) => {
    if (!fbReady || !user) return;
    const db = window.firebase.firestore();
    await db.collection('artifacts').doc(appId).collection('users').doc(user.uid).collection('history').doc(String(bid)).delete();
  };

  useEffect(() => { if (scriptLoaded) fetchHome(); }, [scriptLoaded, fetchHome]);

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

  /**
   * --- NAVIGATION & COMPONENTS ---
   */

  const ProfileMenu = () => (
    <div className="relative">
      <button 
        onClick={() => setProfileOpen(!profileOpen)}
        className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
      >
        {user && !user.isAnonymous ? (
          <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full shadow-lg border border-white/20" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"><UserIcon size={14}/></div>
        )}
        <ChevronDown size={14} className={`text-slate-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
      </button>

      {profileOpen && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setProfileOpen(false)}></div>
          <div className="absolute right-0 mt-3 w-64 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[101] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {user && !user.isAnonymous ? (
              <div className="p-5 border-b border-white/5 bg-gradient-to-br from-blue-600/10 to-transparent">
                <p className="text-white font-black text-xs truncate mb-0.5">{user.displayName}</p>
                <p className="text-slate-500 text-[10px] font-bold truncate uppercase tracking-widest">{user.email}</p>
              </div>
            ) : (
              <div className="p-5 border-b border-white/5 text-center">
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Fitur Terbatas</p>
                <button onClick={handleLogin} className="w-full py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">Masuk Akun</button>
              </div>
            )}
            
            <div className="p-2">
              <button onClick={() => { setView('watchlist'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <Bookmark size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest">Favorit Saya</span>
              </button>
              <button onClick={() => { setView('history'); setProfileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <History size={16} className="text-slate-500 group-hover:text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-widest">Sudah Ditonton</span>
              </button>
              <div className="my-2 h-[1px] bg-white/5 mx-2"></div>
              {user && !user.isAnonymous && (
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors text-left group">
                  <LogOut size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Logout</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (playerState) return (
    <CustomPlayerPage 
      book={playerState.book} 
      initialEp={playerState.ep} 
      onBack={() => { setPlayerState(null); setView('detail'); }}
      onEpisodeChange={(ep) => updateHistory(playerState.book, ep)}
      audioSettings={audioSettings}
      setAudioSettings={(s) => { setAudioSettings(s); localStorage.setItem('dracin_settings_global', JSON.stringify(s)); }}
    />
  );

  return (
    <div className="bg-[#0f172a] h-screen text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-blue-600 selection:text-white">
      <nav className="flex-none h-16 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 flex items-center z-40 px-4 sm:px-8">
        <div className="container mx-auto flex justify-between items-center">
          <button onClick={() => setView('home')} className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-blue-600/20">D</div>
            <span className="text-base font-black text-white hidden xs:block tracking-tighter">NontonDracin</span>
          </button>
          
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
              {[ {id:'home', icon:Home}, {id:'rank', icon:Trophy}, {id:'filter', icon:Filter} ].map(m => (
                <button key={m.id} onClick={() => setView(m.id)} className={`p-2 rounded-full transition-all ${view === m.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  <m.icon size={16} />
                </button>
              ))}
            </div>
            
            <button onClick={() => setSearchModalOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors"><Search size={20} /></button>
            <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
            <ProfileMenu />
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
        <div className="container mx-auto max-w-7xl">
          {view === 'home' && (
            <div className="animate-in fade-in duration-700">
               {homeData.popular[0] && (
                 <div className="mb-10 relative rounded-[2rem] overflow-hidden min-h-[350px] flex items-center bg-slate-900 border border-white/5 shadow-2xl">
                   <div className="absolute inset-0">
                     <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover opacity-30 blur-sm scale-105" />
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/60 to-transparent"></div>
                   </div>
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 p-10 sm:p-14 w-full">
                     <div className="hidden lg:block w-[200px] shrink-0 transform -rotate-2 hover:rotate-0 transition-all duration-500">
                       <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 cursor-pointer" onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }}>
                         <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover" />
                       </div>
                     </div>
                     <div className="flex-1 text-center md:text-left">
                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[8px] font-black rounded-full mb-5 uppercase tracking-widest"><Flame size={12} fill="white" /> Populer</div>
                       <h1 className="text-3xl sm:text-6xl font-black text-white mb-6 leading-tight tracking-tighter">{homeData.popular[0].bookName || homeData.popular[0].title}</h1>
                       <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                        <button onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }} className="bg-white text-black hover:bg-blue-600 hover:text-white px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl flex items-center gap-2 shadow-white/10">LIHAT DETAIL <Play size={16} fill="currentColor"/></button>
                        <button onClick={() => handleToggleWatchlist(homeData.popular[0])} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all backdrop-blur-md border border-white/10 flex items-center gap-2">
                           {watchlist.some(i => String(i.bookId || i.id) === String(homeData.popular[0].bookId || homeData.popular[0].id)) ? <BookmarkCheck size={18} className="text-blue-400" /> : <Bookmark size={18} />} SIMPAN
                        </button>
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               <Section icon={Flame} title="Drama Populer" onSeeAll={() => setView('rank')}>
                 <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                   {homeData.popular.slice(1, 7).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                 </div>
               </Section>

               {watchHistory.length > 0 && (
                 <Section icon={History} title="Lanjut Tonton">
                   <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                     {watchHistory.slice(0, 6).map((item, idx) => (
                       <DramaCard 
                         key={idx} 
                         item={item} 
                         isHistory 
                         lastEpisode={item.lastEpisode}
                         onRemove={clearHistoryItem}
                         onClick={(it) => { setSelectedBookId(it.bookId); setView('detail'); }} 
                       />
                     ))}
                   </div>
                 </Section>
               )}

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
                 {[ { id: 'popular', label: 'Populer' }, { id: 'latest', label: 'Terbaru' } ].map(t => (
                    <button key={t.id} onClick={() => setRankTab(t.id)} className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${rankTab === t.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>{t.label}</button>
                 ))}
               </div>
               <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {(rankTab === 'popular' ? homeData.popular : homeData.latest).map((item, idx) => <DramaCard key={idx} item={item} rank={idx+1} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />)}
               </div>
            </div>
          )}

          {view === 'filter' && (
            <div className="animate-in fade-in duration-500">
               <div className="bg-slate-900/50 p-8 rounded-3xl border border-white/5 mb-10 grid grid-cols-1 md:grid-cols-2 gap-8 backdrop-blur-sm">
                  {STATIC_FILTERS.map(f => (
                    <div key={f.key}>
                      <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1 h-1 bg-blue-500 rounded-full"></div> {f.title}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {f.options.map(o => (
                          <button key={o.value} onClick={() => setActiveFilters(p => ({...p, [f.key]: p[f.key] === o.value ? '' : o.value}))} className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all ${activeFilters[f.key] === o.value ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'}`}>{o.display}</button>
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
               <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {filteredItems.map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />)}
               </div>
               {filteredItems.length === 0 && <EmptyState icon={Filter} title="Hasil Kosong" message="Ubah filter pencarian Anda." />}
            </div>
          )}

          {view === 'watchlist' && (
            <div className="animate-in fade-in duration-500">
              <Section icon={Bookmark} title="Koleksi Favorit">
                {watchlist.length > 0 ? (
                  <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {watchlist.map((item, idx) => (
                      <DramaCard key={idx} item={item} onRemove={() => handleToggleWatchlist(item)} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setView('detail'); }} />
                    ))}
                  </div>
                ) : (
                  <EmptyState 
                    icon={Bookmark} 
                    title="Favorit Kosong" 
                    message="Simpan drama favorit Anda agar mudah ditemukan kembali."
                    actionText="JELAJAHI DRAMA"
                    onAction={() => setView('home')}
                  />
                )}
              </Section>
            </div>
          )}

          {view === 'history' && (
            <div className="animate-in fade-in duration-500">
              <Section icon={History} title="Riwayat Tontonan">
                {watchHistory.length > 0 ? (
                  <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {watchHistory.map((item, idx) => (
                      <DramaCard 
                        key={idx} 
                        item={item} 
                        isHistory 
                        lastEpisode={item.lastEpisode}
                        onRemove={clearHistoryItem}
                        onClick={(it) => { setSelectedBookId(it.bookId); setView('detail'); }} 
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState 
                    icon={History} 
                    title="Riwayat Kosong" 
                    message="Anda belum menonton drama apapun baru-baru ini."
                    actionText="MULAI NONTON"
                    onAction={() => setView('home')}
                  />
                )}
              </Section>
            </div>
          )}

          {view === 'detail' && (
            <DramaDetailPage 
              bookId={selectedBookId} 
              onBack={() => setView(previousView)} 
              user={user}
              watchlist={watchlist}
              history={watchHistory}
              onToggleWatchlist={handleToggleWatchlist}
              onPlayEpisode={(ep, b, c) => { setPlayerState({ book: b, chapters: c, ep }); updateHistory(b, ep); }} 
            />
          )}
        </div>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-xl border-t border-white/5 px-6 py-4 flex justify-between items-center z-50">
        {[ {id:'home', icon:Home, label:'Home'}, {id:'rank', icon:Trophy, label:'Ranking'}, {id:'filter', icon:Filter, label:'Filter'}, {id:'watchlist', icon:Bookmark, label:'Favorit'} ].map(m => (
          <button key={m.id} onClick={() => setView(m.id)} className={`flex flex-col items-center gap-1 ${view === m.id ? 'text-blue-500' : 'text-slate-500'}`}>
            <m.icon size={20} />
            <span className="text-[8px] font-black uppercase tracking-widest">{m.label}</span>
          </button>
        ))}
      </div>

      {searchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4">
          <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md animate-in fade-in" onClick={() => setSearchModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl animate-in slide-in-from-top-8">
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
    </div>
  );
}

/**
 * --- DETAIL MODULE ---
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

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="animate-spin text-blue-500" size={40} />
      <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Menyinkronkan...</p>
    </div>
  );

  if (!data?.book) return <EmptyState icon={AlertTriangle} title="Data Tidak Ditemukan" message="Drama ini mungkin sudah dihapus." actionText="KEMBALI" onAction={onBack} />;

  return (
    <div className="animate-in fade-in duration-700">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold hover:text-white transition-colors text-[10px] uppercase tracking-widest mb-8"><ChevronLeft size={18}/> Kembali</button>

      <div className="flex flex-col lg:flex-row gap-10 bg-slate-900/40 rounded-[2.5rem] p-6 sm:p-10 border border-white/5 backdrop-blur-xl shadow-2xl">
        <div className="w-full lg:w-[320px] shrink-0">
          <div className="relative aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            <img src={data.book.cover} className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 flex gap-2">
               <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg uppercase tracking-wider">{data.book.chapterCount} EPS</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 leading-tight tracking-tighter">{data.book.bookName}</h2>
          
          <div className="flex flex-wrap gap-3 mb-8">
            <button onClick={() => onPlayEpisode(lastWatched || 1, data.book, data.chapters)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2">
              <Play size={18} fill="currentColor" /> {lastWatched ? `LANJUT EPS ${lastWatched}` : 'TONTON SEKARANG'}
            </button>
            <button onClick={() => onToggleWatchlist(data.book)} className={`px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border flex items-center gap-2 ${isBookmarked ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}>
              {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />} {isBookmarked ? 'DISIMPAN' : 'SIMPAN'}
            </button>
          </div>

          <div className="mb-10">
            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">SINOPSIS</h4>
            <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-slate-400 text-xs leading-relaxed italic line-clamp-4 hover:line-clamp-none transition-all duration-300">
               {cleanIntro(data.book.introduction)}
            </div>
          </div>

          <div>
             <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">DAFTAR EPISODE</h4>
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
 * --- PLAYER MODULE ---
 */
const CustomPlayerPage = ({ book, initialEp, onBack, onEpisodeChange, audioSettings, setAudioSettings }) => {
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const timerRef = useRef(null);

  const loadVideo = useCallback(async (ep) => {
    setLoading(true);
    try {
      const res = await window.DramaboxCore.loadViaBatch({ apiBase: CONFIG.API_BASE, localeApi: 'in', bookId: book.bookId || book.id, index: ep });
      const list = res?.data?.chapterList || res?.chapters || [];
      const chapter = list.find(c => String(c.num) === String(ep)) || list[0];
      const url = extractVideoUrlFromChapter(chapter);
      if (url) { 
        setVideoUrl(url); 
        if (onEpisodeChange) onEpisodeChange(ep); 
      }
    } catch (e) { console.error("Player error:", e); } finally { setLoading(false); }
  }, [book, onEpisodeChange]);

  useEffect(() => { loadVideo(currentEp); }, [currentEp, loadVideo]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    if (hlsRef.current) hlsRef.current.destroy();

    const startPlay = () => { if(video) { video.playbackRate = audioSettings.playbackRate; video.play().catch(() => {}); } };
    if (videoUrl.includes('.m3u8')) {
      if (window.Hls) {
        const hls = new window.Hls(); hls.loadSource(videoUrl); hls.attachMedia(video);
        hls.on(window.Hls.Events.MANIFEST_PARSED, startPlay); hlsRef.current = hls;
      } else {
        video.src = videoUrl; video.oncanplay = startPlay;
      }
    } else { video.src = videoUrl; video.oncanplay = startPlay; }
  }, [videoUrl, audioSettings.playbackRate]);

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center" onMouseMove={() => { setShowControls(true); clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setShowControls(false), 3000); }}>
      <div className={`absolute top-0 left-0 right-0 p-6 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent z-50 transition-opacity ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={onBack} className="text-white p-2 rounded-full hover:bg-white/10"><ChevronLeft size={24}/></button>
        <div className="text-center">
          <h2 className="text-white text-xs font-black uppercase tracking-widest truncate max-w-[200px]">{book.bookName || book.title}</h2>
          <p className="text-blue-500 text-[9px] font-black uppercase tracking-[0.2em]">Episode {currentEp}</p>
        </div>
        <div className="w-10"></div>
      </div>
      <video ref={videoRef} className="w-full h-full object-contain" playsInline onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} />
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="animate-spin text-blue-500" size={48} /></div>}
      <div className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-50 transition-all ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={(e) => videoRef.current.currentTime = parseFloat(e.target.value)} className="w-full accent-blue-600 h-1" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button disabled={currentEp <= 1} onClick={() => setCurrentEp(e => e - 1)} className="text-white/40 hover:text-white"><SkipBack size={24}/></button>
              <button onClick={() => isPlaying ? videoRef.current.pause() : videoRef.current.play()} className="text-white">{isPlaying ? <Pause size={32} /> : <Play size={32} />}</button>
              <button onClick={() => setCurrentEp(e => e + 1)} className="text-white/40 hover:text-white"><SkipForward size={24}/></button>
            </div>
            <button onClick={() => setAudioSettings({...audioSettings, playbackRate: audioSettings.playbackRate >= 2 ? 1 : audioSettings.playbackRate + 0.5})} className="px-3 py-1 bg-white/10 text-white rounded-lg text-[10px] font-black">{audioSettings.playbackRate}X SPEED</button>
          </div>
        </div>
      </div>
    </div>
  );
};
