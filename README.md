# HEXAMC Free Rewards System

A modern, responsive, dark-themed HTML+JS+PHP website for claiming free Minecraft server rewards (ranks and crates) with unique code generation, lockout timers, and persistent localStorage.

## Features
- Neon-accented, dark UI (Inter font, #00ff88)
- Two categories: Free Ranks & Free Crates
- Claim button generates a unique code, locks category for cooldown (5 days for ranks, 24h for crates)
- Live countdown timers, persistent across reloads
- Modal popup with code, copy-to-clipboard, and 10s close delay
- Sticky navbar with Discord link
- Responsive grid layout for mobile & desktop
- Favicon and reward icons
- PHP endpoint placeholder for future server-side validation/logging

## Tech Stack
- HTML5, CSS3, JavaScript (ES6)
- PHP (for future backend integration)

## Getting Started
1. Clone/download this repo.
2. Place files on your web server (PHP required for `reward.php`).
3. Open `index.html` in your browser.

## File Structure
- `index.html` – Main UI
- `styles.css` – Neon dark theme styles
- `script.js` – Claim logic, timers, localStorage
- `reward.php` – Placeholder for backend logic
- `README.md` – This file

## Customization
- To add more rewards, edit the `REWARDS` object in `script.js` and the HTML in `index.html`.
- For ad integration, use the `#ads-area` section in `index.html`.

## License
MIT 