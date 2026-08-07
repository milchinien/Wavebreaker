# ============================================================================
#  public/icons/ aus dem Lucid-Satz befuellen
# ----------------------------------------------------------------------------
#  Symbole werden als Maske benutzt (src/ui/icons.ts): Nur die Form zaehlt, die
#  Farbe kommt aus der Palette. Uebernommen wird deshalb nur, wo die Form die
#  Bedeutung wirklich trifft - ein Lupenzeichen als Fadenkreuz waere geraten.
#
#  Groessen: Die "glatten" Symbole duerfen jede Groesse annehmen und kommen aus
#  der 64er Reihe. Die uebrigen rasten im Spiel auf 16 oder 32 ein und kommen
#  deshalb aus der 32er Reihe - so entsteht beim Zeichnen keine Zwischengroesse.
# ============================================================================

$ErrorActionPreference = 'Stop'

$Lucid = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\Assets\raw\Lucid V1.2\PNG\Flat'
$Ziel  = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\public\icons'
if (-not (Test-Path $Ziel)) { New-Item -ItemType Directory -Path $Ziel -Force | Out-Null }

# Zielname = @{ Quelle; Groesse; Begruendung }
$abbildung = @(
    @{ Ziel = 'prev';     Quelle = 'Previous';    Groesse = 64; Warum = 'Wellensteuerung zurueck' },
    @{ Ziel = 'next';     Quelle = 'Next';        Groesse = 64; Warum = 'Wellensteuerung vor' },
    @{ Ziel = 'gear';     Quelle = 'Gear';        Groesse = 64; Warum = 'Navileiste Einstellungen' },
    @{ Ziel = 'settings'; Quelle = 'Gear';        Groesse = 32; Warum = 'Einstellungen als Kachelzeichen' },
    @{ Ziel = 'base';     Quelle = 'Home';        Groesse = 64; Warum = 'Navileiste Basis' },
    @{ Ziel = 'modules';  Quelle = 'Grid';        Groesse = 32; Warum = 'Module sind ein Raster' },
    @{ Ziel = 'upgrade';  Quelle = 'Up-Arrow';    Groesse = 32; Warum = 'allgemeines Verbesserungszeichen' },
    @{ Ziel = 'rate';     Quelle = 'Clock';       Groesse = 32; Warum = 'Feuerrate ist Zeit' }
)

$gesetzt = 0
foreach ($a in $abbildung) {
    $q = Join-Path $Lucid ("{0}\{1}.png" -f $a.Groesse, $a.Quelle)
    if (-not (Test-Path $q)) {
        Write-Host ("  {0,-10} QUELLE FEHLT: {1}" -f $a.Ziel, $a.Quelle) -ForegroundColor Red
        continue
    }
    Copy-Item $q (Join-Path $Ziel ($a.Ziel + '.png')) -Force
    $gesetzt++
    Write-Host ("  {0,-10} <- {1,-12} {2,3}px   {3}" -f $a.Ziel, $a.Quelle, $a.Groesse, $a.Warum) -ForegroundColor Green
}

# Was das Spiel sonst noch anfordert
$alle = @('turret','modules','upgrade','settings','damage','rate','range','hull','gold',
          'radius','autocannon','cannon','amplifier','boss','coin','prev','next','combat',
          'base','gear','crosshair','bullet')
$fehlend = @($alle | Where-Object { -not (Test-Path (Join-Path $Ziel ($_ + '.png'))) })

Write-Host ''
Write-Host ("Gesetzt: $gesetzt von " + $alle.Count) -ForegroundColor Cyan
Write-Host ('Fehlend: ' + ($fehlend -join ', ')) -ForegroundColor Yellow

$rahmen = @('common','rare','epic','legendary','mythic')
$rz = 'D:\Projects\Claude\Desktop\Games\Wavebreaker\public\frames'
$rf = @($rahmen | Where-Object { -not (Test-Path (Join-Path $rz ($_ + '.png'))) })
Write-Host ('Seltenheitsrahmen fehlend: ' + ($rf -join ', ')) -ForegroundColor Yellow
