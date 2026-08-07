# ============================================================================
#  public/coins/coins.png aus coins-chests-etc-2-0.png schneiden
# ----------------------------------------------------------------------------
#  Zielform laut src/render/sprites.ts: 7 Bilder je Reihe, 3 Reihen, 16 px.
#  Also 112 x 48.
#
#  Gemessenes Raster der Vorlage (COINS-Block, Glanzlauf-Gruppe):
#    Spalten x = 176, Abstand 16, sieben Bilder
#    Farbreihen y = 17 (gold), 33 (hellsilber), 49 (stahlblau), 65 (kupfer)
#
#  Reihenfolge im Spiel ist bronze, silber, gold - das sind die Stufen 0, 1, 2
#  aus `coinLook`. Die stahlblaue Reihe bleibt liegen: Sie liesse sich vom
#  Hellsilber nur schwer unterscheiden, und drei Stufen sind gefragt.
# ============================================================================

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$Quelle = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw\coins-chests-etc-2-0.png'
$Ziel   = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\public\coins'
if (-not (Test-Path $Ziel)) { New-Item -ItemType Directory -Path $Ziel -Force | Out-Null }

$ZELLE   = 16
$BILDER  = 7
$SPALTE0 = 176
$REIHEN  = @(
    @{ Name = 'bronze'; Y = 65 },
    @{ Name = 'silber'; Y = 33 },
    @{ Name = 'gold';   Y = 17 }
)

$src = New-Object System.Drawing.Bitmap($Quelle)
$streifen = New-Object System.Drawing.Bitmap(($ZELLE * $BILDER), ($ZELLE * $REIHEN.Count))
$g = [System.Drawing.Graphics]::FromImage($streifen)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.Clear([System.Drawing.Color]::Transparent)

for ($r = 0; $r -lt $REIHEN.Count; $r++) {
    for ($i = 0; $i -lt $BILDER; $i++) {
        $quellRechteck = New-Object System.Drawing.Rectangle(
            ($SPALTE0 + $i * $ZELLE), $REIHEN[$r].Y, $ZELLE, $ZELLE)
        $zielRechteck = New-Object System.Drawing.Rectangle(
            ($i * $ZELLE), ($r * $ZELLE), $ZELLE, $ZELLE)
        $g.DrawImage($src, $zielRechteck, $quellRechteck, [System.Drawing.GraphicsUnit]::Pixel)
    }
    Write-Host ("  Reihe {0}: {1,-7} aus y={2}" -f $r, $REIHEN[$r].Name, $REIHEN[$r].Y)
}

$g.Dispose()
$pfad = Join-Path $Ziel 'coins.png'
$streifen.Save($pfad, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host ''
Write-Host ("Geschrieben: {0}  ({1} x {2})" -f $pfad, $streifen.Width, $streifen.Height) -ForegroundColor Green
$streifen.Dispose()
$src.Dispose()

# Zur Sichtpruefung achtfach vergroessern
$k = New-Object System.Drawing.Bitmap($pfad)
$gross = New-Object System.Drawing.Bitmap(($k.Width * 8), ($k.Height * 8))
$gg = [System.Drawing.Graphics]::FromImage($gross)
$gg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gg.DrawImage($k, 0, 0, $gross.Width, $gross.Height)
$gg.Dispose()
$probe = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\_rettung\coins-probe.png'
$gross.Save($probe, [System.Drawing.Imaging.ImageFormat]::Png)
$gross.Dispose(); $k.Dispose()
Write-Host "Sichtprobe: $probe"
