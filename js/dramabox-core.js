(function (window) {
    'use strict';

    // =====================================================
    // COOKIE HELPERS
    // =====================================================
    function setCookie(name, value, maxAgeSeconds) {
        document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value)
            + '; path=/; max-age=' + maxAgeSeconds;
    }

    function getCookie(name) {
        const cookies = document.cookie ? document.cookie.split('; ') : [];
        for (let i = 0; i < cookies.length; i++) {
            const parts = cookies[i].split('=');
            const key   = decodeURIComponent(parts[0]);
            if (key === name) {
                return decodeURIComponent(parts.slice(1).join('='));
            }
        }
        return null;
    }

    function deleteCookie(name) {
        document.cookie = encodeURIComponent(name) + '=; path=/; max-age=0';
    }

        // =====================================================
        // BASIC HELPERS: SLUG, URL, ESCAPE, RIBBON
        // =====================================================
        function slugify(str) {
            if (!str) return '';

            // Normalisasi dasar
            let s = String(str).trim();

            // Rapikan spasi dulu
            s = s.normalize('NFKC').replace(/\s+/g, ' ').trim();

            // Cek apakah masih punya huruf/angka ASCII
            const asciiOnly = s.replace(/[^\x00-\x7F]/g, '');
            const hasAsciiAlphaNum = asciiOnly.replace(/[^a-zA-Z0-9]+/g, '').length > 0;

            if (hasAsciiAlphaNum) {
                // Mode lama: untuk judul yang ada huruf/angka Latin
                return asciiOnly
                    .toLowerCase()
                    .replace(/[^a-z0-9\s\-]+/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/\-+/g, '-')
                    .replace(/^\-+|\-+$/g, '');
            }

            // FULL non-Latin (Arab/Jepang/Korea/Thai, dll)
            // → jangan dibuang, cukup buang karakter berbahaya & ubah spasi ke "-"
            return s
                .replace(/[\/?#%]+/g, '')   // buang karakter yang bisa ganggu URL
                .replace(/\s+/g, '-')       // spasi → "-"
                .replace(/\-+/g, '-')       // compress multiple "-"
                .replace(/^\-+|\-+$/g, ''); // trim "-"
        }

        function makeDramaUrl(locale, bookId, title, isDefaultLocale) {
            const id = String(bookId);
            let slug = slugify(title || '');

            // Fallback kalau title kosong / semua karakter ke-strip
            if (!slug) {
                slug = 'drama-' + id;
            }

            if (isDefaultLocale) {
                return '/drama/' + slug + '-' + id;
            }

            return '/' + locale + '/drama/' + slug + '-' + id;
        }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // =====================================================
    // SIMPLE TRANSLATE HELPER (ambil dari window.drbxLang)
    // =====================================================
    function t(key, fallback) {
        if (window.drbxLang && Object.prototype.hasOwnProperty.call(window.drbxLang, key)) {
            return window.drbxLang[key];
        }
        return fallback || key;
    }

    function resolveRibbon(name, color) {
        var out = { class: 'ribbon ribbon-default', style: '' };
        var nm  = (name || '').trim();
        var clr = (color || '').trim();

        if (clr) {
            out.class = 'ribbon ribbon-inline-color';
            out.style = 'background: ' + clr;
            return out;
        }

        var slug = nm.toLowerCase();
        if (slug.includes('populer') || slug.includes('popular')) {
            out.class = 'ribbon ribbon-popular';
        } else if (slug.includes('baru') || slug.includes('terbaru') || slug.includes('new')) {
            out.class = 'ribbon ribbon-new';
        } else if (slug.includes('tren') || slug.includes('trending')) {
            out.class = 'ribbon ribbon-trending';
        }

        return out;
    }

    // =====================================================
    // SIGN: via local proxy /dramabox/sign
    // =====================================================
    async function getSign(apiBase, baseString) {
        const url = apiBase.replace(/\/+$/, '') + '/dramabox/sign';

        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: baseString })
        });

        const j = await resp.json().catch(function () { return {}; });

        if (j.status !== 'ok' || !j.data) {
            throw new Error('Sign gagal: ' + JSON.stringify(j));
        }

        return j.data;
    }

    // =====================================================
    // DEVICE (pakai gen-device.php, cached di cookie)
    // =====================================================
    async function getDevice(deviceEndpoint) {
        deviceEndpoint = deviceEndpoint || 'https://api.drachin.online/gen-device.php';

        const saved = getCookie('drbx_device');
        if (saved) {
            try {
                const d = JSON.parse(saved);
                if (d.deviceId && d.androidId) {
                    return d;
                }
            } catch (e) {}
        }

        const resp = await fetch(deviceEndpoint);
        if (!resp.ok) {
            throw new Error('Gagal get device');
        }
        const j = await resp.json();

        const device = {
            deviceId:  j['device-id']  || j['device_id'],
            androidId: j['android-id'] || j['android_id'],
            afid:      j['afid']       || ''
        };

        if (!device.deviceId || !device.androidId) {
            throw new Error('Device invalid: ' + JSON.stringify(j));
        }

        setCookie('drbx_device', JSON.stringify(device), 60 * 60 * 24 * 30);
        return device;
    }

    // =====================================================
    // BOOTSTRAP → TOKEN (ap001/bootstrap via proxy.php)
    // =====================================================
    async function doBootstrap(apiBase, locale, device) {
        const base = apiBase.replace(/\/+$/, '');
        const ts       = Date.now().toString();
        const body     = { distinctId: 'b2043e4b5ee0e9a0', scene: null };
        const bodyJson = JSON.stringify(body);

        const baseString = 'timestamp=' + ts + bodyJson + device.deviceId + device.androidId;
        const sn         = await getSign(base, baseString);

        const langHdr = (locale === 'in' || locale === 'id') ? 'in' : 'en';
        const nowStr  = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' +0700';

        const headers = {
            'version': '470',
            'package-name': 'com.storymatrix.drama',
            'p': '48',
            'cid': 'DRA1000042',
            'apn': '2',
            'country-code': 'ID',
            'mchid': '',
            'mbid': '',
            'tz': '-420',
            'language': langHdr,
            'locale': 'en_ID',
            'is_root': '1',
            'device-id': device.deviceId,
            'nchid': 'DRA1000042',
            'instanceid': '5dbedc0fe1ddcfc92df24899086b7162',
            'md': '23127PN0CC',
            'store-source': 'store_google',
            'mf': 'XIAOMI',
            'device-score': '75',
            'local-time': nowStr,
            'time-zone': '+0700',
            'brand': 'Xiaomi',
            'lat': '0',
            'is_emulator': '1',
            'current-language': langHdr,
            'ov': '12',
            'userid': '337251730',
            'afid': device.afid || '1763133344993-5454297816326183284',
            'android-id': device.androidId,
            'srn': '1440x2560',
            'ins': ts,
            'is_vpn': '1',
            'build': 'Build/W528JS',
            'pline': 'ANDROID',
            'vn': '4.7.0',
            'over-flow': 'new-fly',
            'sn': sn,
            'active-time': '8087',
            'content-type': 'application/json; charset=UTF-8',
            'accept-encoding': 'gzip',
            'user-agent': 'okhttp/4.10.0'
        };

        const url  = base + '/api/proxy.php/drama-box/ap001/bootstrap?timestamp=' + ts;
        const resp = await fetch(url, { method: 'POST', headers: headers, body: bodyJson });

        if (!resp.ok) throw new Error('Bootstrap HTTP error: ' + resp.status);

        const j    = await resp.json();
        const user = j.data && j.data.user ? j.data.user : null;

        if (!user || !user.token) {
            throw new Error('Bootstrap no token: ' + JSON.stringify(j));
        }

        return {
            token: 'Bearer ' + user.token,
            uid:   user.uid || null
        };
    }

    async function getToken(apiBase, locale, device, forceNew) {
        forceNew = !!forceNew;

        if (!forceNew) {
            const saved = getCookie('drbx_token');
            if (saved) {
                try {
                    const t = JSON.parse(saved);
                    if (t.token && t.expiresAt && Date.now() < t.expiresAt) {
                        return t;
                    }
                } catch (e) {}
            }
        }

        const bootInfo  = await doBootstrap(apiBase, locale, device);
        const ttlMs     = 6 * 60 * 60 * 1000;
        const tokenData = {
            token: bootInfo.token,
            uid:   bootInfo.uid || null,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
        };

        setCookie('drbx_token', JSON.stringify(tokenData), ttlMs / 1000);
        return tokenData;
    }

    // =====================================================
    // STREAM URL
    // =====================================================
    function makeStreamUrl(locale, bookId, title, episodeNumber, isDefaultLocale) {
        const id = String(bookId || '').trim();
        if (!id) return '#';

        const base  = title || '';
        const slug  = (typeof slugify === 'function')
            ? slugify(base)
            : String(base).toLowerCase().replace(/\s+/g, '-');

        const ep    = parseInt(episodeNumber || 1, 10) || 1;
        const path  = 'stream/' + slug + '-' + id + '/ep-' + ep;

        if (isDefaultLocale) {
            return '/' + path;
        }

        return '/' + locale + '/' + path;
    }

    // =====================================================
    // CLASSIFY (he001/classify via proxy.php)
    // =====================================================
    async function doClassify(apiBase, locale, device, bearer, feedCode, pageSize, allowRetry) {
        if (allowRetry === undefined) allowRetry = true;

        const base = apiBase.replace(/\/+$/, '');
        const ts = Date.now().toString();

        const body = {
            typeList: [
                { type: 1, value: '' },
                { type: 2, value: '' },
                { type: 4, value: '' },
                { type: 4, value: '' },
                { type: 5, value: String(feedCode) }
            ],
            showLabels: false,
            pageNo: 1,
            pageSize: pageSize
        };

        const bodyJson   = JSON.stringify(body);
        const baseString = 'timestamp=' + ts + bodyJson + device.deviceId + device.androidId + bearer;
        const sn         = await getSign(base, baseString);

        const langHdr = (locale === 'in' || locale === 'id') ? 'in' : locale;
        const nowStr  = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' +0700';

        const headers = {
            'version': '481',
            'package-name': 'com.storymatrix.drama',
            'p': '49',
            'cid': 'DBDASEO1000000',
            'apn': '2',
            'country-code': 'ID',
            'mchid': 'DBDASEO1000000',
            'mbid': '0',
            'tz': '-420',
            'language': langHdr,
            'mcc': '302',
            'locale': 'en_ID',
            'is_root': '1',
            'device-id': device.deviceId,
            'nchid': 'DRA1000042',
            'instanceid': 'fa4ffcd60028854da3aff4d3c2e43cc8',
            'md': '23127PN0CC',
            'store-source': 'store_google',
            'mf': 'XIAOMI',
            'device-score': '75',
            'local-time': nowStr,
            'time-zone': '+0700',
            'brand': 'Xiaomi',
            'lat': '0',
            'is_emulator': '1',
            'current-language': langHdr,
            'ov': '12',
            'userid': '337251730',
            'afid': device.afid || '1763622503350-3593841370232011433',
            'android-id': device.androidId,
            'srn': '1440x2560',
            'ins': ts,
            'is_vpn': '1',
            'build': 'Build/W528JS',
            'pline': 'ANDROID',
            'vn': '4.8.1',
            'over-flow': 'new-fly',
            'tn': bearer,
            'sn': sn,
            'active-time': '9452',
            'content-type': 'application/json; charset=UTF-8',
            'accept-encoding': 'gzip',
            'user-agent': 'okhttp/4.10.0'
        };

        const url  = base + '/api/proxy.php/drama-box/he001/classify?timestamp=' + ts;
        const resp = await fetch(url, { method: 'POST', headers: headers, body: bodyJson });

        if (resp.status === 403) {
            deleteCookie('drbx_token');
            if (allowRetry) {
                const newToken = await getToken(base, locale, device, true);
                return doClassify(base, locale, device, newToken.token, feedCode, pageSize, false);
            }
            throw new Error('he001/classify 403 walau sudah retry');
        }

        const j = await resp.json();

        if (!(j && (j.status === 0 || j.success === true))) {
            if (allowRetry) {
                deleteCookie('drbx_token');
                const newToken = await getToken(base, locale, device, true);
                return doClassify(base, locale, device, newToken.token, feedCode, pageSize, false);
            }
            throw new Error('Classify gagal: ' + JSON.stringify(j));
        }

        const classifyBookList = j.data && j.data.classifyBookList;
        const records          = classifyBookList && classifyBookList.records ? classifyBookList.records : [];

        return records;
    }

    // =====================================================
    // DETAIL + RECOMMEND (WEBFIC)
    // =====================================================
    async function loadDetailWithRecommend(options) {
        const localeApi   = options.localeApi || 'in';
        const bookId      = String(options.bookId || '');
        const webficBase  = options.webficBase || 'https://www.webfic.com';

        if (!bookId) {
            throw new Error('loadDetailWithRecommend: bookId wajib diisi');
        }

        const wfLang = (localeApi === 'id') ? 'in' : localeApi;

        const wfUrl =
            webficBase +
            '/webfic/book/detail/v2?id=' +
            encodeURIComponent(bookId) +
            '&language=' +
            encodeURIComponent(wfLang);

        const resp = await fetch(wfUrl, {
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
            },
        });

        if (!resp.ok) {
            throw new Error('Webfic detail HTTP error: ' + resp.status);
        }

        const j    = await resp.json();
        const data = j.data || {};
        const book = data.book || {};

        // ================== CHAPTER LIST ==================
        const rawChapters =
            Array.isArray(book.chapterList) ? book.chapterList :
            Array.isArray(data.chapterList) ? data.chapterList :
            [];

        const chapters = rawChapters.map(function (ch, idx) {
            const hasIndex = (typeof ch.index === 'number');
            const index    = hasIndex ? ch.index : idx;
            const num      = index + 1;

            const epLabel  = t('episode', 'Episode');

            return {
                raw: ch,
                id: String(ch.id || ''),
                index: index,
                num: num, // 1,2,3,...
                name: ch.name || (epLabel + ' ' + num),
                cover: ch.cover || book.cover || book.bookCover || '',
                m3u8Url: ch.m3u8Url || '',
                mp4: ch.mp4 || '',
                duration: ch.duration || null,
                unlock: !!ch.unlock,
            };
        });

        if (!book.chapterCount) {
            book.chapterCount = chapters.length;
        }

        const relatedRaw =
            data.recommends ||
            data.recommendBooks ||
            data.recommendList ||
            data.recommend ||
            [];

        const related = (relatedRaw || []).map(function (it) {
            const id    = it.bookId || it.id;
            const title = it.bookName || it.title || it.name || 'Tanpa Judul';

            return {
                raw: it,
                bookId: id ? String(id) : '',
                bookName: title,
                cover: it.cover || it.coverWap || it.poster || it.image ||
                    'https://via.placeholder.com/240x400?text=No+Image',
                chapterCount: it.chapterCount || it.totalEpisode || it.episodes || null,
                labels: Array.isArray(it.labels) ? it.labels : [],
                tags: Array.isArray(it.tags) ? it.tags : [],
                typeTwoNames: Array.isArray(it.typeTwoNames) ? it.typeTwoNames : [],
                corner: it.corner || null,
            };
        });

        return {
            raw: j,
            book: book,
            chapters: chapters,
            related: related,
        };
    }

    function pickVideoUrlFromChapter(ch) {
        if (!ch || typeof ch !== 'object') return '';

        // 1. Langsung dari properti standar dulu
        if (typeof ch.mp4 === 'string' && ch.mp4) return ch.mp4;
        if (typeof ch.m3u8Url === 'string' && ch.m3u8Url) return ch.m3u8Url;
        if (typeof ch.playUrl === 'string' && ch.playUrl) return ch.playUrl;
        if (typeof ch.videoUrl === 'string' && ch.videoUrl) return ch.videoUrl;
        if (typeof ch.mediaUrl === 'string' && ch.mediaUrl) return ch.mediaUrl;
        if (typeof ch.url === 'string' && ch.url) return ch.url;

        // helper: ambil path dari item videoPathList (bisa string / object)
        function extractPath(entry) {
            if (!entry) return '';

            if (typeof entry === 'string') {
                return entry;
            }

            if (typeof entry === 'object') {
                return (
                    entry.videoPath ||
                    entry.path ||
                    entry.url ||
                    entry.playUrl ||
                    entry.videoUrl ||
                    ''
                );
            }

            return '';
        }

        // 2. coba dari batch (rawBatch) / raw
        const batch = ch.rawBatch || ch.rawBatchRaw || ch.raw || null;

        if (batch && Array.isArray(batch.cdnList) && batch.cdnList.length) {
            const cdn = batch.cdnList.find(x => x.isDefault === 1) || batch.cdnList[0];

            if (cdn && Array.isArray(cdn.videoPathList) && cdn.videoPathList.length) {
                const mp4Entry  = cdn.videoPathList[1] || cdn.videoPathList[0];
                const m3u8Entry = cdn.videoPathList[0];

                const mp4Path  = extractPath(mp4Entry);
                const m3u8Path = extractPath(m3u8Entry);

                // ⚠️ JIKA SUDAH ABSOLUTE URL, PAKAI LANGSUNG
                if (mp4Path && /^https?:\/\//i.test(mp4Path)) {
                    return mp4Path;
                }
                if (m3u8Path && /^https?:\/\//i.test(m3u8Path)) {
                    return m3u8Path;
                }

                // kalau bukan absolute, baru gabung dengan cdnDomain
                const base = cdn.cdnDomain
                    ? (cdn.cdnDomain.startsWith('http')
                        ? cdn.cdnDomain
                        : 'https://' + cdn.cdnDomain)
                    : '';

                if (base && mp4Path) {
                    return base.replace(/\/+$/, '') + '/' + mp4Path.replace(/^\/+/, '');
                }
                if (base && m3u8Path) {
                    return base.replace(/\/+$/, '') + '/' + m3u8Path.replace(/^\/+/, '');
                }
            }
        }

        // 3. nested chapterVideo
        if (ch.chapterVideo && typeof ch.chapterVideo === 'object') {
            const v = ch.chapterVideo;
            if (typeof v.mp4 === 'string' && v.mp4) return v.mp4;
            if (typeof v.m3u8Url === 'string' && v.m3u8Url) return v.m3u8Url;
            if (typeof v.videoUrl === 'string' && v.videoUrl) return v.videoUrl;
            if (typeof v.playUrl === 'string' && v.playUrl) return v.playUrl;
        }

        // 4. list sumber umum
        if (Array.isArray(ch.sourceList) && ch.sourceList.length) {
            const s = ch.sourceList[0] || {};
            return (
                s.mp4 ||
                s.m3u8Url ||
                s.videoUrl ||
                s.playUrl ||
                s.url ||
                ''
            );
        }

        if (Array.isArray(ch.sources) && ch.sources.length) {
            const s = ch.sources[0] || {};
            return (
                s.mp4 ||
                s.m3u8Url ||
                s.videoUrl ||
                s.playUrl ||
                s.url ||
                ''
            );
        }

        // 5. fallback rawWebfic kalau ada
        const wf = ch.rawWebfic;
        if (wf && typeof wf === 'object') {
            if (typeof wf.mp4 === 'string' && wf.mp4) return wf.mp4;
            if (typeof wf.m3u8Url === 'string' && wf.m3u8Url) return wf.m3u8Url;
            if (typeof wf.playUrl === 'string' && wf.playUrl) return wf.playUrl;
            if (typeof wf.videoUrl === 'string' && wf.videoUrl) return wf.videoUrl;
        }

        return '';
    }

    // =====================================================
    // BATCH LOAD CHAPTERS (chapterv2/batch/load via proxy.php)
    // =====================================================
    // =====================================================
    // BATCH LOAD CHAPTERS (chapterv2/batch/load via proxy.php)
    // - versi per-episode: index diambil dari options.index
    // =====================================================
    async function loadViaBatch(options) {
        const apiBase   = (options.apiBase || '').replace(/\/+$/, '');
        const localeApi = options.localeApi || 'in';
        const bookId    = String(options.bookId || '');
    
        if (!bookId) {
            throw new Error('loadViaBatch: bookId wajib diisi');
        }
    
        // index (episode) diambil dari options.index
        // boleh string / number, kita paksa jadi int >= 1
        let index = 1;
        if (typeof options.index === 'number') {
            index = parseInt(options.index, 10) || 1;
        } else if (typeof options.index === 'string') {
            index = parseInt(options.index, 10) || 1;
        }
        if (index < 1) index = 1;
    
        const locale  = (localeApi === 'id') ? 'in' : localeApi;
        const device  = await getDevice();
        const token   = await getToken(apiBase, locale, device, false);
        const bearer  = token.token;
    
        const ts      = Date.now().toString();
    
        // BODY BARU SESUAI PERMINTAAN
        const body = {
            boundaryIndex: 0,
            index: index, // <--- ini dinamis dari klik episode
            currencyPlaySource: options.currencyPlaySource || 'discover_175_rec',
            currencyPlaySourceName: options.currencyPlaySourceName || '首页发现_Untukmu_推荐列表',
            preLoad: options.preLoad === true ? true : false,
            rid: options.rid || '',
            pullCid: options.pullCid || '',
            loadDirection: 1,
            startUpKey: options.startUpKey || '',
            bookId: bookId,
        };
    
        const bodyJson   = JSON.stringify(body);
        const baseString = 'timestamp=' + ts + bodyJson + device.deviceId + device.androidId + bearer;
        const sn         = await getSign(apiBase, baseString);
    
        const langHdr = (locale === 'in' || locale === 'id') ? 'in' : 'en';
        const nowStr  = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' +0700';
    
        const headers = {
            'version': '481',
            'package-name': 'com.storymatrix.drama',
            'p': '49',
            'cid': 'DBDASEO1000000',
            'apn': '2',
            'country-code': 'ID',
            'mchid': 'DBDASEO1000000',
            'mbid': '0',
            'tz': '-420',
            'language': langHdr,
            'mcc': '302',
            'locale': 'en_ID',
            'is_root': '1',
            'device-id': device.deviceId,
            'nchid': 'DRA1000042',
            'instanceid': 'fa4ffcd60028854da3aff4d3c2e43cc8',
            'md': '23127PN0CC',
            'store-source': 'store_google',
            'mf': 'XIAOMI',
            'device-score': '75',
            'local-time': nowStr,
            'time-zone': '+0700',
            'brand': 'Xiaomi',
            'lat': '0',
            'is_emulator': '1',
            'current-language': langHdr,
            'ov': '12',
            'userid': '337251730',
            'afid': device.afid || '1763622503350-3593841370232011433',
            'android-id': device.androidId,
            'srn': '1440x2560',
            'ins': ts,
            'is_vpn': '1',
            'build': 'Build/W528JS',
            'pline': 'ANDROID',
            'vn': '4.8.1',
            'over-flow': 'new-fly',
            'tn': bearer,
            'sn': sn,
            'active-time': '9452',
            'content-type': 'application/json; charset=UTF-8',
            'accept-encoding': 'gzip',
            'user-agent': 'okhttp/4.10.0'
        };
    
        const url = apiBase +
            '/api/proxy.php/drama-box/chapterv2/batch/load?timestamp=' + ts;
    
        // console.log('[DramaboxCore.loadViaBatch] URL', url, 'body', body);
    
        const resp = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: bodyJson,
        });
    
        // 403 → token kadaluarsa → retry sekali
        if (resp.status === 403 && !options._retried) {
            console.warn('[DramaboxCore.loadViaBatch] 403, reset token & retry');
            deleteCookie('drbx_token');
            const newToken = await getToken(apiBase, locale, device, true);
            return loadViaBatch(Object.assign({}, options, {
                _retried: true,
            }));
        }
    
        const j = await resp.json().catch(function () { return {}; });
        // console.log('[DramaboxCore.loadViaBatch] raw response', j);
    
        if (!(j && (j.status === 0 || j.success === true))) {
            throw new Error('Batch gagal: ' + JSON.stringify(j));
        }
    
        const data  = j.data || {};
        const list  = data.list || data.chapterList || data.chapters || [];
        const book  = data.book || {};
        const rel   = data.recommends || data.recommendBooks || data.recommendList || [];
    
        return {
            book: book,
            chapters: list,
            related: rel,
        };
    }


   // =====================================================
