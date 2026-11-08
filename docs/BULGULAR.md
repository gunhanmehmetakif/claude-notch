# Bulgular

Durum: doğrulanmadı / doğrulandı / yanlış. Not en fazla ~200 karakter.

| # | Tarih | İddia | Kaynak | Durum |
|---|---|---|---|---|
| 1 | 2026-11-08 | Tauri Windows önkoşulu: MSVC "Desktop development with C++", Rust stable-msvc; WebView2 Win11'de hazır. | v2.tauri.app/start/prerequisites | doğrulandı (doküman) |
| 2 | 2026-11-08 | Undecorated pencerede `shadow:true` 1px beyaz kenarlık verir; `shadow:false` kullan. Win'de yine kenarlık kalabildiği bildirilmiş (DWM ile kaldırılır). | Tauri WindowOptions; tauri disc. #9469 | doğrulandı: shadow:false + DWM COLOR_NONE ile kenarlık yok |
| 3 | 2026-11-08 | `set_ignore_cursor_events(true)` iken fare olayı gelmez; Rust 40 ms imleç yoklaması + hit rect ile çözüldü. | tauri#9250; prototip | doğrulandı (kullanıcı testi) |
| 4 | 2026-11-08 | Odak çalmama: tao 0.34.1 `set_focusable` ekledi; Windows'ta WS_EX_NOACTIVATE davranışı belirsiz. | tao v0.34.1 release | doğrulanmadı |
| 5 | 2026-11-08 | Tam ekranda gizlenme için Tauri'de hazır yol yok; Win32 `SHQueryUserNotificationState` tahmini. | — | uygulandı (`visibility.rs`), kullanıcı testi bekliyor |
| 6 | 2026-11-08 | tauri-plugin-autostart: `cargo tauri add autostart`, Rust ≥1.90. | v2.tauri.app/plugin/autostart | doğrulandı (doküman) |
| 7 | 2026-11-08 | Claude Code hook olayları: UserPromptSubmit, Stop, SubagentStart/Stop (agent_id, agent_type), Notification (notification_type), SessionStart/End; ortak alan session_id, cwd. | code.claude.com/docs/en/hooks | doğrulandı (doküman + sahte olay testi) |
| 8 | 2026-11-08 | Düz stdout yalnız UserPromptSubmit, SessionStart vb.'de bağlama girer; boş stdout + çıkış 0 güvenli. `async: true` engellemez. | code.claude.com/docs/en/hooks | doğrulandı (doküman) |
| 9 | 2026-11-08 | İç yardımcı agent'lar boş agent_type ile SubagentStop tetikleyebilir, Stop'tan 2-3 sn sonra gelebilir → sayaç agent_id eşleşmesi + bayat kayıt temizliği. | claude-code #70151, #83365, zj-radar #83 | doğrulanmadı |
| 10 | 2026-11-08 | Status line `rate_limits.five_hour/seven_day.used_percentage` + `resets_at` resmi alan (≥2.1.251). | code.claude.com/docs/en/statusline | doğrulandı (yerelde çalışıyor) |
| 11 | 2026-11-08 | Codex hooks var, varsayılan açık: UserPromptSubmit, Stop, SubagentStart/Stop vb.; `~/.codex/hooks.json`; Windows için `command_windows`; yönetilmeyen hook `/hooks` onayı ister. | learn.chatgpt.com/docs/hooks | doğrulandı (doküman) |
| 12 | 2026-11-08 | `codex exec --json`: turn.started / turn.completed / turn.failed olayları; calistir.js izleyebilir. | learn.chatgpt.com/docs/non-interactive-mode | doğrulandı (doküman) |
| 13 | 2026-11-08 | Codex rate_limits (primary/secondary used_percent, resets_at) oturum jsonl'de; belgesiz, kararlılık garantisi yok. | codex protocol.rs | doğrulanmadı (kota.js'te çalışıyor) |
| 14 | 2026-11-08 | Hook olayındaki `cwd` oturumun o anki klasörü; alt klasöre geçince değişir → proje adı kök klasörden bir kez alınmalı. | canlı test ("hooks" adı göründü) | doğrulandı, düzeltildi |
| 15 | 2026-11-09 | Codex hooks.json: `{"hooks":{Olay:[{matcher?,hooks:[{type:"command",command,commandWindows,async,timeout}]}]}}`; ortak alan session_id, cwd; PermissionRequest'te tool_name/tool_input; Stop JSON ister. | learn.chatgpt.com/docs/hooks.md | doğrulandı (doküman), gerçek Codex testi bekliyor |
| 16 | 2026-11-09 | calistir.js işçi kaydı yazılmıyordu: eklenen kodda değişken `cwd` (dosyada `cd`), ReferenceError try içinde yutuldu. Düzeltildi; GPT işçisi gri agent olarak göründü. | canlı test | doğrulandı, düzeltildi |
