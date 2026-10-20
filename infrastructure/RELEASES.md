# Windows releases and updates

CI runs TypeScript checks, all workspace tests/builds, production dependency audit, and Windows Rust tests/NSIS build. Unsigned CI installers are workflow artifacts. A running GitHub Actions job is required to validate those builds; local source creation is not evidence that a remote job passed.

The release workflow runs on `v*` tags or manual dispatch. Before first release:

1. A local key pair was generated for the initial build at `apps/desktop/.data/updater.key` and `.pub`; the private directory is ignored by Git. Back up the private key securely and use its matching public key already committed in `tauri.conf.json`. Keep this key for updates of installed copies. For a separate distribution generate a new pair using `pnpm --filter @dofus/desktop tauri signer generate`.
2. Put the public key into repository Actions variable `TAURI_UPDATER_PUBLIC_KEY` and the private key into Actions secret `TAURI_SIGNING_PRIVATE_KEY`. If encrypted, set secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
3. For installed applications to validate updates, include the same public key in their original `tauri.conf.json` build. The release workflow injects the variable automatically.
4. Set the intended version in `apps/desktop/src-tauri/tauri.conf.json` and the desktop package manifest, then tag `vVERSION`.
5. Check the generated draft release, NSIS installer, detached signature and `latest.json`. Publish the draft after validation.

The application checks `https://github.com/Despair1999/Dofus-Bot/releases/latest/download/latest.json`. Until a release is published and matching signing keys are configured, automatic update installation is unavailable and must be reported as such in the UI. Later updates must retain the same update verification key, or follow an explicit supported rotation procedure. Keep backups of signing material; never commit private keys.

Update signing verifies downloaded updates. It does not replace Authenticode signing of Windows installers. No Windows code-signing certificate is configured; SmartScreen may display an unknown-publisher warning.

The workflow packages a portable ZIP with the executable and complete `service` directory, attaches it to the draft release and saves a workflow artifact. Run `infrastructure/scripts/package-portable.ps1` after a local native release build to create the same archive. A lone EXE is insufficient because the backend/Node resources are required. WebView2 runtime is still needed on the target Windows installation. Personal data stays under the application's Windows AppData directory; "portable" refers to installation-free launch, not storing user data beside the EXE. The NSIS installer handles the configured Tauri WebView2 bootstrap behavior.
