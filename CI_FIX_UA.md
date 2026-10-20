# ENGINEER PRO — CI виправлення

1. `package.json`: явний список Electron-файлів, включно з `shared/**/*`.
2. `build-1.0.yml`: перевірка шляхів усередині app.asar без початкового слеша.
3. Android: прибрано `android-actions/setup-android@v3`, який у наданому журналі завершився на `sdkmanager tools` (застарілий пакет). Використовується Android SDK, попередньо встановлений у GitHub runner.

Завантажте **весь вміст** архіву в корінь репозиторію, збережіть структуру. Зокрема потрібні `shared/sync.js`, `main.js`, `android/package.json` і `.github/workflows/build-1.0.yml`.

Після збірки перевірте обидва jobs окремо. Фактичне GitHub-збирання не проводилося.
