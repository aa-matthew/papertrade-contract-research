# Shared fork demo — testers on the same Wi-Fi

Every participant connects to one persistent Anvil ledger forked from Robinhood mainnet (4663), pinned at block 89,432,040. The lab uses chain **31337**, test ETH and valueless LABUSD/PART. The deployed contracts and recovered settlement/mint helpers are unchanged. This is a reconstruction, not the original Papertrade deployment.

## Host: start and resume

From the repository root:

```sh
npm run up:lan --prefix demo
npm run lan:status --prefix demo
```

The launcher prints the current LAN address. At preparation time it was:

- UI: **http://192.168.31.251:4173**
- Wallet RPC: **http://192.168.31.251:4173/rpc**
- Chain ID: **31337** (`0x7a69`)
- Currency: **ETH** (test gas)

Use the host's Wi-Fi address, not `127.0.0.1`, on other computers. DHCP can change the address; rerun the launcher and update wallet RPC configuration after a network change. Override network selection with `LAB_LAN_IP=192.168.x.x npm run up:lan --prefix demo` if multiple private interfaces exist. Keep the host plugged in, lid open, and connected to the same Wi-Fi. Shared mode holds a macOS idle-sleep assertion for the service lifetime; it cannot keep a closed laptop available.

Shared mode is remembered under the private runtime directory, so a normal `npm run up --prefix demo` resume also retains the shared-mode rollback guards. The process resumes the saved deployment, contract state, balances and receipts. It does not redeploy or revert participant activity. Blocks mine every second. A behind-wall-clock fork timestamp is moved forward once at startup; time never moves backward. Graceful shutdown saves state; Anvil also dumps every 15 seconds. Abrupt power loss can lose the most recent unsaved blocks. SQLite is an index, not the authoritative chain backup.

## macOS incoming permission — pending verification

At preparation, `127.0.0.1:4173` worked but requests to the Wi-Fi IP timed out. The API listener was confirmed on `0.0.0.0:4173`; macOS Firewall was enabled, and the Mac was locked, preventing inspection of a pending permission dialog. This is a suspected OS permission blocker, not proof of a diagnosed firewall rule. **Another-computer access is not yet verified.**

Unlock the Mac and approve an incoming-network prompt for `robinpaper-api`, or add only the API executable in **System Settings → Network → Firewall → Options**. A scoped host helper is provided:

```sh
./demo/scripts/allow-lan-macos.command
```

It requires the host's administrator password. It keeps Firewall enabled and does not expose Anvil or Redis. Recheck the UI URL from another computer. Guest Wi-Fi/client isolation can independently prevent clients reaching each other. Do not port-forward this development service to the Internet.

## Give each tester one wallet

The host-only exports are ignored by Git and not served in shared mode:

- `demo/.runtime/wallets.local.json` and `wallets.local.csv`: all ten keys, host only.
- `demo/.runtime/participants/`: one import file per actor, plus network instructions.

Share the individual assigned file privately, rather than giving every tester all operator keys. Alice, Bob and Carol are the normal participant wallets; Governor, Guardian, Oracle, Keeper, Liquidator, Treasury and Session relayer have distinct roles. Their development keys are publicly known fixtures. Never fund them on a public chain.

On each tester's computer:

1. Install/use an injected EVM wallet such as MetaMask in a normal browser. The embedded Codex browser has no wallet extension.
2. Import the assigned private key. Open the **LAN UI URL**.
3. Click **Connect wallet** and approve switching/adding chain 31337. If the wallet already has a different network with chain 31337, edit its RPC to the host's `/rpc` URL first. The app compares an exact block hash to reject a different local fork with the same chain ID.
4. The actor selector is a **read-only account view**. Only the connected wallet can sign. Selecting Governor cannot impersonate Governor.
5. Deposit requires two approvals in the wallet: ERC-20 approval, then deposit. Approve each transaction in time. Orders have a 2-second delay and 20-second execution window; a long wallet approval can expire an order, and the keeper will cancel expired orders to release margin.

Only signed calls to the six deployed lab contracts, with zero native value, chain 31337 and a maximum 5m gas limit, are accepted by the RPC gateway. Wallet signing happens on the participant's computer. The server cannot sign participant requests through the shared API. The gateway blocks unlocked signing, account export, impersonation, EVM time travel, snapshots and reset. The actual unlocked Anvil RPC, private ABI engine, source proxy and Redis remain loopback-only.

## Start moving prices and the keeper

Host terminal:

```sh
npm run lan:feed --prefix demo -- on
npm run lan:status --prefix demo
```

The worker obtains fresh BTCUSDT and ETHUSDT spot observations from Binance's public market-data endpoint, validates symbol, positivity, eight-decimal precision and source freshness, publishes them on chain with the oracle operator, then executes eligible orders with the keeper. It does not substitute invented prices after a Binance failure. USDT is treated as LABUSD for this demo; it is not a production oracle design. Source outages are visible, and the contract rejects stale quotes after 30 seconds.

Long/short, close, cancel, custody, stake/unstake/claim, house contribution, FIFO harvest, fee pushes, session authorization/revocation and ABI console calls use the participant wallet. The assigned session wallet uses `eth_signTypedData_v4` and `requestBySig` for Alice's scoped orders; session authority never permits withdrawing Alice's cash. Governor schedules are indexed from actual receipts; execution waits the real one-day timelock. Operator actions still require their actual role wallet.

In shared mode the keeper executes **all** eligible orders, regardless of the local rehearsal auto-execute checkbox. Stopping the feed also stops the worker's execution/cancellation loop:

```sh
npm run lan:feed --prefix demo -- off
```

The chain, balances, positions and receipts remain. Pending orders can expire while the feed is off; users can cancel their own orders, or the keeper cancels expired ones when resumed. There is no continuous trading bot spending user margin without their signed orders.

The full guided stress tour, checkpointed market desk, time travel, restore and server actor signing are disabled in shared mode. They would otherwise roll back participants' external transactions. Use a separate rehearsal environment for the old tour. Do not switch this live session to local rehearsal mode during testing.

## QA and evidence

```sh
npm run check --prefix demo       # read-only health, custody and source checks
npm run test:lan --prefix demo    # real signed transactions, run before giving wallets to testers
```

`test:lan` defaults to the actual LAN URL; it performs small real deposits/withdrawals, opens/closes, stake/unstake and session transactions without snapshots. It briefly starts Binance + keeper, then stops them. Do not run it during a participant session. For isolated gateway QA while OS LAN permission is blocked, `LAB_TEST_BASE=http://127.0.0.1:4173 npm run test:lan --prefix demo` exercises the same gateway and browser wallet-client module but **does not prove LAN reachability or a real MetaMask approval UI**.

External signed lab transactions are discovered from canonical blocks and decoded into the journal/SQLite projection. The in-memory journal is bounded to 500, public state to 100, and the index endpoint to its most recent 50 receipts. Historical receipts remain on the persistent fork. Indexing supports the ten assigned actors and six deployed contracts; it is not a general chain explorer. Existing lab limits are 1,000 position IDs and 2,000 order IDs. The worker uses a new/live-order index rather than rescanning all completed orders every tick.

Check the supplied verification report for what passed and the remaining network-permission limitation. The morning automation performs read-only health checks and will not reset or test against participant activity.
