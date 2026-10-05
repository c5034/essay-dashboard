@echo off
chcp 65001 > nul
echo ========================================================
echo  논술 선생님을 위한 학교 역량 트렌드 대시보드 실행 중...
echo ========================================================
start "" "http://localhost:8080"
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
