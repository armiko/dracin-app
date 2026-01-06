import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, X, Search, Home, Clock, Flame, 
  ChevronRight, SkipBack, SkipForward, AlertTriangle, 
  Loader2, Trophy, Star, Filter, Check, Plus,
  Pause, Volume2, VolumeX, Share2, ChevronLeft,
  Gauge, BookOpen, Maximize, Minimize
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
  
  if (typeof src.m3u8Url === 'string' && src.m3u8Url) return src.m3u8Url;
  if (typeof src.mp4 === 'string' && src.mp4) return src.mp4;
  
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
    
    const onScriptLoad = () => {
      setTimeout(() => {
        if (window.DramaboxCore) setState({ loaded: true, error: false });
        else setState({ loaded: true, error: true });
      }, 500);
    };
    
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
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-gray-800 shadow-md transition-all duration-300 group-hover:shadow-blue-500/20 group-hover:shadow-xl">
        <img src={cover} alt={title} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50">
            <Play size={18} fill="white" className="text-white ml-1" />
          </div>
        </div>
        {rank && (
          <div className={`absolute top-0 left-0 px-2 sm:px-3 py-1 rounded-br-xl text-[10px] sm:text-xs font-bold text-white shadow-lg ${
            rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-600' :
            rank === 2 ? 'bg-gradient-to-r from-gray-400 to-gray-500' : 
            rank === 3 ? 'bg-gradient-to-r from-orange-600 to-orange-700' :
            'bg-black/60'
          }`}>#{rank}</div>
        )}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-white/10">{ep} EPS</div>
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent pt-6">
            <div className="flex items-center gap-1 text-[8px] sm:text-[10px] text-yellow-400 font-bold"><Star size={10} fill="currentColor"/> {score}</div>
        </div>
      </div>
      <h3 className="text-gray-200 font-semibold text-[10px] sm:text-sm leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">{title}</h3>
    </div>
  );
};

