# ============================================================================
#  Effektstreifen aus den Rohpaketen bauen
# ----------------------------------------------------------------------------
#  Zielform laut src/render/sprites.ts: ein waagerechter Streifen aus gleich
#  breiten Einzelbildern. Zugeschnitten und skaliert wird HIER, nicht zur
#  Laufzeit - das Spiel soll kein 256er Bild laden, um daraus 48 Pixel zu machen.
#
#  Farbzuordnung nach docs/anlagen.md:
#    blau     = eigener Schaden      -> impact
#    violett  = zerfallender Gegner  -> death
#    gold     = Belohnung            -> spark
#
#  Violett gibt es in den gelieferten Paketen nicht. Deshalb wird eine blaue
#  Folge um genau den Winkel gedreht, der auf den Violettwert der Palette
#  fuehrt (#b45cff, Farbton 272 Grad).
# ============================================================================

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Roh  = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw\PNG'
$Ziel = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\public\fx'
if (-not (Test-Path $Ziel)) { New-Item -ItemType Directory -Path $Ziel -Force | Out-Null }

function DreheFarbton([System.Drawing.Bitmap]$bmp, [double]$grad) {
    if ($grad -eq 0) { return }
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        for ($y = 0; $y -lt $bmp.Height; $y++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.A -eq 0) { continue }
            $r = $p.R / 255.0; $g = $p.G / 255.0; $b = $p.B / 255.0
            $max = [Math]::Max($r, [Math]::Max($g, $b)); $min = [Math]::Min($r, [Math]::Min($g, $b))
            $v = $max; $d = $max - $min
            $s = if ($max -eq 0) { 0 } else { $d / $max }
            if ($d -eq 0) { continue }          # Grau bleibt grau - Rauch faerbt nicht mit
            $h = if ($max -eq $r) { 60 * ((($g - $b) / $d) % 6) }
                 elseif ($max -eq $g) { 60 * ((($b - $r) / $d) + 2) }
                 else { 60 * ((($r - $g) / $d) + 4) }
            if ($h -lt 0) { $h += 360 }
            $h = ($h + $grad) % 360
            if ($h -lt 0) { $h += 360 }

            $c = $v * $s; $xx = $c * (1 - [Math]::Abs((($h / 60) % 2) - 1)); $m = $v - $c
            switch ([int][Math]::Floor($h / 60)) {
                0 { $rr = $c; $gg = $xx; $bb = 0 }
                1 { $rr = $xx; $gg = $c; $bb = 0 }
                2 { $rr = 0; $gg = $c; $bb = $xx }
                3 { $rr = 0; $gg = $xx; $bb = $c }
                4 { $rr = $xx; $gg = 0; $bb = $c }
                default { $rr = $c; $gg = 0; $bb = $xx }
            }
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(
                $p.A,
                [int][Math]::Round(($rr + $m) * 255),
                [int][Math]::Round(($gg + $m) * 255),
                [int][Math]::Round(($bb + $m) * 255)))
        }
    }
}

function BaueStreifen($quellOrdner, $zielDatei, $kante, $drehung, $beschreibung) {
    $dateien = @(Get-ChildItem (Join-Path $Roh $quellOrdner) -File -Filter '*.png' |
                 Sort-Object { [int]([regex]::Match($_.BaseName, '(\d+)$').Groups[1].Value) })
    if ($dateien.Count -eq 0) { Write-Host "  $quellOrdner : keine Bilder" -ForegroundColor Red; return $null }

    $streifen = New-Object System.Drawing.Bitmap(($kante * $dateien.Count), $kante)
    $g = [System.Drawing.Graphics]::FromImage($streifen)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    for ($i = 0; $i -lt $dateien.Count; $i++) {
        $quelle = New-Object System.Drawing.Bitmap($dateien[$i].FullName)
        # Erst verkleinern, dann faerben: spart bei 256er Vorlagen das Hundertfache an Arbeit.
        $klein = New-Object System.Drawing.Bitmap($kante, $kante)
        $gk = [System.Drawing.Graphics]::FromImage($klein)
        $gk.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gk.DrawImage($quelle, 0, 0, $kante, $kante)
        $gk.Dispose(); $quelle.Dispose()

        DreheFarbton $klein $drehung
        $g.DrawImage($klein, ($i * $kante), 0, $kante, $kante)
        $klein.Dispose()
    }

    $g.Dispose()
    $pfad = Join-Path $Ziel $zielDatei
    $streifen.Save($pfad, [System.Drawing.Imaging.ImageFormat]::Png)
    $w = $streifen.Width; $h = $streifen.Height
    $streifen.Dispose()

    Write-Host ("  {0,-12} {1,3} Bilder a {2}px  ->  {3}x{4}  {5}" -f `
        $zielDatei, $dateien.Count, $kante, $w, $h, $beschreibung) -ForegroundColor Green
    return $dateien.Count
}

Write-Host 'Baue Effektstreifen ...'
$nImpact = BaueStreifen 'Explosion_blue_circle' 'impact.png' 48 0    'blau, unveraendert'
$nDeath  = BaueStreifen 'Explosion_blue_oval'   'death.png'  48 64   'blau +64 Grad -> Palettenviolett'
$nSpark  = BaueStreifen 'Circle_explosion'      'spark.png'  64 0    'gold, unveraendert'

Write-Host ''
Write-Host 'Bildzahlen fuer src/render/sprites.ts:'
Write-Host "  impact: $nImpact"
Write-Host "  death : $nDeath"
Write-Host "  spark : $nSpark"
