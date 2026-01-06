import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, X, Search, Home, Clock, Flame, 
  ChevronRight, SkipBack, SkipForward, AlertTriangle, 
  Loader2, Trophy, Star, Filter, Plus,
  Pause, Volume2, VolumeX, Share2, ChevronLeft,
  Volume1, Gamepad2, CheckCircle2, ExternalLink
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection } from 'firebase/firestore';

/**
 * --- KONFIGURASI ---
 */
const CONFIG = {
  SCRIPT_URL: "https://cdn.jsdelivr.net/gh/armiko/dracin-app@169efe4fc99586d445cbf8780629c5ac210ca929/js/dramabox-core.js",
  HLS_URL: "https://cdn.jsdelivr.net/npm/hls.js@latest",
  API_BASE: "https://drachin.dicky.app",
  LOCALE_API: "in",
  FEED_IDS: { POPULAR: 1, LATEST: 2, TRENDING: 3 },
  PER_PAGE: 24
};

// Firebase Setup
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'nontondracin-compact';

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
      { display: "Kekuatan Khusus", value: "kekuatan khusus" },
      { display: "Sejarah", value: "sejarah" },
      { display: "Takdir Cinta", value: "takdir cinta" }
    ]
  },
  {
    title: "Urutkan",
    key: "sort",
    options: [
      { display: "Terpopuler", value: "popular" },
      { display: "Terbaru", value: "latest" }
    ]
  }
];

/**
 * --- UTILS ---
 */
const useExternalScript = (url) => {
  const [state, setState] = useState({ loaded: false, error: false });
  useEffect(() => {
    let script = document.querySelector(`script[src="${url}"]`);
    const handleLoad = () => setState({ loaded: true, error: false });
    const handleError = () => setState({ loaded: false, error: true });
    if (!script) {
      script = document.createElement("script");
      script.src = url; script.async = true;
      document.body.appendChild(script);
    } else if (window.DramaboxCore || window.Hls) {
      handleLoad(); return;
    }
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [url]);
  return state;
};

const cleanIntro = (h) => h ? String(h).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim() : '';

const extractVideoUrl = (c) => {
  if (!c) return '';
  let s = c.raw || c;
  if (s.m3u8Url) return s.m3u8Url;
  if (s.mp4) return s.mp4;
  const cdn = s.cdnList?.[0];
  if (cdn) {
    const v = cdn.videoPathList?.[0];
    const path = v?.videoPath || v?.path || '';
    if (path && !path.startsWith('http')) return (cdn.cdnDomain.startsWith('http') ? cdn.cdnDomain : 'https://'+cdn.cdnDomain).replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
    return path;
  }
  return '';
};

// Helper format waktu (detik -> mm:ss)
const formatTime = (seconds) => {
  if (isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * --- UI COMPONENTS ---
 */

const SanPoiPopup = ({ onClose }) => {
  const [dontShowToday, setDontShowToday] = useState(false);
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md" onClick={() => onClose(dontShowToday)}></div>
      <div className="relative w-full max-w-[300px] bg-slate-900 border border-white/10 rounded-[1.2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 flex flex-col items-center">
          <button onClick={() => onClose(dontShowToday)} className="absolute top-2.5 right-2.5 p-1 bg-black/20 hover:bg-black/40 rounded-full text-white/80 transition-colors"><X size={14}/></button>
          <div className="w-12 h-12 bg-white rounded-[0.8rem] flex items-center justify-center shadow-xl mb-2 transform rotate-3">
            <Gamepad2 size={24} className="text-blue-600" />
          </div>
          <h2 className="text-base font-black text-white tracking-tight">SanPoi Store</h2>
          <p className="text-blue-100 text-[8px] font-bold uppercase tracking-[0.2em]">Top Up Termurah</p>
        </div>
        <div className="p-4">
          <div className="space-y-1.5 mb-4">
            {["Termurah se-Indonesia", "Proses Cepat", "100% Aman"].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-300 text-[10px] font-semibold bg-white/5 p-2 rounded-lg border border-white/5">
                <CheckCircle2 size={12} className="text-blue-400" /> {t}
              </div>
            ))}
          </div>
          <a href="https://sanpoi.com" target="_blank" rel="noopener noreferrer" className="block w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-black text-[10px] text-center shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 uppercase">TOP UP SEKARANG <ExternalLink size={12}/></a>
          <label className="mt-3 flex items-center justify-center gap-1.5 cursor-pointer group">
            <input type="checkbox" checked={dontShowToday} onChange={(e) => setDontShowToday(e.target.checked)} className="w-3 h-3 rounded border-white/20 bg-transparent text-blue-600 focus:ring-0" />
            <span className="text-[8px] font-bold text-slate-500 group-hover:text-slate-300 uppercase tracking-wider">Jangan tampilkan hari ini</span>
          </label>
        </div>
      </div>
    </div>
  );
};

