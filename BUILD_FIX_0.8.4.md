# ENGINEER PRO 0.8.4 — GitHub Actions npm EUSAGE fix

## Причина
`package.json` містить pdfjs-dist@3.11.174, tesseract.js@5.1.1 і @napi-rs/canvas@0.1.80,
але поточний package-lock.json не містить їх повного дерева залежностей.

## Зміна
`.github/workflows/windows-release.yml`: перед `npm ci` виконується
`npm install --package-lock-only --ignore-scripts --no-audit --no-fund`.
Перевіряються прямі залежності у lockfile. Потім запускається `npm ci`.

## Важливе обмеження
Цей архів не містить локально перегенерованого package-lock.json:
у середовищі підготовки не працював доступ до registry.npmjs.org (EAI_AGAIN).
Lockfile буде синхронізовано під час виконання workflow у GitHub Actions.
Це тимчасовий ремонт CI. Для відтворюваних збірок після успішного запуску
слід локально виконати `npm install --package-lock-only` та закомітити отриманий lockfile,
після чого прибрати крок його відновлення з workflow.

## Використання
Завантажити вміст ZIP у корінь репозиторію (включно з прихованою `.github`).
Запустити Actions → Build and publish ENGINEER PRO з версією 0.8.4,
якщо реліз v0.8.4 ще не існує.
