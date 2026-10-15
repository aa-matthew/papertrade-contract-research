(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=[{label:`Introduction`,items:[{slug:`intro/what-is-papertrade`,title:`What is Papertrade?`},{slug:`intro/faq`,title:`FAQ`},{slug:`intro/quick-start`,title:`Quick start`}]},{label:`How it works`,items:[{slug:`learn/trades-pricing`,title:`Trades and pricing`},{slug:`learn/wins-losses`,title:`Wins and losses`},{slug:`learn/liquidations`,title:`Liquidations`},{slug:`learn/lp-queue`,title:`The LP and the payout queue`},{slug:`learn/paper-emissions`,title:`Paper Emissions`},{slug:`learn/staking-dividends`,title:`Staking Dividends`},{slug:`learn/deposits-withdrawals`,title:`Deposits and withdrawals`},{slug:`learn/session-keys`,title:`Session keys`}]},{label:`How it actually works`,items:[{slug:`how/architecture`,title:`Architecture overview`},{slug:`how/pricing-bbo`,title:`Pricing: BBO precompile`},{slug:`how/asymmetric-impact`,title:`Asymmetric impact PnL`},{slug:`how/solvency-queue`,title:`Solvency & queue`},{slug:`how/mint-curve`,title:`Mint curve`},{slug:`how/deposits`,title:`Deposits: CREATE2 proxies`},{slug:`how/builder-codes`,title:`Builder codes`},{slug:`how/risk`,title:`Risk`}]},{label:`Martingaler LP`,items:[{slug:`martingaler/overview`,title:`Overview`}]},{label:`$PAPER`,items:[{slug:`paper/overview`,title:`Overview`},{slug:`paper/staking`,title:`Staking & claims`}]},{label:`Developer reference`,items:[{slug:`dev/contract-addresses`,title:`Contract addresses`}]}],t=`intro/what-is-papertrade`,n={"intro/what-is-papertrade":{title:`What is Papertrade?`,eyebrow:`Introduction`,lead:`Papertrade is a fair-launched, fully on-chain perpetuals exchange built on Hyperliquid, with several unique features:`,body:`
      <ul>
        <li>1000× leverage</li>
        <li>One-click Buy/Sell, no orderbook</li>
        <li>Zero slippage</li>
        <li>No funding costs</li>
        <li>Self-bootstrapping LP</li>
        <li>No spread</li>
      </ul>

      <h2 id="how-it-runs">How it runs</h2>
      <p>Papertrade's smart contract uses Hyperliquid's <a href="#/how/pricing-bbo">BBO mid as an oracle</a> to create synthetic swaps between the user and the LP. No perpetual contracts are traded on Hyperliquid itself. The contract lives on the HyperEVM L1 and reads HyperCore state through precompiles.</p>
      <p><a href="https://papertrade.xyz">papertrade.xyz</a> is the first canonical frontend for the protocol, built to make the initial trading experience seamless and responsive.</p>

      <h2 id="trades">How trades work</h2>
      <p>All trades on Papertrade are synthetic swaps between the user and the LP: no orderbook, no matching engine, no other counterparty. When you open a position, the contract reads Hyperliquid's <a href="#/how/pricing-bbo">BBO mid through a precompile</a> and locks that price as your entry. When you close, the contract reads BBO mid again and settles PnL directly against the LP.</p>
      <p>Because no actual perpetual contract changes hands on Hyperliquid, there are no funding costs. There is also no slippage: you get the BBO mid regardless of size, subject to per-instrument OI safety caps.</p>

      <h2 id="lp-and-paper">The LP and PAPER</h2>
      <p>The LP bootstraps itself from zero using the Martingaler Protocol. All trades face the LP directly, and the LP grows over time from cumulative user losses. If the LP goes insolvent, it issues debt into a queue, which pays out as soon as the LP receives funds from another user's loss.</p>
      <p>Trading while the LP is low or insolvent is incentivised: PAPER mints fastest in that regime, and the queue pays out automatically as future losses refill the LP.</p>
      <p><a href="#/paper/overview">PAPER</a> is the LP fee-claim token, minted from realised user losses. There is no way to deposit directly into the LP; the only path to exposure is through trade losses that mint PAPER for you. PAPER is a <strong>fair launch</strong>: supply starts at zero, with no pre-mint, no team allocation, no VC allocation, no airdrop, and no vesting. Every token in existence has to be minted through the on-chain emissions curve. At launch PAPER can't be transferred between wallets; it can only be staked and unstaked. The mint rate is flat at <strong>100 PAPER per $1 of loss mint basis</strong> while tracked LP is below <strong>$2M</strong> (including underwater), then decays asymptotically past that point.</p>
      <p>Staked PAPER earns USDC from two sources. <strong>(1) 1% of PnL:</strong> stakers receive 1% of the realised PnL of settled trades, winning or losing, while no payouts are queued and the LP can cover it (liquidations of positions opened from queued balance excepted). <strong>(2) LP overflow:</strong> once tracked LP climbs above the <strong>$5M staker reward cap</strong>, every dollar of further LP gain past that point is fully distributable to stakers via the keeper's <code>pushStakerFees()</code> call. Below $5M, stakers only receive the 1% share.</p>

      <h2 id="fees">No conventional trading fee</h2>
      <p>Papertrade has no notional swap fee, no spread, and no funding cost. At 1000× leverage, none of those would scale sustainably. Instead, the protocol takes its cut from profitable closes, as an <a href="#/how/asymmetric-impact">asymmetric impact</a> haircut on the gain. Losses pay nothing on top of the loss itself.</p>
    `},"martingaler/overview":{title:`Martingaler LP`,eyebrow:`Martingaler LP`,lead:`How Papertrade's LP bootstraps from zero with no upfront capital. A summary of the relevant parts of the Martin Galer whitepaper.`,body:`
      <h2 id="why">Why this mechanism</h2>
      <p>Papertrade's LP is built on the Martingaler mechanism, designed to launch an asynchronous speculation game with no upfront LP capital and no constraints on bet size. The full whitepaper walks through the theory; this page captures the parts directly relevant to Papertrade.</p>
      <p>Traditional onchain speculation games (SatoshiDice, Bustabit, Etheroll, EtherCrash) all needed an LP pool seeded upfront. That meant either centralised capital (with all the trust and incentive design that entails) or token rewards that complicated the protocol's economics. EtherCrash famously had its LP drained by a bad actor; Rollbit-style platforms still face the same solvency anxiety from users.</p>
      <p>The Martingaler mechanism removes both constraints (no initial LP, no bet-size cap) by replacing instant-payout LP economics with a payout queue.</p>

      <h2 id="payout-queue">The payout queue</h2>
      <p>Instead of holding an LP that pays winners on demand, the protocol routes every winning wager through a FIFO queue. The protocol can be temporarily insolvent on aggregate, but every winner gets paid in order as soon as solvency permits.</p>
      <p>Per-wager logic:</p>
      <ol>
        <li>A new wager is placed and wins.</li>
        <li>If a queue already exists:
          <ul>
            <li>Add the wager to the back of the queue.</li>
            <li>Evaluate whether the <em>front</em> of the queue can now be paid out (per the solvency ratio).</li>
            <li>If yes, pay it out.</li>
          </ul>
        </li>
        <li>If no queue exists:
          <ul>
            <li>Evaluate whether this wager can be paid out directly.</li>
            <li>If yes, pay it. Otherwise, start a queue of length one with this wager.</li>
          </ul>
        </li>
      </ol>

      <figure style="margin:22px 0">
        <svg viewBox="0 0 720 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Payout queue FIFO diagram" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <defs>
            <marker id="arMGg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5F564B"/></marker>
            <marker id="arMGgr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2D5F3A"/></marker>
          </defs>
          <text x="360" y="28" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#8B2020" text-anchor="middle" letter-spacing=".04em">PAYOUT QUEUE (FIFO)</text>

          <text x="140" y="60" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2D5F3A" text-anchor="middle">paid first</text>
          <line x1="140" y1="68" x2="140" y2="113" stroke="#2D5F3A" stroke-width="1.5" marker-end="url(#arMGgr)"/>

          <text x="620" y="60" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#5F564B" text-anchor="middle">new wagers append here</text>
          <line x1="620" y1="68" x2="620" y2="113" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arMGg)"/>

          <rect x="60" y="120" width="600" height="80" rx="6" fill="rgba(139,32,32,0.06)" stroke="#8B2020" stroke-width="1.5"/>
          <text x="78" y="138" font-family="Inter,sans-serif" font-size="9" fill="#998C76" text-anchor="start">← FRONT</text>
          <text x="642" y="138" font-family="Inter,sans-serif" font-size="9" fill="#998C76" text-anchor="end">BACK →</text>
          <g font-family="ui-monospace,Menlo,monospace">
            <rect x="100" y="146" width="80" height="44" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1.5"/>
            <text x="140" y="167" font-size="12" fill="#2A2520" text-anchor="middle">w₁</text>
            <text x="140" y="182" font-size="9" fill="#7A7060" text-anchor="middle">user A</text>
            <rect x="195" y="146" width="80" height="44" rx="4" fill="#FAF6ED" stroke="#D4CBBA" stroke-width="1.5"/>
            <text x="235" y="167" font-size="12" fill="#2A2520" text-anchor="middle">w₂</text>
            <text x="235" y="182" font-size="9" fill="#7A7060" text-anchor="middle">user B</text>
            <rect x="290" y="146" width="80" height="44" rx="4" fill="#FAF6ED" stroke="#D4CBBA" stroke-width="1.5"/>
            <text x="330" y="167" font-size="12" fill="#2A2520" text-anchor="middle">w₃</text>
            <text x="330" y="182" font-size="9" fill="#7A7060" text-anchor="middle">user C</text>
            <rect x="385" y="146" width="80" height="44" rx="4" fill="#FAF6ED" stroke="#D4CBBA" stroke-width="1.5"/>
            <text x="425" y="167" font-size="12" fill="#2A2520" text-anchor="middle">w₄</text>
            <text x="425" y="182" font-size="9" fill="#7A7060" text-anchor="middle">user D</text>
            <rect x="480" y="146" width="80" height="44" rx="4" fill="#FAF6ED" stroke="#D4CBBA" stroke-width="1.5"/>
            <text x="520" y="167" font-size="12" fill="#2A2520" text-anchor="middle">w₅</text>
            <text x="520" y="182" font-size="9" fill="#7A7060" text-anchor="middle">user E</text>
            <text x="585" y="172" font-size="14" fill="#7A7060" text-anchor="middle">…</text>
          </g>
          <text x="360" y="226" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">Each box is one unpaid winning wager.</text>
          <text x="360" y="246" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">Harvest fires whenever the protocol can pay the front, draining payouts in order.</text>
        </svg>
      </figure>

      <p>The queue absorbs variance that an LP couldn't have absorbed on its own. Multiple front-of-queue payouts can fire per new wager when solvency allows. In Papertrade's deployed accounting, margin lost on positions opened from available balance becomes free LP cash (net of the 2% fee) while the queue is empty; while the queue is active it is earmarked in <code>sideBucket</code> and harvested into queued payouts instead of freeing LP cash ahead of them.</p>

      <h2 id="emissions">Why token emissions help</h2>
      <p>Token emissions let a positive-house-edge game present as <strong>+EV</strong> for the player by remunerating realised losses with a claim on future protocol value. Early participants, who carry the most variance risk, are rewarded most.</p>
      <p>For Papertrade, this is implemented as the <a href="#/how/mint-curve">PAPER mint curve</a>: 100 tokens per dollar of loss mint basis while tracked LP is below $2M (the flat region, including underwater), then decaying asymptotically past that point. The flat-region rate is what makes early trading attractive even before the LP becomes solvent.</p>

      <h2 id="whitepaper">Whitepaper</h2>
      <p>Full text: <a href="/martingaler-whitepaper.pdf" target="_blank" rel="noopener noreferrer">A Bootstrapping Mechanism for Sustainable Asynchronous Speculation Games of Chance</a> (Galer).</p>
      <p>The whitepaper also covers worked examples (a fair coin flip; a 3/4-chance-to-win-4/3 game with positive house edge), a yield-bearing-collateral variant, and a queue-redemption escape valve for stuck participants. Those are out of scope for Papertrade as deployed; this page summarises only the parts that map to the live system.</p>
    `},"intro/faq":{title:`FAQ`,eyebrow:`Introduction`,lead:`Common questions about how Papertrade works, what it costs, and what's actually onchain.`,body:`
      <h2 id="onchain">How is it onchain?</h2>
      <p>All of Papertrade's trading logic lives entirely on the HyperEVM L1 (Hyperliquid's smart-contract layer), while USDC balances are held entirely on HyperCore (Hyperliquid's native spot ledger). The two are kept separate: the Exchange contract on HyperEVM tracks all trading state (positions, queue, per-user balances) and moves USDC through HyperCore via CoreWriter precompile actions.</p>
      <p>For the gated trading surface, public maintenance paths, and admin-key model see <a href="#/how/risk">Risk</a>.</p>

      <h2 id="how-trades-work">How do trades work?</h2>
      <p>Trades are synthetic swaps between the user and the LP. No perpetual contracts are traded on Hyperliquid. Each trade executes at Hyperliquid's order-book mid. No funding costs and no slippage: you get the BBO mid regardless of size, subject to the per-instrument OI cap.</p>
      <p>When you first connect, the app creates a <a href="#/learn/session-keys">session key</a> for you, which eliminates the need to confirm future trades with a wallet signature.</p>

      <h2 id="oracle">How does the oracle work?</h2>
      <p>Papertrade reads prices through <a href="#/how/pricing-bbo">Hyperliquid precompiles</a>: a free, instant, reliable oracle that any HyperEVM contract can read directly from within the L1. No off-chain feed and no price signer.</p>

      <h2 id="markets">What markets are available, and what's the max leverage?</h2>
      <p>Currently <strong>BTC</strong> and <strong>ETH</strong>, both with up to <strong>1000× leverage</strong>. A single position's notional (margin × leverage) can be up to <strong>$10M</strong>. The protocol can list any perpetual contract on Hyperliquid, including <strong>HIP-3</strong> markets. New markets are added by the contract owner.</p>

      <h2 id="fees">What does it cost to trade?</h2>
      <p>In order to maintain solvency given the trader-favoured nature of offering no slippage at BBO, everything the protocol takes from a trader comes out of a winning close:</p>
      <ol>
        <li>A <strong>0.2 bps jitter-protection deadband</strong>: the gain is measured as if the exit were 0.2 bps less favourable, so a win smaller than that pays nothing (see <a href="#/how/risk">Risk</a> for details).</li>
        <li><strong><a href="#/how/asymmetric-impact">Asymmetric impact</a></strong>: a smooth haircut on the remaining gain that shrinks as the price move between entry and exit grows.</li>
        <li>A <strong>2% win fee</strong> on the gain after impact.</li>
      </ol>
      <p>Losses pay nothing on top of the loss itself. Losing closes and liquidations carry a 2% fee too, but it is carved from the LP's gain, not added to your loss, and it is charged only while the payout queue is empty and the LP can cover it. Liquidating a position opened from your queued balance never carries the fee. Fees are split between stakers and the dev fee recipient (see <a href="#/paper/staking">Staking &amp; claims</a>).</p>

      <h2 id="add-margin">Can I add margin to my position?</h2>
      <p>No. Every position is a discrete slug that cannot be modified once opened. If you want more headroom on a position, close it and reopen with more margin.</p>

      <h2 id="liquidations">What happens during a liquidation?</h2>
      <p>Each position has a displayed <strong>bust price</strong>, which is deliberately set a small distance before the voluntary close path would exhaust the position's equity. Liquidation is a hard bust: crossing the displayed bust price forfeits the full isolated margin, even if a voluntary close immediately beforehand could return some equity. Once the BBO crosses that trigger, the position can be liquidated; the contract removes it and applies the full-margin liquidation accounting.</p>
      <p>The protocol's liquidation keeper submits liquidations as soon as a position crosses its bust price.</p>

      <h2 id="fair-launch">Is PAPER fairly launched?</h2>
      <p>Yes. PAPER starts from a supply of <strong>zero</strong>. There is no pre-mint, no team allocation, no VC allocation, no airdrop, and no vesting schedule. Every token in existence has been minted to a trader who closed at a loss or got liquidated. The supply is purely community-owned by definition: the only mint path is through trading. At launch PAPER can't be transferred between wallets; staking and unstaking still work.</p>

      <h2 id="lp-deposit">How can I deposit to the LP?</h2>
      <p>You can't. The LP is made of cumulative user losses, and the PAPER token owns the future LP revenue. The only way to earn <a href="#/paper/overview">PAPER</a> is to close a losing trade, which directly adds to the LP and mints PAPER for you. If you already hold PAPER, you can stake it to start earning the staker share of protocol fees and LP surplus, paid in USDC.</p>

      <h2 id="own-frontend">Can I build my own frontend?</h2>
      <p>Yes, but trading goes through Papertrade's relayer. A third-party frontend produces the same signed intents and submits them through the relayer, which batches them onchain; the contracts don't accept opens, closes, session-key registration, proxy deployment, or staking actions from anyone else. Withdrawals still require the user's real wallet signature.</p>
    `},"intro/quick-start":{title:`Quick start`,eyebrow:`Introduction`,lead:``,body:`
      <h2 id="what-you-need">What you need</h2>
      <ul>
        <li>An EVM wallet: MetaMask, Rabby, Frame, Rainbow, or anything that speaks WalletConnect.</li>
        <li>At least 10 USDC to fund your trading balance, on Hyperliquid, HyperEVM, Ethereum, Arbitrum or Solana, or USDG on Robinhood Chain.</li>
      </ul>

      <h2 id="connect">1. Connect</h2>
      <p>Go to <a href="https://papertrade.xyz">papertrade.xyz</a> and click <em>Connect</em>. Your wallet pops once for a signature that registers a <a href="#/learn/session-keys">session key</a>: a scoped keypair that signs your trades on your behalf for a window of time. After that single signature you won't see another wallet popup for normal trading.</p>

      <h2 id="deposit">2. Deposit</h2>
      <p>Click <em>Deposit</em> and pick where your funds are. The app sends them from your wallet to your unique deposit address: yours alone, deterministic, no one else's USDC will ever land there. A transfer from Hyperliquid is credited to your Papertrade trading balance within seconds; a deposit from another chain also waits for its bridge. At least 10 USDC has to arrive after fees; the app shows the least each route needs to send. See <a href="#/learn/deposits-withdrawals">Deposits and withdrawals</a> for more.</p>

      <h2 id="trade">3. Trade</h2>
      <p>Pick a market, a direction (long or short), how much margin to commit, and a leverage up to 1000×. Click <em>Buy</em> or <em>Sell</em>. The protocol enters you immediately at Hyperliquid's BBO mid. Close any time; the protocol reads the current mid and settles your PnL against the LP. There is no gas fee on the user side and no popup per trade; the relayer covers gas and the session key signs.</p>

      <h2 id="next">Next</h2>
      <ul>
        <li><a href="#/learn/wins-losses">Wins and losses</a>: what you keep, what the protocol takes.</li>
        <li><a href="#/learn/lp-queue">The LP and the payout queue</a>: what you're trading against.</li>
        <li><a href="#/learn/paper-emissions">Paper Emissions</a>: why you receive PAPER on losses.</li>
      </ul>
    `},"learn/trades-pricing":{title:`Trades and pricing`,eyebrow:`How it works`,lead:`What a trade looks like from the trader's side, and where the price comes from.`,body:`
      <p>To open a trade, you pick a market (BTC or ETH for now), pick a direction (long or short), pick how much margin you want to commit and how much leverage you want on top, and click. The protocol opens the position immediately at Hyperliquid's order-book mid price. Closing works the same way: you click, the protocol reads the current mid, and your PnL settles against the LP.</p>

      <h2 id="counterparty">Who you're trading against</h2>
      <p>The counterparty on every trade is the LP. There is no orderbook on Papertrade, no matching engine, no other trader on the other side. Whether you win or lose flows directly to or from the LP's balance. This is what lets the protocol skip slippage and funding costs entirely.</p>

      <h2 id="pricing">Where the price comes from</h2>
      <p>The price you trade at is Hyperliquid's order-book mid for that asset, read directly by the smart contract from Hyperliquid's network. There's no separate price feed, no oracle committee, no admin signer. The price the contract sees is the same price Hyperliquid's market makers are quoting at that block.</p>

      <h2 id="costs">Fees, funding, slippage</h2>
      <p>No funding cost, no spread, and no user-paid gas. The relayer pays gas. The protocol's cut comes from profitable closes: an <a href="#/learn/wins-losses">asymmetric impact</a> haircut and a 2% win fee. Losses are not charged above the loss itself.</p>

      <h2 id="margin">Margin</h2>
      <p>Each trade lives as its own self-contained position. The margin you commit at open is the margin that position carries until it ends. You cannot top it up to push back a liquidation, and you cannot pull margin out to free up collateral elsewhere. There's no cross-margining between positions, no isolated-vs-cross toggle, no leverage adjustment after the fact.</p>
      <p>The only way to edit a position is to close it (you decide when, full size only) or have it liquidated (the protocol decides when, by hitting your bust price). Want to scale into the same direction? Open a second position. Want to take some risk off the table? Close this one and open a smaller one.</p>

      <h2 id="limits">What's available, what's the cap</h2>
      <p>BTC and ETH today, both with up to <strong>1000× leverage</strong>. A single position's notional (margin × leverage) can be up to <strong>$10M</strong>. Markets are added by the contract owner and are limited to assets that exist on Hyperliquid's order book.</p>
    `},"learn/wins-losses":{title:`Wins and losses`,eyebrow:`How it works`,lead:`What happens at close: what you keep, what the protocol takes, and what you receive on losses.`,body:`
      <h2 id="winning">Winning closes</h2>
      <p>Your raw gain is the price move multiplied by your position notional. Before the protocol credits the gain to your account, it applies an <strong>asymmetric impact</strong>: a smooth haircut that scales with how far price moved between entry and exit. Bigger moves keep more of the raw gain. Tiny moves are scaled the most. A <strong>2% win fee</strong> then comes off the gain that remains.</p>
      <p>That is everything the protocol takes from your trade. Neither is a percentage fee on notional or a spread on the price you see: both scale the realised gain, and they only ever apply to gains.</p>

      <figure style="margin:22px 0">
        <svg viewBox="0 0 760 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wins and losses comparison" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <rect x="20" y="20" width="350" height="240" rx="8" fill="rgba(45,95,58,0.04)" stroke="#2D5F3A" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="195" y="50" font-family="Inter,sans-serif" font-weight="700" fill="#2D5F3A" text-anchor="middle" letter-spacing=".05em" font-size="12">WINNING CLOSE</text>

          <text x="40" y="90" font-family="Inter,sans-serif" font-size="10" fill="#7A7060">Raw gain</text>
          <rect x="40" y="96" width="310" height="28" fill="rgba(45,95,58,0.25)" stroke="#2D5F3A" stroke-width="1.2"/>

          <text x="40" y="152" font-family="Inter,sans-serif" font-size="10" fill="#7A7060">You receive</text>
          <rect x="40" y="158" width="280" height="28" fill="rgba(45,95,58,0.25)" stroke="#2D5F3A" stroke-width="1.2"/>
          <rect x="320" y="158" width="30" height="28" fill="rgba(122,98,53,0.45)" stroke="#7A6235" stroke-width="1.2"/>

          <path d="M 320 192 L 320 198 L 350 198 L 350 192" stroke="#7A6235" stroke-width="1" fill="none"/>
          <text x="335" y="214" font-family="Inter,sans-serif" font-size="10" fill="#7A6235" text-anchor="middle" font-style="italic">impact + fee</text>

          <text x="195" y="244" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">Bigger price moves keep more of the gain.</text>

          <rect x="390" y="20" width="350" height="240" rx="8" fill="rgba(139,32,32,0.04)" stroke="#8B2020" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="565" y="50" font-family="Inter,sans-serif" font-weight="700" fill="#8B2020" text-anchor="middle" letter-spacing=".05em" font-size="12">LOSING CLOSE</text>

          <text x="410" y="90" font-family="Inter,sans-serif" font-size="10" fill="#7A7060">Raw loss</text>
          <rect x="410" y="96" width="310" height="28" fill="rgba(139,32,32,0.25)" stroke="#8B2020" stroke-width="1.2"/>

          <text x="410" y="152" font-family="Inter,sans-serif" font-size="10" fill="#7A7060">Paid to LP</text>
          <rect x="410" y="158" width="310" height="28" fill="rgba(139,32,32,0.25)" stroke="#8B2020" stroke-width="1.2"/>

          <text x="565" y="214" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2D5F3A" text-anchor="middle">+ you receive PAPER for the loss</text>

          <text x="565" y="244" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">No haircut, no extra fee.</text>
        </svg>
      </figure>

      <h2 id="losing">Losing closes</h2>
      <p>Your raw loss is the price move multiplied by your position notional. Nothing extra is taken from you on top of that loss. For a position opened from your available balance, when the payout queue is empty a 2% LP-side fee is carved from the LP's gain on the loss; when the queue is active, the fee is waived and the lost margin is held in <code>sideBucket</code> for queued payouts. For a position opened from your queued balance, the lost part of that queued balance is cancelled, and the 2% LP-side fee is paid from free LP cash only when the queue is empty and that cash covers both what you're owed back and the fee.</p>
      <p>You also receive PAPER tokens for the realised loss. The amount depends on where tracked LP is on its <a href="#/learn/paper-emissions">emissions curve</a>: the lower the LP, the more PAPER you mint per dollar of eligible loss basis. Every loss counts toward tracked LP when it settles, including while the queue is active.</p>

      <h2 id="asymmetric">Why it's called asymmetric</h2>
      <p>Wins are scaled (a haircut). Losses pay the full PnL but face no scaling on top. The cost of trading lives entirely on the win side, scaled by how much you actually won.</p>

      <p>For the exact mechanics see <a href="#/how/asymmetric-impact">Asymmetric impact PnL</a>.</p>
    `},"learn/liquidations":{title:`Liquidations`,eyebrow:`How it works`,lead:`How the displayed bust trigger differs from a voluntary close, and what a hard liquidation means.`,body:`
      <p>Every position has a displayed <strong>bust price</strong>. It is the hard-liquidation trigger, not a promise that the voluntary close path has already reduced the position's remaining equity to zero. Liquidation is a hard bust: crossing the displayed bust price forfeits the full isolated margin, even if a voluntary close immediately beforehand could return some equity.</p>

      <h2 id="buffer">The buffer</h2>
      <p>The trigger is a touch closer to your entry than the zero-equity price used as its reference point. The gap is a small fixed buffer baked into the contract, currently about <strong>5 basis points</strong> (0.05% of price). Because crossing the trigger invokes the separate full-margin liquidation rule, that apparently small price gap can represent meaningful remaining close-path equity at high leverage.</p>
      <p>A worked example: a $100 long opened at 100× leverage. A 1% drop — to $99 — would consume your full margin exactly. The protocol trips liquidation a little earlier, at roughly <strong>$99.05</strong>. That last 0.05% is the buffer.</p>
      <p>The shape is the same at lower leverage. At 10×, the threshold moves from 10% to about 9.95%. At 2×, from 50% to about 49.95%. The absolute offset stays around 5 basis points regardless of leverage.</p>
      <p>Because the offset is fixed in price, its share of your margin grows with leverage. At 100× the buffer is about 5% of your margin; at 1000×, where your full margin covers a 0.1% move, liquidation fires after a move of about 0.052%, while a voluntary close would still return nearly half your margin.</p>

      <h2 id="trigger">When liquidation fires</h2>
      <p>If the BBO mid crosses your bust price, the protocol's liquidation keeper liquidates your position. Liquidation does not settle the position as a voluntary close at the trigger price: it removes the position under the hard-bust path and forfeits the full isolated margin.</p>
      <p>You lose the full isolated margin; that's what hard bust means. For a position opened from your available balance, when the payout queue is empty a 2% liquidation fee is carved from that margin for stakers and the dev fee recipient; when the queue is active, the fee is waived and the margin is held in <code>sideBucket</code> for queued payouts. For a position opened from your queued balance, the queued balance you put up as its margin is forfeited and no liquidation fee is charged. In every case you receive PAPER on the full lost margin.</p>

      <h2 id="who-runs">Who runs the keepers</h2>
      <p>Papertrade runs the liquidation keeper. It watches open positions against the live price and submits liquidations as soon as positions cross their bust prices, paying a higher priority fee than any other protocol transaction so liquidations land first.</p>
    `},"learn/lp-queue":{title:`The LP and the payout queue`,eyebrow:`How it works`,lead:`What you're trading against, where its money comes from, and what happens when it can't pay out a winner immediately.`,body:`
      <h2 id="lp">The LP</h2>
      <p>The LP is the protocol's balance of USDC held to settle trades. It starts at <strong>$0</strong>. There is no seed capital, no founders' deposit, no upfront LP raise. The LP grows over time from cumulative user losses.</p>
      <p>There is also no way for anyone to deposit <em>directly</em> into the LP. The only way to get exposure to LP economics is to hold or stake <a href="#/learn/paper-emissions">PAPER</a>, the protocol's native token, which is minted to traders against losing closes and liquidations. At launch PAPER can't be transferred between wallets; staking and unstaking are supported.</p>

      <h2 id="queue">The payout queue</h2>
      <p>Sometimes the LP doesn't have enough USDC to immediately pay a winning close in full. When that happens, the unpaid portion of the win goes into a FIFO queue. The contract keeps a running list of unpaid wins and pays them out from the front as future losses refill the LP.</p>

      <p><strong>Your USDC margin is never queued.</strong> When you close a position opened from your available balance, the contract returns your original collateral to your balance instantly — only the <em>profit</em> portion of a winning close can land in the queue if the LP is short. On a losing close the loss comes out of your margin and the remainder is yours immediately. Even when the queue has wait time, your principal is always under your own control. A position opened with your queued balance as margin is different: its margin was itself a queue claim, so on close the whole surviving claim can be queued again.</p>

      <figure style="margin:22px 0">
        <svg viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="LP healthy vs LP low scenarios" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <defs>
            <marker id="arLQg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5F564B"/></marker>
          </defs>

          <rect x="20" y="20" width="370" height="220" rx="8" fill="rgba(45,95,58,0.04)" stroke="#2D5F3A" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="205" y="48" font-family="Inter,sans-serif" font-weight="700" fill="#2D5F3A" text-anchor="middle" letter-spacing=".05em" font-size="12">LP HEALTHY</text>

          <rect x="40" y="100" width="80" height="50" rx="5" fill="#FAF6ED" stroke="#2A2520" stroke-width="1.2"/>
          <text x="80" y="124" font-family="Inter,sans-serif" font-size="11" font-weight="600" text-anchor="middle">Your win</text>
          <text x="80" y="140" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle">at close</text>

          <line x1="124" y1="125" x2="148" y2="125" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arLQg)"/>

          <rect x="150" y="100" width="100" height="50" rx="5" fill="rgba(45,95,58,0.15)" stroke="#2D5F3A" stroke-width="1.5"/>
          <text x="200" y="124" font-family="Inter,sans-serif" font-size="11" font-weight="600" text-anchor="middle">LP</text>
          <text x="200" y="140" font-family="Inter,sans-serif" font-size="9" fill="#5F564B" text-anchor="middle" font-style="italic">has funds</text>

          <line x1="254" y1="125" x2="278" y2="125" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arLQg)"/>

          <rect x="280" y="100" width="90" height="50" rx="5" fill="#FAF6ED" stroke="#2A2520" stroke-width="1.2"/>
          <text x="325" y="124" font-family="Inter,sans-serif" font-size="11" font-weight="600" text-anchor="middle">Paid</text>
          <text x="325" y="140" font-family="Inter,sans-serif" font-size="9" fill="#2D5F3A" text-anchor="middle">immediately</text>

          <text x="205" y="200" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">The LP can pay your win in full at close.</text>

          <rect x="410" y="20" width="370" height="220" rx="8" fill="rgba(139,32,32,0.04)" stroke="#8B2020" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="595" y="48" font-family="Inter,sans-serif" font-weight="700" fill="#8B2020" text-anchor="middle" letter-spacing=".05em" font-size="12">LP LOW (or underwater)</text>

          <rect x="430" y="80" width="80" height="46" rx="5" fill="#FAF6ED" stroke="#2A2520" stroke-width="1.2"/>
          <text x="470" y="102" font-family="Inter,sans-serif" font-size="11" font-weight="600" text-anchor="middle">Your win</text>
          <text x="470" y="116" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle">at close</text>

          <line x1="514" y1="103" x2="538" y2="103" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arLQg)"/>

          <rect x="540" y="80" width="100" height="46" rx="5" fill="rgba(139,32,32,0.15)" stroke="#8B2020" stroke-width="1.5"/>
          <text x="590" y="102" font-family="Inter,sans-serif" font-size="11" font-weight="600" text-anchor="middle">Queue</text>
          <text x="590" y="116" font-family="Inter,sans-serif" font-size="9" fill="#5F564B" text-anchor="middle" font-style="italic">FIFO</text>

          <line x1="590" y1="132" x2="590" y2="158" stroke="#7A7060" stroke-width="1" stroke-dasharray="3 3"/>
          <text x="608" y="148" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" font-style="italic">later</text>

          <rect x="430" y="160" width="100" height="46" rx="5" fill="#FAF6ED" stroke="#7A6235" stroke-width="1.2"/>
          <text x="480" y="182" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#7A6235" text-anchor="middle">Future loss</text>
          <text x="480" y="196" font-family="Inter,sans-serif" font-size="9" fill="#5F564B" text-anchor="middle">refills LP</text>

          <line x1="534" y1="183" x2="558" y2="183" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arLQg)"/>

          <rect x="560" y="160" width="100" height="46" rx="5" fill="#FAF6ED" stroke="#2A2520" stroke-width="1.2"/>
          <text x="610" y="182" font-family="Inter,sans-serif" font-size="11" font-weight="600" text-anchor="middle">Paid</text>
          <text x="610" y="196" font-family="Inter,sans-serif" font-size="9" fill="#2D5F3A" text-anchor="middle">queue front</text>

          <text x="595" y="226" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">Win is queued and paid as the LP refills.</text>
        </svg>
      </figure>

      <h2 id="what-this-means">What this means for you</h2>
      <p>If you close a winning trade and the LP can pay you immediately, you're paid immediately. If the LP can't, the queue absorbs the difference and pays you out as solvency returns. Your queued payout is real on-chain debt: not a refund, not a haircut, just a delay.</p>
      <p>Trading while the LP is low or underwater is incentivised by the <a href="#/learn/paper-emissions">PAPER emissions curve</a>: that's exactly when PAPER mints fastest, and while a queue exists, losses go toward paying it down.</p>

      <p>For the academic background on this mechanism see the <a href="#/martingaler/overview">Martingaler LP overview</a>. For the on-chain implementation see <a href="#/how/solvency-queue">Solvency model: three-bucket queue</a>.</p>
    `},"learn/paper-emissions":{title:`Paper Emissions`,eyebrow:`How it works`,lead:`Why PAPER exists, how you earn it, and why the rate is biggest at the start.`,body:`
      <h2 id="fair-launch">A fair launch by construction</h2>
      <p>PAPER starts at <strong>zero supply</strong>. No pre-mint, no team allocation, no VC allocation, no airdrop, no vesting. Every token that will ever exist has to be minted through the emissions curve described below, and the only people who can trigger a mint are the traders who close at a loss or get liquidated. The supply is purely community-owned by definition. At launch PAPER can't be transferred between wallets, only staked and unstaked.</p>

      <h2 id="why">Why PAPER exists</h2>
      <p>PAPER is the LP's fee-claim token. Staking it gives you a pro-rata share of the protocol's future revenue. There is no other path to LP exposure: minting PAPER is how the protocol bootstraps an LP without any upfront capital, by routing a token reward to the people who put money in (which, in this design, means the people who lose trades).</p>

      <h2 id="how-earn">How you earn it</h2>
      <p>PAPER mints to your account whenever you close a trade at a loss or get liquidated. Nothing else mints PAPER. The amount minted scales with your eligible realised loss basis: bigger losses mint more PAPER.</p>

      <h2 id="when-most">When the rate is highest</h2>
      <p>The mint rate isn't fixed. It depends on where the LP is sitting:</p>
      <ul>
        <li>While tracked LP is below <strong>$2M</strong> (including any time it's underwater), the rate is a flat <strong>100 PAPER per $1 of eligible loss basis</strong>.</li>
        <li>Above $2M, the rate decays smoothly as the LP grows. The further the LP gets, the less PAPER each new dollar of loss mints.</li>
      </ul>
      <p>Early traders earn materially more PAPER per dollar lost than late traders. By design: early activity carries the most variance risk and is rewarded the most.</p>

      <figure style="margin:22px 0">
        <svg viewBox="0 0 700 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mint rate vs LP balance, simplified" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <rect x="80" y="50" width="50" height="170" fill="rgba(139,32,32,0.06)"/>
          <rect x="130" y="50" width="70" height="170" fill="rgba(45,95,58,0.06)"/>
          <rect x="200" y="50" width="460" height="170" fill="rgba(122,98,53,0.04)"/>

          <line x1="80" y1="220" x2="660" y2="220" stroke="#7A7060" stroke-width="1"/>
          <line x1="80" y1="50" x2="80" y2="220" stroke="#7A7060" stroke-width="1"/>

          <line x1="130" y1="50" x2="130" y2="220" stroke="#8B2020" stroke-width="1" stroke-dasharray="3 3"/>
          <text x="130" y="42" font-family="Inter,sans-serif" font-size="9" fill="#8B2020" text-anchor="middle">LP = $0</text>

          <line x1="200" y1="50" x2="200" y2="220" stroke="#7A6235" stroke-width="1" stroke-dasharray="3 3"/>
          <text x="200" y="42" font-family="Inter,sans-serif" font-size="9" fill="#7A6235" text-anchor="middle">$2M</text>

          <path d="M 80 70 L 200 70 C 260 70, 360 165, 660 198" stroke="#2D5F3A" stroke-width="2.5" fill="none"/>

          <text x="165" y="92" font-family="Inter,sans-serif" font-size="10" fill="#2D5F3A" text-anchor="middle" font-weight="600">100 / $</text>
          <text x="430" y="125" font-family="Inter,sans-serif" font-size="10" fill="#7A6235" font-style="italic" text-anchor="middle">decays as LP grows</text>

          <text x="105" y="244" font-family="Inter,sans-serif" font-size="10" fill="#8B2020" text-anchor="middle">underwater</text>
          <text x="165" y="244" font-family="Inter,sans-serif" font-size="10" fill="#2D5F3A" text-anchor="middle">flat</text>
          <text x="430" y="244" font-family="Inter,sans-serif" font-size="10" fill="#7A6235" text-anchor="middle">tail (LP growing →)</text>

          <text x="74" y="74" font-family="Inter,sans-serif" font-size="10" fill="#5F564B" text-anchor="end">highest</text>
          <text x="74" y="202" font-family="Inter,sans-serif" font-size="10" fill="#5F564B" text-anchor="end">lower</text>

          <text transform="rotate(-90 26 135)" x="26" y="135" font-family="Inter,sans-serif" font-size="10" fill="#5F564B" font-weight="600" text-anchor="middle">mint rate (PAPER per $1 loss basis)</text>

          <text x="370" y="282" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">Mint rate is highest while the LP is small or underwater, then decays smoothly as it grows.</text>
        </svg>
      </figure>

      <p>For the technical curve and exact formula see <a href="#/how/mint-curve">Mint curve</a>.</p>
    `},"learn/staking-dividends":{title:`Staking Dividends`,eyebrow:`How it works`,lead:`What you can do with PAPER once you have it: stake to earn USDC, with no lockup.`,body:`
      <h2 id="stake">Staking PAPER</h2>
      <p>Stake any amount of PAPER, any time, with a wallet signature. Stake and unstake are both <strong>instant</strong>: there is no cooldown, no lockup, no vesting. Once your PAPER is staked, every distribution pays you a pro-rata share of the protocol's USDC dividends.</p>

      <h2 id="sources">Where the dividends come from</h2>
      <p>Two sources, both paid to stakers in USDC.</p>
      <ol>
        <li><strong>Half of every trading fee.</strong> Winning closes pay a 2% fee out of the trader's gain; losing closes and liquidations carry a 2% fee carved from the LP's gain, not added to the trader's loss (liquidations of positions opened from queued balance carry none). Half of each fee goes to stakers and half to the dev fee recipient. Fees are paid out only while the payout queue is empty and the LP can cover them; queued winners always come first.</li>
        <li><strong>An LP excess sweep.</strong> Once tracked LP (the protocol's running tally of LP profit and loss) grows past its <strong>$5M cap</strong>, every dollar past that point is sweepable to stakers. Below $5M, only the fee share routes to stakers; above, the surplus routes too.</li>
      </ol>

      <h2 id="claim">Claiming</h2>
      <p>Your accrued dividends sit in the staking contract until you claim. The frontend shows your accumulated balance live; you can claim at any time with a wallet signature and the USDC moves to your trading balance.</p>

      <p>For the on-chain mechanics see <a href="#/paper/staking">Staking & claims</a>.</p>
    `},"learn/deposits-withdrawals":{title:`Deposits and withdrawals`,eyebrow:`How it works`,lead:`How money gets into and out of your Papertrade balance.`,body:`
      <h2 id="deposit">Depositing</h2>
      <p>Click <em>Deposit</em>, pick where your funds are, and confirm in your wallet. You can deposit USDC from Hyperliquid, HyperEVM, Ethereum, Arbitrum or Solana, or USDG from Robinhood Chain. The app sends it to a deposit address that belongs only to you, and it's credited to your trading balance once it lands: within seconds from Hyperliquid, or once the bridge completes from another chain.</p>
      <p>At least 10 USDC has to arrive after fees. A first deposit also pays a one-time 1 USDC account activation fee, and deposits from other chains pay the bridge's fee, so the app shows the least each route needs to send.</p>

      <h2 id="withdraw">Withdrawing</h2>
      <p>Withdraw any time, up to your available balance: anything not committed as margin to an open position. The minimum is 10 USDC. Sign with your wallet and the funds go to your wallet address on Hyperliquid, or on to HyperEVM, Ethereum, Arbitrum or Solana if you choose. The app shows any route fee before you sign.</p>

      <h2 id="technical">Technical detail</h2>
      <p>For how deposit addresses and sweeps work under the hood, see <a href="#/how/deposits">Deposits: CREATE2 proxies</a>.</p>
    `},"learn/session-keys":{title:`Session keys`,eyebrow:`How it works`,lead:`Why you don't get a wallet popup on every trade, and what's actually being authorised.`,body:`
      <h2 id="why">Why one click is enough</h2>
      <p>When you first connect your wallet to Papertrade, the app asks you to sign a single message to register a <strong>session key</strong>. After that, your individual trades (opens and closes) don't pop a wallet signature. The session key signs them on your behalf, scoped to your account, for a window of time, and the relayer/batcher submits the signed intents onchain.</p>

      <h2 id="what-it-can">What a session key can do</h2>
      <ul>
        <li>Open positions on your account, funded from your available balance or your queued balance.</li>
        <li>Close positions on your account.</li>
      </ul>

      <h2 id="what-it-cant">What a session key cannot do</h2>
      <ul>
        <li><strong>It cannot withdraw your funds.</strong> Withdrawals always require your real wallet's signature.</li>
        <li>It cannot stake, unstake, or claim PAPER rewards. Those are signed by your wallet too.</li>
      </ul>
      <p>Worst case if a session key is compromised: an attacker can open and close positions on your account, and so could lose your balance in trades, but cannot withdraw it or move it anywhere else. You can revoke a session key at any time by calling <code>revokeSessionKey</code> on the SessionKeyManager from your wallet. It is a HyperEVM transaction, so it needs a little HYPE for gas. Trades the key signed that are still queued are cancelled.</p>

      <h2 id="expiry">Expiry</h2>
      <p>Session keys last 30 days. Every trade a session key signs is valid for one hour, so the app asks you to sign a new session key once the current one has less than an hour left.</p>

    `},"how/architecture":{title:`Architecture overview`,eyebrow:`How it actually works`,lead:`The protocol is a set of contracts on the HyperEVM L1 that uses Hyperliquid's HyperCore precompiles for pricing and bridging. This page maps the contracts and how they fit together.`,body:`
      <figure style="margin:22px 0">
        <svg viewBox="0 0 720 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Papertrade on-chain architecture" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <defs>
            <marker id="arARw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5F564B"/></marker>
          </defs>

          <rect x="20" y="20" width="680" height="220" rx="6" fill="rgba(139,32,32,0.04)" stroke="#8B2020" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="32" y="38" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#8B2020" letter-spacing=".05em">HYPEREVM (on-chain contracts)</text>

          <rect x="40" y="56" width="140" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1"/>
          <text x="110" y="76" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">BatchExecutor</text>
          <text x="110" y="92" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">unpack → per-intent</text>

          <line x1="180" y1="80" x2="200" y2="80" stroke="#5F564B" stroke-width="1.2" marker-end="url(#arARw)"/>

          <rect x="200" y="56" width="160" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1.5"/>
          <text x="280" y="76" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="#8B2020" text-anchor="middle">Exchange</text>
          <text x="280" y="92" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">balances · queue · LP</text>

          <line x1="360" y1="80" x2="380" y2="80" stroke="#5F564B" stroke-width="1.2" marker-end="url(#arARw)"/>

          <rect x="380" y="56" width="140" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1"/>
          <text x="450" y="76" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">PriceOracle</text>
          <text x="450" y="92" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">precompile wrapper</text>

          <rect x="540" y="56" width="140" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1"/>
          <text x="610" y="76" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">SessionKeyManager</text>
          <text x="610" y="92" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">key registry</text>

          <line x1="540" y1="80" x2="520" y2="80" stroke="#5F564B" stroke-width="1.2" marker-end="url(#arARw)" stroke-dasharray="3 2"/>

          <rect x="40" y="138" width="120" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1"/>
          <text x="100" y="158" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">PaperToken</text>
          <text x="100" y="174" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">ERC-20</text>

          <rect x="180" y="138" width="120" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1"/>
          <text x="240" y="158" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">PaperStaking</text>
          <text x="240" y="174" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">stake · claim</text>

          <rect x="320" y="138" width="140" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1"/>
          <text x="390" y="158" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">PaperTokenomics</text>
          <text x="390" y="174" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">mint curve</text>

          <rect x="480" y="138" width="200" height="48" rx="4" fill="#FAF6ED" stroke="#8B2020" stroke-width="1"/>
          <text x="580" y="158" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">DepositProxyFactory</text>
          <text x="580" y="174" font-family="Inter,sans-serif" font-size="9" fill="#7A7060" text-anchor="middle" font-style="italic">+ Create2DepositProxy</text>

          <line x1="280" y1="104" x2="240" y2="138" stroke="#5F564B" stroke-width="1.0" marker-end="url(#arARw)" stroke-dasharray="3 2"/>
          <line x1="280" y1="104" x2="390" y2="138" stroke="#5F564B" stroke-width="1.0" marker-end="url(#arARw)" stroke-dasharray="3 2"/>
          <line x1="280" y1="104" x2="580" y2="138" stroke="#5F564B" stroke-width="1.0" marker-end="url(#arARw)" stroke-dasharray="3 2"/>

          <line x1="360" y1="220" x2="360" y2="262" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arARw)"/>
          <text x="370" y="248" font-family="Inter,sans-serif" font-size="10" fill="#5F564B" font-style="italic">precompile read · CoreWriter sweep</text>

          <rect x="20" y="272" width="680" height="90" rx="6" fill="rgba(74,107,134,0.04)" stroke="#4A6B86" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="32" y="290" font-family="Inter,sans-serif" font-size="10" font-weight="700" fill="#4A6B86" letter-spacing=".05em">HYPERCORE (precompiles)</text>

          <rect x="40" y="302" width="150" height="40" rx="4" fill="#FAF6ED" stroke="#4A6B86" stroke-width="1"/>
          <text x="115" y="320" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">BBO</text>
          <text x="115" y="334" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="#7A7060" text-anchor="middle">0x...080e</text>

          <rect x="200" y="302" width="150" height="40" rx="4" fill="#FAF6ED" stroke="#4A6B86" stroke-width="1"/>
          <text x="275" y="320" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">Mark</text>
          <text x="275" y="334" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="#7A7060" text-anchor="middle">0x...0806</text>

          <rect x="360" y="302" width="150" height="40" rx="4" fill="#FAF6ED" stroke="#4A6B86" stroke-width="1"/>
          <text x="435" y="320" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">Oracle</text>
          <text x="435" y="334" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="#7A7060" text-anchor="middle">0x...0807</text>

          <rect x="520" y="302" width="160" height="40" rx="4" fill="#FAF6ED" stroke="#4A6B86" stroke-width="1"/>
          <text x="600" y="320" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#2A2520" text-anchor="middle">CoreWriter</text>
          <text x="600" y="334" font-family="ui-monospace,Menlo,monospace" font-size="9" fill="#7A7060" text-anchor="middle">EVM ↔ HyperCore</text>
        </svg>
      </figure>

      <h2 id="onchain">Contracts (HyperEVM)</h2>
      <ul>
        <li><code>Exchange</code>: the main trading contract. Tracks user balances, opens and closes positions, settles PnL, manages the payout queue, holds the LP balance. Opens and closes can only arrive through the batch executor; withdrawals and maintenance calls can come from anyone.</li>
        <li><code>BatchExecutor</code>: entry contract for batched intents. It accepts batches only from Papertrade's relayer keys, then unpacks N user intents and dispatches them to <code>Exchange</code>.</li>
        <li><code>PaperToken</code>, <code>PaperStaking</code>, <code>PaperTokenomics</code>: the PAPER token, staking contract, and mint-rate calculator. At launch PAPER is non-transferable apart from staking and unstaking.</li>
        <li><code>SessionKeyManager</code>: registers and validates session keys, so a user can authorise a scoped key once and sign individual intents off-chain without a wallet popup. Registration is submitted through the relayer; revocation is a direct call from the user's wallet.</li>
        <li><code>PriceOracle</code>: wraps the BBO/Mark/Oracle precompiles for in-contract reads.</li>
        <li><code>DepositProxyFactory</code> + <code>Create2DepositProxy</code>: derive per-user deterministic deposit addresses; bridge incoming USDC from HyperCore into the Exchange.</li>
      </ul>

      <h2 id="hypercore">Precompiles (HyperCore)</h2>
      <ul>
        <li><code>BBO 0x...080e</code>: best-bid/ask read; the protocol's execution price.</li>
        <li><code>Mark 0x...0806</code>: Hyperliquid's "fair" mark; read for analytics and future cross-checks.</li>
        <li><code>Oracle 0x...0807</code>: validator-median external reference; read for forward-compat.</li>
        <li><code>CoreWriter</code>: the bridge interface. Used by <code>Create2DepositProxy</code> to push USDC from the user's proxy Core account into the Exchange's HyperCore account, and by <code>Exchange.withdrawToCore</code> to move funds back to the user's Core spot account.</li>
      </ul>

      <h2 id="flow">A trade end-to-end</h2>
      <p>A signed user intent hits the relayer, then the authorised <code>BatchExecutor</code>, which unpacks it and calls <code>Exchange.openPositionBySig</code> (or close, staking, etc). <code>Exchange</code> reads the BBO precompile through <code>PriceOracle</code> for the execution price, settles PnL against the LP, updates the user's internal balance, and mints PAPER on realised losses through <code>PaperTokenomics</code>. Multiple users' intents can be batched into a single EVM transaction; each one is dispatched and settled independently inside <code>BatchExecutor</code>.</p>

      <h2 id="frontends">Frontends</h2>
      <p>Papertrade's relayer submits every open and close. A different frontend can produce compatible user signatures and send them through the relayer, but it can't submit opens or closes to the contracts directly.</p>
    `},"how/pricing-bbo":{title:`Pricing: BBO precompile`,eyebrow:`How it actually works`,lead:`Papertrade reads prices directly from Hyperliquid's native order book via an EVM precompile. No off-chain oracle, no pricing bot, no price signer.`,body:`
      <h2 id="why-precompile">BBO precompile technical implementation</h2>
      <p>A perps exchange needs a price feed for two things: executing new trades and marking open positions to compute PnL and liquidations. On most L1s this is a hard problem: you either trust a centralised oracle, run a decentralised one that's slow and expensive, or accept that a single operator can freeze the market by withholding updates.</p>
      <p>Hyperliquid ships a way out. HyperCore (the consensus layer that runs HL's native spot and perp order books) is observable from the HyperEVM via <em>L1 read precompiles</em>: fixed-address system contracts that any EVM contract can <code>staticcall</code> to read live HyperCore state. Prices included.</p>
      <p>We use one of them, the <strong>BBO precompile</strong> at <code>0x000000000000000000000000000000000000080e</code>. Given a HyperCore asset index (on the current chain-999 deployment, BTC = <code>0</code> and ETH = <code>1</code>), it returns the current best bid and best ask on HL's native book:</p>
      <pre><code>(bool ok, bytes memory result) = PRECOMPILE_BBO.staticcall(abi.encode(asset));
(uint64 bid, uint64 ask) = abi.decode(result, (uint64, uint64));</code></pre>
      <p>Papertrade's execution price is simply the midpoint:</p>
      <pre><code>price = (bid + ask) / 2;</code></pre>
      <p>That's the whole pricing stack.</p>

      <h2 id="trade-offs">What this gives up, and what it gives us</h2>
      <p>The trade-off is honest: we can only list markets that already exist on HL's order book. You won't be able to trade something HL doesn't trade: no long-tail DeFi tokens or hypothetical RWAs, unless HL lists them first.</p>
      <p>In return, we get a pricing pipeline with no off-chain component at all. The BBO precompile is consensus-verified HyperCore state, same as the balances on HL's L1 bridge. No price signer and no oracle committee. The price the exchange sees is the price HL's market makers are quoting at that block, readable by any contract, provable on-chain.</p>

      <h2 id="no-breaker">No deviation breaker</h2>
      <p>Someone can try to manipulate the HL order book for a block by widening the spread or moving the inside quote, then trade Papertrade against the distorted midpoint. That is a real protocol risk of using BBO directly.</p>
      <p><code>PriceOracle</code> reverts if the precompile returns zero or a crossed book (<code>ask &lt; bid</code>), but it has no maximum-deviation, time-weighted-price, or lookback breaker. A non-zero, uncrossed but manipulated BBO can therefore be accepted for execution. The deadband and <a href="#/how/asymmetric-impact">asymmetric-impact curve</a> reduce some small-move payoffs, while configurable per-side OI caps limit additional exposure. They do not prove manipulation unprofitable or place a hard bound on protocol loss; see <a href="#/how/risk">Risk</a>.</p>

      <h2 id="pause-opens">The one real-time lever: retiring a market</h2>
      <p>There's exactly one admin action over pricing that runs in real time: <strong>retiring a market</strong>. The pause guardian calls <code>Exchange.pauseMarket(instrumentId)</code>, which captures the current BBO into a frozen bid/ask pair and flips the pause flag. From then on:</p>
      <ul>
        <li>New opens on that market revert with <code>MarketIsPaused</code>.</li>
        <li>Closes and liquidations still succeed, but they read the frozen BBO instead of the live precompile.</li>
      </ul>
      <p>Retirement is permanent: nobody, including the contract owner, can unpause that instrument ID. That is deliberate, to block obscure attack vectors around reopening. If a market could come back, anyone holding a position through the pause could pick between the frozen price and the later live one, and the moment of reopening would itself become something to game. If the market does come back, it is listed again under a fresh instrument ID. The frozen price is what lets us stop a market without stranding open positions: a trader who opened before the retirement can still get out at a price that made sense at the moment the operator intervened, even if HL's book has moved wildly since. Retirement is scoped per-market, so a problem with one asset doesn't take the whole exchange down.</p>
      <p>The same guardian can also call <code>setTradingPaused(true)</code>, which blocks new opens on every market until the contract owner lifts it, without freezing prices: closes and liquidations keep using the live BBO.</p>
      <p>Apart from the market keeper's OI caps and trade minimums (see <a href="#/how/risk">Risk</a>), everything else admin can do (tuning fee/impact params, adding markets, swapping keepers, upgrading contracts) is owner-only.</p>
    `},"how/deposits":{title:`Deposits: CREATE2 proxies`,eyebrow:`How it actually works`,lead:`Deposits work by sending USDC to a personal, per-user address. Whatever arrives there is credited to you: there is no deposit call to the Exchange and nothing to approve on it. It's the same model as a CEX deposit address, built on top of entirely on-chain mechanics.`,body:`
      <figure style="margin:22px 0">
        <svg viewBox="0 0 600 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Deposit flow: wallet to Papertrade balance" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <defs><marker id="arDP" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5F564B"/></marker></defs>
          <rect x="80" y="20" width="280" height="60" rx="6" fill="#FAF6ED" stroke="#D4CBBA" stroke-width="1.5"/>
          <text x="220" y="46" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#2A2520" text-anchor="middle">User wallet</text>
          <text x="220" y="64" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle" font-style="italic">MetaMask, Rabby, Frame, Rainbow…</text>
          <line x1="220" y1="80" x2="220" y2="115" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arDP)"/>
          <text x="378" y="102" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="start">Core spot/perp USDC</text>
          <rect x="80" y="120" width="280" height="60" rx="6" fill="rgba(45,95,58,0.06)" stroke="#2D5F3A" stroke-width="1.5"/>
          <text x="220" y="146" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#2D5F3A" text-anchor="middle">CREATE2 proxy</text>
          <text x="220" y="164" font-family="Inter,sans-serif" font-size="10" fill="#5F564B" text-anchor="middle" font-style="italic">your unique deterministic address</text>
          <line x1="220" y1="180" x2="220" y2="215" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arDP)"/>
          <text x="378" y="202" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="start">sweeper detects balance</text>
          <rect x="80" y="220" width="280" height="60" rx="6" fill="rgba(45,95,58,0.06)" stroke="#2D5F3A" stroke-width="1.5"/>
          <text x="220" y="246" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#2D5F3A" text-anchor="middle">CoreWriter precompile</text>
          <text x="220" y="264" font-family="ui-monospace,Menlo,monospace" font-size="10" fill="#5F564B" text-anchor="middle">sweepAllToExchange</text>
          <line x1="220" y1="280" x2="220" y2="315" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arDP)"/>
          <text x="378" y="294" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="start">moves Core USDC</text>
          <text x="378" y="308" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="start">→ Exchange</text>
          <rect x="80" y="320" width="280" height="60" rx="6" fill="rgba(45,95,58,0.06)" stroke="#2D5F3A" stroke-width="1.5"/>
          <text x="220" y="346" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#2D5F3A" text-anchor="middle">HyperCore spot</text>
          <text x="220" y="364" font-family="Inter,sans-serif" font-size="10" fill="#5F564B" text-anchor="middle" font-style="italic">USDC lands here, swept to Exchange</text>
          <line x1="220" y1="380" x2="220" y2="415" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arDP)"/>
          <text x="378" y="402" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="start">credit user account</text>
          <rect x="80" y="420" width="280" height="60" rx="6" fill="rgba(139,32,32,0.06)" stroke="#8B2020" stroke-width="1.5"/>
          <text x="220" y="446" font-family="Inter,sans-serif" font-size="13" font-weight="700" fill="#8B2020" text-anchor="middle">Papertrade balance</text>
          <text x="220" y="464" font-family="Inter,sans-serif" font-size="10" fill="#5F564B" text-anchor="middle" font-style="italic">trade-ready: ~1–3 HL blocks total</text>
        </svg>
      </figure>

      <h2 id="per-user-address">Your own deposit address</h2>
      <p>Every user has a unique deposit address, computed deterministically from their wallet address using CREATE2. The address can be predicted before deployment, so it can receive funds first: the relayer deploys the proxy contract once at least 10 USDC has arrived there.</p>
      <p>The app registers this address with the relayer before it sends a deposit. Hyperliquid transfers, Circle CCTP bridge routes and Across fills from Robinhood Chain all land on the HyperCore side of that address. The guided HL EVM route first moves canonical native USDC through CoreDepositWallet; a raw ERC-20 transfer to the proxy is not monitored.</p>

      <h2 id="sweeper">The sweeper picks it up</h2>
      <p>The relayer's deposit process (the "sweeper") reacts to evidence that funds have arrived: indexed CCTP and HyperEVM deposits, HyperCore transfers into registered addresses, and address checks from the app. When a proxy holds at least 10 USDC across spot and withdrawable perp balances, it drives the Exchange sweep flow:</p>
      <ul>
        <li><code>requestSweep(user)</code>: records the proxy's Core balances and calls the proxy to move spot/perp USDC into the Exchange's Core account.</li>
        <li><code>finalizeSweep(user)</code>: after the Core transfer clears, credits the user's internal Exchange balance.</li>
      </ul>
      <p>The proxy calls HL's <code>CoreWriter</code> precompile under the hood. Funds usually land in your Papertrade balance within a few HL blocks of arriving at your address; a first deposit also waits for its proxy to be deployed.</p>
      <p>A sweep moves at least 10 USDC; a smaller balance waits at your address until more arrives.</p>
      <p>Finalize credits a sweep only if the proxy's balance went down. If it didn't, because the transfer failed or another deposit arrived in the same window and hid it, finalize drops the old snapshot uncredited and requests a fresh sweep of what is there. Any funds from the dropped sweep that did reach the Exchange are then credited manually by the contract owner through <code>reconcileSweepCredit</code>. That is why the app sends one deposit at a time and waits for it to be credited before allowing another.</p>
      <p>The sweep/finalize Exchange calls are public maintenance paths, but only the relayer can deploy proxies, to avoid public gas griefing. The protocol team operates the sweeper for normal UX latency.</p>

      <h2 id="why-proxies">Why proxies, not direct deposits</h2>
      <p>Two reasons. First: UX. A direct deposit would require you to sign two transactions (the approval and the deposit) each with gas. Proxies turn the deposit into a plain transfer to an address, which works the same whether it comes from Hyperliquid, a Circle bridge or Across.</p>
      <p>Second: per-user isolation. Each user's proxy is a distinct address. Nobody else's balance can collide with yours, and the sweeper can reason about each user independently without global accounting. If the sweeper misbehaves for one user, the others are unaffected.</p>

      <h2 id="safety">What you're trusting</h2>
      <p>The proxy contracts are deployed from a single <code>DepositProxyFactory</code> using CREATE2 with a fixed bytecode. Anyone can derive the expected proxy address for any wallet off-chain and verify the on-chain proxy matches: the factory, the salt, and the init code hash are all public. If the bytecode ever changes, the derived address changes; your old deposit address would become an empty slot and would not silently map to different code.</p>
      <p>The proxy's sweep function, <code>sweepAllToExchange</code>, can only be called by the Exchange contract, so nothing else can trigger Core transfers out of the proxy. ERC-20 tokens accidentally sent to the HyperEVM proxy can be recovered by the proxy owner with <code>withdrawStuckToken</code>; they are not counted as Papertrade deposits.</p>
    `},"how/solvency-queue":{title:`Solvency & queue`,eyebrow:`How it actually works`,lead:`Papertrade's LP can be temporarily insolvent. A FIFO payout queue and a parked-funds side bucket guarantee winners eventually get paid, in order, while keeping the protocol from blocking new trades.`,body:`
      <h2 id="model">The model</h2>
      <p>Conceptually, Papertrade has three separate accounting buckets:</p>
      <ul>
        <li><strong>LP cash</strong>: the part of the Exchange's <code>treasury</code> that isn't owed to anyone else. <code>treasury</code> is all the USDC the Exchange holds; subtract users' available balances, margin locked in open positions, and accrued fees, and what remains is free LP cash. Cannot go negative.</li>
        <li><strong><code>sideBucket</code></strong>: loss proceeds parked while the queue is non-empty, earmarked inside that cash. Drained first by harvest into queue payouts.</li>
        <li><strong>Payout queue</strong>: a FIFO of unpaid winning closes. Each entry: <code>(user, amount)</code>.</li>
      </ul>
      <p>This is the <a href="#/martingaler/overview">Martingaler mechanism</a>: instead of holding pre-funded LP that pays winners on demand, the protocol queues winners when reserves are short, and clears them as future losses replenish the LP.</p>

      <p><strong>What enters the queue and what doesn't.</strong> The queue holds <em>only what the LP owes on a close but cannot pay from its available budget at close time</em>: profit after the win fee on a USD-funded close, or the surviving claim on a debt-funded close. Several things explicitly stay out:</p>
      <ul>
        <li><strong>Margin / collateral</strong> on a USD-funded close — returned to <code>balances[user]</code> immediately via <code>marginCredit</code> (see <code>QueueLib.settle</code>: <code>marginOut = size256</code>). The user can withdraw or reuse it without waiting on the queue.</li>
        <li><strong>Fees ahead of queued winners</strong> — never paid. Every winner pays the 2% win fee, but it reaches stakers and the dev only when the queue is empty and the LP can fund it as well; otherwise it isn't paid out, and the winner's queued claim is that much smaller. Loss and liquidation fees are waived while the queue is non-empty.</li>
        <li><strong>USD-funded losses while queue non-empty</strong> — earmarked in <code>sideBucket</code> instead of becoming free LP cash. They still credit tracked LP in full when they settle; harvest uses available queue-backing cash and debits <code>sideBucket</code> first.</li>
      </ul>

      <figure style="margin:22px 0">
        <svg viewBox="0 0 760 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three-bucket model diagram" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <defs>
            <marker id="arSQg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#5F564B"/></marker>
            <marker id="arSQbr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7A6235"/></marker>
          </defs>
          <text x="180" y="34" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="#5F564B" text-anchor="middle" letter-spacing=".04em">USD-FUNDED LOSS / LIQUIDATION</text>
          <text x="580" y="34" font-family="Inter,sans-serif" font-size="11" font-weight="700" fill="#5F564B" text-anchor="middle" letter-spacing=".04em">WINNING CLOSE</text>
          <line x1="180" y1="44" x2="180" y2="74" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arSQg)"/>
          <line x1="580" y1="44" x2="580" y2="74" stroke="#5F564B" stroke-width="1.5" marker-end="url(#arSQg)"/>
          <text x="180" y="100" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">if queue empty</text>
          <text x="580" y="100" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">if queue empty AND solvent</text>
          <path d="M 180 110 Q 180 130 100 165" stroke="#5F564B" stroke-width="1.5" fill="none" marker-end="url(#arSQg)"/>
          <path d="M 180 110 Q 180 130 320 165" stroke="#5F564B" stroke-width="1.5" fill="none" marker-end="url(#arSQg)"/>
          <path d="M 580 110 Q 580 130 460 165" stroke="#5F564B" stroke-width="1.5" fill="none" marker-end="url(#arSQg)"/>
          <path d="M 580 110 Q 580 130 660 165" stroke="#5F564B" stroke-width="1.5" fill="none" marker-end="url(#arSQg)"/>
          <text x="115" y="140" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle">yes</text>
          <text x="245" y="140" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle">no</text>
          <text x="500" y="140" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle">yes</text>
          <text x="640" y="140" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle">no</text>
          <rect x="20"  y="170" width="160" height="100" rx="6" fill="rgba(45,95,58,0.08)"  stroke="#2D5F3A" stroke-width="1.5"/>
          <text x="100" y="200" font-family="Inter,sans-serif" font-size="14" font-weight="700" fill="#2D5F3A" text-anchor="middle">LP cash</text>
          <text x="100" y="222" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">free treasury</text>
          <text x="100" y="248" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle" font-style="italic">cannot go negative</text>
          <rect x="240" y="170" width="160" height="100" rx="6" fill="rgba(122,98,53,0.08)" stroke="#7A6235" stroke-width="1.5"/>
          <text x="320" y="200" font-family="Inter,sans-serif" font-size="14" font-weight="700" fill="#7A6235" text-anchor="middle">sideBucket</text>
          <text x="320" y="222" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">parked loss proceeds</text>
          <text x="320" y="248" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle" font-style="italic">drained by harvest</text>
          <rect x="400" y="170" width="160" height="100" rx="6" fill="none" stroke="#7A7060" stroke-width="1" stroke-dasharray="4 3"/>
          <text x="480" y="205" font-family="Inter,sans-serif" font-size="13" font-weight="600" fill="#5F564B" text-anchor="middle">pay user direct</text>
          <text x="480" y="226" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle" font-style="italic">debits LP cash</text>
          <rect x="580" y="170" width="160" height="100" rx="6" fill="rgba(139,32,32,0.08)" stroke="#8B2020" stroke-width="1.5"/>
          <text x="660" y="200" font-family="Inter,sans-serif" font-size="14" font-weight="700" fill="#8B2020" text-anchor="middle">payout queue</text>
          <text x="660" y="222" font-family="Inter,sans-serif" font-size="11" fill="#5F564B" text-anchor="middle">FIFO of unpaid wins</text>
          <text x="660" y="248" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle" font-style="italic">user owed but unpaid</text>
          <path d="M 320 272 C 320 320, 660 320, 660 272" stroke="#7A6235" stroke-width="1.5" fill="none" marker-end="url(#arSQbr)"/>
          <text x="490" y="338" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#7A6235" text-anchor="middle">harvest</text>
          <text x="490" y="353" font-family="Inter,sans-serif" font-size="10" fill="#7A7060" text-anchor="middle" font-style="italic">drains sideBucket into queue payouts (anyone can call)</text>
          <line x1="60" y1="376" x2="700" y2="376" stroke="#D4CBBA" stroke-width="1"/>
          <text x="380" y="400" font-family="ui-monospace,Menlo,monospace" font-size="12" fill="#2A2520" text-anchor="middle">net LP equity = LP cash (incl. sideBucket) − queueTotal</text>
          <text x="380" y="420" font-family="Inter,sans-serif" font-size="10" font-style="italic" fill="#8B2020" text-anchor="middle">CAN go negative: that's the Martingaler "temporary insolvency" by design</text>
        </svg>
        <figcaption style="margin-top:8px;font:12px/1.45 Inter,sans-serif;color:#7A7060;text-align:center">USD-funded loss/liq proceeds become LP cash (queue empty) or park in <code>sideBucket</code> (queue active); debt-funded losses bring in no cash and only shrink the user's queue claim (a liquidation wipes it). Wins pay direct from LP cash when solvent, else queue. Harvest pays queued claims from available backing cash and debits <code>sideBucket</code> first.</figcaption>
      </figure>

      <h2 id="winner-flow">Winning closes</h2>
      <p>When a user closes at a profit, the 2% win fee comes off the profit whatever the LP's state. Then:</p>
      <ol>
        <li>If the queue is empty: pay the user immediately from the LP's free cash, up to the payout. The fee goes to stakers and the dev only if free cash covers it as well; otherwise it isn't paid out.</li>
        <li>Append whatever the LP couldn't pay (the whole payout if the queue is non-empty) to the back of the queue as <code>(user, payout)</code>. LP cash is unchanged for the queued part.</li>
      </ol>
      <p>A debt-funded position settles the same way, except the LP owes its whole surviving claim: margin plus profit after the win fee, or margin minus the loss. The queue claim it consumed at open was contingent collateral, not money the user held.</p>

      <h2 id="loser-flow">Losing closes &amp; liquidations</h2>
      <p>When a USD-funded position closes at a loss (or is liquidated):</p>
      <ol>
        <li>If the queue is empty: the LP-retained slice (loss minus 2% fee) becomes LP cash directly.</li>
        <li>If the queue is non-empty: the loss proceeds stay in <code>treasury</code> but are earmarked in <code>sideBucket</code> for queued payouts instead of becoming free LP cash, and the loss or liquidation fee is waived. They still count toward tracked LP when they settle. PAPER mint still fires for realised losses, including insolvent close losses and liquidations; the cash routing to <code>sideBucket</code> does not suppress PAPER emission.</li>
      </ol>
      <p>A debt-funded loss or liquidation brings in no cash: the destroyed part of the user's queue claim simply stops being owed, so nothing becomes LP cash or goes to <code>sideBucket</code>. On a losing close, the surviving claim is paid or queued like a win, and the 2% LP-side loss fee is paid from free LP cash only when the queue is empty and that cash covers the surviving claim plus the fee; otherwise it is waived. A liquidation destroys the whole claim and charges no fee.</p>

      <h2 id="harvest">Harvest</h2>
      <p>A keeper periodically calls <code>harvest(maxEntries)</code>:</p>
      <ol>
        <li>Walk the queue head forward, paying out each entry <code>(user, amount)</code> from available queue-backing cash.</li>
        <li>Debit <code>sideBucket</code> first for the amount paid. If available backing cash runs out before the queue is clear, stop. Future losses or freed cash can fund later harvests.</li>
        <li>If the queue empties with <code>sideBucket &gt; 0</code>, the residual is released back into ordinary LP cash. Neither harvest nor this release changes tracked LP; the loss already counted when it settled.</li>
      </ol>
      <p>Harvest is permissionless; anyone can run it, though the caller isn't paid. The protocol's queue-harvest keeper calls <code>harvest(32)</code> on new blocks whenever there is cash to pay out, so users don't have to.</p>

      <h2 id="invariants">Invariants</h2>
      <ul>
        <li><code>treasury</code> and <code>sideBucket</code> are unsigned, so neither can go negative.</li>
        <li>Free LP cash for new payouts (<code>lpBankrollAvailable()</code>) is zero whenever anything is queued, so a new winner can never be paid ahead of earlier queued ones.</li>
        <li>Net LP equity = LP cash (including <code>sideBucket</code>) − <code>totalQueued</code>. <strong>This can go negative</strong>; that's the Martingaler "temporary insolvency" by design.</li>
      </ul>

      <h2 id="user-side">What the user sees</h2>
      <p>Opening a position is unaffected by queue state except for normal OI caps and debt-queue gas limits. Closing at a profit may either pay you directly or queue you, depending on solvency. The UI shows both an "available" balance (paid out) and a "queued" balance (waiting on harvest); both are spendable for new opens, because queued balance can be consumed as position collateral.</p>
      <p>Source: <code>contracts/src/QueueLib.sol</code> and the close/liquidate flows in <code>contracts/src/Exchange.sol</code>.</p>
    `},"how/asymmetric-impact":{title:`Asymmetric impact PnL`,eyebrow:`How it actually works`,lead:`How Papertrade settles closing PnL, where the protocol takes its cut of a trade.`,body:`
      <p>Trades enter at <a href="#/how/pricing-bbo">BBO mid</a>, and a later close uses the BBO mid at the block in which that close executes. There is no spread, no slippage, no funding, no notional trading fee, and no gas charged to the user. Losses are not charged above the loss itself; in solvent cases the LP-side loss fee is carved from the LP's gain, and in insolvent cases it is waived.</p>
      <p>On <strong>profitable closes</strong>, the protocol applies an <em>asymmetric-impact haircut</em> to the resulting PnL. It is not a percentage fee on notional or a spread on the execution price: it multiplies the raw gain by a scale factor determined by the entry-to-exit move. The haircut can consume most of a very small gain and becomes less severe as the move grows.</p>
      <p>A winning close goes through three steps, in order:</p>
      <ol>
        <li><strong>Deadband.</strong> The gain is measured as if the exit were 0.2 bps (<code>entryPrice / 50000</code>) less favourable. A win smaller than that becomes zero.</li>
        <li><strong>Impact.</strong> The remaining gain is scaled by the formula below.</li>
        <li><strong>Win fee.</strong> 2% of the scaled gain comes off. The trader receives the other 98%.</li>
      </ol>

      <h2 id="properties">Properties</h2>
      <ul>
        <li><strong>Asymmetric.</strong> Only winning closes are scaled. Losing closes pay nothing extra.</li>
        <li><strong>Move-sized, not position-sized.</strong> The haircut percentage doesn't depend on whether you're closing $100 or $100K of notional. A reference notional set per market controls the steepness; the size of your trade does not.</li>
        <li><strong>Bigger moves keep more of the gain.</strong> The haircut shrinks smoothly as the move grows. Tiny moves are scaled the most aggressively; larger moves keep most of the raw gain.</li>
      </ul>

      <h2 id="formula">The formula</h2>
      <p>For a winning close, the protocol applies a scale factor to the raw PnL:</p>
      <pre><code>adjustedPnl = rawPnl × scale
scale       = (1 − baseRate) / (1 + term1 + term2)
term1       = 1 / (move × rateMultiplier)
term2       = referenceNotional / (10⁶ × move × positionMultiplier)
move        = |exitPrice − entryPrice| / entryPrice</code></pre>
      <p><code>baseRate</code>, <code>rateMultiplier</code>, <code>positionMultiplier</code>, and <code>referenceNotional</code> are per-instrument parameters set by the contract owner. As <code>move</code> grows, both <code>term1</code> and <code>term2</code> shrink, the denominator approaches 1, and the trader keeps a larger share of <code>rawPnl</code>, up to <code>1 − baseRate</code>. As <code>move</code> approaches zero, the terms blow up and the scaled gain collapses toward zero. The exact implementation lives in <code>QueueLib.applyMarketImpact</code>; <code>move</code> there uses the exit price after the deadband.</p>
      <p>At launch both BTC and ETH use <code>baseRate = 10%</code>, <code>rateMultiplier = 15,000</code> and <code>referenceNotional = $100,000</code>, with <code>positionMultiplier</code> of 814.598 for BTC and 483.979 for ETH. So a winning close never keeps more than 90% of its raw gain before the win fee. On BTC, counting the deadband, a 1% move keeps about 88% of the raw gain and a 0.1% move about 74%.</p>

      <h2 id="term2-fixed">Why <code>term2</code> is fixed</h2>
      <p>In Rollbit's original formulation, <code>term2</code> scales with the actual position notional, so the haircut percentage grows with trade size. We can't carry that property at 1000× leverage: it would push traders toward many small positions (more trades, more state, more gas) without making the per-trade economics any better for anyone. Papertrade substitutes a per-instrument <code>referenceNotional</code> constant for the position size in <code>term2</code>. The curve is otherwise sound; the haircut percentage is now identical for a $100 close and a $100K close.</p>

      <h2 id="why">Why this design</h2>
      <p>At 1000× leverage, no fee on notional and no spread on price could plausibly sustain the LP: each one would either be invisible to the protocol or impossible for the user to bear. The asymmetric impact moves the cost into the only place that scales with realised outcome: the user's gain on a successful trade. Losses never pay extra.</p>
      <p>The curve also adds economic friction to small gains, including gains that may come from briefly distorting BBO. It is not a deviation check, however, and does not guarantee that a manipulation strategy is unprofitable. Papertrade accepts that residual risk when it reads BBO without a breaker; see <a href="#/how/pricing-bbo">No deviation breaker</a>.</p>

      <h2 id="rollbit">Inspiration</h2>
      <p>The mechanism is adapted from Rollbit's market-impact model, which uses a similar PnL-side haircut to fund their LP without a traditional spread. Papertrade's variant fixes the position-size factor to a per-market reference notional, so the haircut percentage doesn't depend on how big a position you take.</p>
    `},"how/builder-codes":{title:`Builder codes`,eyebrow:`How it actually works`,lead:`A planned 1% revenue share for frontends that originate trades. Not yet live.`,body:`
      <div class="callout">
        <div class="callout-head">Coming soon</div>
        <p>Builder codes are not yet live. This page describes the planned mechanism so integrators can see the shape of what's coming.</p>
      </div>

      <p>Builder codes will let any frontend earn a share of revenue from trades it originates. The model follows Hyperliquid's native builder-code design: a frontend tags its intents with a builder identifier, and when the trade settles the protocol routes <strong>1%</strong> of the LP-revenue carve to the builder's address.</p>

      <h2 id="user-impact">No impact on the user</h2>
      <p>Builder codes do not change anything the user pays. The 1% comes from the LP-revenue carve, the same source that funds <a href="#/paper/staking">staker dividends</a>. There is no additional fee on top of the user's trade. From the user's perspective, builder codes are invisible.</p>

      <h2 id="who">Who can register</h2>
      <p>Anyone running a frontend that drives volume to Papertrade, once builder codes launch.</p>

      <h2 id="canonical">papertrade.xyz is the first canonical frontend</h2>
      <p><a href="https://papertrade.xyz">papertrade.xyz</a> is the canonical implementation operated by the protocol team, and the protocol's relayer submits every trade.</p>
      <p>Permissionless builder codes are coming soon. Once the on-chain plumbing is finalised, any frontend will be able to register, tag its intents with a builder identifier, and earn the 1% revenue share on the volume it brings in.</p>

      <h2 id="when">When</h2>
      <p>No firm date. We will document the registration flow, the per-intent tagging surface, and the builder-payout claim mechanics here once the on-chain plumbing is finalised.</p>
    `},"how/risk":{title:`Risk`,eyebrow:`How it actually works`,lead:`The main protocol-level risk surface is BBO price manipulation on Hyperliquid's order book. This page covers that unresolved vector, the contract's economic frictions and exposure controls, the operational guards on top, and the gated/public/admin surfaces.`,body:`
      <h2 id="bbo-jitter">BBO jitter risk</h2>
      <p>Papertrade reads its execution price directly from Hyperliquid's BBO. The natural BBO spread on BTC and ETH is tight but non-zero, and within that spread an attacker can place a small limit order on HL's book that does not need to fill: simply sitting on the inside changes the best bid or best ask, which moves the BBO mid by a tick or two.</p>
      <p>An attacker who shifts BBO this way may be able to open or close a Papertrade position at a distorted midpoint and profit when the quote returns toward the natural market. This is a real residual risk: the pricing pipeline has no independent reference price against which to reject the quote.</p>

      <h2 id="defences">Economic frictions and exposure controls</h2>
      <p>The protocol has three relevant controls, but none is proof that BBO manipulation is impossible or unprofitable:</p>
      <ol>
        <li><strong>0.2 bps jitter-protection deadband.</strong> On a winning close, raw profit smaller than <code>entryPrice / 50000</code> (≈0.2 bps of price) is zeroed before the impact curve runs; larger wins have that amount removed before scaling.</li>
        <li><strong>Asymmetric impact curve.</strong> The <a href="#/how/asymmetric-impact">haircut</a> on profitable closes is steepest on the smallest moves, reducing the payout from some small BBO distortions without comparing BBO to an independent price.</li>
        <li><strong>Configurable directional OI caps.</strong> Every instrument has independent long and short caps, and an open that would exceed the selected side's cap reverts. For launch, the keeper will be configured to target each side's current OI plus asset quantity worth $1 billion at the current BBO. The keeper leaves the cap alone while that headroom remains within a 10% hysteresis band ($900M–$1.1B) and rebuilds it toward $1 billion outside the band. These are limits on new per-side exposure, not a $1 billion total-OI ceiling, a loss ceiling, or a guarantee against manipulation profit.</li>
      </ol>
      <p>Together these controls can reduce payoff and limit how much new directional exposure fits under the configured caps. A manipulated but non-zero, uncrossed BBO can still pass the oracle, so residual manipulation and LP-loss risk remain.</p>

      <h2 id="operational-guards">Operational guards</h2>
      <ul>
        <li><strong>Rigorous watching keeper set.</strong> The protocol team operates an active keeper set that monitors BBO, open interest, and live position health, and runs harvests and liquidations.</li>
        <li><strong>Terminal market retirement and global opens gate.</strong> The pause guardian can retire a market ID if something looks anomalous; that ID can never accept another open, and existing positions remain closeable only against the BBO frozen at retirement. Retirement can't be undone, which blocks obscure attack vectors around reopening a market; the product may later be listed again under a fresh instrument ID. The separate global trading pause is the reversible way to halt opens without retiring markets.</li>
        <li><strong>Trailing OI cap operator.</strong> The market keeper applies the configured policy independently to each side. For launch, it will be configured to target current OI plus $1 billion of BBO-valued headroom and update only after that headroom leaves the 10% hysteresis band.</li>
      </ul>

      <h2 id="permissionless">Permissionless and gated surfaces</h2>
      <p>Trading goes through Papertrade's relayer: opens, closes, session-key registration, proxy deployment, and staking actions are submitted by configured relayer keys through the batch executor. Every intent is still signed by the user's wallet or session key and checked onchain, so the relayer can't act on an account without its signature.</p>
      <p>Withdrawals remain user-controlled: direct <code>withdrawToCore</code> is callable by the wallet, and <code>withdrawToCoreBySig</code> can be submitted by anyone but requires the user's real wallet signature. Liquidations, queue harvest, sweep/finalize maintenance, and pushing Exchange-held staker fees remain public maintenance paths. The contract has no admin kill-switch on user balances; user value can be in available balance, open-position margin, or queued debt collateral.</p>

      <h2 id="admin-keys">Admin keys</h2>
      <p>Three roles, each scoped to a narrow surface:</p>
      <ul>
        <li><strong>Pause guardian.</strong> Can retire an instrument ID or engage the global opens gate. Market retirement <em>freezes the oracle</em>: the BBO snapshot captured at retirement becomes the permanent close price for that ID. The retired ID cannot be unpaused or reopened; a later relist uses a fresh instrument ID. Existing positions remain closeable against the frozen BBO. The global gate blocks opens on every market without freezing prices; the guardian can engage it, but only the owner can lift it.</li>
        <li><strong>Owner.</strong> Can tune impact-curve and fee-rate parameters, set the dev fee recipient (only it can claim accumulated dev fees), swap configured relayers/keepers, list new markets, reconcile deposits whose normal sweep failed, and upgrade the contract implementations. The contracts are proxied, so in principle the owner can do anything the implementation can be rewritten to do.</li>
        <li><strong>Market keeper.</strong> Moves the configurable per-asset, per-side OI caps and holds the minimum margin and minimum position value (margin × leverage) for opens. Can effectively pause new opens on a side by setting its cap to zero, but unlike the pause guardian this does not freeze the oracle: the BBO still floats and closes still settle at live BBO mid. Cannot move user collateral, cannot freeze the oracle, and cannot touch the impact curve.</li>
      </ul>
    `},"paper/overview":{title:`$PAPER overview`,eyebrow:`$PAPER`,lead:`$PAPER is Papertrade's native token. It captures a share of protocol revenue when staked and is minted to traders against losing closes and liquidations.`,body:`
      <h2 id="what">What $PAPER is</h2>
      <p>$PAPER is an ERC-20-style token with two roles. At launch it can't be transferred between wallets, but minting, staking, unstaking, and claims all work.</p>
      <ul>
        <li><strong>Revenue share.</strong> Staked $PAPER earns a pro-rata share of half the protocol's trading fees, plus LP surplus above the staker reward cap, paid in USDC.</li>
        <li><strong>Loss-backed supply.</strong> $PAPER is minted to a trader when they realise an eligible loss (closing at a loss or being liquidated) as a consolation claim on future protocol value.</li>
      </ul>

      <h2 id="fair-launch">Fair launch</h2>
      <p>$PAPER is a fair launch in the strictest sense. Supply starts at <strong>zero</strong>. No pre-mint, no team allocation, no VC allocation, no airdrop, no vesting schedule. Every token that will ever exist must be minted through the on-chain emissions curve, and the only people who can trigger a mint are traders who close at a loss or get liquidated. The supply is purely community-owned by definition: anyone who wants exposure has to participate.</p>

      <h2 id="flow">How supply grows</h2>
      <p>Supply expands purely from trading activity. The <a href="#/how/mint-curve">mint curve</a> is front-loaded: while tracked LP is below the <strong>$2M flat threshold</strong> (including underwater), every $1 of eligible loss mint basis mints <strong>100 PAPER</strong>. Above that threshold, the rate decays asymptotically as cumulative LP gain grows.</p>

      <h2 id="staker-share">What stakers earn</h2>
      <p>Two revenue streams route to staked PAPER.</p>
      <ul>
        <li><strong>Fee share.</strong> Half of every 2% fee: the win fee out of a winning close's gain, and the LP-side fee carved from the LP's gain on losing closes and on liquidations of positions opened from available balance. The other half goes to the dev fee recipient. Fees are paid out only while the payout queue is empty and the LP can cover them.</li>
        <li><strong>LP excess sweep.</strong> Once tracked LP climbs above the <strong>$5M staker reward cap</strong>, every dollar of further LP gain past that point is fully distributable to stakers via the public <code>pushStakerFees()</code> call.</li>
      </ul>
      <p>Both streams pay out as USDC, claimable through the staking flow with a wallet signature.</p>

      <h2 id="links">Contracts</h2>
      <p>See <a href="#/dev/contract-addresses">Contract addresses</a> for the on-chain addresses of <code>PaperToken</code>, <code>PaperStaking</code>, and <code>PaperTokenomics</code>.</p>
    `},"how/mint-curve":{title:`PAPER mint curve`,eyebrow:`How it actually works`,lead:`The flat-then-ratchet curve that turns realised loss basis into PAPER supply. Early activity mints at a constant rate while tracked LP is underwater or small; later activity mints asymptotically less.`,body:`
      <h2 id="shape">The shape</h2>
      <p>The curve has two regions, parametrised by four constants in <code>PaperTokenomics</code>:</p>
      <ul>
        <li><strong>Flat region</strong> (when <code>trackedLpUsd &lt; lpFlatThresholdUsd</code>, including negative): mint rate is the constant <code>flatRate = 100 PAPER per $1 of mint basis</code>. The mint basis is the user's eligible realised loss, not necessarily the amount credited to <code>trackedLpUsd</code>.</li>
        <li><strong>Ratchet region</strong> (when <code>trackedLpUsd ≥ lpFlatThresholdUsd</code>): rate decays as the high-water-mark of cumulative LP gain past the threshold (<code>tailProgressUsd</code>) grows. The closed-form rate at HWM <code>H</code> is <code>flatRate · (S / (S + H))²</code> where <code>S = tailDecayScaleUsd</code>.</li>
      </ul>
      <p>Live defaults: <code>lpFlatThresholdUsd = $2M</code>, <code>flatRate = 100</code>, <code>tailDecayScaleUsd = $120M</code>.</p>

      <figure style="margin:22px 0">
        <svg viewBox="0 0 700 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mint rate vs LP balance" style="width:100%;height:auto;display:block;background:#FAF6ED;border:1px solid #D4CBBA;border-radius:6px">
          <rect x="50"   y="30" width="29.5" height="280" fill="rgba(139,32,32,0.06)"/>
          <rect x="79.5" y="30" width="11.8" height="280" fill="rgba(122,98,53,0.08)"/>
          <g stroke="rgba(42,37,32,0.10)" stroke-width="1">
            <line x1="50" y1="55.5"  x2="670" y2="55.5"/>
            <line x1="50" y1="119.1" x2="670" y2="119.1"/>
            <line x1="50" y1="182.7" x2="670" y2="182.7"/>
            <line x1="50" y1="246.4" x2="670" y2="246.4"/>
          </g>
          <g stroke="rgba(42,37,32,0.06)" stroke-width="1">
            <line x1="138.6" y1="30" x2="138.6" y2="310"/>
            <line x1="227.1" y1="30" x2="227.1" y2="310"/>
            <line x1="374.8" y1="30" x2="374.8" y2="310"/>
            <line x1="522.4" y1="30" x2="522.4" y2="310"/>
            <line x1="670"   y1="30" x2="670"   y2="310"/>
          </g>
          <g font-family="ui-monospace,Menlo,monospace" font-size="11" fill="#7A7060" text-anchor="end">
            <text x="44" y="59">100</text>
            <text x="44" y="123">75</text>
            <text x="44" y="186">50</text>
            <text x="44" y="250">25</text>
            <text x="44" y="313">0</text>
          </g>
          <g font-family="ui-monospace,Menlo,monospace" font-size="11" fill="#7A7060" text-anchor="middle">
            <text x="50"    y="328">−$5M</text>
            <text x="79.5"  y="328">$0</text>
            <text x="138.6" y="328">$10M</text>
            <text x="227.1" y="328">$25M</text>
            <text x="374.8" y="328">$50M</text>
            <text x="522.4" y="328">$75M</text>
            <text x="670"   y="328">$100M</text>
          </g>
          <line x1="79.5" y1="30" x2="79.5" y2="310" stroke="#8B2020" stroke-width="1.5" stroke-dasharray="4,4"/>
          <text x="76" y="26" font-family="Inter,sans-serif" font-size="10" fill="#8B2020" text-anchor="end">LP=$0</text>
          <line x1="91.3" y1="30" x2="91.3" y2="310" stroke="#7A6235" stroke-width="1.5" stroke-dasharray="4,4"/>
          <text x="95" y="26" font-family="Inter,sans-serif" font-size="10" fill="#7A6235">flat → tail ($2M)</text>
          <text x="380" y="50" font-family="Inter,sans-serif" font-size="10" font-weight="600" fill="#998C76" text-anchor="middle" letter-spacing=".05em">TAIL (asymptotic decay)</text>
          <path d="M 50 55.5 L 91.3 55.5 L 97.2 59.7 L 109.1 67.7 L 138.6 86.3 L 168.1 102.8 L 197.6 117.6 L 256.7 142.7 L 315.7 163.2 L 374.8 180.1 L 492.9 206.2 L 670 232.9"
                stroke="#2D5F3A" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
          <g fill="#2D5F3A">
            <circle cx="91.3" cy="55.5" r="3.5"/>
            <circle cx="138.6" cy="86.3" r="3.5"/>
            <circle cx="374.8" cy="180.1" r="3.5"/>
            <circle cx="670" cy="232.9" r="3.5"/>
          </g>
          <g font-family="ui-monospace,Menlo,monospace" font-size="10" fill="#2D5F3A">
            <text x="146" y="80">88 /$</text>
            <text x="382" y="174">51 /$</text>
            <text x="664" y="226" text-anchor="end">30 /$</text>
            <text x="98"  y="50">100 /$</text>
          </g>
          <text font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#5F564B" text-anchor="middle" transform="rotate(-90 18 170)" x="18" y="170">PAPER per $1 mint basis</text>
          <text x="360" y="352" font-family="Inter,sans-serif" font-size="11" font-weight="600" fill="#5F564B" text-anchor="middle">trackedLpUsd</text>
        </svg>
        <figcaption style="margin-top:8px;font:12px/1.45 Inter,sans-serif;color:#7A7060;text-align:center">
          Marginal mint rate vs tracked LP, with defaults <code>flatRate=100</code>, <code>threshold=$2M</code>, <code>S=$120M</code>.
          Insolvent region (tracked LP &lt; 0) and flat region both mint at the full <strong>100 PAPER/$</strong> of eligible loss basis; the tail decays as <code>100 · (S/(S+H))²</code> where <code>H = tailProgressUsd</code>.
        </figcaption>
      </figure>

      <h2 id="ratchet">One-way ratchet (v2)</h2>
      <p><code>tailProgressUsd</code> is a high-water-mark that never decreases: staker drains debit <code>trackedLpUsd</code> but <strong>do not</strong> reduce <code>tailProgressUsd</code>. Once the cumulative tail-region gain has advanced, the rate is permanently decayed by that amount. Concrete consequence: cumulative tail-region losses of $100M ⇒ HWM stays at $100M ⇒ the rate is now <code>100 · (120/220)² ≈ 30 PAPER/$</code> regardless of how often the LP got drained to stakers in between.</p>
      <p><strong>Early traders mint at materially higher rates than late traders.</strong> By design.</p>

      <h2 id="basis">What counts as "loss"</h2>
      <p>For a close, the mint basis is the user's eligible realised loss after any LP-side loss-fee carve; a liquidation always mints on the full lost margin. On a USD-funded losing close while the queue is empty, the 2% loss-branch fee is carved from LP's side, so PAPER mints on <code>rawLoss − fee</code> and tracked LP advances by that same amount. On a USD-funded losing close while the queue is active, no fee is taken and the loss is earmarked in <code>sideBucket</code>; PAPER mints on the full loss and <code>trackedLpUsd</code> advances by the same amount. <code>sideBucket</code> only decides that this cash funds queued payouts first; neither harvest nor the release of any residual changes <code>trackedLpUsd</code>. Liquidations mint on the lost margin in full, regardless of queue state; tracked LP advances by that margin net of the 2% fee when one is charged. Debt-funded losing closes mint on the destroyed portion of the user's queue claim, net of the loss fee when one is charged, and tracked LP advances by the same amount. A debt-funded liquidation destroys the whole claim, charges no fee, and mints on all of it.</p>
    `},"paper/staking":{title:`Staking & claims`,eyebrow:`$PAPER`,lead:`Stake PAPER, earn a pro-rata share of protocol revenue in USDC. Stake and unstake are both instant: no cooldown, no lockup.`,body:`
      <h2 id="stake">Stake</h2>
      <p>In the normal app flow, stake from the app with a wallet signature. Your stake shares in every distribution from then on. No vesting, no lockup.</p>
      <p>The app submits your signed stake as <code>stakeBySig</code> through the relayer; direct <code>stake</code> calls are disabled. The PAPER token auto-approves the staking contract, so the user does not need a separate approval transaction.</p>

      <h2 id="unstake">Unstake</h2>
      <p>Unstake through the same staking flow, again with a wallet signature. Your PAPER returns to your wallet balance immediately, your stake stops earning fees, and any USDC rewards already accrued remain claimable. There is <strong>no cooldown</strong>. The app submits it as <code>unstakeBySig</code> through the relayer.</p>

      <h2 id="claims">Claims</h2>
      <p>Trading-fee revenue accrues as a per-stake claimable USDC balance via the global <code>accRewardPerShare</code> accumulator. Claim any time through the app; the claim credits your USDC balance on the Exchange contract, and from there you can withdraw to HyperCore. The app submits it as <code>claimBySig</code> through the relayer.</p>
      <p>Want to know your unclaimed balance without spending gas? Read <code>PaperStaking.pendingReward(addr)</code>. It includes only rewards that have already been distributed.</p>

      <h2 id="distribute">How rewards arrive</h2>
      <p>Fee revenue lives in two places until distributed:</p>
      <ol>
        <li>The <strong>Exchange's <code>stakerFeeAccumulator</code></strong> collects the staker share of every trade fee. Anyone can call <code>Exchange.pushStakerFees()</code> to forward the accumulated balance, plus any LP excess above the staker reward cap, to PaperStaking.</li>
        <li>Once received by PaperStaking, distribution updates the global <code>accRewardPerShare</code> so all stakers' pending rewards advance pro-rata. Direct public <code>distribute()</code> is disabled; distribution runs as a keeper-signed <code>distributeBySig</code> submitted through the relayer, which pushes fees first.</li>
      </ol>
      <p>The protocol's fee-push keeper does both, so users don't have to think about it.</p>

      <h2 id="math">The math</h2>
      <p>Each distribution splits the USDC that PaperStaking has newly received across stakers in proportion to their staked balance at that moment. There are no boosts, no lockups, no tiers: every staked PAPER earns the same from a given distribution.</p>
    `},"dev/contract-addresses":{title:`Contract addresses`,eyebrow:`Developer reference`,lead:`Papertrade's contracts on HyperEVM mainnet (chain 999).`,body:`
      <p>Each address links to HyperEVMScan. The Papertrade contracts are proxies; the addresses below are the ones to call.</p>
      <ul>
        <li><strong>Exchange</strong>: balances, positions, settlement and the payout queue.<br><a href="https://hyperevmscan.io/address/0x6cd5661646289FB6E65EA5C032310fDEd797D0a2"><code>0x6cd5661646289FB6E65EA5C032310fDEd797D0a2</code></a></li>
        <li><strong>BatchExecutor</strong>: submits batches of signed user intents to the Exchange.<br><a href="https://hyperevmscan.io/address/0x233Ff29b239abc1D7748605dA9b205C3e008626E"><code>0x233Ff29b239abc1D7748605dA9b205C3e008626E</code></a></li>
        <li><strong>PriceOracle</strong>: reads Hyperliquid's BBO for execution prices.<br><a href="https://hyperevmscan.io/address/0xa9B4c7b7Ca5835652d81E25739c870D49F39cC2e"><code>0xa9B4c7b7Ca5835652d81E25739c870D49F39cC2e</code></a></li>
        <li><strong>SessionKeyManager</strong>: registers, checks and revokes session keys.<br><a href="https://hyperevmscan.io/address/0x8326Eb8896e358717f10502Ec73CE8D28E37B108"><code>0x8326Eb8896e358717f10502Ec73CE8D28E37B108</code></a></li>
        <li><strong>DepositProxyFactory</strong>: derives and deploys each user's deposit address.<br><a href="https://hyperevmscan.io/address/0x1629b7D46bef6E13FF754174FC9F32dEa309b38F"><code>0x1629b7D46bef6E13FF754174FC9F32dEa309b38F</code></a></li>
        <li><strong>PaperToken</strong>: the PAPER token.<br><a href="https://hyperevmscan.io/address/0xe40f17915DAa230324030003A197cdAEf2261C0e"><code>0xe40f17915DAa230324030003A197cdAEf2261C0e</code></a></li>
        <li><strong>PaperStaking</strong>: PAPER staking and USDC rewards.<br><a href="https://hyperevmscan.io/address/0xAAd6c7b0CC3014FC80FfEDAe0Ed7Ce5967b0F016"><code>0xAAd6c7b0CC3014FC80FfEDAe0Ed7Ce5967b0F016</code></a></li>
        <li><strong>PaperTokenomics</strong>: the PAPER mint curve and staker LP excess.<br><a href="https://hyperevmscan.io/address/0x75174549dbBD44497D31a47E2E2D7406408d63D9"><code>0x75174549dbBD44497D31a47E2E2D7406408d63D9</code></a></li>
      </ul>

      <h2 id="governance">Collateral and governance</h2>
      <ul>
        <li><strong>USDC</strong>: the collateral token, native Circle USDC on HyperEVM.<br><a href="https://hyperevmscan.io/address/0xb88339CB7199b77E23DB6E890353E22632Ba630f"><code>0xb88339CB7199b77E23DB6E890353E22632Ba630f</code></a></li>
        <li><strong>Timelock</strong>: owns the contracts; every owner action waits 7 days here before it can run.<br><a href="https://hyperevmscan.io/address/0xB915Fa41e824D6aA31BB833Ee81220C0F2c8EA0F"><code>0xB915Fa41e824D6aA31BB833Ee81220C0F2c8EA0F</code></a></li>
        <li><strong>Multisig</strong>: a 2-of-3 multisig that owns the Timelock; only it can schedule, execute or cancel an owner action.<br><a href="https://hyperevmscan.io/address/0x696292762fD5AC3677a45EdBe54EAECE4194d1F6"><code>0x696292762fD5AC3677a45EdBe54EAECE4194d1F6</code></a></li>
      </ul>
    `}};function r(){let e=location.hash||``;return e?e.startsWith(`#/`)?e.replace(/^#\//,``).replace(/\/$/,``)||t:null:t}function i(){return e.flatMap(e=>e.items)}function a(e){let t=i(),n=t.findIndex(t=>t.slug===e);return{prev:n>0?t[n-1]:null,next:n>=0&&n<t.length-1?t[n+1]:null}}function o(t){let[n,r]=t.split(`/`),i=e.find(e=>e.items.some(e=>e.slug.startsWith(n+`/`)));return i?i.label:`Docs`}function s(t){let n=document.getElementById(`sidebarNav`);n.innerHTML=e.map(e=>`
    <div class="sidebar-section">
      <p class="sidebar-head">${e.label}</p>
      <ul class="sidebar-list">
        ${e.items.map(e=>`
          <li><a href="#/${e.slug}" class="${e.slug===t?`active`:``}" data-slug="${e.slug}">${e.title}</a></li>
        `).join(``)}
      </ul>
    </div>
  `).join(``)}function c(){let e=document.querySelector(`.article`),t=document.getElementById(`tocList`);if(!e||!t)return;let n=e.querySelectorAll(`h2, h3`);if(!n.length){t.innerHTML=``;return}t.innerHTML=Array.from(n).map(e=>{e.id||=e.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g,`-`).replace(/^-|-$/g,``);let t=e.tagName===`H3`?`h3`:``;return`<li><a href="#${e.id}" class="${t}" data-heading="${e.id}">${e.textContent}</a></li>`}).join(``),u(n)}var l=null;function u(e){l&&l.disconnect();let t=new Map;l=new IntersectionObserver(e=>{e.forEach(e=>t.set(e.target.id,e.isIntersecting));let n=Array.from(t.entries()).filter(([,e])=>e).map(([e])=>e)[0]||null;document.querySelectorAll(`#tocList a`).forEach(e=>{e.classList.toggle(`active`,e.getAttribute(`data-heading`)===n)})},{rootMargin:`-80px 0px -70% 0px`,threshold:0}),e.forEach(e=>l.observe(e))}function d(e){let r=document.getElementById(`article`),i=n[e];if(!i){r.innerHTML=`
      <div class="not-found">
        <div class="breadcrumb"><a href="#/">Docs</a><span class="sep">/</span><span>404</span></div>
        <h1>Page not found</h1>
        <p>We couldn't find <code>${e}</code>.</p>
        <a class="back" href="#/${t}">← Back to docs home</a>
      </div>
    `,document.getElementById(`tocList`).innerHTML=``;return}let{prev:s,next:l}=a(e);r.innerHTML=`
    <div class="breadcrumb">
      <a href="#/${t}">Docs</a>
      <span class="sep">/</span>
      <span>${o(e)}</span>
      <span class="sep">/</span>
      <span>${i.title}</span>
    </div>
    <article class="article">
      ${i.eyebrow?`<div class="eyebrow">${i.eyebrow}</div>`:``}
      <h1>${i.title}</h1>
      ${i.lead?`<p class="lead">${i.lead}</p>`:``}
      ${i.body}
      <div class="prev-next">
        ${s?`<a href="#/${s.slug}"><div class="label">← Previous</div><div class="title">${s.title}</div></a>`:`<a class="disabled" aria-disabled="true"><div class="label">← Previous</div><div class="title">…</div></a>`}
        ${l?`<a class="next" href="#/${l.slug}"><div class="label">Next →</div><div class="title">${l.title}</div></a>`:`<a class="next disabled" aria-disabled="true"><div class="label">Next →</div><div class="title">…</div></a>`}
      </div>
      <div class="article-foot">
        <span>Last updated: <time>2026-10-06</time></span>
      </div>
    </article>
  `,c(),window.scrollTo({top:0,behavior:`instant`}),document.title=`${i.title} · Papertrade Docs`}function f(){let e=document.getElementById(`sidebarToggle`),t=document.getElementById(`sidebar`);if(!e||!t)return;let n=n=>{t.classList.toggle(`is-collapsed`,!n),e.setAttribute(`aria-expanded`,n?`true`:`false`)};e.addEventListener(`click`,()=>{n(t.classList.contains(`is-collapsed`))}),t.addEventListener(`click`,e=>{e.target.tagName===`A`&&e.target.dataset.slug&&n(!1)});let r=()=>{window.matchMedia(`(min-width:900px)`).matches?t.classList.remove(`is-collapsed`):e.getAttribute(`aria-expanded`)!==`true`&&t.classList.add(`is-collapsed`)};window.addEventListener(`resize`,r),r()}function p(){document.addEventListener(`keydown`,e=>{if(e.target.tagName===`INPUT`||e.target.tagName===`TEXTAREA`||e.metaKey||e.ctrlKey||e.altKey)return;let{prev:t,next:n}=a(r());e.key===`[`&&t&&(location.hash=`#/`+t.slug,e.preventDefault()),e.key===`]`&&n&&(location.hash=`#/`+n.slug,e.preventDefault())})}function m(){let e=r();e!==null&&(s(e),d(e))}window.addEventListener(`hashchange`,m),window.addEventListener(`load`,()=>{f(),p(),m()});