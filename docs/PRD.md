# PRD: Claude Çentiği

## Amaç

Kullanıcı aynı anda en fazla ~3 projede Claude Code penceresi açar, agent'lar (Claude Sonnet ve Codex/GPT) çalıştırır. Başka pencereye geçtiğinde ekranın üst ortasına bakarak şunları görmek ister: hangi proje çalışıyor, hangisi soru soruyor veya bitti, kaç agent koşuyor, Claude ve Codex kotası ne durumda.

Kullanıcı: tek kişi, Windows 11 masaüstü. Etkileşim: bakış 0 tık, detay 1 tık, küçültme 1 tık.

## Durumlar (maket: `docs/tasarim/maket.html`, artifact https://claude.ai/artifact/GG5cVWDFk8tVjuxMPC4xA4)

- **Uyku:** iş yok → ince siyah çizgi. Fare üstüne gelince kısa açılır (Claude gözleri kapalı oturur, "zz", kotalar).
- **Kompakt:** solda 5 saatlik, sağda 7 günlük sıvı kota kabı; ortada sahne + tek satır metin; altta ▲.
- **Sahne:** Claude çalışıyorsa koşar; işi agent'lara verip bekliyorsa oturup kahve içer, agent'lar yanında küçük koşar (turuncu = Claude agent, gri = Codex agent). Soru beklerken durur, başında "!".
- **Sadece ok:** ▲ ile küçülür; çalışırken ok turuncu yanıp söner, soru gelince hızlanır. ▼ ile açılır.
- **Bildirim:** proje soru sorunca (turuncu parıltı) veya bitince (yeşil halka) çentik ~4 sn açılıp proje adını söyler.
- **Genişletilmiş:** çentiğe tıklayınca; Claude + Codex kotaları ve sıfırlanma zamanları, her proje ayrı satır (sahne, ad, durum, süre).
- Sıvı renkleri: %0–59 yeşil, %60–84 kehribar, %85+ kırmızı (dalga hızlanır).

## Kararlar

| Tarih | Karar |
|---|---|
| 2026-11-08 | Claude çalışmıyorken ince çizgi kalır, fare üstüne gelince kısa açılır. |
| 2026-11-08 | Teknoloji: Tauri 2 (Electron değil). |
| 2026-11-08 | Soru/bitiş: çentik açılıp proje adını söyler. Ses ve Windows bildirimi yok. |
| 2026-11-08 | Codex kotası genişletilmiş panelde görünür (kompaktta yalnız Claude). |
| 2026-11-08 | Birden fazla proje ve agent takibi; Codex agent'ları da sayılır. |
| 2026-11-08 | Uygulama token harcamaz; veri yalnız yerel hook/status line dosyalarından gelir. |
| 2026-11-09 | Agent'lar ve ana Claude tek ortak yolda koşar; agent'lar büyütülmez (kullanıcı). |
| 2026-11-09 | Dinlenme (agent beklerken) stili: sigara (ağza götürür, ağız yalnız nefeste görünür) veya kahve; tepsiden seçilir, varsayılan sigara. |
| 2026-11-09 | Kota %100 olunca "yorgun" poz: çökmüş, dili dışarıda, terli; "Kota doldu · X sonra açılır". |
| 2026-11-09 | GitHub: herkese açık `claude-notch`, MIT, README İngilizce + Türkçe bölüm, görseller kahveli; `hooks/install.js` ile kurulum. |
