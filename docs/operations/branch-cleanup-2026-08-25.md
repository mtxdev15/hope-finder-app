# Branch cleanup record — 2026-08-25

> **Not yet executed.** The cloud session that produced this record cannot delete
> remote branches — its git credentials allow pushing its own branch but return
> **403** on `git push origin --delete`. Run
> `./scripts/delete-merged-branches.sh --yes` from a machine with normal push
> rights. The script recomputes the merged set at run time rather than trusting
> the table below, so it stays correct as branches land.

Thirty-seven remote branches are queued for deletion because every one of their commits
is already reachable from `main` (`ahead: 0`). **Nothing will be lost** — the
commits live in main's history. This file exists so the deletion is reversible
without archaeology.

Restore any one with:

```bash
git push origin <sha>:refs/heads/<branch-name>
```

| Branch | Tip SHA | Last commit |
|---|---|---|
| `chore/convex-generated-stripe-cancellation` | `e7501bd96b1b48b12ff5a5248d59fd8b3d69129e` | 2026-08-22 |
| `chore/playwright-artifact-hygiene` | `4d2ecc23409f93ae109044f8058e20c7ef89f4dd` | 2026-08-22 |
| `docs/billing-audit-oneoff-invoice` | `df054386ade86586d18e0d43586534475bc6f391` | 2026-08-22 |
| `docs/billing-failure-lifecycle-record` | `b10fc358d4d7810c991cdee6b942555c9e556a3a` | 2026-08-23 |
| `docs/billing-harness-execution-readiness` | `e895e34c53591b90bb5f87fc2f2cd70394422c18` | 2026-08-23 |
| `docs/billing-portal-production-readiness` | `96342e13c3762652e60bf15ecde95d47289605e3` | 2026-08-23 |
| `docs/billing-test-harness-brief` | `ad1bc656476426cc8f356f9c026fcf1515622504` | 2026-08-23 |
| `docs/production-deployment-status` | `3efeec8905af664055945969a26252b409cf2344` | 2026-08-01 |
| `feat/plans-billing-experience` | `4086f74b8aa2ba30e6a8ca2b8f6618f9af65ad83` | 2026-08-23 |
| `feature/account-profile-hybrid` | `cad06e952e89c00b3af8f8399bcee6ee21d6f67a` | 2026-08-22 |
| `feature/billing-test-clock-harness` | `88842201b9b3e78bb694086c3eb0fa2b4356165a` | 2026-08-23 |
| `feature/checkout-return-pages` | `53792dba9cd7b527f3676f4556c4e1aa1767c850` | 2026-08-21 |
| `feature/journey-plan-locale-integrity` | `65e9c9b46f3d20a50a8636e8bd9e8120c8cd36ac` | 2026-08-20 |
| `feature/stripe-lifecycle-controls` | `2e0964537217954419d324c4f0aec1438122990b` | 2026-08-22 |
| `feature/stripe-sandbox-billing` | `8b9de570e071d44ac1e4c409c29c450eede3fc2b` | 2026-08-21 |
| `feature/subscription-visibility` | `e2ccf01566967581c8d2cf1d5e535b205a6ed3ba` | 2026-08-22 |
| `fix/billing-harness-clear-success-error` | `d622014990d8644072a14d33f18321670dab0a48` | 2026-08-23 |
| `fix/billing-harness-portal-recovery-resume` | `ad40369fff0c6e99c3151cfe4efe3ef4e95a8add` | 2026-08-23 |
| `fix/billing-harness-provisioning-convergence` | `e08a1917a7722015e8736295fb6d7c0525b1a4a3` | 2026-08-23 |
| `fix/harness-advance-finalization-window` | `2f3d08d62b7260caa5c4f9aaceee882d42266817` | 2026-08-23 |
| `fix/harness-advance-idempotency` | `fae81b0d88f43c7b378f155bd74f089328a3a395` | 2026-08-23 |
| `fix/harness-advance-preflight` | `33c99b5f8c7e1a3477bb9185fe966b7570a3126d` | 2026-08-23 |
| `fix/harness-converge-everywhere` | `4719661a6b0d4f7f0c499181e08debb8b4ac4ab8` | 2026-08-23 |
| `fix/harness-prewrite-rollback` | `fafbd2d227a59bcf79e8863798639a265cdf3c35` | 2026-08-23 |
| `fix/stripe-cancel-at-reader` | `8965d0ece920d9ef60241795e921c952028fe2c8` | 2026-08-22 |
| `fix/stripe-duplicate-subscription-guard` | `3e2ca4e827efb0f1885d967f8a86e46fac349546` | 2026-08-21 |
| `hotfix/completed-day-locale-immutability` | `56e4610e84df598cdc2ea4c4d52ae489216d3277` | 2026-08-20 |
| `hotfix/retire-live-giving-ui` | `1855a817da9a1f258a19245940dd1ba665d3adf7` | 2026-08-01 |
| `redesign/desktop-web-shell` | `dcfa4419b80f29225e0f0037cf0efcfb1dd6c02a` | 2026-07-22 |
| `release/journey-app-shell` | `906f61616c37685ec1b23cbf2a7d3df3d9c95ec5` | 2026-08-19 |
| `release/spanish-completed-review` | `1f07e2e5b92514ffaf79f41d7ff11617e46f0416` | 2026-08-19 |
| `verify/account-profile-hybrid-visual` | `62324978bce793810fb0d822b923161c6031179e` | 2026-08-22 |
| `verify/stripe-annual-checkout` | `e0ce2d9b549645696c2cd0217afcbb50f01089b9` | 2026-08-22 |
| `verify/stripe-cancellation-reconciliation` | `e0d359202bea6565ad42adca53b06ee41e50e342` | 2026-08-22 |
| `verify/stripe-invoice-interaction` | `d816252400503d93fa64cea18f6621dea39bf194` | 2026-08-22 |
| `verify/stripe-payment-method-update` | `2f1f2a959f757f8b0310819e9846d124f0ea8571` | 2026-08-22 |
| `verify/stripe-portal-smoke-test` | `891c46f72c2c589e33efd65b75aebd64ae3fafc7` | 2026-08-22 |

## Kept deliberately

| Branch | Why |
|---|---|
| `release-c1-monetization` | Production Convex was deployed from it. Keep until `convex function-spec --prod` confirms production no longer needs it as a reference. |
| `chore/retired-webhook-secret-hygiene` | Merged into `claude/convex-stripe-billing-webhook-7tnwek`, not yet into main. Delete after that lands. |
| `docs/cross-platform-subscription-contract` | Cherry-picked (`71ad34b`) into the same branch. Delete after that lands. |
| `claude/billing-pricing-cta-stage6` | Held for Stage 6, deliberately unmerged. |

## Still to decide

Twelve branches remain that are 137 behind main and carry pre-parity source —
the retired donation code and the billing-portal IDOR. They are ahead of main
and so were NOT touched here: `feat/give-*`, `feat/declare-checkout-dev`,
`fix/billing-portal`, `fix/nav-footer-links`, `welcome-copy-pass`,
`v2.0-redesign`, `v3*-redesign*`, `redesign/release-b-journey`,
`feature/root-pattern-insight`, `feature/es-full-app`,
`claude/resend-email-marketing-setup-pn132l`. Deleting them loses real work;
archiving each as a tag first is the safer path. Tracked as TODO E4.
