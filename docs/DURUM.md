# Durum

Son güncelleme: 2026-11-09

## Güncel

- Tasarım maketi onaylandı (`docs/tasarim/maket.html`, artifact GG5cVWDFk8tVjuxMPC4xA4). Prototipi kullanıcı denedi: "gayet güzel" (2026-11-08).
- Kurulu: VS 2022 Build Tools 17.14 (C++), Rust 1.99.1 (`D:\dev`, RUSTUP_HOME/CARGO_HOME kullanıcı ortamında).
- `app/` Tauri 2.12.5: şeffaf, kenarlıksız, en üstte, tıklama geçirgen çentik. `cargo build` (src-tauri) uyarısız.
- Veri köprüsü çalışıyor (sözleşme `docs/SOZLESME.md`):
  - `hooks/claude-hook.js` + `test-hook.js` (8/8). `~/.claude/settings.json`'a 8 olay `async` bağlı.
  - `~/.claude/statusline-command.js` → `centik/status/<id>.json`; `calistir.js` → `centik/workers/<pid>.json` + `CENTIK_WORKER=1`.
  - Yedekler `yedek/` (20261108-2349). Gizli bilgi yok, yine de repoya girmesin.
  - `src-tauri/src/state.rs` 1 sn yoklama, Codex kotası 30 sn. Sahte oturumla busy / soru / bitti ekran görüntüsüyle doğrulandı; gerçek kotalar ve bu oturumun model/bağlam/maliyeti görüldü.
  - Proje adı: cwd'den yukarı `.git` veya `CLAUDE.md` olan klasör, bir kez yazılır (BULGULAR 14).
- Codex: `~/.codex/hooks.json` (8 olay, async) yeni dosya, `config.toml`'a dokunulmadı. Kullanıcı Codex'te `/hooks` ile onaylamalı. Sahte Codex oturumuyla gri karakter doğrulandı.
- Tepsi (gizle/göster, "Bilgisayar açılınca başlat" varsayılan kapalı, Çıkış), tam ekranda gizlenme (SHQueryUserNotificationState 1,5 sn), tek kopya derlendi. Tek kopya ve autostart kapalı doğrulandı; tepsi menüsü ve tam ekran kullanıcı testi bekliyor.
- Bu oturum gerçek hook verisiyle "claude-centik · çalışıyor" göründü (2026-11-09).
- Sigara/kahve mola stili (tepsi "Mola stili", `centik/app.json`, varsayılan sigara), kota %100 yorgun poz, tek ortak yol: uygulamada, sahte veriyle doğrulandı.
- Kurulu sürüm: `%LOCALAPPDATA%\Claude Çentiği\claude_centik.exe` (NSIS, per-user, 0.1.0). Kapatma: tepsi → Çıkış.
- GitHub: `gunhanmehmetakif/claude-notch` (public, MIT). README İngilizce + Türkçe, banner.svg + durum GIF'leri (kahveli), `hooks/install.js` (24/24 test).

## Sıradaki adımlar

1. Gerçek kullanım testi: birkaç Claude penceresi, Agent aracıyla agent'lar, calistir.js işçisi (Claude ve GPT).
2. Kullanıcı Codex `/hooks` onayladı (2026-11-09); doğrudan Codex oturumu testi bekliyor. calistir.js GPT işçisi gri agent olarak doğrulandı.
3. Kullanıcı tepsiden "Bilgisayar açılınca başlat"ı açar; tepsi menüsü ve tam ekran testi.

## Açık sorunlar

- BULGULAR 4 (odak çalmama) ve 9 (iç agent'ların geç SubagentStop'u) gerçek kullanımda izlenecek.
- PowerShell 5.1 borusuyla hook'a veri gitmedi (bash ile gidiyor); Claude Code etkilenmiyor, yalnız elle test için not.
