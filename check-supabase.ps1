$env = @{}
Get-Content .env | Where-Object { $_ -match '^([^#=]+)=(.*)$' } | ForEach-Object { $env[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'") }

try {
    $res = Invoke-RestMethod -Uri "$($env['SUPABASE_URL'])/auth/v1/health" -Headers @{ apikey = $env['SUPABASE_ANON_KEY'] } -Method Get -TimeoutSec 5
    Write-Output "✅ Supabase 연결 성공 ($($res.name) $($res.version))"
} catch {
    Write-Output "❌ Supabase 연결 실패: $($_.Exception.Message)"
}

