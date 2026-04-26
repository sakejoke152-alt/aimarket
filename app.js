// ╔══════════════════════════════════════════════════════════╗
// ║  app.js — Fresh Harvest: Supabase + Gemini AI Miy        ║
// ║  ⚠️  CFG ichindegi qıymetlerdi óz açqıshlarıń benen      ║
// ║     almashtır, keyin islete ber.                          ║
// ╚══════════════════════════════════════════════════════════╝

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Sazlamalar ───────────────────────────────────────────────
export const CFG = {
  SUPABASE_URL:   'https://vkajjrdapjeytgmfoovq.supabase.co',
  SUPABASE_ANON:  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrYWpqcmRhcGpleXRnbWZvb3ZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njk4MzA1OSwiZXhwIjoyMDkyNTU5MDU5fQ.0oDfQhJMb2v9EKLAHQKkmAIaejMVIGBJGEVExSGTT2Q',
  GEMINI_KEY:     'AIzaSyAL6MfQabUgoKkIswUMEuTBcCsjSNVag3Q',
  ADMIN_NOMER:    '998901234567',            // Admin telefon (raqamlar)
  GEMINI_MODEL:   'gemini-1.5-flash',
  RT_RECONNECT_MS: 4000,                    // WebView qayta jalǵanıw
};

// ─── Supabase client ─────────────────────────────────────────
export const sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON, {
  realtime: {
    params: { eventsPerSecond: 10 },
    // Android WebView ushın WebSocket saqlawı
    heartbeatIntervalMs: 25000,
    reconnectAfterMs: (n) => Math.min(n * 1000, CFG.RT_RECONNECT_MS),
  },
});

// ═══════════════════════════════════════════════════════════════
//  AUTH  (Supabase anonymous + localStorage sessiya)
// ═══════════════════════════════════════════════════════════════
export const Auth = {
  kirıw(nomer) {
    const taza = nomer.replace(/\D/g, '');
    if (taza.length < 9) return { xata: 'Nomer noto\'ǵrı kiritildi' };
    const adminMi = taza.endsWith(CFG.ADMIN_NOMER) ||
                    nomer.toLowerCase() === 'admin';
    const user = {
      nomer,
      rol:  adminMi ? 'admin' : 'user',
      at:   adminMi ? 'Admin' : 'Paydalanıwshı',
    };
    localStorage.setItem('fh_user', JSON.stringify(user));
    return { user };
  },
  shıǵıw()  { localStorage.removeItem('fh_user'); },
  meni()    { return JSON.parse(localStorage.getItem('fh_user') || 'null'); },
  adminMi() { return this.meni()?.rol === 'admin'; },
};

// ═══════════════════════════════════════════════════════════════
//  DB  — Supabase `products` jədveli
//  Keste baǵanları: id, name, price, category, image_url, calories
// ═══════════════════════════════════════════════════════════════
export const DB = {
  // Barlıq tovarlar (bir ret)
  async tovarlar() {
    const { data, error } = await sb.from('products').select('*').order('id');
    if (error) throw error;
    return data ?? [];
  },

  // ─── Real-time subscription ───────────────────────────────
  // Qaytarıladı: unsubscribe() funksiyası
  realtime(cb) {
    // Aldın bir ret jüklew
    this.tovarlar().then(cb).catch(console.error);

    const ch = sb.channel('fh-products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async () => { try { cb(await this.tovarlar()); } catch (e) { console.error(e); } }
      )
      .subscribe(status => {
        console.info('[RT]', status);
        if (status === 'CLOSED') {
          // Android WebView óshirilgende qayta jalǵanıw
          setTimeout(() => this.realtime(cb), CFG.RT_RECONNECT_MS);
        }
      });

    return () => sb.removeChannel(ch);
  },

  // Admin: qosıw
  async qos({ at, baha, kategoriya, rasm, kaloriya }) {
    const { data, error } = await sb.from('products')
      .insert([{
        name:      at,
        price:     baha,
        category:  kategoriya,
        image_url: rasm  || '',
        calories:  kaloriya ?? 0,
      }])
      .select().single();
    if (error) throw error;
    return data;
  },

  // Admin: ózgertıw
  async ózgert(id, { at, baha, kategoriya, rasm, kaloriya }) {
    const { error } = await sb.from('products')
      .update({ name: at, price: baha, category: kategoriya,
                image_url: rasm || '', calories: kaloriya ?? 0 })
      .eq('id', id);
    if (error) throw error;
  },

  // Admin: óshiriw
  async óshir(id) {
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) throw error;
  },
};

// ═══════════════════════════════════════════════════════════════
//  SEBET  — localStorage
// ═══════════════════════════════════════════════════════════════
export const Sebet = {
  _r()     { return JSON.parse(localStorage.getItem('fh_cart') || '[]'); },
  _w(s)    { localStorage.setItem('fh_cart', JSON.stringify(s)); },
  barlıq() { return this._r(); },
  san()    { return this._r().reduce((t, z) => t + z.san, 0); },
  jami()   { return this._r().reduce((t, z) => t + z.price * z.san, 0); },
  qos(tv)  {
    const s = this._r(), f = s.find(z => z.id === tv.id);
    f ? f.san++ : s.push({ ...tv, san: 1 });
    this._w(s);
  },
  al(id)   {
    this._w(this._r()
      .map(z => z.id === id ? { ...z, san: z.san - 1 } : z)
      .filter(z => z.san > 0));
  },
  tazala() { this._w([]); },
};

