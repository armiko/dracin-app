import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, X, Search, Home, Clock, Flame, 
  ChevronRight, SkipBack, SkipForward, AlertTriangle, 
  Loader2, Trophy, Filter, Star, ChevronLeft
} from 'lucide-react';

// --- KONFIGURASI API & KONSTANTA ---
const CONFIG = {
  SCRIPT_URL: "https://nontondracin.com/vendor/core/plugins/dramabox/js/dramabox-core.js?v=2.1.8",
  API_BASE: "https://drachin.dicky.app",
  LOCALE_API: "in",
  LOCALE_URL: "id",
  FEED_IDS: {
    POPULAR: 1,
    LATEST: 2,
    TRENDING: 3
  }
};

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

/**
 * LOGIKA EKSTRAKSI VIDEO (Diambil dari skrip HTML referensi)
 * Menangani cdnList, videoPathList, dan penggabungan domain.
 */
const extractVideoUrlFromChapter = (chapter) => {
  if (!chapter) return '';

  // 1. Ambil sumber data (raw atau root)
  let src = chapter.raw || chapter;
  
  // 2. Coba ambil URL langsung jika tersedia
  if (typeof src.mp4 === 'string' && src.mp4) return src.mp4;
  if (typeof src.m3u8Url === 'string' && src.m3u8Url) return src.m3u8Url;
  if (typeof src.videoUrl === 'string' && src.videoUrl) return src.videoUrl;
  if (typeof src.url === 'string' && src.url) return src.url;

  // 3. Logika Parsing cdnList (Sesuai script referensi)
  const cdnList = src.cdnList || [];
  let candidates = [];

  const extractPath = (entry) => {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object') {
      return entry.videoPath || entry.path || entry.url || entry.playUrl || entry.videoUrl || '';
    }
    return '';
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
    // Urutkan: Non-VIP > Default Video > Default CDN > Kualitas Tertinggi
    candidates.sort((a, b) => {
      if (a.isVip !== b.isVip) return a.isVip - b.isVip;
      if (a.isDefault !== b.isDefault) return b.isDefault - a.isDefault;
      if (a.isCdnDefault !== b.isCdnDefault) return b.isCdnDefault - a.isCdnDefault;
      return b.quality - a.quality;
    });

    const best = candidates[0];
    let finalUrl = best.url;

    // Cek apakah URL bersifat relatif (tidak diawali http)
    if (finalUrl && !/^https?:\/\//i.test(finalUrl) && best.domain) {
      const base = best.domain.startsWith('http') ? best.domain : 'https://' + best.domain;
      finalUrl = base.replace(/\/+$/, '') + '/' + finalUrl.replace(/^\/+/, '');
    }
    return finalUrl;
  }

  // 4. Fallback ke properti video lainnya
  if (src.chapterVideo && typeof src.chapterVideo === 'object') {
    const cv = src.chapterVideo;
    return cv.mp4 || cv.m3u8Url || cv.videoUrl || '';
  }

  return '';
};

// --- HOOK: Muat Skrip Eksternal ---
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

const FilterGroup = ({ title, type, options, active, onToggle, scrollable }) => (
  <div className="mb-5">
    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">{title}</p>
    <div className={`flex ${scrollable ? 'overflow-x-auto pb-2 gap-2' : 'flex-wrap gap-2'}`}>
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onToggle(type, opt.value)}
          className={`px-4 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-all duration-200 border ${
            String(active) === String(opt.value) 
              ? 'bg-gradient-to-r from-orange-500 via-pink-500 to-indigo-600 border-transparent text-white shadow-lg' 
              : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-pink-500/50 hover:text-white'
          }`}
        >
          {opt.display}
        </button>
      ))}
    </div>
  </div>
);

