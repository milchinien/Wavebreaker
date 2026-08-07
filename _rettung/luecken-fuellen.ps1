# ============================================================================
#  Waverbreaker - Luecken im Rohmaterial suchen
# ----------------------------------------------------------------------------
#  Sucht fuer jede Luecke nach ihrem Inhalt im gesamten Sitzungsmaterial.
#
#  Vorgehen: Die Zeilen unmittelbar VOR und NACH einer Luecke sind bekannt. Sie
#  dienen als Anker. Wo im Rohmaterial derselbe Anker auftaucht, steht mit hoher
#  Wahrscheinlichkeit auch das, was dazwischen fehlt.
#
#  Ausgewertet werden vier Quellen, die die erste Rekonstruktion nicht nutzte:
#    - old_string / new_string der Edit-Aufrufe (woertlicher Dateiinhalt)
#    - Ausgaben von Bash-Aufrufen (cat, sed, grep)
#    - in Fliesstext zitierte Codebloecke
#    - alle uebrigen Werkzeugergebnisse
#
#  WICHTIG: Dieses Skript aendert keine Projektdatei. Es legt Vorschlaege unter
#  _rettung\kandidaten ab. Eingesetzt wird jeder Fund einzeln nach Sichtung.
# ============================================================================

$ErrorActionPreference = 'Stop'

$Root      = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$Quelle    = Join-Path $Root '_rettung\verlauf\alle-sitzungen.json'
$KandDir   = Join-Path $Root '_rettung\kandidaten'
$Marke     = 'FEHLENDE ZEILE'
$AnkerTief = 4      # so viele Zeilen als Anker verwenden
$Vorschau  = 140    # so viele Zeilen nach einem Treffer mitschreiben

if (Test-Path $KandDir) { Remove-Item $KandDir -Recurse -Force }
New-Item -ItemType Directory -Path $KandDir -Force | Out-Null

# --- Rohmaterial einsammeln --------------------------------------------------
Write-Host "Lese Rohmaterial ..."
$j = Get-Content $Quelle -Raw -Encoding UTF8 | ConvertFrom-Json

$korpus = New-Object System.Collections.Generic.List[object]

function FuegeHinzu($text, $herkunft) {
    if (-not $text) { return }
    $s = [string]$text
    if ($s.Length -lt 40) { return }
    # Zeilennummern der Read-Ausgaben entfernen, damit der Text vergleichbar wird
    $ohne = [regex]::Replace($s, '(?m)^\s*\d+\t', '')
    $korpus.Add([PSCustomObject]@{ Text = $ohne; Herkunft = $herkunft })
}

foreach ($s in $j.sitzungen) {
    $kurz = $s.sid -replace '^session_', ''
    if ($s.tools) {
        foreach ($t in $s.tools) {
            FuegeHinzu $t.result "$kurz/$($t.name)/Ergebnis"
            if ($t.input.old_string) { FuegeHinzu $t.input.old_string "$kurz/Edit/alt" }
            if ($t.input.new_string) { FuegeHinzu $t.input.new_string "$kurz/Edit/neu" }
            if ($t.input.content)    { FuegeHinzu $t.input.content    "$kurz/Write/Inhalt" }
            if ($t.input.command)    { FuegeHinzu $t.input.command    "$kurz/Bash/Befehl" }
        }
    }
    if ($s.texts) {
        foreach ($x in $s.texts) { FuegeHinzu $x.text "$kurz/Text/$($x.role)" }
    }
}
Write-Host ("Korpuseintraege: " + $korpus.Count)

# --- Luecken finden ----------------------------------------------------------
$dateien = Get-ChildItem $Root -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '\\(_rettung|\.git|node_modules)\\' }

$gesamtLuecken = 0
$gesamtTreffer = 0