// STREAM: ambil list episode untuk halaman stream
// - Cover, judul, jumlah episode → Webfic (detail)
// - Video URL (mp4/m3u8)        → BATCH (chapterv2/batch/load via proxy)
// - Urutan episode: 1..chapterCount (pakai index dari batch kalau ada)
// =====================================================
async function loadStreamChapters(options) {
    const apiBase   = options.apiBase || '';
    const localeApi = options.localeApi || 'in';
    const bookId    = String(options.bookId || '');

    if (!bookId) {
        throw new Error('loadStreamChapters: bookId wajib diisi');
    }

    // 1) DETAIL WEBFIC → cover, chapterCount, list episode dasar (buat judul + cover)
    const detail = await loadDetailWithRecommend({
        localeApi: localeApi,
        bookId: bookId,
    });

    const wfBook     = detail.book || {};
    const wfChapters = Array.isArray(detail.chapters) ? detail.chapters : [];

    // total episode dari Webfic
    let totalEps = 0;
    if (wfBook.chapterCount) {
        totalEps = parseInt(wfBook.chapterCount, 10) || 0;
    }
    if (!totalEps || totalEps < wfChapters.length) {
        totalEps = wfChapters.length;
    }

    // 2) BATCH LOAD → ambil daftar chapter yang berisi URL video
    let batchChapters = [];
    if (window.DramaboxCore && typeof window.DramaboxCore.loadViaBatch === 'function') {
        try {
            const batchRes = await window.DramaboxCore.loadViaBatch({
                apiBase: apiBase,
                localeApi: localeApi,
                bookId: bookId,
                totalEpisodes: totalEps, // ❗ tetap kirim total eps ke body mu yang custom
            });

            if (batchRes && Array.isArray(batchRes.chapters)) {
                batchChapters = batchRes.chapters;
            }
        } catch (e) {
            console.warn('loadStreamChapters: batch load gagal, pakai Webfic saja untuk video:', e);
        }
    } else {
        console.warn('loadStreamChapters: DramaboxCore.loadViaBatch tidak ada, pakai Webfic saja');
    }

    // 2a) Bikin MAP dari batch: ep → dataBatch
    // ep diambil dari field "index" kalau ada: ep = index + 1
    const batchMap = {};
    batchChapters.forEach(function (bCh, idx) {
        let ep = null;

        if (typeof bCh.index === 'number') {
            ep = bCh.index + 1;
        } else if (typeof bCh.chapterIndex === 'number') {
            ep = bCh.chapterIndex + 1;
        }

        // fallback: posisi array (kalau memang tidak ada index)
        if (!ep) {
            ep = idx + 1;
        }

        ep = parseInt(ep, 10) || 0;
        if (ep > 0) {
            batchMap[ep] = bCh;
        }
    });

    // 3) GABUNG: loop 1..totalEps
    const finalChapters = [];
    const episodeMap    = {};

    for (let ep = 1; ep <= totalEps; ep++) {
        const idx  = ep - 1;
        const wfCh = wfChapters[idx] || {};
        const bCh  = batchMap[ep] || {};

        const name =
            wfCh.name ||
            wfCh.title ||
            (wfCh.raw && (wfCh.raw.name || wfCh.raw.title)) ||
            ('Episode ' + ep);

        const cover =
            wfCh.cover ||
            (wfCh.raw && wfCh.raw.cover) ||
            wfBook.cover ||
            wfBook.bookCover ||
            ('https://via.placeholder.com/100x135?text=EP+' + ep);

        // 🔥 URL video: pakai helper pickVideoUrlFromChapter,
        // prioritas dari batch, fallback ke Webfic kalau perlu
        let urlFromBatch = '';
        let urlFromWf    = '';

        if (window.DramaboxCore && typeof window.DramaboxCore.pickVideoUrlFromChapter === 'function') {
            urlFromBatch = window.DramaboxCore.pickVideoUrlFromChapter(bCh);
            urlFromWf    = window.DramaboxCore.pickVideoUrlFromChapter(wfCh);
        }

        const mp4 =
            bCh.mp4 ||
            (bCh.chapterVideo && bCh.chapterVideo.mp4) ||
            urlFromBatch ||
            wfCh.mp4 ||
            (wfCh.raw && wfCh.raw.mp4) ||
            urlFromWf ||
            '';

        const m3u8Url =
            bCh.m3u8Url ||
            (bCh.chapterVideo && bCh.chapterVideo.m3u8Url) ||
            (bCh.sourceList && bCh.sourceList[0] && (bCh.sourceList[0].m3u8Url || bCh.sourceList[0].url)) ||
            wfCh.m3u8Url ||
            (wfCh.raw && wfCh.raw.m3u8Url) ||
            '';

        const merged = {
            ep: ep,
            index: ep - 1,
            name: name,
            cover: cover,
            mp4: mp4,
            m3u8Url: m3u8Url,

            raw: bCh && Object.keys(bCh).length ? bCh : wfCh,
            rawWebfic: wfCh,
            rawBatch:  bCh,
        };

        finalChapters.push(merged);
        episodeMap[ep] = merged;
    }

    const related = detail.related || [];

    return {
        book: wfBook,
        chapters: finalChapters,
        episodeMap: episodeMap,
        related: related,
    };
}

    // =====================================================
    // SEARCH BOOKS (drama-box/search/search via proxy.php)
    // =====================================================
    async function doSearch(apiBase, locale, device, bearer, keyword, pageNo, pageSize, allowRetry) {
        if (allowRetry === undefined) allowRetry = true;

        keyword  = (keyword || '').trim();
        pageNo   = parseInt(pageNo || 1, 10)  || 1;
        pageSize = parseInt(pageSize || 100, 10) || 100;

        if (!keyword) {
            return {
                items: [],
                isMore: false,
                total: 0,
            };
        }

        const base = apiBase.replace(/\/+$/, '');
        const ts = Date.now().toString();

        const body = {
            keyword:      keyword,
            searchSource: '搜索按钮',
            pageNo:       pageNo,
            pageSize:     pageSize,
            from:         'search_sug',
        };

        const bodyJson   = JSON.stringify(body);
        const baseString = 'timestamp=' + ts + bodyJson + device.deviceId + device.androidId + bearer;
        const sn         = await getSign(base, baseString);

        const langHdr = (locale === 'in' || locale === 'id') ? 'in' : 'en';
        const nowStr  = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' +0700';

        const headers = {
            'version': '481',
            'package-name': 'com.storymatrix.drama',
            'p': '49',
            'cid': 'DBDASEO1000000',
            'apn': '2',
            'country-code': 'ID',
            'mchid': 'DBDASEO1000000',
            'mbid': '0',
            'tz': '-420',
            'language': langHdr,
            'mcc': '302',
            'locale': 'en_ID',
            'is_root': '1',
            'device-id': device.deviceId,
            'nchid': 'DRA1000042',
            'instanceid': 'fa4ffcd60028854da3aff4d3c2e43cc8',
            'md': '23127PN0CC',
            'store-source': 'store_google',
            'mf': 'XIAOMI',
            'device-score': '75',
            'local-time': nowStr,
            'time-zone': '+0700',
            'brand': 'Xiaomi',
            'lat': '0',
            'is_emulator': '1',
            'current-language': langHdr,
            'ov': '12',
            'userid': '337251730',
            'afid': device.afid || '1763622503350-3593841370232011433',
            'android-id': device.androidId,
            'srn': '1440x2560',
            'ins': ts,
            'is_vpn': '1',
            'build': 'Build/W528JS',
            'pline': 'ANDROID',
            'vn': '4.8.1',
            'over-flow': 'new-fly',
            'tn': bearer,
            'sn': sn,
            'active-time': '9452',
            'content-type': 'application/json; charset=UTF-8',
            'accept-encoding': 'gzip',
            'user-agent': 'okhttp/4.10.0'
        };

        const url = base + '/api/proxy.php/drama-box/search/search?timestamp=' + ts;

        // console.log('[DramaboxCore.doSearch] URL', url, 'body', body);

        const resp = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: bodyJson,
        });

        if (resp.status === 403) {
            console.warn('[DramaboxCore.doSearch] 403, reset token & retry (allowRetry=', allowRetry, ')');
            deleteCookie('drbx_token');

            if (allowRetry) {
                const newToken = await getToken(base, locale, device, true);
                return doSearch(base, locale, device, newToken.token, keyword, pageNo, pageSize, false);
            }

            throw new Error('search/search 403 walau sudah retry');
        }

        const j = await resp.json().catch(function () { return {}; });
        // console.log('[DramaboxCore.doSearch] raw response', j);

        if (!(j && (j.status === 0 || j.success === true))) {
            console.warn('[DramaboxCore.doSearch] status bukan 0 / success!=true', j);

            if (allowRetry) {
                deleteCookie('drbx_token');
                const newToken = await getToken(base, locale, device, true);
                return doSearch(base, locale, device, newToken.token, keyword, pageNo, pageSize, false);
            }

            throw new Error('Search gagal: ' + JSON.stringify(j));
        }

        const data  = j.data || {};
        const list  = data.list || data.searchList || data.items || [];
        const total = parseInt(
            data.totalSize ?? data.total ?? list.length,
            10
        ) || list.length;

        let isMore = false;
        if (typeof data.isMore !== 'undefined') {
            isMore = Number(data.isMore) === 1 || data.isMore === true;
        } else if (typeof data.totalSize !== 'undefined') {
            isMore = Number(data.totalSize) > pageNo * pageSize;
        }

        return {
            items: list,
            isMore: isMore,
            total: total,
        };
    }

    async function searchBooks(apiBase, locale, keyword, pageNo, pageSize) {
        apiBase = (apiBase || '').replace(/\/+$/, '');
        locale  = locale || 'in';

        // console.log('[DramaboxCore.searchBooks] start', {
        //     apiBase,
        //     locale,
        //     keyword,
        //     pageNo,
        //     pageSize,
        // });

        const device    = await getDevice();
        const tokenData = await getToken(apiBase, locale, device, false);
        const bearer    = tokenData.token;

        return doSearch(apiBase, locale, device, bearer, keyword, pageNo, pageSize, true);
    }

    // =====================================================
    // EXPOSE GLOBAL
    // =====================================================
    window.DramaboxCore = {
        setCookie: setCookie,
        getCookie: getCookie,
        deleteCookie: deleteCookie,

        slugify: slugify,
        makeDramaUrl: makeDramaUrl,
        makeStreamUrl: makeStreamUrl,
        escapeHtml: escapeHtml,
        resolveRibbon: resolveRibbon,

        getSign: getSign,
        getDevice: getDevice,
        doBootstrap: doBootstrap,
        getToken: getToken,
        doClassify: doClassify,

        loadDetailWithRecommend: loadDetailWithRecommend,
        loadStreamChapters: loadStreamChapters,
        pickVideoUrlFromChapter: pickVideoUrlFromChapter,

        searchBooks: searchBooks,
        loadViaBatch: loadViaBatch,   
        // helper translate biar bisa dipakai file JS lain
        t: t,
        translate: t,

    };

})(window);
