@echo off
rem Chay app qua http://localhost:8000 (can cho dang nhap Google). Dong cua so nay de dung.
cd /d "%~dp0"
where python >nul 2>nul || (echo Can cai Python 3 de chay may chu cuc bo. & pause & exit /b 1)
start "" "http://localhost:8000/"
python -m http.server 8000 --bind 127.0.0.1
