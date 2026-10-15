# What the local port reproduces

The local Anvil fork executes original EVM runtime code at original contract addresses, including linked-library calls. It preserves lazy storage reads through the remote RPC and tests selected interactions with fresh local signatures. It is an inspection port, not newly compiled original Papertrade source.

## Native chain boundary

HyperCore BBO/mark/oracle reads are native precompiles. Their captured input/output pairs are in `hypercore-precompile-reads.json`. Anvil cannot obtain native semantics merely by forking an address with no code. `local/mock-bbo.mjs` explicitly installs deterministic BTC/ETH return values for test scenarios. It does not recreate a price feed, manipulation resistance, ordering, or state synchronization.

CoreWriter has published wrapper source, which is archived. Its action logs are processed by HyperCore outside the EVM. Forking wrapper bytecode does not move Core balances. Real sweep/finalize, CCTP and onward withdrawal behavior require a chain integration or separate mocks.

## Source and state completeness

- All documented core deployment addresses and current resolved EVM implementations are archived.
- Known dependencies and one representative CREATE2 user proxy are included. Historical implementations, every user proxy instance, full lifetime logs, every storage slot, all Circle ecosystem contracts and all backend services are not exhaustively mirrored.
- Unverified protocol source cannot be losslessly recreated. Disassembly and partial interfaces are labeled accordingly. IPFS metadata CIDs were recovered for the protocol implementations, but tested gateways did not provide metadata/source; CID text files preserve those references.
- The public HyperEVM RPC serves present state even when historical tags are supplied. The archive records the collection anchor and live-read timestamps. The fork's header can be pinned while its lazy upstream reads still observe later state; use a genuinely archive-capable provider for consistent replay.
- Read-only observations and official frontend summary responses have their own times/blocks and must not be mixed into an exact financial balance sheet.

## Reimplementation on another EVM chain

Replace the oracle adapter and HyperCore custody/transfer path, implement deterministic report selection and outage policies, seed/size counterparty capital, rebuild relayer/keeper infrastructure, and independently specify state storage and deployment initialization. The archived frontend typed-data domain and signature layouts are a useful reference, but a new deployment needs its own chain/address domains and authorization configuration.

An exact source-level fork is blocked on unpublished protocol Solidity, full verified ABIs/storage layouts and backend code. A bytecode fork for local behavioral inspection already works; a clean-room replacement requires a separate implementation and validation effort.
