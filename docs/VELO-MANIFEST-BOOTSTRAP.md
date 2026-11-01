# Wix Velo dependency manifest bootstrap

**Repository:** `nachoortegazgz/marianmadridz`  
**Base:** `main` at `1c1165d32795fa1fc8b646f4a3e249af8e58e228`  
**Purpose:** trigger the existing `.github/workflows/wix-cli-manifest.yml` on this isolated `feat/**` branch so Wix CLI for Sites can generate `src/velo.dependencies.json`.

## Safety

- Documentation-only trigger; no production publish.
- No CMS writes, bookings, payments, or customer data operations.
- The workflow must generate Wix metadata itself; do not hand-author the manifest.
- The workflow is expected to fail closed if the GitHub secret `CLI_API_KEY` is absent or Wix CLI cannot authenticate.
- Keep the Wix backend-import ESLint rule disabled until the generated manifest exists and the full lint passes.

This file can be removed after the generated metadata and workflow evidence are reviewed.
