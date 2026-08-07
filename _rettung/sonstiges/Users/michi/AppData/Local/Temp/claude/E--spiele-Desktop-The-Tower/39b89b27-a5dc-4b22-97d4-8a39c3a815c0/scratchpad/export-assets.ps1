Add-Type -AssemblyName System.Drawing

$Root = "E:\spiele\Desktop\The Tower"
$Raw = "$Root\assets\raw"
$Ex = "$Raw\_extracted"
$GameUI = "$Ex\Game UI collection FREE version\Game UI collection FREE version\PNG"
$Giga = "$Ex\Super Pixel Effects Gigapack (Free Version) v2.8.0\Super Pixel Effects Gigapack (Free Version)\spritesheet"
$Pub = "$Root\public"

foreach ($d in @("$Pub\coins", "$Pub\ui", "$Pub\icons", "$Pub\fx")) {
  New-Item -ItemType Directory -Force $d | Out-Null
}

function Copy-Scaled([string]$src, [string]$dst, [int]$max) {
  $img = [System.Drawing.Image]::FromFile($src)
  $scale = [Math]::Min(1.0, [Math]::Min($max / $img.Width, $max / $img.Height))
  $w = [int][Math]::Round($img.Width * $scale)
  $h = [int][Math]::Round($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.PixelOffsetMode = 'HighQuality'
  $g.CompositingQuality = 'HighQuality'
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $w, $h)))
  $g.Dispose()
  $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose(); $img.Dispose()
  "  {0,-24} {1}x{2}" -f (Split-Path $dst -Leaf), $w, $h
}

function Copy-Exact([string]$src, [string]$dst) {
  Copy-Item $src $dst -Force
  $img = [System.Drawing.Image]::FromFile($dst)
  "  {0,-24} {1}x{2}" -f (Split-Path $dst -Leaf), $img.Width, $img.Height
  $img.Dispose()
}

# --- Muenzen: drei Wertstufen mit je sieben Glanzbildern, 16 px Raster -------
"Muenzen"
$sheet = New-Object System.Drawing.Bitmap("$Raw\coins-chests-etc-2-0.png")
$rows = @(64, 32, 16)   # Reihenfolge im Ziel: bronze, silber, gold
$coins = New-Object System.Drawing.Bitmap(112, 48)
$g = [System.Drawing.Graphics]::FromImage($coins)
$g.InterpolationMode = 'NearestNeighbor'; $g.PixelOffsetMode = 'Half'
for ($r = 0; $r -lt 3; $r++) {
  for ($f = 0; $f -lt 7; $f++) {
    $srcRect = New-Object System.Drawing.Rectangle((176 + $f * 16), $rows[$r], 16, 16)
    $dstRect = New-Object System.Drawing.Rectangle(($f * 16), ($r * 16), 16, 16)
    $g.DrawImage($sheet, $dstRect, $srcRect, 'Pixel')
  }
}
$g.Dispose()
$coins.Save("$Pub\coins\coins.png", [System.Drawing.Imaging.ImageFormat]::Png)
$coins.Dispose(); $sheet.Dispose()
"  coins.png                112x48  (3 Stufen x 7 Bilder, 16 px)"

# --- Oberflaechenteile aus der Game-UI-Sammlung -----------------------------
"Oberflaeche"
Copy-Scaled "$GameUI\button\Blue\1x\Asset 19.png"           "$Pub\ui\frame-slot.png"  256
Copy-Scaled "$GameUI\button\Blue\1x\Asset 16.png"           "$Pub\ui\frame-box.png"   256
Copy-Scaled "$GameUI\Bars\Blue\x1\Asset 10.png"             "$Pub\ui\bar-hatch.png"   512
Copy-Scaled "$GameUI\Bars\Blue\x1\Asset 5.png"              "$Pub\ui\corner.png"      256
Copy-Scaled "$GameUI\Button with border\Blue\1x\Asset 8.png" "$Pub\ui\plate.png"      512

# --- Symbole. Werden als Maske benutzt, es zaehlt nur die Deckung. ----------
"Symbole"
Copy-Scaled "$GameUI\Icons\Asset 5.png"   "$Pub\icons\coin.png"      128
Copy-Scaled "$GameUI\Icons\Asset 25.png"  "$Pub\icons\prev.png"      128
Copy-Scaled "$GameUI\Icons\Asset 26.png"  "$Pub\icons\next.png"      128
Copy-Scaled "$GameUI\Icons\Asset 13.png"  "$Pub\icons\combat.png"    128
Copy-Scaled "$GameUI\Icons\Asset 39.png"  "$Pub\icons\base.png"      128
Copy-Scaled "$GameUI\Icons\Asset 27.png"  "$Pub\icons\crosshair.png" 128
Copy-Scaled "$GameUI\Icons\Asset 19.png"  "$Pub\icons\bullet.png"    128
Copy-Scaled "$Raw\PackCyanBlue\Png Files\Icons\Settings_icon.png" "$Pub\icons\gear.png" 128

# --- Effekte ----------------------------------------------------------------
"Effekte"
Copy-Exact "$Giga\Impacts\symmetrical_impact_002\symmetrical_impact_002_small_blue\spritesheet.png" "$Pub\fx\impact.png"
Copy-Exact "$Giga\Explosions\stylized_explosion_002\stylized_explosion_002_small_violet\spritesheet.png" "$Pub\fx\death.png"
Copy-Exact "$Giga\Sci-fi\scifi_spark_burst_001\scifi_spark_burst_001_small_yellow\spritesheet.png" "$Pub\fx\spark.png"

"fertig"