foreach ($datei in $dateien) {
    $zeilen = @(Get-Content $datei.FullName -Encoding UTF8)
    $marken = @()
    for ($i = 0; $i -lt $zeilen.Count; $i++) {
        if ($zeilen[$i] -match $Marke) { $marken += $i }
    }
    if ($marken.Count -eq 0) { continue }

    # Zusammenhaengende Bloecke bilden
    $bloecke = @()
    $start = $marken[0]; $vorher = $marken[0]
    foreach ($m in $marken) {
        if ($m -gt $vorher + 1) { $bloecke += ,@($start, $vorher); $start = $m }
        $vorher = $m
    }
    $bloecke += ,@($start, $vorher)

    $relativ = $datei.FullName.Substring($Root.Length + 1)
    Write-Host ""
    Write-Host ("=== $relativ - " + $bloecke.Count + " Luecke(n) ===") -ForegroundColor Cyan

    foreach ($b in $bloecke) {
        $gesamtLuecken++
        $von = $b[0]; $bis = $b[1]
        $anzahl = $bis - $von + 1

        # Anker: die letzten echten Zeilen davor, die ersten danach
        $ankerVor = @()
        for ($i = $von - 1; $i -ge 0 -and $ankerVor.Count -lt $AnkerTief; $i--) {
            if ($zeilen[$i].Trim().Length -gt 3) { $ankerVor = ,$zeilen[$i] + $ankerVor }
        }
        $ankerNach = @()
        for ($i = $bis + 1; $i -lt $zeilen.Count -and $ankerNach.Count -lt $AnkerTief; $i++) {
            if ($zeilen[$i].Trim().Length -gt 3) { $ankerNach += $zeilen[$i] }
        }

        Write-Host ("  Zeilen $($von+1)-$($bis+1) ($anzahl fehlend)")

        $treffer = New-Object System.Collections.Generic.List[object]

        # Zwei Suchrichtungen.
        #
        # "vor"     : Anker VOR der Luecke suchen, danach weiterlesen.
        # "zurueck" : Anker NACH der Luecke suchen, davor rueckwaerts lesen.
        #
        # Die zweite Richtung ist die wichtigere. Endet eine Leseausgabe mitten in
        # der Luecke, liefert die erste Richtung nur das Ende dieser Ausgabe - also
        # nichts. Eine andere Quelle hat dieselbe Stelle aber vielleicht von hinten
        # erfasst, weil sie dort BEGANN.
        foreach ($richtung in @('vor', 'zurueck')) {
            foreach ($tiefe in @($AnkerTief, 3, 2)) {
                if ($treffer.Count -ge 8) { break }
                $anker = if ($richtung -eq 'vor') { $ankerVor } else { $ankerNach }
                if ($anker.Count -lt $tiefe) { continue }
                $teil = if ($richtung -eq 'vor') {
                    $anker[($anker.Count - $tiefe)..($anker.Count - 1)]
                } else {
                    $anker[0..($tiefe - 1)]
                }
                $muster = ($teil | ForEach-Object { $_.Trim() }) -join "`n"
                if ($muster.Length -lt 12) { continue }

                foreach ($eintrag in $korpus) {
                    $alle = $eintrag.Text -split "`r?`n"
                    $flach = ($alle | ForEach-Object { $_.Trim() }) -join "`n"
                    $pos = $flach.IndexOf($muster, [StringComparison]::Ordinal)
                    if ($pos -lt 0) { continue }
                    $zeilenVor = ($flach.Substring(0, $pos) -split "`n").Count - 1

                    if ($richtung -eq 'vor') {
                        $ab = $zeilenVor + $tiefe
                        if ($ab -ge $alle.Count) { continue }
                        $bis2 = [Math]::Min($alle.Count - 1, $ab + $Vorschau)
                        $inhalt = $alle[$ab..$bis2]
                    } else {
                        $bis2 = $zeilenVor - 1
                        if ($bis2 -lt 0) { continue }
                        $ab = [Math]::Max(0, $bis2 - $Vorschau)
                        $inhalt = $alle[$ab..$bis2]
                    }

                    # Zu kurze Funde sind wertlos - dort endete die Quelle schlicht.
                    $echte = @($inhalt | Where-Object { $_.Trim().Length -gt 0 })
                    if ($echte.Count -lt 3) { continue }

                    $treffer.Add([PSCustomObject]@{
                        Herkunft = $eintrag.Herkunft
                        Tiefe    = $tiefe
                        Richtung = $richtung
                        Zeilen   = $echte.Count
                        Inhalt   = ($inhalt -join "`n")
                    })
                    if ($treffer.Count -ge 8) { break }
                }
            }
        }

        $gesamtTreffer += $treffer.Count
        $farbe = if ($treffer.Count -gt 0) { 'Green' } else { 'DarkGray' }
        Write-Host ("     Fundstellen: " + $treffer.Count) -ForegroundColor $farbe

        # Vorschlag ablegen
        $name = ($relativ -replace '[\\/:]', '_') + "__$($von+1)-$($bis+1).txt"
        $aus = New-Object System.Collections.Generic.List[string]
        $aus.Add("Datei : $relativ")
        $aus.Add("Luecke: Zeilen $($von+1) bis $($bis+1)  ($anzahl Zeilen)")
        $aus.Add("")
        $aus.Add("---- Anker davor ----")
        $ankerVor | ForEach-Object { $aus.Add($_) }
        $aus.Add("")
        $aus.Add("---- Anker danach ----")
        $ankerNach | ForEach-Object { $aus.Add($_) }
        $aus.Add("")
        if ($treffer.Count -eq 0) {
            $aus.Add("KEINE FUNDSTELLE im Rohmaterial - muss rekonstruiert werden.")
        } else {
            $nr = 0
            foreach ($t in $treffer) {
                $nr++
                $richtungText = if ($t.Richtung -eq 'vor') { 'vorwaerts ab Anker davor' } else { 'rueckwaerts ab Anker danach' }
                $aus.Add("======== Fundstelle $nr  |  $richtungText  |  Anker $($t.Tiefe) Zeilen  |  $($t.Zeilen) Inhaltszeilen  |  $($t.Herkunft) ========")
                $aus.Add($t.Inhalt)
                $aus.Add("")
            }
        }
        Set-Content -Path (Join-Path $KandDir $name) -Value $aus -Encoding UTF8
    }
}

Write-Host ""
Write-Host "-------------------------------------------------------------"
Write-Host "Luecken untersucht : $gesamtLuecken"
Write-Host "Fundstellen gesamt : $gesamtTreffer"
Write-Host "Vorschlaege in     : $KandDir"
Write-Host "Projektdateien wurden NICHT veraendert."
