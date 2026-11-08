# Claude Çentiği

Windows masaüstünün üst ortasında duran, Claude Code / Codex çalışırken koşan karakter ve kota göstergeleri gösteren çentik (Dynamic Island benzeri) uygulaması.

## Kurallar

- Global kurallar (`~/.claude/CLAUDE.md`) ve `proje-yonetimi` skill'i geçerli.
- Arayüz metinleri Türkçe; kod, tanımlayıcılar, yorumlar İngilizce.
- Uygulama **token harcamaz**: hiçbir yapay zekâ API'sine istek atmaz, yalnız yerel durum dosyalarını okur.
- Hook betikleri **sessiz** olmalı: stdout boş, çıkış kodu 0, `async: true`. UserPromptSubmit/SessionStart stdout'u Claude'un bağlamına girer.
- `~/.claude/settings.json`, `~/.claude/statusline-command.js`, `~/.codex/` dosyalarına dokunmadan önce yedek alınır ve kullanıcı onayı istenir.
- `~/.claude/usage/claude-limits.json` biçimi değiştirilmez (`chatgpt` skill'inin `kota.js`'i okuyor); yalnız yeni dosya/alan eklenir.

## Yapı (plan)

- `app/` Tauri 2 uygulaması (Rust + HTML/CSS/JS, framework yok)
- `hooks/` Claude Code ve Codex hook betikleri (Node)
- `docs/` DURUM, PRD, BULGULAR, `tasarim/maket.html` (onaylı tasarım maketi)

## Ortam

- Rust: `RUSTUP_HOME=D:\dev\rustup`, `CARGO_HOME=D:\dev\cargo`, toolchain `stable-msvc`
- MSVC: Visual Studio 2022 Build Tools, "Desktop development with C++"
- Node 22, WebView2 (Win11 hazır)
