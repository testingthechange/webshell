# betablocker-shell (Vite + React)

Receiver shell:
- Shop is hardcoded to shareIds
- Product reads ONLY S3 manifest: public/players/<shareId>/manifest.json
- Account saves shareIds locally (localStorage)

## Run
npm install
npm run dev

## Build
npm run build

## Static deploy
Publish directory: dist

If your host needs SPA rewrites, route all requests to /index.html.
(Render supports this via Redirect/Rewrites in the dashboard.)
