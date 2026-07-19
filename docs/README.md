# TradeLog documentation

| Doc                                      | Read it when you need…                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| [prerequisites.md](prerequisites.md)     | What to install/verify on a machine before touching the project            |
| [running-locally.md](running-locally.md) | Step-by-step from clone to running app, with troubleshooting               |
| [architecture.md](architecture.md)       | The big picture: auth flow, route map, server actions, design decisions    |
| [data-model.md](data-model.md)           | Every table, the trade/position lifecycles, cash-flow semantics            |
| [market-data.md](market-data.md)         | Provider routing, caching TTLs, free-tier limits, adding a provider        |
| [portfolio-math.md](portfolio-math.md)   | How P&L, TWR/MWR, the equity curve, and the Playground simulators compute  |
| [ml-prediction.md](ml-prediction.md)     | The /predict ML model: pipeline, Python↔TS parity contract, retraining     |
| [testing.md](testing.md)                 | Running the test battery, E2E setup, CI behavior, Windows/OneDrive gotchas |

Related docs at the repo root:

- [README.md](../README.md) — overview + quickstart
- [ml/README.md](../ml/README.md) — the ML final-project folder: Colab notebook, trainer, requirements
- [SETUP.md](../SETUP.md) — full Supabase + Google OAuth provisioning walkthrough
- [CONTRIBUTING.md](../CONTRIBUTING.md) — branch/commit conventions, PR flow
- [CHANGELOG.md](../CHANGELOG.md) — release history
- [CLAUDE.md](../CLAUDE.md) — working conventions + session handoff notes for AI-assisted development
