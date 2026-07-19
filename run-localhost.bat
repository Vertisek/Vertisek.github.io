@echo off
title Vertone Local Host Server
echo ==================================================
echo  Vertone Local Dev Server is starting...
echo  URL: http://localhost:5500
echo ==================================================
echo.
python -m http.server 5500
pause
