$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$W = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw'

Write-Host '=== Gigapack: spritesheet-Ordner ===' -ForegroundColor Cyan
$ss = Join-Path $W 'Super Pixel Effects Gigapack (Free Version)\spritesheet'
if (Test-Path $ss) {
    Get-ChildItem $ss -Directory | ForEach-Object {
        $n = @(Get-ChildItem $_.FullName -File).Count
        "  [D] {0,-34} {1,4} Dateien" -f $_.Name, $n
    }
    Get-ChildItem $ss -File | Select-Object -First 8 | ForEach-Object { "      " + $_.Name }
}

Write-Host ''
Write-Host '=== PNG-Ordner: Bildgroessen der Folgen ===' -ForegroundColor Cyan
foreach ($d in (Get-ChildItem (Join-Path $W 'PNG') -Directory)) {
    $f = @(Get-ChildItem $d.FullName -File -Filter '*.png' | Sort-Object Name)
    if ($f.Count -eq 0) { continue }
    try {
        $img = [System.Drawing.Image]::FromFile($f[0].FullName)
        $groesse = "$($img.Width)x$($img.Height)"
        $img.Dispose()
    } catch { $groesse = '?' }
    "  {0,-26} {1,3} Bilder   je {2}   erstes: {3}" -f $d.Name, $f.Count, $groesse, $f[0].Name
}

Write-Host ''
Write-Host '=== Muenzquelle ===' -ForegroundColor Cyan
$c = Join-Path $W 'coins-chests-etc-2-0.png'
if (Test-Path $c) {
    $img = [System.Drawing.Image]::FromFile($c)
    "  coins-chests-etc-2-0.png : {0} x {1}" -f $img.Width, $img.Height
    $img.Dispose()
}

Write-Host ''
Write-Host '=== Lucid: Aufbau ===' -ForegroundColor Cyan
$lp = Join-Path $W 'Lucid V1.2\PNG'
if (Test-Path $lp) {
    Get-ChildItem $lp -Directory | Select-Object -First 10 | ForEach-Object {
        $n = @(Get-ChildItem $_.FullName -File).Count
        "  [D] {0,-24} {1,4} Dateien" -f $_.Name, $n
    }
    Get-ChildItem $lp -File | Select-Object -First 10 | ForEach-Object { "      " + $_.Name }
}
