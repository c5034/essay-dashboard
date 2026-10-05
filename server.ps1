# PowerShell 내장 로컬 HTTP 서버 & 공공데이터 API 브릿지
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

# 1. .env 파일 파싱
$envFile = Join-Path $root ".env"
$envVars = @{}
if (Test-Path $envFile) {
    Get-Content $envFile -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $envVars[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

$port = if ($envVars["PORT"]) { [int]$envVars["PORT"] } else { 8080 }
$url = "http://localhost:$port/"

# 2. HttpListener 시작
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
try {
    $listener.Start()
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host " [논술 수업 기획 대시보드 로컬 서버 가동]" -ForegroundColor Green
    Write-Host " 주소: $url" -ForegroundColor Yellow
    Write-Host " .env 파일에서 환경변수를 성공적으로 로드했습니다." -ForegroundColor Cyan
    Write-Host " 종료하려면 터미널에서 Ctrl + C 를 누르세요." -ForegroundColor Gray
    Write-Host "========================================================" -ForegroundColor Cyan
} catch {
    Write-Host "포트 $port 수신 대기 시작 오류: $_" -ForegroundColor Red
    exit 1
}

# 3. 요청 루프
while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath

        # CORS 헤더
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        # API: 서버 상태 및 안전한 설정 확인 (인증키 직접 노출 방지)
        if ($path -eq "/api/config") {
            $configJson = @{
                status = "ok"
                port = $port
                neisKeyRegistered = [bool]($envVars["NEIS_API_KEY"])
                schoolInfoKeyRegistered = [bool]($envVars["SCHOOLINFO_API_KEY"])
            } | ConvertTo-Json
            
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($configJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # API: NEIS 공공 학교 데이터 프록시 (화면에 키 노출 없음)
        if ($path -eq "/api/schools") {
            $pSize = $request.QueryString["pSize"]
            if (-not $pSize) { $pSize = "10" }
            $keyParam = if ($envVars["NEIS_API_KEY"]) { "&KEY=" + $envVars["NEIS_API_KEY"] } else { "" }
            $targetUrl = "https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=$pSize$keyParam"

            try {
                $webClient = New-Object System.Net.WebClient
                $webClient.Encoding = [System.Text.Encoding]::UTF8
                $rawData = $webClient.DownloadString($targetUrl)
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($rawData)
            } catch {
                $errorJson = @{ error = "NEIS API 호출 실패: $_" } | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($errorJson)
            }

            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        # 정적 파일 서빙
        if ($path -eq "/" -or $path -eq "") {
            $filePath = Join-Path $root "index.html"
        } else {
            $relPath = $path.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $filePath = Join-Path $root $relPath
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($notFound, 0, $notFound.Length)
        }

        $response.Close()
    } catch {
        # 예외 발생 시 안전하게 응답 닫기
        if ($response) {
            $response.StatusCode = 500
            $response.Close()
        }
    }
}
