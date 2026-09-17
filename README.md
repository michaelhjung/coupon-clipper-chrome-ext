<div align="center" id="readme-header">

<img src="./public/imgs/logo_v2.png" alt="logo" width="150" />

<br>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Automatically clip all coupons on a webpage at once!

[Github](https://github.com/michaelhjung/coupon-clipper-chrome-ext)
&nbsp;•&nbsp;
**[Extension URL](https://chromewebstore.google.com/detail/coupon-clipper/dihamlfidaeahaijeogelncpkpefhded?pli=1)**

https://github.com/user-attachments/assets/3fb500ec-09f0-4925-affc-e5c97e226df7

[![Typescript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev/)
[ ![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

Copyright © 2024-2026 Michael Jung. All rights reserved.

</div>

## Features

- One-click **Clip All** on Albertsons-family stores (Safeway, Vons, Acme, Jewel-Osco and more) and Raley's
- **Auto-clip** (opt-in): clips automatically when you open a store's coupon page while signed in
- **Adaptive backoff**: slows down when the store pushes back, then speeds up again
- Running totals: coupons clipped and estimated dollar savings, synced across devices (can be turned off in settings)
- Progress on the page, in the tab title, on the toolbar badge, and a notification when auto-clip finishes

## Development

```sh
npm install
npm run build      # generates public/manifest.json, type-checks, builds dist/
npm test           # vitest
npm run lint
```

Load `dist/` as an unpacked extension at `chrome://extensions`.
The store list lives in `src/shared/stores.json`; the manifest is generated from it — do not edit `public/manifest.json` by hand.
