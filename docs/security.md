# Security Model & Privacy Guarantees: Hakim (حَكِيم)

## Guarantees

1. **Zero Credential Transmission**:
   - The browser extension never accesses or exports Amazon passwords, 2FA codes, or session cookies (`read.amazon.com`).
   - All network requests to Amazon happen in the browser context where cookies are automatically attached by the Chromium networking layer.
2. **Loopback Binding**:
   - The Hakim Engine listens strictly on `127.0.0.1`.
   - All extension-to-engine API requests must authenticate with a high-entropy pairing token generated at engine startup.
3. **Secret Redaction**:
   - Notion integration tokens, LLM API keys, and paired tokens are never printed in console logs, diagnostics, or error traces.
   - Logs are structured JSON with automated secret scrubbing.
4. **Local Sovereignty**:
   - All book highlights and user notes reside locally in an SQLite database on your machine.
   - Exported Markdown files remain 100% on the local filesystem.
