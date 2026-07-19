@echo off
title PHP Local Server

cd /d "C:\Users\StudyAcer\Documents\GitHub\21st"

echo Starting PHP server at http://localhost:8000

:: Start PHP server in a new window
start "PHP Server" C:\xampp\php\php.exe -S localhost:8000

:: Wait 2 seconds for the server to start
timeout /t 2 /nobreak >nul

:: Open the default browser
start http://localhost:8000

echo.
echo Server is running.
echo Close the "PHP Server" window to stop the server.
pause
