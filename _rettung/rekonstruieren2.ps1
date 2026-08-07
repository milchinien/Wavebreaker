# ============================================================================
#  Waverbreaker - Rekonstruktion durch Abspielen der Aenderungsgeschichte
# ----------------------------------------------------------------------------
#  Der erste Versuch hat Zeilen aus verschiedenen Zeitpunkten uebereinandergelegt.
#  Das geht nur gut, solange eine Datei ihre Zeilennummern behaelt - bei stark
#  umgebauten Dateien entstanden dadurch Mischfassungen, die es nie gab.
#
#  Dieser Weg spielt stattdessen die tatsaechliche Geschichte ab:
#
#     Write  ->  setzt den vollstaendigen Inhalt zu diesem Zeitpunkt
#     Edit   ->  ersetzt old_string durch new_string (woertlich)
#     Read   ->  dient als Ausgangsstand, wenn es noch keinen gibt, und am
#                Ende als Pruefstein gegen das Ergebnis
#
#  Das ist dieselbe Mechanik, mit der die Dateien damals entstanden sind -
#  entsprechend genau ist das Ergebnis.
# ============================================================================

$ErrorActionPreference = 'Stop'

$Root       = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$Quelle     = Join-Path $Root '_rettung\verlauf\alle-sitzungen.json'
$Bericht    = Join-Path $Root '_rettung\BERICHT.md'
$AltePfade  = @('E:\spiele\Desktop\The Tower\', 'E:/spiele/Desktop/The Tower/',
                '/e/spiele/Desktop/The Tower/')

$Reihenfolge = @(
  'session_01Aeun1yAx8dX7yZTcRrwGte','session_013z6F6uM52Mbkutjk2RkKtu','session_018RDq5T9duERXFFvNSz72Y1',
  'session_012YrbpumVFRu5ygPkJCH7BX','session_01QexX4hhGi5mWBuRAHqGQQJ','session_01BamuD7CimtQC6FrgTgPyZ6',
  'session_01CTjpLuUzsRAaXWJs6sYBeT','session_01FgXz7KkkZ4URdLhw3YSQap','session_01YN87ANE7jGj38AxaDcVjzF',
  'session_01BGULKw85QVq8N747W7GvYj','session_0123k3KpYpQezVUAiUijpUX9','session_01PPSJXRSZFyL43eBYmkWARD',
  'session_01ARjwCTZiTeWDdFAr8Me6tr','session_01529YqdKLRNbK7fQJnM9Kk3','session_01FhUc7aPDwFpZrZSHNx5Mcy',
  'session_01E1azVsAugDrEeZfWWzCv6d','session_01AdKuuazGAn61xYsHyjMXbm','session_0188QEpMtn7dCn7WXwKmDaB1',
  'session_01PMQtEQdw2etW41S8DLn6rb','session_01VSaXb3WPEG47nhh8ezGZmA','session_011XLKayxrANwXMgyySEoRRT'
)
$RangTabelle = @{}
for ($i = 0; $i -lt $Reihenfolge.Count; $i++) { $RangTabelle[$Reihenfolge[$i]] = $i }

