@echo off
chcp 65001 > nul
echo ===================================================
echo   Wysylanie najnowszych zmian na GitHub Pages...
echo ===================================================
echo.
git push origin main --force
echo.
echo ===================================================
echo   Gotowe! Jesli nie bylo bledow, strona zaktualizuje sie na GitHub Pages.
echo ===================================================
pause
