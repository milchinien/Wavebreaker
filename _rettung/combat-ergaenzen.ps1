# ============================================================================
#  render/combat.ts: fehlende Funktionen aus der aelteren Fassung anfuegen
# ----------------------------------------------------------------------------
#  Die letzte Leseausgabe dieser Datei war abgeschnitten (Grenze fuer
#  Werkzeugausgaben). Was dahinter stand, fehlt in der neuen Fassung, steht aber
#  noch in der aelteren - dort lag es vor der Grenze.
# ============================================================================

$ErrorActionPreference = 'Stop'

$Root = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$Neu  = Join-Path $Root 'src\render\combat.ts'
$Alt  = Join-Path $Root '_rettung\combat-alte-fassung.ts'

$neuText  = Get-Content $Neu -Raw -Encoding UTF8
$altZeilen = Get-Content $Alt -Encoding UTF8

# Eine Funktion samt ihrem Kommentarblock aus der alten Fassung schneiden.
function SchneideFunktion($zeilen, $name) {
    $start = -1
    for ($i = 0; $i -lt $zeilen.Count; $i++) {
        if ($zeilen[$i] -match ('^export function\s+' + [regex]::Escape($name) + '\s*\(')) { $start = $i; break }
    }
    if ($start -lt 0) { return $null }

    # Den Kommentarblock davor mitnehmen - er traegt die Begruendung.
    $kopf = $start
    for ($i = $start - 1; $i -ge 0; $i--) {
        $z = $zeilen[$i].Trim()
        if ($z -eq '*/' -or $z.StartsWith('*') -or $z.StartsWith('/**') -or $z.StartsWith('/*')) { $kopf = $i }
        elseif ($z.Length -eq 0 -and $kopf -lt $start) { continue }
        else { break }
    }

    # Ende: die erste schliessende Klammer ganz links nach dem Beginn.
    $ende = -1
    for ($i = $start + 1; $i -lt $zeilen.Count; $i++) {
        if ($zeilen[$i] -eq '}') { $ende = $i; break }
    }
    if ($ende -lt 0) { return $null }

    return ($zeilen[$kopf..$ende] -join "`n")
}

$gesucht = @('drawBursts', 'drawGains', 'drawHits', 'drawMuzzles', 'drawShards')
$anzufuegen = New-Object System.Collections.Generic.List[string]

foreach ($name in $gesucht) {
    if ($neuText -match ('(?m)^export function\s+' + [regex]::Escape($name) + '\s*\(')) {
        Write-Host ("  $name : schon vorhanden") -ForegroundColor DarkGray
        continue
    }
    $code = SchneideFunktion $altZeilen $name
    if ($null -eq $code) {
        Write-Host ("  $name : in der alten Fassung NICHT gefunden") -ForegroundColor Red
        continue
    }
    $anzufuegen.Add($code)
    Write-Host ("  $name : uebernommen (" + ($code -split "`n").Count + " Zeilen)") -ForegroundColor Green
}

if ($anzufuegen.Count -eq 0) { Write-Host 'Nichts anzufuegen.'; exit 0 }

$kopfzeile = @'

/* ============================================================================
 * [REKONSTRUIERT] Aus einer aelteren Fassung uebernommen.
 *
 * Die letzte vollstaendige Leseausgabe dieser Datei endete bei Zeile 1207 - dort
 * greift die Laengengrenze fuer Werkzeugausgaben. Was danach stand, ist in keiner
 * Sitzung erfasst. Die folgenden Funktionen stammen deshalb aus dem Stand vom
 * 03.08.2026; `render/scene.ts` fuehrt sie unveraendert im Import, sie gehoeren
 * also weiterhin hierher. Spaetere Aenderungen an ihnen koennen fehlen.
 * ==========================================================================*/
'@

$ergebnis = $neuText.TrimEnd() + "`n" + $kopfzeile + "`n" + ($anzufuegen -join "`n`n") + "`n"
Set-Content -Path $Neu -Value $ergebnis -Encoding UTF8 -NoNewline

Write-Host ''
Write-Host ("Neue Zeilenzahl: " + (($ergebnis -split "`n").Count))
$auf = ([regex]::Matches($ergebnis, '\{')).Count
$zu  = ([regex]::Matches($ergebnis, '\}')).Count
Write-Host ("Klammerbilanz: { $auf   } $zu")