function Normalisiere($p) {
    if (-not $p) { return $null }
    $x = [string]$p
    foreach ($a in $AltePfade) { $x = $x.Replace($a, '') }
    if ($x -match '^[A-Za-z]:[\\/]' -or $x -match '^/') { return $null }   # Fremdpfade weglassen
    $x = $x.Replace('/', '\').TrimStart('\')
    if ($x -match '^\.\.' -or $x -match '(^|\\)node_modules(\\|$)') { return $null }
    return $x
}

# Zeilennummern einer Read-Ausgabe abstreifen; gibt auch zurueck, ob sie bei 1 beginnt
function LeseSchnappschuss($text) {
    $zeilen = @{}
    $min = [int]::MaxValue; $max = 0
    foreach ($z in ($text -split "`r?`n")) {
        $m = [regex]::Match($z, '^\s*(\d+)\t(.*)$')
        if (-not $m.Success) { continue }
        $nr = [int]$m.Groups[1].Value
        $zeilen[$nr] = $m.Groups[2].Value
        if ($nr -lt $min) { $min = $nr }
        if ($nr -gt $max) { $max = $nr }
    }
    if ($zeilen.Count -eq 0) { return $null }
    return [PSCustomObject]@{ Zeilen = $zeilen; Von = $min; Bis = $max; Lueckenlos = (($max - $min + 1) -eq $zeilen.Count) }
}

# --- Geschichte je Datei einsammeln -----------------------------------------
Write-Host 'Lese Rohmaterial ...'
$j = Get-Content $Quelle -Raw -Encoding UTF8 | ConvertFrom-Json

$geschichte = @{}
foreach ($s in $j.sitzungen) {
    if (-not $RangTabelle.ContainsKey($s.sid)) { continue }
    $rang = $RangTabelle[$s.sid]
    if (-not $s.tools) { continue }
    $idx = 0
    foreach ($t in $s.tools) {
        $idx++
        if ($t.name -notin @('Write', 'Edit', 'Read')) { continue }
        $pfad = Normalisiere $t.input.file_path
        if (-not $pfad) { continue }
        if (-not $geschichte.ContainsKey($pfad)) { $geschichte[$pfad] = New-Object System.Collections.Generic.List[object] }
        $geschichte[$pfad].Add([PSCustomObject]@{
            Rang = $rang; Idx = $idx; Art = $t.name
            Inhalt = [string]$t.input.content
            Alt = [string]$t.input.old_string
            Neu = [string]$t.input.new_string
            Ergebnis = [string]$t.result
        })
    }
}
Write-Host ("Dateien mit Geschichte: " + $geschichte.Count)

# --- Abspielen ---------------------------------------------------------------
$ergebnisse = @()

foreach ($pfad in ($geschichte.Keys | Sort-Object)) {
    $ereignisse = $geschichte[$pfad] | Sort-Object Rang, Idx

    $stand = $null            # aktueller Dateiinhalt als Zeichenkette
    $quelleStand = ''         # woher der Ausgangsstand kam
    $editsOk = 0; $editsFehl = 0; $writes = 0; $abgleiche = 0
    $letzterSchnapp = $null

    foreach ($e in $ereignisse) {
        switch ($e.Art) {
            'Write' {
                if ($e.Inhalt) { $stand = $e.Inhalt; $writes++; if (-not $quelleStand) { $quelleStand = 'Write' } }
            }
            'Read' {
                $schnapp = LeseSchnappschuss $e.Ergebnis
                if ($schnapp) {
                    $letzterSchnapp = $schnapp
                    # Brauchbar nur, wenn die Ausgabe bei Zeile 1 beginnt und keine Loecher
                    # hat - sonst faengt man mit einem Bruchstueck an.
                    if ($schnapp.Von -eq 1 -and $schnapp.Lueckenlos) {
                        $liste = @()
                        for ($k = 1; $k -le $schnapp.Bis; $k++) { $liste += $schnapp.Zeilen[$k] }
                        $neu = $liste -join "`n"

                        if ($null -eq $stand) {
                            $stand = $neu; $quelleStand = 'Read'
                        }
                        # Eine vollstaendige Leseausgabe ist der beobachtete Stand zu diesem
                        # Zeitpunkt - also verlaesslicher als alles Abgespielte davor. Sie wird
                        # aber nur uebernommen, wenn sie nicht KUERZER ist als der bisherige
                        # Stand: Eine mit Grenze abgeschnittene Ausgabe wuerde sonst den
                        # Dateirest abschneiden.
                        elseif ($schnapp.Bis -ge ($stand -split "`n").Count) {
                            if ($stand -ne $neu) { $abgleiche++ }
                            $stand = $neu
                        }
                    }
                }
            }
            'Edit' {
                if ($null -eq $stand -or -not $e.Alt) { $editsFehl++; break }
                $pos = $stand.IndexOf($e.Alt, [StringComparison]::Ordinal)
                if ($pos -lt 0) {
                    # Auch mit vereinheitlichten Zeilenenden versuchen
                    $altN = $e.Alt.Replace("`r`n", "`n")
                    $pos = $stand.IndexOf($altN, [StringComparison]::Ordinal)
                    if ($pos -ge 0) { $e.Alt = $altN }
                }
                if ($pos -lt 0) { $editsFehl++; break }
                $stand = $stand.Substring(0, $pos) + $e.Neu + $stand.Substring($pos + $e.Alt.Length)
                $editsOk++
            }
        }
    }

    if ($null -eq $stand) { continue }

    # --- Gegen den letzten Schnappschuss pruefen ---
    $abweichungen = 0; $geprueft = 0
    if ($letzterSchnapp) {
        $ist = $stand -split "`r?`n"
        foreach ($nr in $letzterSchnapp.Zeilen.Keys) {
            if ($nr -le $ist.Count) {
                $geprueft++
                if ($ist[$nr - 1] -ne $letzterSchnapp.Zeilen[$nr]) { $abweichungen++ }
            }
        }
    }

    $ziel = Join-Path $Root $pfad
    $ordner = Split-Path $ziel -Parent
    if ($ordner -and -not (Test-Path $ordner)) { New-Item -ItemType Directory -Path $ordner -Force | Out-Null }
    Set-Content -Path $ziel -Value $stand -Encoding UTF8 -NoNewline

    $ergebnisse += [PSCustomObject]@{
        Pfad = $pfad
        Zeilen = ($stand -split "`n").Count
        Basis = $quelleStand
        Writes = $writes
        EditsOk = $editsOk
        EditsFehl = $editsFehl
        Abgleiche = $abgleiche
        Geprueft = $geprueft
        Abweichungen = $abweichungen
        Guete = if ($geprueft -gt 0) { [math]::Round(100.0 * ($geprueft - $abweichungen) / $geprueft, 1) } else { $null }
    }
}

# --- Bericht -----------------------------------------------------------------
$z = New-Object System.Collections.Generic.List[string]
$z.Add('# Waverbreaker - Rekonstruktionsbericht (Abspielverfahren)')
$z.Add('')
$z.Add('Quelle: 21 Sitzungsverlaeufe vom 02. bis 04.08.2026 aus dem Claude-Konto.')
$z.Add('Urspruenglicher Projektpfad: `E:\spiele\Desktop\The Tower`')
$z.Add('')
$z.Add('Verfahren: Die Aenderungsgeschichte jeder Datei wird abgespielt - ein `Write` setzt')
$z.Add('den Stand, jedes `Edit` aendert ihn woertlich. Das entspricht dem, was damals')
$z.Add('tatsaechlich geschah. Am Ende wird das Ergebnis gegen den letzten `Read` geprueft.')
$z.Add('')
$z.Add('**Guete** = Anteil der Zeilen, die mit dem letzten bekannten Schnappschuss')
$z.Add('uebereinstimmen. 100 % heisst: Das Ergebnis ist nachweislich der Originalstand.')
$z.Add('')
$z.Add('| Datei | Zeilen | Basis | Edits ok | Edits offen | geprueft | Guete |')
$z.Add('|---|---:|---|---:|---:|---:|---:|')
foreach ($r in ($ergebnisse | Sort-Object @{e='Guete';d=$false}, Pfad)) {
    $g = if ($null -ne $r.Guete) { "$($r.Guete) %" } else { '-' }
    $z.Add("| ``$($r.Pfad)`` | $($r.Zeilen) | $($r.Basis) | $($r.EditsOk) | $($r.EditsFehl) | $($r.Geprueft) | $g |")
}
$perfekt = @($ergebnisse | Where-Object { $_.Guete -eq 100 }).Count
$ohne = @($ergebnisse | Where-Object { $null -eq $_.Guete }).Count
$z.Add('')
$z.Add("**Summe:** $($ergebnisse.Count) Dateien. Nachweislich original: $perfekt. Ohne Pruefmoeglichkeit: $ohne.")
$z.Add("Edits angewandt: $(($ergebnisse | Measure-Object EditsOk -Sum).Sum), nicht anwendbar: $(($ergebnisse | Measure-Object EditsFehl -Sum).Sum).")
Set-Content -Path $Bericht -Value $z -Encoding UTF8

Write-Host ''
Write-Host ("Dateien geschrieben     : " + $ergebnisse.Count)
Write-Host ("Nachweislich original   : $perfekt")
Write-Host ("Edits angewandt         : " + ($ergebnisse | Measure-Object EditsOk -Sum).Sum)
Write-Host ("Edits nicht anwendbar   : " + ($ergebnisse | Measure-Object EditsFehl -Sum).Sum)
Write-Host ("Bericht                 : $Bericht")
