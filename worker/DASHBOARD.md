# Deploy through the Cloudflare dashboard

`tristana-worker.js` is the complete bundled Worker. It includes the npm libraries and local security helpers; its remaining imports are Node built-ins supplied by the Workers runtime.

1. Open the file on GitHub and use **Raw** to copy the entire text.
2. In Cloudflare, select the existing **tristana** Worker, then **Edit code**.
3. Replace the default Hello World JavaScript with the complete contents of `tristana-worker.js`.
4. Deploy the updated code.
5. Set the Worker compatibility date to **2026-10-11** in its runtime settings. Node compatibility is enabled by default with this date; preserve any existing `nodejs_compat` flag.
6. Keep the existing variables/secrets, `TRISTANA_STATE` KV binding, and minutely Cron Trigger configured on this same Worker.
7. Check `https://tristana.allenkevinc.workers.dev/health`. It should return `{"app":"Tristana","version":1}`.

The source files `index.js` and `security.js` remain the maintained implementation. For source changes, regenerate the bundle with Wrangler's dry-run build. Do not put secrets in any JavaScript file.
