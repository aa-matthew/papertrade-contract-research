# Showcase ngày mai — mở lên là diễn

## Chuẩn bị 2 phút trước buổi demo

1. Giữ máy thức, cắm nguồn. Đây là fork chạy trên máy này, không phải website public hosting.
2. Từ repo root: `npm run up --prefix demo`, rồi `npm run check --prefix demo`.
3. Mở **http://127.0.0.1:4173/#showcase**. Chọn **Reliable scenario → Full product tour** cho phần thuyết trình chính. Nguồn này không cần gọi Binance trong buổi diễn; trạng thái fork đã đọc được dùng qua cache local. Các phần fork chưa cache vẫn cần RPC upstream.
4. Bấm **Start showcase**. Để tab Showcase cho tổng quan, hoặc chuyển Trade / House / Paper / Operations để đọc state thật. Thanh trên luôn có Stop & restore.
5. Hết tour tự restore. Có thể chạy lại, hoặc chọn **Binance spot → Continuous trading desk** để giá thật và bot long/short chạy khoảng 5 phút. Stop bất cứ lúc nào; chờ báo **original state restored**.

Shortcut macOS: double-click `demo/start-showcase.command` để khởi động, kiểm tra và mở trang. Nếu máy cảnh báo file tải từ Internet, dùng các lệnh npm ở trên; không cần sửa thiết lập bảo mật.

Trước giờ diễn không chạy regression tests khi đang showcase: hai workflow đều dùng checkpoint. Chỉ chạy một instance. Không xóa `.runtime`, không `--redeploy`, không sửa địa chỉ deploy để chữa một trang chưa tải.

## Lời mở đầu — 20 giây

> “Đây là một oracle-based perp lab chạy trên fork của Robinhood. Source chain được ghim ở block 89,432,040; giao dịch demo chạy riêng trên chain 31337. Có 10 ví với quyền thật. Giá, order, settlement và reward đều có transaction receipt. Tiền demo là LABUSD, không có giá trị thật.”

Ở Contracts chỉ source block/hash và địa chỉ Exchange, Oracle, PART, Staking, Timelock. Tránh gọi đây là full source gốc Papertrade đã recover: chỉ settlement math và loss-mint curve được gọi trực tiếp từ các helper reconstructed; phần protocol bao quanh là code của chúng ta.

## Kịch bản chính — khoảng 3 phút

| Thời điểm | Màn hình / thao tác | Nói gì |
| --- | --- | --- |
| 0:00–0:20 | Showcase / Contracts | Fork thật, signature domain riêng, giao dịch local; chỉ rõ source block và chain ID. |
| 0:20–0:50 | Start full tour → Trade | Alice long BTC, Bob short ETH. Margin reserve ở request; keeper khớp bằng observation sau đó. Giá/positions/PnL nhảy theo state thật. |
| 0:50–1:10 | Portfolio / timeline | Session relayer ký EIP-712 với budget của Alice. Revocation chặn order pending; session không có quyền withdraw. |
| 1:10–1:35 | Operations → Paper | Bắt đầu scripted stress có gắn nhãn: short 100× bị move 2% và liquidate. Loss mint PART. Bob stake → fee push → claim collateral → unstake; Carol cũng claim. |
| 1:35–2:00 | House | Position lớn làm hết 5m net-profit budget. Queue vẫn là nghĩa vụ nợ. Sau local day jump + tiền treasury, keeper harvest FIFO. |
| 2:00–2:25 | Operations | Guardian pause ngay. Governor schedule; execute sớm bị từ chối; clock local tăng rồi timelock execute. Retirement đóng market mới nhưng cho exit ở frozen price. |
| 2:25–2:45 | Paper / timeline | Đóng hết vị thế, clear pending/queue rồi surplus mới chuyển về staking. House giữ configured cap. Chỉ rõ treasury test donation. |
| 2:45–3:00 | Showcase | Receipt proof, 10 actors, state restored. Kết: “Điểm khó không phải vẽ chart, mà là execution fairness, inventory risk và funded liabilities.” |

Full tour tự chạy khoảng một phút đến 90 giây tùy máy/RPC và tốc độ cập nhật; có thể dùng phần thời gian còn lại giải thích insight. Timeline giữ các bước đã chạy. Đừng cố bấm manual write trong tour; browse và đổi actor vẫn dùng được. Captured proof sau restore là receipt lưu trước revert, không phải hash còn query được trên chain đã restore.

## Encore — Binance live

Chọn **Binance spot → Continuous trading desk → Start**. Bot mở long BTC / short ETH và đóng/mở lại theo chu kỳ, oracle lấy BTCUSDT/ETHUSDT spot last price khoảng 2 giây/lần. Price fetch kiểm timestamp, decimal, symbol; nguồn lỗi/stale thì kết thúc và restore, không chuyển âm thầm sang giá giả. Chế độ 5 phút tự kết thúc; có thể Stop trước.

