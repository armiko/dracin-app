import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Plus, X, Search, Home, Clock, Flame, ChevronRight, SkipBack, SkipForward, AlertTriangle, Loader2 } from 'lucide-react';

// --- KONFIGURASI API ---
const CONFIG = {
  SCRIPT_URL: "https://nontondracin.com/vendor/core/plugins/dramabox/js/dramabox-core.js?v=2.1.8",
  API_BASE: "https://drachin.dicky.app",
  LOCALE_API: "in",
  LOCALE_URL: "id",
  MAX_ITEMS_HOME: 18,
  LATEST_PAGE_SIZE: 24
};

// --- HELPER: Load External Script ---
const useExternalScript = (url) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (document.querySelector(`script[src="${url}"]`)) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError(true);
    document.body.appendChild(script);
  }, [url]);

  return { loaded, error };
};

// --- HELPER: Clean HTML String ---
const cleanIntro = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?p[^>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// --- HELPER: Extract Video URL ---
const extractVideoUrl = (chapter) => {
  if (!chapter) return '';
  let src = chapter;
  if (chapter.raw && chapter.raw.cdnList) src = chapter.raw;
  else if (chapter.cdnList) src = chapter;

  const cdnList = src.cdnList || [];
  let candidates = [];

  cdnList.forEach((cdn) => {
    (cdn.videoPathList || []).forEach((v) => {
      candidates.push({
        url: v.videoPath,
        quality: v.quality || 0,
        isDefault: v.isDefault || 0,
        isVip: v.isVipEquity || 0,
        isCdnDefault: cdn.isDefault || 0,
      });
    });
  });

  if (!candidates.length) return '';

  candidates.sort((a, b) => {
    if (a.isVip !== b.isVip) return a.isVip - b.isVip;
    if (a.isDefault !== b.isDefault) return b.isDefault - a.isDefault;
    if (a.isCdnDefault !== b.isCdnDefault) return b.isCdnDefault - a.isCdnDefault;
    return b.quality - a.quality;
  });

  return candidates[0].url || '';
};

// --- COMPONENT: Card ---
const DramaCard = ({ item, onClick }) => {
  const cover = item.coverWap || item.cover || item.poster || item.image || 'https://via.placeholder.com/300x450?text=No+Image';
  const title = item.bookName || item.title || item.name || 'Untitled';
  const ep = item.chapterCount || item.totalEpisode || item.ep || '?';

  return (
    <div className="group relative cursor-pointer" onClick={() => onClick(item)}>
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 shadow-lg bg-gray-800">
        <img 
          src={cover} 
          alt={title} 
          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500 ease-in-out"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
          <button className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded-lg shadow-lg flex items-center justify-center gap-1">
            <Play size={12} fill="currentColor" /> PLAY
          </button>
        </div>
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 shadow-sm">
          {ep} EPS
        </div>
      </div>
      <h3 className="text-white font-semibold text-sm leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">
        {title}
      </h3>
    </div>
  );
};

// --- COMPONENT: Skeleton ---
const SkeletonCard = () => (
  <div className="space-y-3 animate-pulse">
    <div className="aspect-[2/3] rounded-xl bg-gray-800"></div>
    <div className="h-4 w-3/4 rounded bg-gray-800"></div>
    <div className="h-3 w-1/2 rounded bg-gray-800"></div>
  </div>
);

// --- COMPONENT: Modal Detail ---
const DetailModal = ({ isOpen, onClose, bookId, onPlayEpisode }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !bookId) return;
    
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const core = window.DramaboxCore;
        const result = await core.loadDetailWithRecommend({
          apiBase: CONFIG.API_BASE,
          localeApi: CONFIG.LOCALE_API,
          bookId: bookId,
          webficBase: 'https://www.webfic.com',
        });
        setData(result);
      } catch (err) {
        console.error("Detail Error:", err);
        setError("Gagal memuat detail drama.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [isOpen, bookId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1e293b] w-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl relative my-8 flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500 transition">
          <X size={18} />
        </button>

        <div className="overflow-y-auto custom-scroll flex-1">
          {loading ? (
            <div className="p-8 flex flex-col md:flex-row gap-6 animate-pulse">
              <div className="w-full md:w-1/3 aspect-[2/3] bg-gray-800 rounded-xl"></div>
              <div className="w-full md:w-2/3 space-y-4">
                <div className="h-8 w-3/4 bg-gray-800 rounded"></div>
                <div className="h-4 w-full bg-gray-800 rounded"></div>
                <div className="h-4 w-1/2 bg-gray-800 rounded"></div>
              </div>
            </div>
          ) : error ? (
            <div className="p-10 text-center text-red-400">{error}</div>
          ) : data ? (
            <div>
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-1/3 relative bg-black/20">
                  <img 
                    src={data.book?.cover || data.book?.image || 'https://via.placeholder.com/300x450'} 
                    alt="Poster" 
                    className="w-full h-full object-cover aspect-[2/3] md:min-h-[500px]"
                  />
                </div>
                
                <div className="w-full md:w-2/3 p-6 md:p-8 flex flex-col relative bg-[#1e293b]">
                  <div className="mb-6">
                    <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full w-fit mb-3">DRAMA</span>
                    <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 leading-tight">
                      {data.book?.bookName || data.book?.title}
                    </h2>
                    <div className="flex items-center gap-4 text-gray-400 text-sm mb-4">
                      <span>{data.chapters?.length || 0} Eps</span>
                      <span className="flex items-center gap-1 text-yellow-500">★ 9.8</span>
                      <span className="px-2 py-0.5 border border-gray-600 rounded text-xs">HD</span>
                    </div>
                    <p className="text-gray-300 mb-6 leading-relaxed text-sm md:text-base max-h-32 overflow-y-auto pr-2">
                      {cleanIntro(data.book?.introduction || data.book?.desc)}
                    </p>
                    
                    <div className="flex gap-3 mb-8">
                      <button 
                        onClick={() => onPlayEpisode(data.chapters?.[0]?.num || 1, data.book, data.chapters)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                      >
                        <Play size={18} fill="currentColor" /> Mulai Nonton
                      </button>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <h3 className="text-lg font-bold text-white mb-3 flex justify-between items-center">
                      <span>Episode List</span>
                      <span className="text-xs font-normal text-gray-400">({data.chapters?.length})</span>
                    </h3>
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[200px] overflow-y-auto pr-2">
                        {data.chapters?.map((ch) => (
                          <button 
                            key={ch.index}
                            onClick={() => onPlayEpisode(ch.num || (ch.index + 1), data.book, data.chapters)}
                            className="bg-gray-700 hover:bg-blue-600 text-white text-center py-2 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {ch.num || (ch.index + 1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 bg-black/20 border-t border-white/5">
                <h3 className="text-lg font-bold text-white mb-4">Rekomendasi Serupa</h3>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {data.related?.slice(0, 6).map((item) => (
                    <div key={item.bookId || item.id} className="cursor-pointer group" onClick={() => {
                        alert("Silakan tutup dan pilih drama ini dari daftar utama.");
                    }}>
                      <div className="aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-gray-800">
                        <img 
                          src={item.cover || item.poster} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          alt={item.title}
                        />
                      </div>
                      <h4 className="text-xs text-gray-300 truncate group-hover:text-white">{item.bookName || item.title}</h4>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: Player Modal ---
const PlayerModal = ({ isOpen, onClose, book, chapters, initialEp }) => {
  const [currentEp, setCurrentEp] = useState(initialEp);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [autoNext, setAutoNext] = useState(true);
  
  const requestRef = useRef(0);

  const loadEpisode = useCallback(async (epNum) => {
    setLoading(true);
    setError(false);
    setVideoUrl(''); 
    
    const requestId = ++requestRef.current;
    
    try {
      const core = window.DramaboxCore;
      const apiIndex = epNum - 1; 
      
      const batchRes = await core.loadViaBatch({
        apiBase: CONFIG.API_BASE,
        localeApi: CONFIG.LOCALE_API,
        bookId: book.bookId || book.id,
