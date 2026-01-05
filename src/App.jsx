import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, X, Search, Home, Clock, Flame, 
  ChevronRight, SkipBack, SkipForward, AlertTriangle, 
  Loader2, Trophy, Star, Filter, Check, Plus,
  Pause, Volume2, VolumeX, Share2, ChevronLeft,
  Gauge
} from 'lucide-react';

/**
 * --- KONFIGURASI API & KONSTANTA ---
 */
const CONFIG = {
  SCRIPT_URL: "https://nontondracin.com/vendor/core/plugins/dramabox/js/dramabox-core.js?v=2.1.8",
  API_BASE: "https://drachin.dicky.app",
  LOCALE_API: "in",
  LOCALE_URL: "id",
  FEED_IDS: {
    POPULAR: 1,
    LATEST: 2,
    TRENDING: 3
  },
  PER_PAGE: 24
};

/**
 * --- DATA FILTER STATIS ---
 */
const STATIC_FILTERS = [
  {
    title: "Sound",
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
    title: "Urutkan",
    key: "sort",
    options: [
      { display: "Terpopuler", value: "popular" },
      { display: "Terbaru", value: "latest" }
    ]
  }
];

// --- HELPER: Utilitas ---
const cleanIntro = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?p[^>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractVideoUrlFromChapter = (chapter) => {
  if (!chapter) return '';
  let src = chapter.raw || chapter;
  if (typeof src.mp4 === 'string' && src.mp4) return src.mp4;
  if (typeof src.m3u8Url === 'string' && src.m3u8Url) return src.m3u8Url;
  
  const cdnList = src.cdnList || [];
  let candidates = [];
  const extractPath = (entry) => {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    return entry.videoPath || entry.path || entry.url || '';
  };

  cdnList.forEach((cdn) => {
    (cdn.videoPathList || []).forEach((v) => {
      const path = extractPath(v);
      if (path) {
        candidates.push({
          url: path,
          quality: v.quality || 0,
          isDefault: v.isDefault || 0,
          isVip: v.isVipEquity || 0,
          isCdnDefault: cdn.isDefault || 0,
          domain: cdn.cdnDomain || ''
        });
      }
    });
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.isVip !== b.isVip) return a.isVip - b.isVip;
      if (a.isDefault !== b.isDefault) return b.isDefault - a.isDefault;
      if (a.isCdnDefault !== b.isCdnDefault) return b.isCdnDefault - a.isCdnDefault;
      return b.quality - a.quality;
    });
    const best = candidates[0];
    let finalUrl = best.url;
    if (finalUrl && !/^https?:\/\//i.test(finalUrl) && best.domain) {
      const base = best.domain.startsWith('http') ? best.domain : 'https://' + best.domain;
      finalUrl = base.replace(/\/+$/, '') + '/' + finalUrl.replace(/^\/+/, '');
    }
    return finalUrl;
  }
  return '';
};

const useExternalScript = (url) => {
  const [state, setState] = useState({ loaded: false, error: false });
  useEffect(() => {
    if (window.DramaboxCore) {
      setState({ loaded: true, error: false });
      return;
    }
    let script = document.querySelector(`script[src="${url}"]`);
    const onScriptLoad = () => setState({ loaded: true, error: false });
    const onScriptError = () => setState({ loaded: true, error: true });
    if (!script) {
      script = document.createElement("script");
      script.src = url;
      script.async = true;
      document.body.appendChild(script);
    }
    script.addEventListener("load", onScriptLoad);
    script.addEventListener("error", onScriptError);
    const interval = setInterval(() => {
      if (window.DramaboxCore) {
        setState({ loaded: true, error: false });
        clearInterval(interval);
      }
    }, 500);
    return () => {
      script.removeEventListener("load", onScriptLoad);
      script.removeEventListener("error", onScriptError);
      clearInterval(interval);
    };
  }, [url]);
  return state;
};

// --- KOMPONEN UI ---

