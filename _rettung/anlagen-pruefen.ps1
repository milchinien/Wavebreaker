$ErrorActionPreference = 'Stop'
$W = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw'

function Zeig($titel, $pfad, $tiefe) {
    Write-Host ''
    Write-Host "=== $titel ===" -ForegroundColor Cyan
    if (-not (Test-Path $pfad)) { Write-Host '  nicht vorhanden' -ForegroundColor Red; return }
    Get-ChildItem $pfad -Directory -ErrorAction SilentlyContinue | Select-Object -First 25 | ForEach-Object {
        $n = @(Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue).Count
        "  [D] {0,-42} {1,5} Dateien" -f $_.Name, $n
    }
    Get-ChildItem $pfad -File -ErrorAction SilentlyContinue | Select-Object -First 12 | ForEach-Object {
        "      {0,-42} {1,6} KB" -f $_.Name, [math]::Round($_.Length / 1KB, 1)
    }
}

Zeig 'Coins'      (Join-Path $W 'Coins') 1
Zeig 'Lucid V1.2' (Join-Path $W 'Lucid V1.2') 1
Zeig 'PNG'        (Join-Path $W 'PNG') 1
Zeig 'Super Pixel Effects Gigapack' (Join-Path $W 'Super Pixel Effects Gigapack (Free Version)') 1

Write-Host ''
Write-Host '=== Suche nach den in docs/anlagen.md genannten Quellen ===' -ForegroundColor Cyan
$suchen = @(
  @{ N = 'Game UI collection'; M = '*game*ui*' },
  @{ N = 'Cyan Blue Neon';     M = '*cyan*' },
  @{ N = 'Skillicons';         M = '*skillicon*' },
  @{ N = 'monogram (Schrift)'; M = '*monogram*' },
  @{ N = 'TTF-Schriften';      M = '*.ttf' },
  @{ N = 'OGG-Klaenge';        M = '*.ogg' }
)
foreach ($s in $suchen) {
    $t = @(Get-ChildItem $W -Recurse -Force -ErrorAction SilentlyContinue -Filter $s.M)
    if ($t.Count -eq 0) {
        Write-Host ("  {0,-22} FEHLT" -f $s.N) -ForegroundColor Red
    } else {
        Write-Host ("  {0,-22} {1} Treffer" -f $s.N, $t.Count) -ForegroundColor Green
        $t | Select-Object -First 4 | ForEach-Object {
            Write-Host ('      ' + $_.FullName.Replace($W, '~')) -ForegroundColor DarkGray
        }
    }
}

Write-Host ''
Write-Host '=== Dateiarten insgesamt ===' -ForegroundColor Cyan
Get-ChildItem $W -Recurse -File -ErrorAction SilentlyContinue |
    Group-Object Extension | Sort-Object Count -Descending | Select-Object -First 10 |
    ForEach-Object { "  {0,-8} {1,6}" -f $_.Name, $_.Count }
