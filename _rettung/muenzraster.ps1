# Bestimmt das Raster des COINS-Blocks in coins-chests-etc-2-0.png.
# Gesucht ist die rechte Gruppe: der Glanzlauf mit sieben Bildern je Farbreihe.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$src = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw\coins-chests-etc-2-0.png'
$bmp = New-Object System.Drawing.Bitmap($src)

# Untersuchungsbereich: der COINS-Kasten oben links
$X0 = 0; $X1 = 530; $Y0 = 10; $Y1 = 110

function Belegt($x, $y) {
    $p = $bmp.GetPixel($x, $y)
    # Der Rahmen des Kastens ist fast schwarz - der zaehlt nicht als Inhalt
    if ($p.A -lt 40) { return $false }
    if ($p.R -lt 40 -and $p.G -lt 40 -and $p.B -lt 60) { return $false }
    return $true
}

Write-Host '=== Zeilen mit Inhalt (Farbreihen) ==='
$zeilen = @()
$inZeile = $false; $start = 0
for ($y = $Y0; $y -le $Y1; $y++) {
    $n = 0
    for ($x = $X0; $x -le $X1; $x++) { if (Belegt $x $y) { $n++ } }
    $hat = $n -gt 8
    if ($hat -and -not $inZeile) { $inZeile = $true; $start = $y }
    elseif (-not $hat -and $inZeile) { $inZeile = $false; $zeilen += ,@($start, ($y - 1)) }
}
if ($inZeile) { $zeilen += ,@($start, $Y1) }
foreach ($z in $zeilen) { "  y {0,3} bis {1,3}   Hoehe {2}" -f $z[0], $z[1], ($z[1] - $z[0] + 1) }

Write-Host ''
Write-Host '=== Spalten mit Inhalt in der ersten Farbreihe ==='
if ($zeilen.Count -eq 0) { Write-Host '  keine Reihen gefunden'; exit 1 }
$zy0 = $zeilen[0][0]; $zy1 = $zeilen[0][1]
$spalten = @()
$inSp = $false; $sStart = 0
for ($x = $X0; $x -le $X1; $x++) {
    $n = 0
    for ($y = $zy0; $y -le $zy1; $y++) { if (Belegt $x $y) { $n++ } }
    $hat = $n -gt 1
    if ($hat -and -not $inSp) { $inSp = $true; $sStart = $x }
    elseif (-not $hat -and $inSp) { $inSp = $false; $spalten += ,@($sStart, ($x - 1)) }
}
if ($inSp) { $spalten += ,@($sStart, $X1) }

$i = 0
foreach ($s in $spalten) {
    $i++
    "  {0,2}. x {1,3} bis {2,3}   Breite {3}" -f $i, $s[0], $s[1], ($s[1] - $s[0] + 1)
}

Write-Host ''
Write-Host ('Gefunden: ' + $zeilen.Count + ' Farbreihen, ' + $spalten.Count + ' Einzelbilder in der ersten Reihe')
$bmp.Dispose()
