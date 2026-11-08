# Durum

Son güncelleme: 2026-11-09

## Güncel

- Ortam: VS 2022 Build Tools 17.14 (C++), Rust 1.99.1 (`D:\dev`, RUSTUP_HOME/CARGO_HOME kullanıcı ortamında). Release: `cd app && npx tauri build` → `src-tauri/target/release/bundle/nsis/`.
- Uygulama (Tauri 2.12.5) kurulu: `%LOCALAPPDATA%\Claude Çentiği\claude_centik.exe` (NSIS per-user 0.1.0). Şeffaf, tıklama geçirgen, tek kopya, tam ekranda gizlenir, tepsi menüsü (gizle/göster, Mola stili sigara/kahve, açılışta başlat varsayılan kapalı, Çıkış).
- Pozlar: koşma, mola (sigara varsayılan / kahve), soru "!", bitti zıplama, uyku, kota %100 yorgun; agent'lar tek ortak yolda. Sahte veri klasörüyle (`CENTIK_DIR`) ekran görüntüsüyle doğrulandı.
- Veri köprüsü (`docs/SOZLESME.md`): `hooks/claude-hook.js` (8/8 test), `~/.claude/settings.json`'da 8 olay async; Codex `~/.codex/hooks.json` (kullanıcı `/hooks` onayladı); `statusline-command.js` → `centik/status/`; `calistir.js` → `centik/workers/` (GPT işçisi gri agent olarak doğrulandı). Yedekler `yedek/` (gitignore).
- GitHub: `gunhanmehmetakif/claude-notch` public, MIT, Release v0.1.0 (setup.exe). README: banner.svg, rozetler, hero.gif, durum GIF'leri (kahveli), cast/gauges/flow SVG. `hooks/install.js` (24/24 test).
- Profil `gunhanmehmetakif/gunhanmehmetakif` (yerel `D:\claude\gunhanmehmetakif`): en üstte `assets/notch-banner.svg`, projelerin başında `notch-*.svg` kartı. Push edildi.
- Maket artifact: claude.ai/artifact/GG5cVWDFk8tVjuxMPC4xA4 (`docs/tasarim/maket.html` kopyası).

## Sıradaki adımlar

1. Kullanıcı testi: tepsi menüsü (Mola stili, gizle/göster), tam ekran video, "Bilgisayar açılınca başlat"; sonuçları BULGULAR 4-5'e yaz.
2. Doğrudan Codex oturumu (Codex penceresinde iş) çentikte gri ana karakterle görünüyor mu bak.
3. Birkaç Claude penceresiyle gerçek kullanımda iç agent'ların geç SubagentStop'u takılma yapıyor mu izle (BULGULAR 9).
4. İstenirse: arayüz metinlerini İngilizce seçeneği (README "Turkish for now" diyor), uygulama içi otomatik güncelleme.

## Açık sorunlar

- BULGULAR 4 (odak çalmama), 5 (tam ekran), 9 (geç SubagentStop) gerçek kullanımda doğrulanmadı.
- Oturan Claude'un gözleri küçük boyutta (README GIF'leri) zor seçiliyor.
- PowerShell 5.1 borusuyla hook'a test verisi gitmiyor ve `Get-Date -UFormat %s` yerel saat veriyor; elle testte bash kullan.
