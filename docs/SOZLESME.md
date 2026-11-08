# Veri sözleşmesi (v1)

Kök klasör: `%USERPROFILE%\.claude\usage\centik\` (test için `CENTIK_DIR` ortam değişkeni bunu ezer; hook ve uygulama ikisi de uyar).
Tüm zamanlar Unix saniyesi. Dosyalar UTF-8 JSON, atomik yazılır (aynı klasörde `.tmp` yaz → `rename`).

## sessions/<session_id>.json — yazan: `hooks/claude-hook.js`

Codex CLI aynı betiği `--source codex` ile çağırır (`~/.codex/hooks.json`): `source: "codex"`, agent `kind: "gpt"`, `PermissionRequest` → `waiting` (`question`: `tool_input.description` veya "<tool_name> için onay istiyor"). Codex modunda Stop/SubagentStop stdout'u `{}`.

```json
{
  "v": 1,
  "id": "<session_id>",
  "source": "claude | codex",
  "project": "claude-centik",
  "cwd": "D:\\projeler\\claude-centik",
  "status": "idle | busy | waiting | resting | done",
  "question": "Notification mesajı veya null",
  "agents": { "<agent_id>": { "kind": "claude", "type": "gelistirici", "started": 1794160000 } },
  "turn_started": 1794160000,
  "done_at": null,
  "transcript": "<transcript_path>",
  "updated": 1794160000
}
```

`project` = cwd'nin son klasör adı. Olay → değişiklik:

| Olay | Değişiklik |
|---|---|
| SessionStart | Dosya yoksa oluştur, `status: idle`. |
| UserPromptSubmit | `status: busy`, `question: null`, `turn_started: now`, `done_at: null`. |
| Notification | `notification_type` ∈ {permission_prompt, elicitation_dialog, agent_needs_input} → `status: waiting`, `question: message`. Diğer türler yok sayılır. |
| PostToolUse | `status === waiting` ise `busy`, `question: null`. |
| SubagentStart | `agent_type` boş değilse `agents[agent_id] = {kind:"claude", type, started}`. Boşsa yok say (iç yardımcı). `status` idle/done ise `busy`. |
| SubagentStop | `agents[agent_id]` sil. `status === resting` ve agents boşsa → `done`, `done_at: now`. |
| Stop | agents boş değilse `resting`, boşsa `done` + `done_at: now`. `question: null`. |
| SessionEnd | Dosyayı sil. |

Her yazımda `updated: now`. Ortamda `CENTIK_WORKER=1` varsa hook hiçbir şey yapmaz (calistir.js işçisi; aşağıdaki workers dosyası sayılır).
Aynı oturuma eşzamanlı hook'lar gelebilir: `sessions/<id>.lock` ile `wx` kilidi, en fazla ~1 sn bekle, 10 sn'den eski kilidi kır.
Hook her durumda stdout'a hiçbir şey yazmaz, hata olsa da çıkış kodu 0.

## workers/<pid>.json — yazan: `~/.claude/skills/chatgpt/scripts/calistir.js`

```json
{ "v": 1, "kind": "claude | gpt", "agent": "gelistirici", "cwd": "D:\\projeler\\x", "project": "x", "pid": 1234, "started": 1794160000 }
```

İşçi başlarken yazılır, bitince silinir. `claude -p` işçisine `CENTIK_WORKER=1` geçirilir.

## status/<session_id>.json — yazan: `~/.claude/statusline-command.js`

```json
{ "v": 1, "model": "Opus 5.5", "ctx": 41, "cost": 1.82, "added": 120, "removed": 30, "updated": 1794160000 }
```

## Okunan diğer dosyalar (uygulama)

- `%USERPROFILE%\.claude\usage\claude-limits.json` (biçimi değişmez): `five_hour/seven_day.{used_percent,resets_at}`, `updated_at`. Sıfırlanma zamanı geçmişse %0.
- Codex kotası: `%USERPROFILE%\.codex\sessions\YYYY\MM\DD\*.jsonl` içinde en yeni `"rate_limits"` satırı → `payload.rate_limits.primary/secondary.{used_percent,resets_at}` (mantık: `kota.js` `gptQuota`). Dosyanın yalnız son ~256 KB'ı okunur, 30 sn'de bir.

## Uygulamanın yorumu

- Aktif: `busy | waiting | resting`. `done` → bir kez "bitti" bildirimi, sonra listeden düşer. `idle` listede görünmez.
- Bayat: aktif durumda ama `updated` ve transcript dosyasının değişme zamanı 30 dk'dan eski → idle say. `updated` 24 saatten eski dosya silinir.
- Payload oturum satırında `src` (claude|codex): codex ana karakteri gri çizilir.
- workers: aynı `cwd`'li oturuma agent olarak eklenir (`kind`). Eşleşen oturum yoksa kendi satırı (`status: resting`, project adı). `pid` yaşamıyorsa dosya silinir.
