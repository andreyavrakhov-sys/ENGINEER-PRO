# ENGINEER PRO — виправлення GitHub Actions

Оновлено `.github/workflows/build-1.0.yml`:
- Windows: розпаковує весь `app.asar` і перевіряє наявність `shared/sync.js` та інших файлів.
- Android: використовує попередньо встановлений SDK GitHub runner, без `android-actions/setup-android@v3` і застарілого пакета `tools`.

Завантажте **вміст** ZIP у корінь репозиторію GitHub зі збереженням структури `.github/workflows/`. Перевірте, що в GitHub саме нова версія `build-1.0.yml`. Запустіть workflow `ENGINEER PRO 1.0 - EXE and APK`.

Увага: це виправлення конфігурації, не підтвердження успішної хмарної збірки. Якщо `shared/sync.js` справді відсутній в архіві після пакування, перевірка правильно зупиниться та виведе перелік фактично запакованих файлів.
