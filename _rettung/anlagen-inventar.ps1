# Kompakter Ueberblick ueber die gelieferten Anlagen.
$ErrorActionPreference = 'Stop'
$Wurzel = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw'

Write-Host '=== Oberste Ebene: Ordner ==='
foreach ($d in (Get-ChildItem $Wurzel -Directory | Sort-Object Name)) {
    $n = @(Get-ChildItem $d.FullName -Recurse -File -ErrorAction SilentlyContinue)
    $mb = if ($n.Count) { [math]::Round((($n | Measure-Object Length -Sum).Sum) / 1MB, 1) } else { 0 }
    "{0,-52} {1,5} Dateien  {2,7} MB" -f $d.Name, $n.Count, $mb
}

Write-Host ''
Write-Host '=== Oberste Ebene: lose Dateien ==='
foreach ($f in (Get-ChildItem $Wurzel -File | Sort-Object Name)) {
    "{0,-52} {1,7} KB" -f $f.Name, [math]::Round($f.Length / 1KB, 1)
}

Write-Host ''
Write-Host '=== Gesucht laut docs/anlagen.md ==='
$gesucht = @{
    'Game UI collection' = 'Symbole, Rahmen, Leisten'
    'Cyan Blue Neon'     = 'Settings_icon'
    'Skillicon'          = 'Kachelsymbole'
    'coins-chests'       = 'Muenzstreifen'
    'Super Pixel'        = 'Einschlag, Explosion, Funken'
    'monogram'           = 'Pixelschrift'
    'Coins sounds'       = 'Aufhebe-Klaenge'
}
foreach ($k in ($gesucht.Keys | Sort-Object)) {
    $treffer = @(Get-ChildItem $Wurzel -Recurse -ErrorAction SilentlyContinue |
                 Where-Object { $_.Name -like "*$k*" -or $_.FullName -like "*$k*" })
    $status = if ($treffer.Count -gt 0) { "gefunden ($($treffer.Count))" } else { 'FEHLT' }
    $farbe = if ($treffer.Count -gt 0) { 'Green' } else { 'Red' }
    Write-Host ("  {0,-22} {1,-26} {2}" -f $k, $gesucht[$k], $status) -ForegroundColor $farbe
    if ($treffer.Count -gt 0) {
        $treffer | Select-Object -First 2 | ForEach-Object {
            Write-Host ("      " + $_.FullName.Replace($Wurzel, '...')) -ForegroundColor DarkGray
        }
    }
}