Giá live có thể ít biến động trong vài giây. Đừng hứa giá phải nhảy mạnh. Dùng scenario tour để trình diễn chắc chắn liquidation, queue và governance. USDT được coi như LABUSD trong fixture; đây không phải production mark/index oracle hay decentralized price feed.

## 10 pha được tự động hóa

1. Fork provenance + approve/deposit/withdraw.
2. Oracle publications + long/short request/keeper execute/close.
3. Session authorize, signed order, revoke, rejected execution, cancel.
4. Scripted liquidation + recovered PART emission.
5. Stake, push funded fees, claim, unstake; Carol claim.
6. Shared 5m UTC net-profit budget → excess FIFO debt.
7. Treasury funding + next local day + keeper harvest.
8. Immediate guardian pause + actual delayed governance.
9. Permanent market retirement + frozen-price exit.
10. Clear positions/orders → funded surplus distribution → claim.

Các role owner/operator/trader vẫn là transaction sender thật. Local clock acceleration, scenario shocks, treasury faucet và automatic restore đều là fixture được ghi rõ. ABI console vẫn chứa mọi public function; tour không có nghĩa đã diễn từng setter/ownership function.

## Product insight / Q&A

**Vì sao trader cần dùng?** Ít bước, leverage và scoped session giúp UX nhanh. Cần tối ưu time-to-first-trade và làm rõ net execution price/PnL sau haircut, không chỉ quảng cáo leverage.

**Oracle chậm có bị scalp không?** Có adverse-selection risk. Delay/future observation, freshness, price limits, exposure caps và haircut giúp giảm; chúng không chứng minh đã chặn hoàn toàn. Demo không có multi-source price validation/production Chainlink report auth. Cần đo quote age, end-to-end latency, execution slippage và realized toxic-flow cost. Recovered haircut có input price movement/impact, không chứng minh có riêng time-decay haircut theo holding duration.

**LP có bị động chịu trận không?** House giữ exposure đối ứng. Theo dõi cash trừ debt trừ marked trader PnL và stress directional moves. Donation trong lab không có LP shares/withdrawal. Protocol-owned capital đổi chủ thể chịu rủi ro, không xóa rủi ro.

**5M/day có phải pool chỉ có 5M?** Không. Lab seed khoảng 8M; 5M/day là allowance cho credited net trader profit theo UTC. Principal cash withdrawals không bị tính vào allowance. House surplus threshold là một tham số khác. Reset theo calendar day cho phép hai budget sát ranh giới ngày; queue tiếp tục là nợ.

**PART có giá/thu nhập đảm bảo không?** Không. Loss-minted participation token, transfer thường bị chặn, stake để chia collateral rewards thực sự được fund. Cần adversarial testing wash trading, emission farming, reward timing/Sybil và economic sustainability. Protocol invariant pass không chứng minh game không có profitable attack.

**Đã production-ready chưa?** Chưa. Đây là local executable prototype và reconstruction từng phần. Còn production oracle design, risk/economic calibration, independent audit, multi-source monitoring, operational keys, deployment verification và integration thực với collateral/BBO/bridge. Không trình bày roadmap đó như tính năng đã deploy.

## Khi có sự cố

- **Giá live lỗi:** Stop & restore, chọn Reliable scenario rồi chạy lại. Chỉ đổi nguồn khi UI đã báo restore xong.
- **Manual write bị khóa:** Tour đang giữ checkpoint. Dùng Stop & restore trước.
- **Market bị pause/retire từ thao tác manual:** Preflight từ chối để giữ trạng thái người dùng; không tự unpause/reset. Dùng deployment sạch đã chuẩn bị riêng nếu thực sự muốn reset, lưu runtime cũ trước.
- **Trang chưa lên:** `npm run status --prefix demo`, `npm run up --prefix demo`; kiểm tra `.runtime/service.local.log`. Chỉ có một service trên ports 4173/9545/9546.
- **Tour fail:** Lỗi được hiện trên Presenter desk; kiểm tra `restored=true` trước chạy lại. Report dưới `.runtime/showcase.local.json`.
- **Muốn ngừng service:** Stop & restore trong UI trước, rồi `npm run down --prefix demo`. Graceful shutdown cũng đợi tour restore trước khi tắt Anvil; tránh force-kill.

## Chạy rehearsal

```sh
npm run test:showcase --prefix demo
npm test --prefix demo
npm run test:feed --prefix demo
npm run check --prefix demo
```

`test:showcase` kiểm full tour, duplicate-start/manual-write lock, Stop/restore và Binance live round trips. Không chạy đồng thời với tests hoặc người dùng khác. Giữ `.runtime/` private: chứa dev key exports và chain state.