const DramaDetailPage = ({ bookId, onPlayEpisode, onTagClick, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  
  useEffect(() => {
    if (!bookId) return;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const core = window.DramaboxCore;
        if (!core) {
          setTimeout(fetchDetail, 1000);
          return;
        }
        const result = await core.loadDetailWithRecommend({
          apiBase: CONFIG.API_BASE, localeApi: CONFIG.LOCALE_API, bookId: bookId, webficBase: 'https://www.webfic.com',
        });
        setData(result);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchDetail();
  }, [bookId]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center animate-pulse p-10">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest text-center">Memuat Detail Drama...</p>
      </div>
    );
  }

  if (!data) return null;

  let bookTags = [];
  if (data.book) {
    if (Array.isArray(data.book.typeTwoNames)) bookTags = bookTags.concat(data.book.typeTwoNames);
    if (Array.isArray(data.book.tags)) bookTags = bookTags.concat(data.book.tags);
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden">
      <div className="flex-none mb-4 flex items-center gap-3">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 transition-all shrink-0"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">Detail Drama</h1>
          <p className="text-slate-400 text-[10px] sm:text-xs">Informasi lengkap dan daftar episode.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="bg-[#1e293b] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/5">
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 lg:w-[300px] relative bg-black/20 shrink-0">
              <img 
                src={data.book?.cover || data.book?.image} 
                alt="Poster" 
                className="w-full h-full object-cover aspect-[2/3] md:aspect-auto" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1e293b] via-transparent to-transparent md:hidden"></div>
            </div>
            
            <div className="w-full md:w-2/3 p-5 sm:p-8 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[9px] font-black rounded uppercase tracking-wider border border-blue-500/20">
                  {data.book?.chapterCount || data.chapters?.length} Episode
                </span>
                <div className="flex items-center gap-1 text-yellow-400 font-bold text-xs">
                  <Star size={12} fill="currentColor" /> {data.book?.score || 9.8}
                </div>
              </div>

              <h2 className="text-xl sm:text-3xl font-bold text-white mb-3 leading-tight">{data.book?.bookName || data.book?.title}</h2>
              
              <div className="bg-black/10 rounded-xl p-4 mb-6">
                <h3 className="text-white/60 font-bold text-[10px] uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                  <BookOpen size={14} className="text-blue-500" /> Sinopsis
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed italic line-clamp-4 md:line-clamp-none">
                  {cleanIntro(data.book?.introduction || data.book?.desc)}
                </p>
              </div>

              {bookTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-8">
                  {bookTags.map((tag, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => onTagClick(tag)}
                      className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:bg-blue-600 hover:text-white hover:border-transparent transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-auto">
                <h3 className="text-xs sm:text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Plus size={16} className="text-blue-500" /> Daftar Episode
                </h3>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                  <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 overflow-y-auto pr-1">
                    {data.chapters?.map((ch) => (
                      <button 
                        key={ch.index} 
                        onClick={() => onPlayEpisode(ch.num || (ch.index + 1), data.book, data.chapters)} 
                        className="bg-slate-700 hover:bg-blue-600 text-white py-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all active:scale-95 shadow-sm"
                      >
                        {String(ch.num || (ch.index + 1))}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
  const requestRef = useRef(0);
  const controlsTimeoutRef = useRef(null);

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const loadEpisode = useCallback(async (epNum) => {
    setLoading(true); setError(false); setVideoUrl(''); setIsPlaying(false); setShowControls(true);
    const requestId = ++requestRef.current;
    try {
      const core = window.DramaboxCore;
      if (!core) throw new Error("API Core belum siap");
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
    handleMouseMove();
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
    <div 
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden"
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
    >
      {/* --- TOP BAR (Minimalist) --- */}
      <div className={`absolute top-0 left-0 right-0 p-4 sm:p-6 z-50 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button onClick={onBack} className="text-white/80 p-2 hover:bg-white/10 rounded-full transition-all">
          <ChevronLeft size={28} />
        </button>
        <div className="text-center flex-1 min-w-0 px-4">
          <h2 className="text-white font-bold text-sm sm:text-base truncate">{book.bookName}</h2>
          <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Episode {currentEp}</p>
        </div>
        <button onClick={handleShare} className="text-white/80 p-2 hover:bg-white/10 rounded-full transition-all">
          <Share2 size={20} />
        </button>
      </div>

      {/* --- VIDEO CONTAINER --- */}
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden" onClick={togglePlay}>
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-blue-500" size={48} />
            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Processing...</p>
          </div>
        ) : error ? (
          <div className="text-center p-6 flex flex-col items-center bg-white/5 backdrop-blur-md rounded-3xl border border-white/10">
            <AlertTriangle className="text-red-500 mb-4" size={40} />
            <p className="text-white mb-6 text-xs font-bold uppercase tracking-wider">Video Gagal Dimuat</p>
            <button onClick={() => loadEpisode(currentEp)} className="px-8 py-3 bg-blue-600 text-white rounded-full font-black text-xs tracking-[0.2em] shadow-lg shadow-blue-600/30 active:scale-95 transition">COBA LAGI</button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef}
              src={videoUrl}
              autoPlay={audioSettings.autoNext}
              className="w-full h-full object-contain cursor-pointer"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => setCurrentTime(videoRef.current.currentTime)}
              onLoadedMetadata={() => {
                setDuration(videoRef.current.duration);
                if (videoRef.current) {
                  videoRef.current.volume = audioSettings.volume;
                  videoRef.current.playbackRate = audioSettings.playbackRate;
                  videoRef.current.muted = audioSettings.isMuted;
                }
              }}
              onEnded={() => audioSettings.autoNext && handleNext()}
              playsInline
              webkit-playsinline="true"
              preload="auto"
            />
            
            {/* Center Play/Pause Overlay */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                <div className="bg-white/10 p-6 rounded-full backdrop-blur-sm border border-white/20 scale-125 transition-transform duration-300">
                  <Play size={40} fill="white" className="text-white ml-1" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* --- BOTTOM CONTROLS (Minimalist & Responsive) --- */}
      <div className={`absolute bottom-0 left-0 right-0 p-4 sm:p-8 z-50 transition-all duration-500 transform ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          
          {/* Timeline & Progress */}
          <div className="flex flex-col gap-2">
            <div className="relative group/timeline h-6 flex items-center">
              <input 
                type="range" min="0" max={duration || 0} step="0.1" 
                value={currentTime} 
                onChange={handleSeek}
                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-600 hover:h-1.5 transition-all"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono font-bold text-white/50 tracking-tighter">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls Wrapper */}
          <div className="flex items-center justify-between bg-black/40 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl sm:rounded-3xl">
            <div className="flex items-center gap-4 sm:gap-8">
              <button 
                disabled={currentEp <= 1}
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="text-white/60 hover:text-white transition disabled:opacity-20"
              >
                <SkipBack size={24} fill="currentColor" />
              </button>
              
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white transition-transform active:scale-90">
                {isPlaying ? <Pause size={36} fill="white" /> : <Play size={36} fill="white" />}
              </button>
              
              <button 
                disabled={currentEp >= (chapters?.length || 999)}
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="text-white/60 hover:text-white transition disabled:opacity-20"
              >
                <SkipForward size={24} fill="currentColor" />
              </button>
            </div>

            <div className="flex items-center gap-3 sm:gap-6">
              {/* Volume Slider Desktop View */}
              <div className="hidden sm:flex items-center gap-2 group/volume bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <button onClick={(e) => { e.stopPropagation(); setAudioSettings(prev => ({ ...prev, isMuted: !prev.isMuted })); }} className="text-white/70 hover:text-white">
                  {audioSettings.isMuted || audioSettings.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input 
                  type="range" min="0" max="1" step="0.01"
                  value={audioSettings.isMuted ? 0 : audioSettings.volume}
                  onChange={(e) => { e.stopPropagation(); handleVolumeChange(e); }}
                  className="w-20 h-1 accent-blue-500 bg-white/20 rounded-full cursor-pointer"
                />
              </div>

              {/* Volume Icon Mobile (Only toggle) */}
              <button className="sm:hidden text-white/70" onClick={(e) => { e.stopPropagation(); setAudioSettings(prev => ({ ...prev, isMuted: !prev.isMuted })); }}>
                 {audioSettings.isMuted || audioSettings.volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); togglePlaybackRate(); }}
                className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-[10px] font-black text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
              >
                {audioSettings.playbackRate}X
              </button>
              
              <div className="hidden xs:flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer opacity-60 hover:opacity-100 transition">
                  <input 
                    type="checkbox" checked={audioSettings.autoNext} 
                    onChange={(e) => { e.stopPropagation(); setAudioSettings(prev => ({ ...prev, autoNext: e.target.checked })); }} 
                    className="w-3 h-3 accent-blue-600 rounded-sm bg-black border-white/20"
                  />
                  <span className="text-[9px] font-bold text-white uppercase tracking-tighter">Auto</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

  const [selectedBookId, setSelectedBookId] = useState(null);
  const [playerState, setPlayerState] = useState({ book: {}, chapters: [], ep: 1 });

  const getToken = useCallback(async () => {
    const core = window.DramaboxCore;
    if (!core) return null;
    try {
      const device = await core.getDevice();
      return await core.getToken(CONFIG.API_BASE, CONFIG.LOCALE_API, device, false);
    } catch (e) {
      console.error("Token Error:", e);
      return null;
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    const core = window.DramaboxCore;
    if (!core) return;
    try {
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      if (!tokenInfo) return;
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
    const core = window.DramaboxCore;
    if (!core) {
      setLoadingHome(false);
      return;
    }
    setLoadingHome(true);
    try {
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      if (!tokenInfo) throw new Error("No token");
      const [pop, lat] = await Promise.all([
        core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, CONFIG.FEED_IDS.POPULAR, 18),
        core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, CONFIG.FEED_IDS.LATEST, 12)
      ]);
      setHomeData({ popular: pop || [], latest: lat || [] });
    } catch (e) {
       console.error("Home fetch error:", e);
    } finally { setLoadingHome(false); }
  }, [getToken]);

  const fetchRank = useCallback(async (type, pageNum = 1) => {
    const core = window.DramaboxCore;
    if (!core) return;
    if (pageNum === 1) {
      setLoading(true);
      setRankData([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      if (!tokenInfo) return;
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
    const core = window.DramaboxCore;
    if (!core || !keyword) return;
    if (pageNum === 1) {
      setLoading(true);
      setSearchData([]);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await core.searchBooks(CONFIG.API_BASE, CONFIG.LOCALE_API, keyword, pageNum, CONFIG.PER_PAGE);
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

  const openDetail = (item) => { 
    setSelectedBookId(item.bookId || item.id); 
    setPreviousView(view);
    setView('detail'); 
  };
  
  const onPlayEpisode = (epNum, book, chapters) => { 
    setPlayerState({ book, chapters, ep: epNum }); 
    setPreviousView(view);
    setView('player'); 
  };

  const handleTagClick = (tagName) => {
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
  };

  useEffect(() => { 
    if (scriptLoaded && !scriptError) { 
      fetchHome(); 
      fetchAllData(); 
    } else if (scriptError) {
      setLoadingHome(false);
    }
  }, [scriptLoaded, scriptError, fetchHome, fetchAllData]);
  
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
  };

  const renderGrid = (items, isLoading, isRankView = false) => {
    if (isLoading && (!items || items.length === 0)) {
      return (
        <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      );
    }
    if (!items || items.length === 0) return <div className="text-slate-500 text-center py-10 italic">Tidak ada konten ditemukan.</div>;
    return (
      <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
        {items.map((item, idx) => (
          <DramaCard 
            key={idx} 
            item={item} 
            onClick={openDetail} 
            rank={isRankView ? idx + 1 : null} 
          />
        ))}
      </div>
    );
  };

  if (view === 'player') {
    return (
      <CustomPlayerPage 
        {...playerState} 
        initialEp={playerState.ep} 
        onBack={() => setView('detail')} 
        audioSettings={audioSettings}
        setAudioSettings={setAudioSettings}
      />
    );
  }

  return (
    <div className="bg-[#0f172a] h-screen text-slate-200 font-sans flex flex-col overflow-hidden">
      {/* --- NAVBAR --- */}
      <nav className="flex-none h-16 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 flex items-center z-40 px-4">
        <div className="container mx-auto flex justify-between items-center max-w-7xl">
          <button onClick={() => setView('home')} className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">D</div>
            <span className="text-lg font-bold tracking-tight text-white hidden xs:block">Nonton<span className="text-blue-400">Dracin</span></span>
          </button>
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5 overflow-hidden">
            {[ 
              { id: 'home', label: 'Beranda', icon: Home }, 
              { id: 'rank', label: 'Peringkat', icon: Trophy } 
            ].map((menuItem) => {
              const Icon = menuItem.icon;
              return (
                <button key={menuItem.id} onClick={() => setView(menuItem.id)} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-2 transition-all ${view === menuItem.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                  <Icon size={14} /> <span className="hidden sm:inline">{menuItem.label}</span>
                </button>
              );
            })}
            <button onClick={() => setView('filter')} className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-2 transition-all ${view === 'filter' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
              <Filter size={14} /> <span className="hidden xs:inline">Filter</span>
            </button>
            <button onClick={() => setSearchModalOpen(true)} className={`p-2 rounded-full transition-all ${view === 'search' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Search size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* --- CONTENT AREA --- */}
      <main className="flex-1 overflow-y-auto no-scrollbar pt-4 pb-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          {scriptError && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6 flex items-center gap-3 text-red-400">
              <AlertTriangle size={20} />
              <p className="text-xs font-bold">Gagal memuat sistem inti. Mohon segarkan halaman atau cek koneksi internet.</p>
            </div>
          )}

          {view === 'home' && (
            <div className="animate-in fade-in duration-500">
               {homeData.popular[0] && (
                 <div className="mb-8 relative rounded-2xl sm:rounded-3xl overflow-hidden min-h-[250px] sm:min-h-[350px] flex items-center bg-[#1e293b] shadow-2xl shrink-0">
                   <div className="absolute inset-0">
                     <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover opacity-30 blur-[2px] sm:opacity-40" alt="Hero BG"/>
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-[#0f172a]/90"></div>
                   </div>
                   <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 p-6 sm:p-10 w-full">
                     <div className="hidden md:block w-1/3 max-w-[220px]">
                       <div className="aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl transform hover:scale-105 transition duration-500 cursor-pointer" onClick={() => openDetail(homeData.popular[0])}>
                         <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover" alt="Hero Poster" />
                       </div>
                     </div>
                     <div className="w-full md:w-2/3 text-center md:text-left">
                       <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600/90 text-white text-[10px] font-bold rounded-full mb-3 shadow-lg shadow-red-600/20"><Flame size={12} fill="white" /> #1 POPULER</div>
                       <h1 className="text-xl sm:text-4xl font-bold text-white mb-3 leading-tight">{String(homeData.popular[0].bookName)}</h1>
                       <p className="text-gray-300 mb-6 max-w-2xl mx-auto md:mx-0 line-clamp-3 text-xs sm:text-sm">{cleanIntro(homeData.popular[0].introduction || homeData.popular[0].desc)}</p>
                       <button onClick={() => openDetail(homeData.popular[0])} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition shadow-lg active:scale-95 flex items-center justify-center gap-2 mx-auto md:mx-0"><Play size={18} fill="white" /> Lihat Detail</button>
                     </div>
                   </div>
                 </div>
               )}
              
              <div className="mb-10">
                <div className="flex items-center justify-between mb-4 border-l-4 border-red-500 pl-3">
                  <h2 className="text-base sm:text-lg font-bold text-white">Drama Populer</h2>
                  <button onClick={() => navigateToListView('popular')} className="text-blue-400 hover:text-white text-[10px] sm:text-xs font-bold flex items-center gap-1">Lihat Semua <ChevronRight size={14} /></button>
                </div>
                {renderGrid(homeData.popular.slice(1), loadingHome)}
              </div>

              <div className="mb-10">
                <div className="flex items-center justify-between mb-4 border-l-4 border-blue-500 pl-3">
                  <h2 className="text-base sm:text-lg font-bold text-white">Update Terbaru</h2>
                  <button onClick={() => navigateToListView('latest')} className="text-blue-400 hover:text-white text-[10px] sm:text-xs font-bold flex items-center gap-1">Lihat Semua <ChevronRight size={14} /></button>
                </div>
                {renderGrid(homeData.latest, loadingHome)}
              </div>
            </div>
          )}

          {view === 'rank' && (
            <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-6 text-center">Papan Peringkat</h1>
              <div className="flex justify-start sm:justify-center mb-8 overflow-x-auto gap-2 pb-2 no-scrollbar">
                {[ { id: 'trending', label: 'Trending', icon: Flame }, { id: 'popular', label: 'Populer', icon: Trophy }, { id: 'latest', label: 'Terbaru', icon: Clock } ].map((tab) => (
                  <button key={tab.id} onClick={() => setRankTab(tab.id)} className={`px-4 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${rankTab === tab.id ? 'bg-blue-600 text-white shadow-blue-600/20 shadow-lg' : 'text-slate-400 hover:text-slate-200 bg-slate-800/50'}`}><tab.icon size={14} /> {tab.label}</button>
                ))}
              </div>
              {renderGrid(rankData, loading, true)}
              {hasMoreRank && rankData.length > 0 && (
                <div className="mt-8 flex justify-center">
                  <button onClick={handleLoadMoreRank} disabled={loadingMore} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl font-bold transition flex items-center gap-2 shadow-xl active:scale-95">
                    {loadingMore ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Memuat Lebih Banyak
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'filter' && (
            <div className="animate-in fade-in duration-500 h-full flex flex-col">
              <div className="mb-6 flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500"><Filter size={20} /></div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Eksplorasi Drama</h1>
              </div>
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 mb-8 backdrop-blur-md">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {STATIC_FILTERS.map((group) => (
                    <div key={group.key}>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">{group.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.options.map((opt) => (
                          <button key={opt.value} onClick={() => toggleFilter(group.key, opt.value)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${activeFilters[group.key] === opt.value ? 'bg-blue-600 border-transparent text-white' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'}`}>{opt.display}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {allDramaData.length === 0 ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" size={32} /></div> : renderGrid(filterData, false)}
            </div>
          )}

          {view === 'search' && (
            <div className="h-full animate-in fade-in">
              <h1 className="text-lg sm:text-xl font-bold text-white mb-6">Hasil Pencarian: <span className="text-blue-400 italic">"{searchQuery}"</span></h1>
              {renderGrid(searchData, loading)}
              {hasMoreSearch && searchData.length > 0 && (
                <div className="mt-8 flex justify-center">
                  <button onClick={handleLoadMoreSearch} disabled={loadingMore} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl font-bold transition flex items-center gap-2 active:scale-95 shadow-lg">
                    {loadingMore ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Muat Lebih Banyak
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'detail' && (
            <DramaDetailPage 
              bookId={selectedBookId} 
              onBack={() => setView(previousView)} 
              onPlayEpisode={onPlayEpisode}
              onTagClick={handleTagClick}
            />
          )}
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="flex-none bg-[#0f172a] border-t border-white/5 py-4 px-4 overflow-hidden">
        <div className="container mx-auto max-w-4xl flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] text-slate-500 font-bold">
            © 2026 <a href="https://sanpoi.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline transition-all">SanPoi</a> | Made with AI
          </p>
          <p className="text-[9px] text-slate-600 leading-tight max-w-2xl italic hidden sm:block">
            We do not host or stream any video content. All trademarks and copyrighted materials are owned by their respective owners. This site is for information, reviews, and references only. Please watch content through official and legal streaming services.
          </p>
          <p className="text-[9px] text-slate-600 font-mono">
            API by <a href="https://drachin.dicky.app" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">https://drachin.dicky.app</a>
          </p>
        </div>
      </footer>

      {/* --- SEARCH OVERLAY --- */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setSearchModalOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                autoFocus 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Cari drama favorit..." 
                className="bg-slate-800 text-white w-full pl-11 pr-4 py-3 rounded-xl border border-white/5 outline-none focus:border-blue-500 transition-all font-bold text-sm" 
                onKeyDown={handleSearchSubmit} 
              />
            </div>
          </div>
        </div>
      )}
      
      {loading && (view === 'home' || view === 'rank' || view === 'search') && (
        <div className="fixed bottom-16 right-6 sm:bottom-20 sm:right-8 bg-blue-600 p-3 sm:p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-40 border border-white/10">
          <Loader2 className="animate-spin text-white" size={18}/><span className="text-[10px] font-black uppercase tracking-widest text-white">Sinkronisasi...</span>
        </div>
      )}
    </div>
  );
}
