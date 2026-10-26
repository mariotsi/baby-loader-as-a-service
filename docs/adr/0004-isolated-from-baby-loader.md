# Isolated from baby-loader

The Platform started from the single-tenant [baby-loader](https://github.com/mariotsi/baby-loader) but shares nothing with it at runtime: its own D1 databases (ADR-0009), apart from baby-loader's MongoDB, its own VAPID keypair, its own `SESSION_SECRET`, and no imports between the two repos. Utilities copied from baby-loader evolve independently here, so a change in one project never breaks the other.

## Consequences

- Ports from baby-loader are copies adapted to this codebase, never a shared package.