const DramaCard = ({ item, onClick, rank }) => {
  const title = item.bookName || item.title || 'Drama';
  const cover = item.coverWap || item.coverUrl || item.cover || 'https://via.placeholder.com/300x450';
  return (
    <div className="group cursor-pointer" onClick={() => onClick(item)}>
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 shadow-md mb-2 border border-white/5">
        <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-white/20 backdrop-blur-md p-3 rounded-full border border-white/30 transform translate-y-3 group-hover:translate-y-0 transition-transform duration-500">
            <Play size={18} fill="white" className="text-white" />
          </div>
        </div>
        {rank && <div className="absolute top-0 left-0 bg-blue-600 text-white font-black text-[9px] px-2 py-0.5 rounded-br-lg shadow-lg">#{rank}</div>}
        <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-md text-white text-[7px] font-black px-1.5 py-0.5 rounded border border-white/10 uppercase">{item.chapterCount || '?'} EPS</div>
      </div>
      <h3 className="text-[10px] font-bold text-slate-200 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors px-0.5">{title}</h3>
    </div>
  );
};

const DramaDetailPage = ({ bookId, onBack, onPlayEpisode }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    const fetch = async () => {
      const res = await window.DramaboxCore.loadDetailWithRecommend({ apiBase: CONFIG.API_BASE, localeApi: 'in', bookId, webficBase: 'https://www.webfic.com' });
      setData(res);
    };
    if (window.DramaboxCore) fetch();
  }, [bookId]);

  if (!data) return <div className="flex flex-col items-center justify-center p-12 gap-3"><Loader2 className="animate-spin text-blue-500" size={32} /><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sinkronisasi Data...</p></div>;

  return (
    <div className="animate-in fade-in duration-500">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 font-bold mb-6 hover:text-white transition-colors text-[10px]"><ChevronLeft size={16}/> KEMBALI</button>
      <div className="bg-slate-900/60 rounded-[1.5rem] overflow-hidden border border-white/5 flex flex-col md:flex-row shadow-2xl backdrop-blur-sm">
        <div className="w-full md:w-[280px] shrink-0"><img src={data.book?.cover} className="w-full h-full object-cover" alt="Cover" /></div>
        <div className="p-6 sm:p-10 flex-1">
          <div className="flex items-center gap-2 mb-3">
             <span className="bg-blue-600/20 text-blue-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider">{data.book?.chapterCount} EPISODE</span>
             <div className="flex items-center gap-1 text-yellow-500 font-bold text-[10px]"><Star size={12} fill="currentColor"/> {data.book?.score || 9.8}</div>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-white mb-4 leading-tight tracking-tight">{data.book?.bookName}</h2>
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 mb-6">
            <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Sinopsis</h4>
            <p className="text-slate-300 text-xs leading-relaxed italic">{cleanIntro(data.book?.introduction)}</p>
          </div>
          <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">Pilih Episode</h4>
          <div className="grid grid-cols-5 xs:grid-cols-8 sm:grid-cols-10 lg:grid-cols-12 gap-1.5 max-h-[200px] overflow-y-auto pr-2 no-scrollbar">
            {data.chapters?.map((ch, i) => (
              <button key={i} onClick={() => onPlayEpisode(ch.num || (i+1), data.book, data.chapters)} className="bg-slate-800 hover:bg-blue-600 text-white font-bold py-2 rounded-lg transition-all active:scale-95 text-[10px] border border-white/5">{ch.num || (i+1)}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomPlayerPage = ({ book, chapters, initialEp, onBack, audioSettings, setAudioSettings }) => {
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const requestRef = useRef(0);

  const loadEpisode = useCallback(async (epNum) => {
    setLoading(true); setError(false); setVideoUrl(''); setIsPlaying(false);
    const requestId = ++requestRef.current;
    try {
      const core = window.DramaboxCore;
      const res = await core.loadViaBatch({ apiBase: CONFIG.API_BASE, localeApi: 'in', bookId: book.bookId || book.id, index: epNum });
      if (requestId !== requestRef.current) return;
      const list = res.data?.chapterList || res.chapters || [];
      const batchCh = list.find(item => String(item.num) === String(epNum) || item.index === (epNum - 1)) || list[0];
      const url = extractVideoUrl(batchCh);
      if (url) setVideoUrl(url); else throw new Error();
    } catch (e) { if (requestId === requestRef.current) setError(true); } finally { if (requestId === requestRef.current) setLoading(false); }
  }, [book]);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    const video = videoRef.current;
    if (hlsRef.current) hlsRef.current.destroy();
    if (videoUrl.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls(); hls.loadSource(videoUrl); hls.attachMedia(video);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hlsRef.current = hls;
    } else { video.src = videoUrl; video.play().catch(() => {}); }
    return () => hlsRef.current && hlsRef.current.destroy();
  }, [videoUrl]);

  useEffect(() => { loadEpisode(currentEp); }, [currentEp, loadEpisode]);

  const getVolumeIcon = () => {
    if (audioSettings.isMuted || audioSettings.volume === 0) return <VolumeX size={18} />;
    return audioSettings.volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />;
  };

  const volumeVal = audioSettings.isMuted ? 0 : audioSettings.volume;
  const volumePercent = volumeVal * 100;

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden" onMouseMove={() => { setShowControls(true); setTimeout(() => setShowControls(false), 5000); }}>
      <div className={`absolute top-0 left-0 right-0 p-6 z-50 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={onBack} className="text-white hover:bg-white/10 p-2 rounded-full transition-all"><ChevronLeft size={24} /></button>
        <div className="text-center flex-1 max-w-xl">
          <h2 className="text-white font-black text-sm truncate uppercase tracking-tight">{book.bookName}</h2>
          <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.2em]">Episode {currentEp}</p>
        </div>
        <button className="text-white p-2 rounded-full"><Share2 size={18} /></button>
      </div>

      <div className="relative w-full h-full flex items-center justify-center bg-black" onClick={() => (isPlaying ? videoRef.current.pause() : videoRef.current.play())}>
        {loading ? <Loader2 className="animate-spin text-blue-500" size={48} /> : error ? <div className="text-white text-[10px] font-black bg-red-600/40 px-8 py-4 rounded-2xl border border-red-500/20 uppercase tracking-widest">Video Gagal Dimuat</div> : 
          <video ref={videoRef} className="w-full h-full object-contain cursor-pointer" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)} onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)} onEnded={() => setCurrentEp(e => e + 1)} playsInline />
        }
        {!isPlaying && !loading && <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30"><div className="bg-white/10 p-8 rounded-full backdrop-blur-md border border-white/20"><Play size={40} fill="white" className="text-white ml-1.5" /></div></div>}
      </div>

      <div className={`absolute bottom-0 left-0 right-0 p-6 z-50 transition-all duration-500 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          {/* Progress Bar & Durasi */}
          <div className="flex flex-col gap-1.5">
            <input type="range" min="0" max={duration || 0} step="0.1" value={currentTime} onChange={(e) => { videoRef.current.currentTime = e.target.value; }} className="w-full h-1 accent-blue-600 bg-white/20 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all" />
            <div className="flex justify-between items-center px-1 text-[9px] font-mono font-bold text-white/50 tracking-tighter">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-2xl p-4 rounded-[1.5rem] border border-white/10 shadow-2xl">
            <div className="flex items-center gap-6">
              <button disabled={currentEp <= 1} onClick={(e) => { e.stopPropagation(); setCurrentEp(e => e - 1); }} className="text-white/40 hover:text-white disabled:opacity-10"><SkipBack size={24} fill="currentColor" /></button>
              <button onClick={(e) => { e.stopPropagation(); isPlaying ? videoRef.current.pause() : videoRef.current.play(); }} className="text-white transform active:scale-90 transition-transform">{isPlaying ? <Pause size={40} fill="white" /> : <Play size={40} fill="white" />}</button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentEp(e => e + 1); }} className="text-white/40 hover:text-white"><SkipForward size={24} fill="currentColor" /></button>
            </div>
            <div className="flex items-center gap-6">
               {/* UI Slider Volume yang Diperbaiki */}
               <div className="hidden sm:flex items-center gap-2 group/vol bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                  <button onClick={(e) => { e.stopPropagation(); setAudioSettings(s => ({...s, isMuted: !s.isMuted}))}} className="text-white/70 hover:text-white transition-colors">
                    {getVolumeIcon()}
                  </button>
                  <div className="w-0 group-hover/vol:w-28 overflow-hidden transition-all duration-300 ease-out flex items-center">
                    <input 
                      type="range" min="0" max="1" step="0.01" 
                      value={volumeVal} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setAudioSettings(s => ({...s, volume: val, isMuted: val === 0}));
                      }} 
                      style={{
                        background: `linear-gradient(to right, #3b82f6 ${volumePercent}%, rgba(255,255,255,0.1) ${volumePercent}%)`
                      }} 
                      className="volume-premium w-28 h-1 appearance-none rounded-full cursor-pointer outline-none" 
                    />
                  </div>
               </div>
               
               {/* Toggle Mute Mobile */}
               <button onClick={(e) => { e.stopPropagation(); setAudioSettings(s => ({...s, isMuted: !s.isMuted}))}} className="sm:hidden text-white/70">
                 {getVolumeIcon()}
               </button>

               <button onClick={(e) => { e.stopPropagation(); setAudioSettings(s => ({...s, playbackRate: s.playbackRate === 1 ? 1.5 : s.playbackRate === 1.5 ? 2 : 1}))}} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black tracking-widest uppercase shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                 {audioSettings.playbackRate}X SPEED
               </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .volume-premium::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; background: white; border-radius: 50%; border: 2px solid #3b82f6; cursor: pointer; opacity: 0; transition: 0.2s; }
        .group\\/vol:hover .volume-premium::-webkit-slider-thumb { opacity: 1; }
        .volume-premium::-moz-range-thumb { width: 10px; height: 10px; background: white; border-radius: 50%; border: 2px solid #3b82f6; cursor: pointer; opacity: 0; border: none; }
      `}</style>
    </div>
  );
};

/**
 * --- MAIN APP ---
 */
export default function App() {
  const { loaded: scriptLoaded } = useExternalScript(CONFIG.SCRIPT_URL);
  const { loaded: hlsLoaded } = useExternalScript(CONFIG.HLS_URL);
  
  const [view, setView] = useState('home'); 
  const [previousView, setPreviousView] = useState('home');
  const [homeData, setHomeData] = useState({ popular: [], latest: [] });
  const [rankData, setRankData] = useState([]);
  const [filterData, setFilterData] = useState([]);
  const [allDramaData, setAllDramaData] = useState([]);
  
  const [user, setUser] = useState(null);
  const [showAd, setShowAd] = useState(false);
  const [loadingRank, setLoadingRank] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [playerState, setPlayerState] = useState({ book: {}, chapters: [], ep: 1 });
  const [rankTab, setRankTab] = useState('popular');
  const [activeFilters, setActiveFilters] = useState({ voice: '', category: '', sort: 'popular' });
  const [audioSettings, setAudioSettings] = useState({ volume: 1, isMuted: false, playbackRate: 1, autoNext: true });

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
      else await signInAnonymously(auth);
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Ad Logic
  useEffect(() => {
    if (!user) return;
    const checkAd = async () => {
      const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'ad_pref'));
      let show = true;
      if (snap.exists()) {
        const d = snap.data();
        const diff = Date.now() - (d.ts || 0);
        if (d.p ? diff < 86400000 : diff < 3600000) show = false;
      }
      if (show) setTimeout(() => setShowAd(true), 3000);
    };
    checkAd();
  }, [user]);

  const handleCloseAd = async (p) => {
    setShowAd(false);
    if (user) await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'ad_pref'), { ts: Date.now(), p });
  };

  // API Logic
  const fetchHome = useCallback(async () => {
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const token = (await core.getToken(CONFIG.API_BASE, 'in', device, false)).token;
      const [pop, lat] = await Promise.all([
        core.doClassify(CONFIG.API_BASE, 'in', device, token, CONFIG.FEED_IDS.POPULAR, 18),
        core.doClassify(CONFIG.API_BASE, 'in', device, token, CONFIG.FEED_IDS.LATEST, 12)
      ]);
      setHomeData({ popular: pop || [], latest: lat || [] });
      
      const combined = [...(pop || []), ...(lat || [])];
      const unique = combined.filter((item, index, self) => index === self.findIndex(t => (t.bookId || t.id) === (item.bookId || item.id)));
      setAllDramaData(unique);
    } catch (e) {}
  }, []);

  const fetchRank = useCallback(async (tab) => {
    setLoadingRank(true);
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const token = (await core.getToken(CONFIG.API_BASE, 'in', device, false)).token;
      const fid = tab === 'popular' ? CONFIG.FEED_IDS.POPULAR : tab === 'latest' ? CONFIG.FEED_IDS.LATEST : CONFIG.FEED_IDS.TRENDING;
      const res = await core.doClassify(CONFIG.API_BASE, 'in', device, token, fid, 30);
      setRankData(res || []);
    } catch (e) {} finally { setLoadingRank(false); }
  }, []);

  useEffect(() => { if (scriptLoaded) fetchHome(); }, [scriptLoaded, fetchHome]);
  useEffect(() => { if (view === 'rank') fetchRank(rankTab); }, [view, rankTab, fetchRank]);

  // Filter Logic
  useEffect(() => {
    let filtered = [...allDramaData];
    if (activeFilters.voice === '1') filtered = filtered.filter(i => (i.bookName || i.title || '').toLowerCase().includes('(sulih suara)'));
    else if (activeFilters.voice === '2') filtered = filtered.filter(i => !(i.bookName || i.title || '').toLowerCase().includes('(sulih suara)'));
    if (activeFilters.category) filtered = filtered.filter(i => {
      const tags = [...(i.typeTwoNames || []), ...(i.tags || [])].map(t => String(t).toLowerCase());
      return tags.some(tag => tag.includes(activeFilters.category.toLowerCase()));
    });
    if (activeFilters.sort === 'popular') filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (activeFilters.sort === 'latest') filtered.sort((a, b) => (b.bookId || b.id || 0) - (a.bookId || a.id || 0));
    setFilterData(filtered);
  }, [allDramaData, activeFilters]);

  if (view === 'player') return <CustomPlayerPage {...playerState} initialEp={playerState.ep} onBack={() => setView('detail')} audioSettings={audioSettings} setAudioSettings={setAudioSettings} />;

  return (
    <div className="bg-[#0f172a] h-screen text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* NAVBAR */}
      <nav className="flex-none h-16 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5 flex items-center z-40 px-4 sm:px-8">
        <div className="container mx-auto flex justify-between items-center">
          <button onClick={() => setView('home')} className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center text-white font-black shadow-lg">D</div>
            <span className="text-base font-black text-white hidden xs:block">Nonton<span className="text-blue-500">Dracin</span></span>
          </button>
          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-full border border-white/10">
            {[ { id: 'home', label: 'Home', icon: Home }, { id: 'rank', label: 'Ranking', icon: Trophy }, { id: 'filter', label: 'Filter', icon: Filter } ].map((m) => (
              <button key={m.id} onClick={() => setView(m.id)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${view === m.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                <m.icon size={12} /> <span className="hidden sm:inline">{m.label}</span>
              </button>
            ))}
            <button onClick={() => setSearchModalOpen(true)} className="p-2 rounded-full text-slate-400 hover:text-white"><Search size={16} /></button>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="flex-1 overflow-y-auto pt-4 pb-16 px-4 sm:px-8 no-scrollbar">
        <div className="container mx-auto max-w-7xl">
          {view === 'home' && (
            <div className="animate-in fade-in duration-700">
               {homeData.popular[0] && (
                 <div className="mb-8 relative rounded-[2rem] overflow-hidden min-h-[300px] flex items-center bg-slate-900 border border-white/5 shadow-2xl">
                   <div className="absolute inset-0">
                     <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover opacity-30 blur-sm scale-105" alt="Hero" />
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent"></div>
                   </div>
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-8 sm:p-12 w-full">
                     <div className="hidden lg:block w-[180px] shrink-0">
                       <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl" onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }}>
                         <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover cursor-pointer" alt="Poster" />
                       </div>
                     </div>
                     <div className="flex-1 text-center md:text-left">
                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[8px] font-black rounded-full mb-4 uppercase tracking-widest"><Flame size={12} fill="white" /> Populer</div>
                       <h1 className="text-3xl sm:text-5xl font-black text-white mb-4 leading-tight tracking-tighter">{homeData.popular[0].bookName || homeData.popular[0].title}</h1>
                       <button onClick={() => { setSelectedBookId(homeData.popular[0].bookId || homeData.popular[0].id); setView('detail'); }} className="bg-white text-black hover:bg-blue-600 hover:text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 mx-auto md:mx-0">LIHAT DETAIL <Play size={16} fill="currentColor"/></button>
                     </div>
                   </div>
                 </div>
               )}
              <Section title="Drama Populer" icon={<Flame size={16} className="text-orange-500"/>} onSeeAll={() => { setView('rank'); setRankTab('popular'); }}>
                <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                  {homeData.popular.slice(1, 7).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                </div>
              </Section>
              <Section title="Update Terbaru" icon={<Clock size={16} className="text-blue-400"/>} onSeeAll={() => { setView('rank'); setRankTab('latest'); }}>
                <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
                  {homeData.latest.slice(0, 6).map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('home'); setView('detail'); }} />)}
                </div>
              </Section>
            </div>
          )}

          {view === 'rank' && (
            <div className="animate-in fade-in duration-500">
               <div className="flex justify-center gap-3 mb-8 overflow-x-auto no-scrollbar py-1">
                  {[ { id: 'popular', label: 'Populer' }, { id: 'latest', label: 'Terbaru' }, { id: 'trending', label: 'Trending' } ].map(t => (
                    <button key={t.id} onClick={() => setRankTab(t.id)} className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${rankTab === t.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>{t.label}</button>
                  ))}
               </div>
               {loadingRank ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" size={32}/></div> : 
                 <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                    {rankData.map((item, idx) => <DramaCard key={idx} item={item} rank={idx+1} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('rank'); setView('detail'); }} />)}
                 </div>
               }
            </div>
          )}

          {view === 'filter' && (
            <div className="animate-in fade-in duration-500">
               <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {STATIC_FILTERS.map(f => (
                    <div key={f.key}>
                      <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-3">{f.title}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {f.options.map(o => (
                          <button key={o.value} onClick={() => setActiveFilters(prev => ({...prev, [f.key]: prev[f.key] === o.value ? '' : o.value}))} className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${activeFilters[f.key] === o.value ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>{o.display}</button>
                        ))}
                      </div>
                    </div>
                  ))}
               </div>
               <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                  {filterData.map((item, idx) => <DramaCard key={idx} item={item} onClick={(it) => { setSelectedBookId(it.bookId || it.id); setPreviousView('filter'); setView('detail'); }} />)}
               </div>
            </div>
          )}

          {view === 'detail' && (
            <DramaDetailPage bookId={selectedBookId} onBack={() => setView(previousView)} onPlayEpisode={(ep, b, c) => { setPlayerState({ book: b, chapters: c, ep }); setPreviousView('detail'); setView('player'); }} />
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="flex-none bg-[#0f172a] border-t border-white/5 py-6 px-4 overflow-hidden">
        <div className="container mx-auto max-w-4xl flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            © 2026 <a href="https://sanpoi.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline transition-all">SanPoi</a> | Made with AI
          </p>
          <p className="text-[9px] text-slate-600 leading-tight max-w-2xl italic hidden sm:block">
            We do not host or stream any video content. All trademarks and copyrighted materials are owned by their respective owners.
          </p>
          <p className="text-[9px] text-slate-600 font-mono">
            API by <a href="https://drachin.dicky.app" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">https://drachin.dicky.app</a>
          </p>
        </div>
      </footer>

      {/* OVERLAYS */}
      {showAd && <SanPoiPopup onClose={handleCloseAd} />}
      {searchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4">
          <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-2xl" onClick={() => setSearchModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl animate-in slide-in-from-top-8 duration-500">
             <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={24} />
                <input autoFocus type="text" placeholder="Cari drama favorit..." className="w-full bg-slate-900 border border-white/10 rounded-[1.5rem] pl-16 pr-8 py-6 text-xl font-bold text-white outline-none focus:border-blue-600 transition-all shadow-2xl" />
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Section = ({ title, icon, onSeeAll, children }) => (
  <section className="mb-12">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-slate-900 rounded-lg border border-white/5 shadow-inner">{icon}</div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight">{title}</h2>
      </div>
      {onSeeAll && (
        <button 
          onClick={onSeeAll} 
          className="flex items-center gap-1 text-[10px] font-black text-blue-500 hover:text-white uppercase tracking-widest transition-all bg-white/5 px-3 py-1 rounded-full border border-white/5"
        >
          Lihat Semua <ChevronRight size={12}/>
        </button>
      )}
    </div>
    {children}
  </section>
);
