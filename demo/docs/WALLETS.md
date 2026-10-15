# Ten local actor wallets

All ten are test identities. Never send real funds to these publicly known dev-key addresses. Switch them with the UI selector; private keys are available only through the local export and ignored `.runtime/wallets.local.json` / `.csv`.

| Index | Actor | Onchain role / scenario | Address |
| --- | --- | --- | --- |
| 00 | Governor | Timelock proposer / executor | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| 01 | Guardian | Pause opens/oracle; retire markets | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| 02 | Oracle operator | Publish scenario prices | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| 03 | Keeper | Execute orders, harvest and push fees | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| 04 | Liquidator | Permissionless liquidation | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |
| 05 | Treasury | LABUSD faucet, house donor, fee recipient | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` |
| 06 | Alice | Long trader / session owner | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` |
| 07 | Bob | Short trader | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` |
| 08 | Carol | Participation staker | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` |
| 09 | Session relayer | Alice’s budgeted session key | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` |

The **owner is the deployed timelock contract**, not the Governor EOA. Governor is its proposer/executor/canceller. Keeper and Liquidator are scenario labels: their maintenance functions are permissionless, so other actors can also call them. The selected actor cannot sign as another wallet through ordinary contract calls. Auto-execution, clock refresh and faucet workflows explicitly use the named lab services.

Alice, Bob and Carol start with 10,000 LABUSD on the exchange. Alice has a 500 LABUSD / 20× BTC long; Bob a 350 LABUSD / 10× ETH short. Carol earned 10,000 PART from a local 100 LABUSD liquidation, then staked it. Alice authorizes Session relayer with a 5,000 LABUSD cumulative margin budget. Treasury donates 8m LABUSD and is the developer fee recipient. Each account has local ETH for gas.

Network for optional external-wallet import: chain ID **31337**, RPC **http://127.0.0.1:9545**, native symbol **ETH**. Wallet exports have no value outside the lab and are excluded from the public repository.