const DramaCard = ({ item, onClick, rank }) => {
  const cover = String(item.coverWap || item.cover || 'https://via.placeholder.com/300x450');
  const title = String(item.bookName || item.title || 'Untitled');
  const ep = String(item.chapterCount || '?');
  const score = item.score || 9.8;
  return (
    <div className="group relative cursor-pointer" onClick={() => onClick(item)}>
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-gray-800 shadow-md transition-all duration-300 group-hover:shadow-blue-500/20 group-hover:shadow-xl">
        <img src={cover} alt={title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50">
            <Play size={20} fill="white" className="text-white ml-1" />
          </div>
        </div>
        {rank && rank <= 3 && (
          <div className={`absolute top-0 left-0 px-3 py-1 rounded-br-xl text-xs font-bold text-white shadow-lg ${
            rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-600' :
            rank === 2 ? 'bg-gradient-to-r from-gray-400 to-gray-500' : 'bg-gradient-to-r from-orange-600 to-orange-700'
          }`}>#{rank}</div>
        )}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/10">{ep} EPS</div>
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent pt-6">
            <div className="flex items-center gap-1 text-[10px] text-yellow-400 font-bold"><Star size={10} fill="currentColor"/> {score}</div>
        </div>
      </div>
      <h3 className="text-gray-200 font-semibold text-sm leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">{title}</h3>
    </div>
  );
};

const DetailModal = ({ isOpen, onClose, bookId, onPlayEpisode, onTagClick }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  useEffect(() => {
    if (!isOpen || !bookId) return;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const core = window.DramaboxCore;
        const result = await core.loadDetailWithRecommend({
          apiBase: CONFIG.API_BASE, localeApi: CONFIG.LOCALE_API, bookId: bookId, webficBase: 'https://www.webfic.com',
        });
        setData(result);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchDetail();
  }, [isOpen, bookId]);

  if (!isOpen) return null;

  let bookTags = [];
  if (data && data.book) {
    if (Array.isArray(data.book.typeTwoNames)) bookTags = bookTags.concat(data.book.typeTwoNames);
    if (Array.isArray(data.book.tags)) bookTags = bookTags.concat(data.book.tags);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-[#1e293b] w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-black/40 hover:bg-red-500/80 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md"><X size={18} /></button>
        <div className="overflow-y-auto custom-scroll flex-1">
          {loading ? (
            <div className="p-8 flex flex-col md:flex-row gap-6 animate-pulse">
              <div className="w-full md:w-1/3 aspect-[2/3] bg-gray-700 rounded-xl"></div>
              <div className="flex-1 space-y-4"><div className="h-8 bg-gray-700 rounded w-3/4"></div><div className="h-32 bg-gray-700 rounded w-full"></div></div>
            </div>
          ) : data ? (
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-1/3 relative bg-black/20">
                <img src={data.book?.cover || data.book?.image} alt="Poster" className="w-full h-full object-cover aspect-[2/3]" />
              </div>
              <div className="w-full md:w-2/3 p-6 md:p-8 flex flex-col bg-[#1e293b]">
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">{String(data.book?.bookName || data.book?.title)}</h2>
                <p className="text-blue-400 font-bold text-sm mb-4">{data.book?.chapterCount || data.chapters?.length} Episode</p>
                
                <p className="text-gray-300 mb-4 text-sm md:text-base line-clamp-6 leading-relaxed">
                  {cleanIntro(data.book?.introduction || data.book?.desc)}
                </p>

                {bookTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {bookTags.map((tag, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => onTagClick(tag)}
                        className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[11px] font-bold text-gray-400 uppercase tracking-wider hover:bg-blue-600 hover:text-white hover:border-transparent transition-all"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-auto">
                  <h3 className="text-lg font-bold text-white mb-3 tracking-tight">Daftar Episode</h3>
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-8 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scroll">
                      {data.chapters?.map((ch) => (
                        <button key={ch.index} onClick={() => onPlayEpisode(ch.num || (ch.index + 1), data.book, data.chapters)} className="bg-gray-700 hover:bg-blue-600 text-gray-200 py-2 rounded-lg text-xs font-semibold transition">
                          {String(ch.num || (ch.index + 1))}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

/**
 * --- CUSTOM PLAYER PAGE ---
 */
const CustomPlayerPage = ({ book, chapters, initialEp, onBack, audioSettings, setAudioSettings }) => {
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const videoRef = useRef(null);
  const requestRef = useRef(0);

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const loadEpisode = useCallback(async (epNum) => {
    setLoading(true); setError(false); setVideoUrl(''); setIsPlaying(false);
    const requestId = ++requestRef.current;
    try {
      const core = window.DramaboxCore;
      const batchRes = await core.loadViaBatch({
        apiBase: CONFIG.API_BASE, localeApi: CONFIG.LOCALE_API, 
        bookId: book.bookId || book.id, index: epNum,
      });
      if (requestId !== requestRef.current) return;
      const list = batchRes.data?.chapterList || batchRes.chapters || [];
      const batchCh = list.find(item => String(item.num) === String(epNum) || item.index === (epNum - 1)) || list[0];
      if (!batchCh) throw new Error("Data episode tidak ditemukan");
      const url = extractVideoUrlFromChapter(batchCh);
      if (url) setVideoUrl(url); else throw new Error("URL Video tidak tersedia");
    } catch (e) { 
      if (requestId === requestRef.current) setError(true);
    } finally { 
      if (requestId === requestRef.current) setLoading(false); 
    }
  }, [book]);

  useEffect(() => { loadEpisode(currentEp); }, [currentEp, loadEpisode]);

  // Sinkronisasi audioSettings global ke elemen video
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      videoRef.current.volume = audioSettings.volume;
      videoRef.current.muted = audioSettings.isMuted;
      videoRef.current.playbackRate = audioSettings.playbackRate;
    }
  }, [videoUrl, audioSettings]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (currentEp < (chapters?.length || 999)) {
      setCurrentEp(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentEp > 1) {
      setCurrentEp(prev => prev - 1);
    }
  };

  const togglePlaybackRate = () => {
    const nextRate = audioSettings.playbackRate === 1 ? 1.5 : audioSettings.playbackRate === 1.5 ? 2 : 1;
    setAudioSettings(prev => ({ ...prev, playbackRate: nextRate }));
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setAudioSettings(prev => ({ ...prev, volume: val, isMuted: val === 0 }));
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  };

  const handleShare = async () => {
    const shareData = {
      title: book.bookName,
      text: `Nonton drama ${book.bookName} episode ${currentEp}`,
      url: window.location.href
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (e) {}
    } else {
      const el = document.createElement('textarea');
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
      {/* Header Player (Bukan Main Navbar) */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onBack} className="text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-white font-bold text-sm truncate max-w-[200px]">{book.bookName}</h2>
          <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Episode {currentEp}</p>
        </div>
        <button onClick={handleShare} className="text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
          <Share2 size={20} />
        </button>
      </div>

      {/* Video Content (Portrait) */}
      <div className="relative w-full max-w-[450px] aspect-[9/16] bg-slate-900 shadow-2xl flex items-center justify-center overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-blue-500" size={48} />
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">Memuat Video...</p>
          </div>
        ) : error ? (
          <div className="text-center p-6 flex flex-col items-center">
            <AlertTriangle className="text-yellow-500 mb-4" size={48} />
            <p className="text-white mb-4 font-bold">Gagal memuat episode</p>
            <button onClick={() => loadEpisode(currentEp)} className="px-8 py-2 bg-blue-600 text-white rounded-full font-bold">ULANGI</button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef}
              src={videoUrl}
              autoPlay={audioSettings.autoNext}
              className="w-full h-full object-cover cursor-pointer"
              onClick={togglePlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => setCurrentTime(videoRef.current.currentTime)}
              onLoadedMetadata={() => {
                setDuration(videoRef.current.duration);
                videoRef.current.volume = audioSettings.volume;
                videoRef.current.playbackRate = audioSettings.playbackRate;
                videoRef.current.muted = audioSettings.isMuted;
              }}
              onEnded={() => audioSettings.autoNext && handleNext()}
              playsInline
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/40 p-6 rounded-full backdrop-blur-sm border border-white/20 scale-110">
                  <Play size={40} fill="white" className="text-white ml-1" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Control Bar (Bukan Footer Utama) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-4">
        {/* Scroll / Seek Bar */}
        <div className="flex flex-col gap-1.5">
          <input 
            type="range" min="0" max={duration || 0} step="0.1" 
            value={currentTime} 
            onChange={handleSeek}
            className="w-full accent-blue-600 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              disabled={currentEp <= 1}
              onClick={handlePrev}
              className="text-white hover:text-blue-400 transition transform active:scale-90 disabled:opacity-20"
            >
              <SkipBack size={24} fill="currentColor" />
            </button>
            <button onClick={togglePlay} className="text-white hover:text-blue-400 transition transform active:scale-90">
              {isPlaying ? <Pause size={36} fill="currentColor" /> : <Play size={36} fill="currentColor" />}
            </button>
            <button 
              disabled={currentEp >= (chapters?.length || 999)}
              onClick={handleNext}
              className="text-white hover:text-blue-400 transition transform active:scale-90 disabled:opacity-20"
            >
              <SkipForward size={24} fill="currentColor" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Speed Selector */}
            <button 
              onClick={togglePlaybackRate}
              className="px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/5 text-[10px] font-bold text-white hover:bg-white/20 transition flex items-center gap-1.5"
            >
              <Gauge size={14} /> {audioSettings.playbackRate}X
            </button>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center gap-3">
              <button onClick={() => setAudioSettings(prev => ({ ...prev, isMuted: !prev.isMuted }))} className="text-white/70 hover:text-white transition">
                {audioSettings.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={audioSettings.isMuted ? 0 : audioSettings.volume} 
                onChange={handleVolumeChange}
                className="w-20 accent-white h-1 bg-white/20 rounded-full appearance-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <div className="flex items-center gap-2">
            <input 
              id="auto-play" type="checkbox" checked={audioSettings.autoNext} 
              onChange={(e) => setAudioSettings(prev => ({ ...prev, autoNext: e.target.checked }))} 
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <label htmlFor="auto-play" className="text-[10px] font-bold text-white uppercase tracking-widest cursor-pointer select-none">Auto Next</label>
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">NontonDracin Player</p>
        </div>
      </div>
    </div>
  );
};

// --- APLIKASI UTAMA ---
export default function App() {
  const { loaded: scriptLoaded, error: scriptError } = useExternalScript(CONFIG.SCRIPT_URL);
  
  const [view, setView] = useState('home'); 
  const [previousView, setPreviousView] = useState('home');
  const [homeData, setHomeData] = useState({ popular: [], latest: [] });
  const [rankData, setRankData] = useState([]);
  const [searchData, setSearchData] = useState([]);
  const [allDramaData, setAllDramaData] = useState([]);
  const [filterData, setFilterData] = useState([]);
  
  const [rankPage, setRankPage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreRank, setHasMoreRank] = useState(true);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);

  const [activeFilters, setActiveFilters] = useState({
    voice: '',
    category: '',
    sort: 'popular'
  });

  // --- AUDIO SETTINGS (PERSISTENSI) ---
  const [audioSettings, setAudioSettings] = useState({
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    autoNext: true
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [rankTab, setRankTab] = useState('trending');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingHome, setLoadingHome] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(null);
  
  const [playerState, setPlayerState] = useState({ book: {}, chapters: [], ep: 1 });

  const getToken = useCallback(async () => {
    const core = window.DramaboxCore;
    const device = await core.getDevice();
    return await core.getToken(CONFIG.API_BASE, CONFIG.LOCALE_API, device, false);
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!window.DramaboxCore) return;
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      const [popular, latest] = await Promise.all([
        core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, CONFIG.FEED_IDS.POPULAR, 50),
        core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, CONFIG.FEED_IDS.LATEST, 50)
      ]);
      const combined = [...(popular || []), ...(latest || [])];
      const unique = combined.filter((item, index, self) => 
        index === self.findIndex(t => (t.bookId || t.id) === (item.bookId || item.id))
      );
      setAllDramaData(unique);
    } catch (e) { console.error(e); }
  }, [getToken]);

  const applyFilters = useCallback(() => {
    let filtered = [...allDramaData];
    if (activeFilters.voice === '1') {
      filtered = filtered.filter(item => (item.bookName || item.title || '').toLowerCase().includes('(sulih suara)'));
    } else if (activeFilters.voice === '2') {
      filtered = filtered.filter(item => !(item.bookName || item.title || '').toLowerCase().includes('(sulih suara)'));
    }
    if (activeFilters.category) {
      filtered = filtered.filter(item => {
        const tags = [...(Array.isArray(item.typeTwoNames) ? item.typeTwoNames : []), ...(Array.isArray(item.tags) ? item.tags : [])].map(t => String(t).toLowerCase());
        return tags.some(tag => tag.includes(activeFilters.category.toLowerCase()));
      });
    }
    if (activeFilters.sort === 'popular') filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (activeFilters.sort === 'latest') filtered.sort((a, b) => (b.bookId || b.id || 0) - (a.bookId || a.id || 0));
    setFilterData(filtered);
  }, [allDramaData, activeFilters]);

  const fetchHome = useCallback(async () => {
    if (!window.DramaboxCore) return;
    setLoadingHome(true);
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      const [pop, lat] = await Promise.all([
        core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, CONFIG.FEED_IDS.POPULAR, 18),
        core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, CONFIG.FEED_IDS.LATEST, 12)
      ]);
      setHomeData({ popular: pop || [], latest: lat || [] });
    } catch (e) {} finally { setLoadingHome(false); }
  }, [getToken]);

  const fetchRank = useCallback(async (type, pageNum = 1) => {
    if (!window.DramaboxCore) return;
    if (pageNum === 1) {
      setLoading(true);
      setRankData([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      let fid = type === 'popular' ? CONFIG.FEED_IDS.POPULAR : type === 'latest' ? CONFIG.FEED_IDS.LATEST : CONFIG.FEED_IDS.TRENDING;
      const res = await core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, fid, pageNum * CONFIG.PER_PAGE);
      
      if (res && res.length >= pageNum * CONFIG.PER_PAGE) {
        setHasMoreRank(true);
      } else {
        setHasMoreRank(false);
      }

      setRankData(res || []);
    } catch (e) {
      console.error(e);
    } finally { 
      setLoading(false); 
      setLoadingMore(false);
    }
  }, [getToken]);

  const fetchSearch = useCallback(async (keyword, pageNum = 1) => {
    if (!window.DramaboxCore || !keyword) return;
    if (pageNum === 1) {
      setLoading(true);
      setSearchData([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await window.DramaboxCore.searchBooks(CONFIG.API_BASE, CONFIG.LOCALE_API, keyword, pageNum, CONFIG.PER_PAGE);
      const newItems = res.items || [];
      
      setSearchData(prev => pageNum === 1 ? newItems : [...prev, ...newItems]);
      setHasMoreSearch(newItems.length >= CONFIG.PER_PAGE);
    } catch (e) {
      console.error(e);
    } finally { 
      setLoading(false); 
      setLoadingMore(false);
    }
  }, []);

  const handleLoadMoreRank = () => {
    const nextPage = rankPage + 1;
    setRankPage(nextPage);
    fetchRank(rankTab, nextPage);
  };

  const handleLoadMoreSearch = () => {
    const nextPage = searchPage + 1;
    setSearchPage(nextPage);
    fetchSearch(searchQuery, nextPage);
  };

  const openDetail = (item) => { setSelectedBookId(item.bookId || item.id); setDetailModalOpen(true); };
  
  const onPlayEpisode = (epNum, book, chapters) => { 
    setPlayerState({ book, chapters, ep: epNum }); 
    setDetailModalOpen(false); 
    setPreviousView(view);
    setView('player'); 
  };

  const handleTagClick = (tagName) => {
    setDetailModalOpen(false);
    const catFilter = STATIC_FILTERS.find(f => f.key === 'category');
    const option = catFilter.options.find(o => o.display.toLowerCase() === tagName.toLowerCase());
    if (option && option.value !== '') {
      setActiveFilters({ voice: '', category: option.value, sort: 'popular' });
      setView('filter');
    } else {
      setView('search');
      setSearchQuery(tagName);
      setSearchPage(1);
      fetchSearch(tagName, 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => { 
    if (scriptLoaded) { fetchHome(); fetchAllData(); }
  }, [scriptLoaded, fetchHome, fetchAllData]);
  
  useEffect(() => { 
    if (view === 'rank') {
      setRankPage(1);
      fetchRank(rankTab, 1);
    }
  }, [view, rankTab, fetchRank]);

  useEffect(() => { if (view === 'filter' && allDramaData.length > 0) applyFilters(); }, [view, activeFilters, allDramaData, applyFilters]);

  const handleSearchSubmit = (e) => { 
    if (e.key === 'Enter') { 
      const q = searchQuery.trim(); 
      if (q) { 
        setView('search'); 
        setSearchPage(1);
        fetchSearch(q, 1); 
        setSearchModalOpen(false); 
      } 
    } 
  };
  
  const toggleFilter = (key, val) => {
    setActiveFilters(prev => ({ ...prev, [key]: prev[key] === val ? '' : val }));
  };

  const navigateToListView = (type) => {
    setView('rank');
    setRankTab(type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderGrid = (items, isLoading) => {
    if (isLoading && (!items || items.length === 0)) {
      return (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      );
    }
    if (!items || items.length === 0) return <div className="text-slate-500 text-center col-span-full py-20 italic">Tidak ada konten ditemukan.</div>;
    return (
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
        {items.map((item, idx) => <DramaCard key={idx} item={item} onClick={openDetail} rank={view === 'rank' ? idx + 1 : null} />)}
      </div>
    );
  };

  /**
   * --- ROUTING ---
   */
  if (view === 'player') {
    return (
      <CustomPlayerPage 
        {...playerState} 
        initialEp={playerState.ep} 
        onBack={() => setView(previousView)} 
        audioSettings={audioSettings}
        setAudioSettings={setAudioSettings}
      />
    );
  }

  if (scriptError) return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white">
      <AlertTriangle size={48} className="text-red-500 mb-4" />
      <h2 className="text-xl font-bold">Gagal Memuat Library</h2>
      <button onClick={() => window.location.reload()} className="bg-blue-600 px-6 py-2 rounded-lg font-bold mt-4">Muat Ulang</button>
    </div>
  );

  if (!scriptLoaded) return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-blue-500 font-bold px-6">
      <Loader2 className="animate-spin mb-4" size={48} />
      <p className="animate-pulse">Menghubungkan ke Server...</p>
    </div>
  );

  return (
    <div className="bg-[#0f172a] min-h-screen text-slate-200 font-sans flex flex-col">
      {/* --- NAVBAR --- */}
      <nav className="fixed w-full z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 top-0 h-16 flex items-center">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <button onClick={() => setView('home')} className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">D</div>
            <span className="text-xl font-bold tracking-tight text-white hidden sm:block">Nonton<span className="text-blue-400">Dracin</span></span>
          </button>
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
            {[ 
              { id: 'home', label: 'Beranda', icon: Home }, 
              { id: 'rank', label: 'Peringkat', icon: Trophy } 
            ].map((menuItem) => {
              const Icon = menuItem.icon;
              return (
                <button key={menuItem.id} onClick={() => setView(menuItem.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${view === menuItem.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                  <Icon size={14} /> <span className="hidden xs:inline">{menuItem.label}</span>
                </button>
              );
            })}
            <button onClick={() => setView('filter')} className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${view === 'filter' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
              <Filter size={14} /> <span className="hidden xs:inline">Filter</span>
            </button>
            <button onClick={() => setSearchModalOpen(true)} className={`p-2 rounded-full transition-all ${view === 'search' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Search size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="pt-20 pb-10 flex-1">
        {/* --- VIEW: HOME --- */}
        {view === 'home' && (
          <div className="container mx-auto px-4 animate-in fade-in duration-500">
             {homeData.popular[0] && (
               <div className="mb-12 relative rounded-2xl overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center bg-[#1e293b]">
                 <div className="absolute inset-0">
                   <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover opacity-40 blur-sm" alt="Hero BG"/>
                   <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-[#0f172a]/90"></div>
                 </div>
                 <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 p-6 md:p-12 w-full">
                   <div className="hidden md:block w-1/3 max-w-[280px]">
                     <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-2xl transform -rotate-2 hover:rotate-0 transition duration-500 cursor-pointer" onClick={() => openDetail(homeData.popular[0])}>
                       <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover" alt="Hero Poster" />
                     </div>
                   </div>
                   <div className="w-full md:w-2/3 text-center md:text-left">
                     <div className="inline-flex items-center gap-1 px-3 py-1 bg-red-600/90 text-white text-xs font-bold rounded-full mb-4"><Flame size={12} fill="white" /> #1 POPULER</div>
                     <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">{String(homeData.popular[0].bookName)}</h1>
                     <p className="text-gray-300 mb-6 max-w-2xl mx-auto md:mx-0 line-clamp-3 text-sm md:text-base">{cleanIntro(homeData.popular[0].introduction || homeData.popular[0].desc)}</p>
                     <button onClick={() => openDetail(homeData.popular[0])} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 mx-auto md:mx-0"><Play size={20} fill="white" /> Lihat Detail</button>
                   </div>
                 </div>
               </div>
             )}
            
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6 border-l-4 border-red-500 pl-3">
                <h2 className="text-xl font-bold text-white">Drama Populer</h2>
                <button 
                  onClick={() => navigateToListView('popular')}
                  className="text-blue-400 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  Lihat Selengkapnya <ChevronRight size={14} />
                </button>
              </div>
              {renderGrid(homeData.popular.slice(1), loadingHome)}
            </div>

            <div className="mb-12">
              <div className="flex items-center justify-between mb-6 border-l-4 border-blue-500 pl-3">
                <h2 className="text-xl font-bold text-white">Update Terbaru</h2>
                <button 
                  onClick={() => navigateToListView('latest')}
                  className="text-blue-400 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  Lihat Selengkapnya <ChevronRight size={14} />
                </button>
              </div>
              {renderGrid(homeData.latest, loadingHome)}
            </div>
          </div>
        )}

        {/* --- VIEW: RANKING --- */}
        {view === 'rank' && (
          <div className="container mx-auto px-4 animate-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold text-white mb-8 text-center">Papan Peringkat</h1>
            <div className="flex justify-center mb-10 overflow-x-auto gap-2">
              {[ { id: 'trending', label: 'Trending', icon: Flame }, { id: 'popular', label: 'Populer', icon: Trophy }, { id: 'latest', label: 'Terbaru', icon: Clock } ].map((tab) => (
                <button key={tab.id} onClick={() => setRankTab(tab.id)} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${rankTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-slate-800/50'}`}><tab.icon size={14} /> {tab.label}</button>
              ))}
            </div>
            {renderGrid(rankData, loading)}
            
            {hasMoreRank && rankData.length > 0 && (
              <div className="mt-12 flex justify-center">
                <button 
                  onClick={handleLoadMoreRank} 
                  disabled={loadingMore}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg"
                >
                  {loadingMore ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {loadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- VIEW: FILTER --- */}
        {view === 'filter' && (
          <div className="container mx-auto px-4 animate-in fade-in duration-500">
            <div className="mb-8 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500"><Filter size={24} /></div>
              <div>
                <h1 className="text-2xl font-bold text-white">Eksplorasi Drama</h1>
                <p className="text-slate-400 text-sm">Gunakan filter untuk menemukan drama yang Anda sukai.</p>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 md:p-8 mb-10 backdrop-blur-md">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-8">
                {STATIC_FILTERS.map((group) => (
                  <div key={group.key} className="space-y-4">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">{group.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => toggleFilter(group.key, opt.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${activeFilters[group.key] === opt.value ? 'bg-blue-600 border-transparent text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'}`}
                        >
                          {activeFilters[group.key] === opt.value && <Check size={12} />}
                          {opt.display}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                <button onClick={() => setActiveFilters({ voice: '', category: '', sort: 'popular' })} className="text-xs font-bold text-slate-500 hover:text-white transition-colors">Atur Ulang Filter</button>
              </div>
            </div>
            {allDramaData.length === 0 ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={48} /></div> : renderGrid(filterData, false)}
          </div>
        )}

        {/* --- VIEW: SEARCH --- */}
        {view === 'search' && (
          <div className="container mx-auto px-4 min-h-[60vh]">
            <h1 className="text-2xl font-bold text-white mb-8">Hasil Pencarian: <span className="text-blue-400">"{searchQuery}"</span></h1>
            {renderGrid(searchData, loading)}

            {hasMoreSearch && searchData.length > 0 && (
              <div className="mt-12 flex justify-center">
                <button 
                  onClick={handleLoadMoreSearch} 
                  disabled={loadingMore}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-lg"
                >
                  {loadingMore ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {loadingMore ? 'Memuat...' : 'Muat Lebih Banyak'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 bg-[#0f172a] pt-16 pb-12">
        <div className="container mx-auto px-4 text-center max-w-4xl mx-auto flex flex-col items-center">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg text-xl">D</div>
              <span className="text-2xl font-bold tracking-tight text-white">Nonton<span className="text-blue-400">Dracin</span></span>
            </div>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-8">
              NontonDracin merupakan platform streaming drama Asia modern yang menghadirkan ribuan judul favorit dengan sistem pembaruan data secara real-time untuk memastikan pengalaman menonton Anda selalu yang tercepat dan terdepan.
            </p>
            <div className="text-slate-500 text-xs md:text-sm mb-6 flex flex-wrap justify-center items-center gap-x-2">
              <span>© 2026</span>
              <a href="https://sanpoi.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">SanPoi</a>
              <span className="opacity-50">|</span>
              <span className="italic">Made with AI</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-8 text-slate-500 text-[10px] md:text-xs leading-relaxed italic">
                We do not host or stream any video content. All trademarks and copyrighted materials are owned by their respective owners. This site is for information, reviews, and references only. Please watch content through official and legal streaming services.
            </div>
            <div className="text-slate-600 text-[10px] font-mono">
              API by <a href="https://drachin.dicky.app" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition-colors">https://drachin.dicky.app</a>
            </div>
        </div>
      </footer>

      {/* --- SEARCH OVERLAY --- */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSearchModalOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4">
            <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Masukkan judul..." className="bg-slate-800 text-white w-full px-4 py-3 rounded-xl border border-white/5 outline-none focus:border-blue-500" onKeyDown={handleSearchSubmit} />
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      <DetailModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} bookId={selectedBookId} onPlayEpisode={onPlayEpisode} onTagClick={handleTagClick} />
      
      {loading && (view === 'home' || view === 'rank' || view === 'search') && (
        <div className="fixed bottom-6 right-6 bg-blue-600 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-[100]">
          <Loader2 className="animate-spin text-white" size={20}/><span className="text-xs font-bold text-white">Sinkronisasi...</span>
        </div>
      )}
    </div>
  );
}
