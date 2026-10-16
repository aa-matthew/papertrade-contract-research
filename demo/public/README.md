# Robinpaper frontend

Static HTML/CSS and browser-native JavaScript modules served by the [Rust API](../backend/README.md). No frontend bundler, transpiler or separate package install is required. Start the full stack from the repository root using the [demo quick start](../README.md).

| File | Responsibility |
| --- | --- |
| `index.html` | Application shell and module/style entry points |
| `app.js` | Hash-routed trading/account/operator views, charts, SSE state and UI actions |
| `wallet.js` | Injected EVM wallet connection, network/fork checks, unsigned request preparation, signatures and broadcasts |
| `style.css` | Responsive trading interface styling |
| `favicon.svg` | Local application icon |

## Integration

The UI uses same-origin `/api/state`, `/api/events`, `/api/abi` and receipt endpoints. Shared wallet operations use `/api/prepare` for unsigned calldata or typed data, then wallet signatures and the guarded `/rpc` gateway. Chain-backed state comes from the API; the cache/database never replaces the fork ledger as source of truth.

Shared mode requires an injected wallet. The actor selector is read-only account selection, and server-side actor signing/key exports are blocked. External wallet RPC is `http://HOST_LAN_IP:4173/rpc`, chain 31337. See [LAN.md](../docs/LAN.md) for wallet assignment and connectivity limitations.

Edit files here to change the UI; there is no generated frontend distribution to commit. Do not embed private keys, engine credentials or provider secrets in browser assets. The static directory contains only public application files; runtime exports remain outside it.

## Verification

`node --check demo/public/app.js` and `node --check demo/public/wallet.js` check JavaScript syntax from repository root. `npm run check --prefix demo` verifies the running UI/API and contract state without transactions. Transactional UI/integration QA belongs on an isolated rehearsal fork, not the shared participant ledger. See [recorded functionality and performance QA](../docs/QA-REPORT-2026-10-16.md).
