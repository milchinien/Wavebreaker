# Misst die vorherrschende Farbe jeder Effektfolge, damit die Zuordnung
# blau / violett / gold auf Messung beruht und nicht auf Dateinamen.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$W = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw\PNG'

function Farbton($r, $g, $b) {
    $max = [Math]::Max($r, [Math]::Max($g, $b)); $min = [Math]::Min($r, [Math]::Min($g, $b))
    if ($max -eq $min) { return -1 }
    $d = $max - $min
    $h = if ($max -eq $r) { 60 * ((($g - $b) / $d) % 6) }
         elseif ($max -eq $g) { 60 * ((($b - $r) / $d) + 2) }
         else { 60 * ((($r - $g) / $d) + 4) }
    if ($h -lt 0) { $h += 360 }
    return [math]::Round($h)
}

function Benennen($h) {
    if ($h -lt 0) { return 'grau' }
    if ($h -lt 20 -or $h -ge 340) { return 'rot' }
    if ($h -lt 45)  { return 'orange' }
    if ($h -lt 70)  { return 'GOLD/gelb' }
    if ($h -lt 160) { return 'gruen' }
    if ($h -lt 200) { return 'tuerkis' }
    if ($h -lt 255) { return 'BLAU' }
    if ($h -lt 290) { return 'VIOLETT' }
    return 'magenta'
}

foreach ($d in (Get-ChildItem $W -Directory | Sort-Object Name)) {
    $f = @(Get-ChildItem $d.FullName -File -Filter '*.png' | Sort-Object Name)
    if ($f.Count -lt 3) { continue }
    # Mittleres Bild einer Folge - dort ist der Effekt am kraeftigsten
    $probe = $f[[int]($f.Count / 3)]
    $bmp = New-Object System.Drawing.Bitmap($probe.FullName)

    $rs = 0; $gs = 0; $bs = 0; $n = 0
    $schritt = [Math]::Max(1, [int]($bmp.Width / 48))
    for ($x = 0; $x -lt $bmp.Width; $x += $schritt) {
        for ($y = 0; $y -lt $bmp.Height; $y += $schritt) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.A -lt 120) { continue }
            $hell = ($p.R + $p.G + $p.B) / 3
            if ($hell -lt 40 -or $hell -gt 240) { continue }   # Rauch und weisser Kern raus
            $rs += $p.R; $gs += $p.G; $bs += $p.B; $n++
        }
    }
    $bmp.Dispose()
    if ($n -eq 0) { "{0,-26} keine auswertbaren Pixel" -f $d.Name; continue }

    $r = [int]($rs / $n); $g = [int]($gs / $n); $b = [int]($bs / $n)
    $h = Farbton $r $g $b
    "{0,-26} {1,3} Bilder   RGB({2,3},{3,3},{4,3})   Ton {5,4}   -> {6}" -f `
        $d.Name, $f.Count, $r, $g, $b, $h, (Benennen $h)
}
