@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>&1 || (echo Встановіть Node.js LTS: https://nodejs.org/ & pause & exit /b 1)
call npm install || (echo Помилка встановлення залежностей & pause & exit /b 1)
call npm run dist || (echo Помилка збірки & pause & exit /b 1)
echo Готово. Відкрийте папку dist і запустіть ENGINEER_PRO_Setup_*.exe
explorer dist
pause