const DramaCard = ({ item, onClick, rank }) => {
  const cover = String(item.coverWap || item.cover || item.poster || item.image || 'https://via.placeholder.com/300x450');
  const title = String(item.bookName || item.title || item.name || 'Tanpa Judul');
  const ep = String(item.chapterCount || item.totalEpisode || '?');
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

const DetailModal = ({ isOpen, onClose, bookId, onPlayEpisode }) => {
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
                <p className="text-gray-300 mb-6 text-sm md:text-base line-clamp-4">{cleanIntro(data.book?.introduction || data.book?.desc)}</p>
                <div className="mt-auto">
                  <h3 className="text-lg font-bold text-white mb-3">Daftar Episode</h3>
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

const PlayerModal = ({ isOpen, onClose, book, chapters, initialEp }) => {
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const requestRef = useRef(0);

  const loadEpisode = useCallback(async (epNum) => {
    setLoading(true); setError(false); setVideoUrl(''); 
    const requestId = ++requestRef.current;
    
    try {
      const core = window.DramaboxCore;
      const apiIndex = epNum - 1; 
      
      // 1. Panggil Batch API (Sesuai script referensi)
      const batchRes = await core.loadViaBatch({
        apiBase: CONFIG.API_BASE, 
        localeApi: CONFIG.LOCALE_API, 
        bookId: book.bookId || book.id, 
        index: epNum, // Script referensi mengirim index sebagai nomor episode
      });

      if (requestId !== requestRef.current) return;

      // 2. Cari data chapter dari hasil batch
      const data = batchRes.data || batchRes;
      const list = data.chapterList || data.chapters || data.list || (Array.isArray(batchRes) ? batchRes : []);
      
      const batchCh = list.find(item => 
        String(item.num) === String(epNum) || 
        item.index === apiIndex || 
        String(item.chapterNum) === String(epNum)
      ) || list[0];

      if (!batchCh) throw new Error("Data episode tidak ditemukan");

      // 3. Gabungkan dengan data Webfic (Daftar Chapter yang tersimpan di state)
      const wfCh = chapters.find(c => String(c.num) === String(epNum)) || chapters[apiIndex];
      if (batchCh && wfCh) {
        batchCh.rawWebfic = wfCh.raw || wfCh;
      }

      // 4. Ekstraksi URL menggunakan logika pickVideoUrlFromChapter atau extract manual
      let url = '';
      if (core.pickVideoUrlFromChapter) {
        url = core.pickVideoUrlFromChapter(batchCh);
      }
      
      if (!url) {
        url = extractVideoUrlFromChapter(batchCh);
      }

      if (url) {
        setVideoUrl(url);
      } else {
        throw new Error("URL Video tidak tersedia");
      }
    } catch (e) { 
      if (requestId === requestRef.current) {
        console.error("Player Error:", e);
        setError(true);
      }
    } finally { 
      if (requestId === requestRef.current) setLoading(false); 
    }
  }, [book, chapters]);

  useEffect(() => { if (isOpen) setCurrentEp(initialEp); }, [isOpen, initialEp]);
  useEffect(() => { if (isOpen && currentEp) loadEpisode(currentEp); }, [isOpen, currentEp, loadEpisode]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col animate-in fade-in duration-300">
      <div className="p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent text-white">
        <h3 className="font-bold truncate max-w-[70%]">{String(book?.bookName || 'Memutar...')} Ep {currentEp}</h3>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
      </div>
      <div className="flex-1 flex justify-center items-center relative bg-black">
        {loading ? <Loader2 className="animate-spin text-blue-500" size={48} /> : 
         error ? (
           <div className="text-center p-6 flex flex-col items-center">
             <AlertTriangle className="text-yellow-500 mb-4" size={48} />
             <p className="text-white mb-2 font-bold">Video Gagal Dimuat</p>
             <button onClick={() => loadEpisode(currentEp)} className="px-8 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-500 transition shadow-lg">Coba Lagi</button>
           </div>
         ) :
         <video key={videoUrl} src={videoUrl} controls autoPlay className="w-full h-full max-h-screen object-contain" onEnded={() => autoNext && currentEp < (chapters?.length || 0) && setCurrentEp(prev => prev + 1)} />}
      </div>
      <div className="p-4 bg-[#0f172a] border-t border-gray-800 text-white flex justify-between items-center">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400"><input type="checkbox" checked={autoNext} onChange={e => setAutoNext(e.target.checked)} className="rounded" /> Auto Next</label>
        <div className="flex gap-3">
          <button disabled={currentEp <= 1} onClick={() => setCurrentEp(prev => prev - 1)} className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-30 flex items-center gap-1 hover:bg-gray-700 transition font-bold text-xs"><SkipBack size={16} /> SBLM</button>
          <button disabled={currentEp >= (chapters?.length || 0)} onClick={() => setCurrentEp(prev => prev + 1)} className="px-4 py-2 bg-blue-600 rounded-lg disabled:opacity-30 flex items-center gap-1 hover:bg-blue-500 transition font-bold text-xs">BRKT <SkipForward size={16} /></button>
        </div>
      </div>
    </div>
  );
};

// --- APLIKASI UTAMA ---
export default function App() {
  const { loaded: scriptLoaded, error: scriptError } = useExternalScript(CONFIG.SCRIPT_URL);
  
  const [view, setView] = useState('home'); 
  const [homeData, setHomeData] = useState({ popular: [], latest: [] });
  const [rankData, setRankData] = useState([]);
  const [searchData, setSearchData] = useState([]);
  const [filterData, setFilterData] = useState([]);
  
  // State Filter Dinamis
  const [activeFilters, setActiveFilters] = useState({ region: '', voice: '', member: '', genre: '', theme: '', sort: '1' });
  const [dynamicFilterOptions, setDynamicFilterOptions] = useState([]);
  const [filterPage, setFilterPage] = useState(1);
  const [filterHasMore, setFilterHasMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [rankTab, setRankTab] = useState('trending');
  const [loading, setLoading] = useState(false);
  const [loadingHome, setLoadingHome] = useState(true);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerState, setPlayerState] = useState({ book: {}, chapters: [], ep: 1 });

  const getToken = useCallback(async () => {
    const core = window.DramaboxCore;
    const device = await core.getDevice();
    return await core.getToken(CONFIG.API_BASE, CONFIG.LOCALE_API, device, false);
  }, []);

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
    } catch (e) { console.error(e); } finally { setLoadingHome(false); }
  }, [getToken]);

  const fetchRank = useCallback(async (type) => {
    if (!window.DramaboxCore) return;
    setLoading(true); setRankData([]);
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      let fid = type === 'popular' ? CONFIG.FEED_IDS.POPULAR : type === 'latest' ? CONFIG.FEED_IDS.LATEST : CONFIG.FEED_IDS.TRENDING;
      const res = await core.doClassify(CONFIG.API_BASE, CONFIG.LOCALE_API, device, tokenInfo.token, fid, 30);
      setRankData(res || []);
    } catch (e) {} finally { setLoading(false); }
  }, [getToken]);

  // LOGIKA KATEGORI DINAMIS (Sesuai script filter-page yang diberikan)
  const fetchFilterData = useCallback(async (isLoadMore = false) => {
    if (!window.DramaboxCore) return;
    setLoading(true);
    try {
      const core = window.DramaboxCore;
      const device = await core.getDevice();
      const tokenInfo = await getToken();
      const nextPage = isLoadMore ? filterPage + 1 : 1;
      
      const typeList = [
        { type: 1, value: activeFilters.region },
        { type: 2, value: activeFilters.voice },
        { type: 3, value: activeFilters.member },
        { type: 4, value: activeFilters.genre },
        { type: 4, value: activeFilters.theme },
        { type: 5, value: activeFilters.sort }
      ];

      const ts = Date.now().toString();
      const body = { typeList, showLabels: true, pageNo: nextPage, pageSize: 18 };
      const bodyJson = JSON.stringify(body);
      const baseString = 'timestamp=' + ts + bodyJson + device.deviceId + device.androidId + tokenInfo.token;
      const sn = await core.getSign(CONFIG.API_BASE, baseString);
      
      const res = await fetch(`${CONFIG.API_BASE}/api/proxy.php/drama-box/he001/classify?timestamp=${ts}`, {
        method: 'POST', headers: { 'tn': tokenInfo.token, 'sn': sn, 'device-id': device.deviceId, 'content-type': 'application/json' }, body: bodyJson
      });
      const json = await res.json();
      const data = json.data || {};
      const records = (data.classifyBookList && data.classifyBookList.records) || [];
      
      if (dynamicFilterOptions.length === 0 && data.classifyList) {
        const groups = { 1: 'region', 2: 'voice', 3: 'member', 5: 'sort' };
        const processed = [];
        data.classifyList.forEach(g => {
          if (groups[g.type]) {
            processed.push({ key: groups[g.type], name: g.name, items: g.showList.map(o => ({ value: o.value, display: o.display })) });
          }
        });
        const type4Groups = data.classifyList.filter(f => f.type === 4);
        if (type4Groups.length >= 1) processed.push({ key: 'genre', name: 'Genre', items: type4Groups[0].showList.map(o => ({ value: o.value, display: o.display })) });
        if (type4Groups.length >= 2) processed.push({ key: 'theme', name: 'Tema', items: type4Groups[1].showList.map(o => ({ value: o.value, display: o.display })) });
        setDynamicFilterOptions(processed);
      }

      setFilterData(prev => isLoadMore ? [...prev, ...records] : records);
      setFilterHasMore(!!(data.classifyBookList && data.classifyBookList.isMore));
      setFilterPage(nextPage);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [getToken, activeFilters, filterPage, dynamicFilterOptions.length]);

  const fetchSearch = useCallback(async (keyword) => {
    if (!window.DramaboxCore || !keyword) return;
    setLoading(true); setSearchData([]);
    try {
      const res = await window.DramaboxCore.searchBooks(CONFIG.API_BASE, CONFIG.LOCALE_API, keyword, 1, 30);
      setSearchData(res.items || []);
    } catch (e) {} finally { setLoading(false); }
  }, []);

  const renderGrid = (items, loadingGrid) => {
    if (loadingGrid && (!items || items.length === 0)) {
      return <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">{[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] bg-slate-800 rounded-xl animate-pulse" />)}</div>;
    }
    if (!items || items.length === 0) return <div className="text-slate-500 text-center col-span-full py-20 italic">Tidak ada konten yang ditemukan.</div>;
    return <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">{items.map((item, idx) => <DramaCard key={idx} item={item} onClick={openDetail} />)}</div>;
  };

  const openDetail = (item) => { setSelectedBookId(item.bookId || item.id); setDetailModalOpen(true); };
  const onPlayEpisode = (epNum, book, chapters) => { setPlayerState({ book, chapters, ep: epNum }); setDetailModalOpen(false); setPlayerOpen(true); };

  useEffect(() => { if (scriptLoaded) fetchHome(); }, [scriptLoaded, fetchHome]);
  useEffect(() => { if (view === 'rank') fetchRank(rankTab); }, [view, rankTab, fetchRank]);
  useEffect(() => { if (view === 'filter') fetchFilterData(false); }, [view, activeFilters]);

  const handleSearchSubmit = (e) => { if (e.key === 'Enter') { const q = searchQuery.trim(); if (q) { setView('search'); fetchSearch(q); setSearchModalOpen(false); } } };
  const toggleFilter = (key, val) => setActiveFilters(prev => ({ ...prev, [key]: prev[key] === String(val) ? '' : String(val) }));

  if (scriptError) return <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 text-center text-white"><AlertTriangle size={48} className="text-red-500 mb-4" /><h2 className="text-xl font-bold">Gagal Memuat Library</h2><button onClick={() => window.location.reload()} className="bg-blue-600 px-6 py-2 rounded-lg font-bold mt-4">Muat Ulang</button></div>;
  if (!scriptLoaded) return <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-blue-500 font-bold"><Loader2 className="animate-spin mb-4" size={48} /><p className="animate-pulse">Menghubungkan ke Server...</p></div>;

  return (
    <div className="bg-[#0f172a] min-h-screen text-slate-200 font-sans selection:bg-blue-500/30 flex flex-col">
      
      <nav className="fixed w-full z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-white/5 top-0 h-16 flex items-center">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <button onClick={() => setView('home')} className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">D</div>
            <span className="text-xl font-bold tracking-tight text-white hidden sm:block">Nonton<span className="text-blue-400">Dracin</span></span>
          </button>
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
            {[ { id: 'home', label: 'Beranda', icon: Home }, { id: 'rank', label: 'Peringkat', icon: Trophy } ].map((nav) => (
              <button key={nav.id} onClick={() => setView(nav.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${view === nav.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><nav.icon size={14} /> {nav.label}</button>
            ))}
            <button onClick={() => setView('filter')} className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all ${view === 'filter' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}><Filter size={14} /> Kategori</button>
            <button onClick={() => setSearchModalOpen(true)} className={`p-2 rounded-full transition-all ${view === 'search' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`} title="Cari Drama"><Search size={16} /></button>
          </div>
          <div className="hidden sm:block w-32"></div>
        </div>
      </nav>

      {searchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSearchModalOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300">
            <div className="relative">
              <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Masukkan judul drama..." className="bg-slate-800 text-white w-full pl-12 pr-4 py-3 rounded-xl border border-white/5 outline-none focus:border-blue-500 transition-all" onKeyDown={handleSearchSubmit} />
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            <p className="text-[10px] text-slate-500 mt-3 text-center uppercase tracking-widest">Tekan Enter untuk mencari</p>
          </div>
        </div>
      )}

      <div className="pt-20 pb-10 flex-1">
        {view === 'home' && (
          <div className="container mx-auto px-4 animate-in fade-in duration-500">
            {homeData.popular[0] && (
              <div className="mb-12 relative rounded-2xl overflow-hidden min-h-[300px] md:min-h-[400px] flex items-center bg-[#1e293b]">
                <div className="absolute inset-0">
                  <img src={homeData.popular[0].coverWap || homeData.popular[0].cover} className="w-full h-full object-cover opacity-40 blur-sm" alt="Hero BG"/>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-[#0f172a]/90 flex items-end p-6 md:p-12 w-full">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent"></div>
                  </div>
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
                    <button onClick={() => openDetail(homeData.popular[0])} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 mx-auto md:mx-0"><Play size={20} fill="white" /> Lihat Detail</button>
                  </div>
                </div>
              </div>
            )}
            <div className="mb-12"><div className="flex items-center justify-between mb-6 border-l-4 border-red-500 pl-3"><h2 className="text-xl font-bold text-white">Paling Populer</h2><button onClick={() => setView('rank')} className="text-blue-400 text-xs font-bold hover:text-blue-300 flex items-center gap-1">Lihat Peringkat <ChevronRight size={14}/></button></div>{renderGrid(homeData.popular.slice(1), loadingHome)}</div>
            <div className="mb-12"><div className="flex items-center justify-between mb-6 border-l-4 border-blue-500 pl-3"><h2 className="text-xl font-bold text-white">Update Terbaru</h2><button onClick={() => setView('filter')} className="text-blue-400 text-xs font-bold hover:text-blue-300 flex items-center gap-1">Semua Kategori <ChevronRight size={14}/></button></div>{renderGrid(homeData.latest, loadingHome)}</div>
          </div>
        )}

        {view === 'rank' && (
          <div className="container mx-auto px-4 animate-in slide-in-from-bottom-4 duration-500 text-center">
            <h1 className="text-3xl font-bold text-white mb-8">Papan Peringkat</h1>
            <div className="flex justify-center mb-10 bg-slate-800/50 p-1 rounded-2xl border border-white/5 inline-flex backdrop-blur-md overflow-x-auto">
              {[ { id: 'trending', label: 'Trending', icon: Flame }, { id: 'popular', label: 'Populer', icon: Trophy }, { id: 'latest', label: 'Terbaru', icon: Clock } ].map((tab) => (
                <button key={tab.id} onClick={() => setRankTab(tab.id)} className={`px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${rankTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}><tab.icon size={14} /> {tab.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 text-left">{rankData.map((item, idx) => <DramaCard key={idx} item={item} rank={idx + 1} onClick={openDetail} />)}</div>
          </div>
        )}

        {view === 'filter' && (
          <div className="container mx-auto px-4 animate-in fade-in duration-500">
            <div className="filter-head mb-4 text-left"><h1 className="text-2xl font-bold text-white">Eksplorasi Kategori</h1><p className="text-slate-400 text-sm italic">Cari drama favorit berdasarkan preferensi Anda.</p></div>
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 mb-10 backdrop-blur-md shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 text-left">
                {dynamicFilterOptions.length > 0 ? dynamicFilterOptions.map(group => (
                  <FilterGroup key={group.key} title={group.name} type={group.key} options={[{ display: 'Semua', value: '' }, ...group.items]} active={activeFilters[group.key]} onToggle={toggleFilter} scrollable={group.key === 'genre' || group.key === 'theme'} />
                )) : <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-500 italic"><Loader2 className="animate-spin mb-2" /> Menghubungkan ke API Filter...</div>}
              </div>
            </div>
            {renderGrid(filterData, loading)}
            {filterHasMore && !loading && <div className="flex justify-center mt-12"><button onClick={() => fetchFilterData(true)} className="px-10 py-3 bg-gradient-to-r from-orange-500 via-pink-500 to-indigo-600 text-white rounded-xl font-bold transition shadow-xl hover:scale-105">Muat Lebih Banyak</button></div>}
          </div>
        )}

        {view === 'search' && (
          <div className="container mx-auto px-4 animate-in fade-in duration-500 min-h-[60vh]">
            <h1 className="text-2xl font-bold text-white mb-8">Hasil Pencarian: <span className="text-blue-400">"{searchQuery}"</span></h1>
            {renderGrid(searchData, loading)}
          </div>
        )}
      </div>

      <footer className="border-t border-gray-800 bg-[#0f172a] py-10 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center items-center gap-2 mb-4"><div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">D</div><span className="text-lg font-bold text-white">NontonDracin</span></div>
          <p className="text-gray-400 text-sm mb-4 max-w-2xl mx-auto leading-relaxed">NontonDracin merupakan platform streaming drama Asia modern yang menghadirkan ribuan judul favorit dengan sistem pembaruan data secara real-time untuk memastikan pengalaman menonton Anda selalu yang tercepat dan terdepan.</p>
          <p className="text-gray-600 text-xs mb-4">&copy; 2026 NontonDracin.</p>
          <div className="max-w-2xl mx-auto text-[10px] text-gray-500 leading-relaxed space-y-2 border-t border-gray-800/50 pt-4">
            <p>We do not host or stream any video content. All trademarks and copyrighted materials are owned by their respective owners. This site is for information, reviews, and references only. Please watch content through official and legal streaming services.</p>
            <p className="font-semibold text-gray-400">API by <a href="https://drachin.dicky.app" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">https://drachin.dicky.app</a></p>
          </div>
        </div>
      </footer>

      <DetailModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} bookId={selectedBookId} onPlayEpisode={onPlayEpisode} />
      <PlayerModal isOpen={playerOpen} onClose={() => setPlayerOpen(false)} {...playerState} initialEp={playerState.ep} />
      {loading && view !== 'filter' && <div className="fixed bottom-6 right-6 bg-blue-600 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-[100] border border-white/20"><Loader2 className="animate-spin text-white" size={20}/><span className="text-xs font-bold text-white">Menyinkronkan Data...</span></div>}
    </div>
  );
}