// ═══════════════════════════════════════════════════════════════
//  GEMINI AI
// ═══════════════════════════════════════════════════════════════
export const AI = {
  // Sebetke qaray 2 ta usınıs
  async rekomendaciya(sebet, katalog) {
    if (!sebet.length) return [];

    const keyJoq = !CFG.GEMINI_KEY || CFG.GEMINI_KEY === 'YOUR_GEMINI_API_KEY';
    if (!keyJoq) {
      const prompt =
        `Cart: [${sebet.map(z => z.name).join(', ')}]. ` +
        `Shop: [${katalog.slice(0, 25).map(t => `${t.name}(${t.category})`).join(', ')}]. ` +
        `Suggest 2 complementary items not in cart. ` +
        `Return ONLY valid JSON: {"s":[{"name":"...","reason":"..."},{"name":"...","reason":"..."}]}`;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${CFG.GEMINI_MODEL}:generateContent?key=${CFG.GEMINI_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
        );
        const raw  = await res.json();
        const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
        const json = JSON.parse(text.replace(/```json|```/g, '').trim());
        if (Array.isArray(json.s) && json.s.length) return json.s;
      } catch (e) { console.warn('[AI] Gemini qate:', e); }
    }

    // Fallback — mantıqıy usınıs
    const katMap = { sut: 'nan', miyweler: 'sut', paliz: 'nan', nan: 'miyweler' };
    const maqsat = new Set(sebet.map(z => katMap[z.category]).filter(Boolean));
    return katalog
      .filter(t => maqsat.has(t.category) && !sebet.find(z => z.id === t.id))
      .slice(0, 2)
      .map(t => ({ name: t.name, reason: 'Sebetińe uyǵın ónım 🌿' }));
  },

  // Aqıllı qıdırıw
  qıdır(soraw, tovarlar) {
    if (!soraw) return tovarlar;
    const s = soraw.toLowerCase().trim();
    const dietaSozler = ['dieta', 'dietalıq', 'arıqlaw', 'kaloriya', 'parhız', 'low cal'];
    if (dietaSozler.some(k => s.includes(k)))
      return tovarlar.filter(t => (t.calories ?? 0) < 100);
    return tovarlar.filter(t =>
      t.name?.toLowerCase().includes(s) ||
      t.category?.toLowerCase().includes(s)
    );
  },
};

// ═══════════════════════════════════════════════════════════════
//  STORAGE — Supabase Storage (rasm yuklash)
//  Supabase Console-da "product-images" bucket jasań (public: true)
// ═══════════════════════════════════════════════════════════════
export const Storage = {
  BUCKET: 'product-images',

  // Fayl → Supabase Storage → public URL qaytaradi
  async rasmYükle(file, onProgress) {
    if (!file) throw new Error('Fayl tanlanmagan');

    // Fayl teksheriw
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024)
      throw new Error(`Rasm ${MAX_MB}MB dan kichik bolıwı kerek`);
    if (!file.type.startsWith('image/'))
      throw new Error('Tek rasm fayllar qabıl etiledi');

    // Unique fayl nomi: timestamp + random + extension
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
    const nom  = `product_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    onProgress?.(20);

    // Compress (canvas arqalı, 800px max, quality 0.82)
    const compressed = await this._compress(file, 800, 0.82);
    onProgress?.(50);

    // Supabase-ga upload
    const { error } = await sb.storage
      .from(this.BUCKET)
      .upload(nom, compressed, { contentType: 'image/jpeg', upsert: false });

    if (error) throw error;
    onProgress?.(90);

    // Public URL al
    const { data } = sb.storage.from(this.BUCKET).getPublicUrl(nom);
    onProgress?.(100);
    return data.publicUrl;
  },

  // Canvas arqalı rasm siqıw
  _compress(file, maxPx, quality) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        if (w > maxPx || h > maxPx) {
          if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
          else       { w = Math.round(w * maxPx / h); h = maxPx; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => blob ? res(blob) : rej(new Error('Compress xatası')),
          'image/jpeg', quality);
      };
      img.onerror = () => rej(new Error('Rasm oqilmadi'));
      img.src = url;
    });
  },

  // Eski rasmni öshiriw (URL → fayl nomi)
  async rasmÓshir(publicUrl) {
    if (!publicUrl) return;
    const nom = publicUrl.split('/').pop();
    await sb.storage.from(this.BUCKET).remove([nom]);
  },
};

// ─── Yardamshı ───────────────────────────────────────────────
export const somsózi = n => `${(n ?? 0).toLocaleString('uz-UZ')} so'm`;
export const katAt   = k => ({ miyweler: '🍎', sut: '🥛', paliz: '🥦', nan: '🍞' }[k] ?? '📦');
export const plImg   = n =>
  `https://placehold.co/300x140/e8f5f0/006846?text=${encodeURIComponent(n ?? '?')}`;
