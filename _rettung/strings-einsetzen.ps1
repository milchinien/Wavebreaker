# Setzt die fehlenden Textbausteine in src/data/strings.ts ein.
# Jeder Schluessel kommt hinter den letzten vorhandenen seiner Gruppe; gibt es die
# Gruppe noch nicht, kommt sie als eigener Block ans Ende der Tabelle.
$ErrorActionPreference = 'Stop'

$Root  = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$Datei = Join-Path $Root 'src\data\strings.ts'
$Liste = Join-Path $Root '_rettung\strings-fehlend.txt'

$zeilen = [System.Collections.Generic.List[string]](Get-Content $Datei -Encoding UTF8)
$neue = @(Get-Content $Liste -Encoding UTF8 | Where-Object { $_.Trim().Length -gt 0 })

# Ende der Tabelle: die Zeile "} as const"
$tabellenEnde = -1
for ($i = 0; $i -lt $zeilen.Count; $i++) {
    if ($zeilen[$i] -match '^\} as const') { $tabellenEnde = $i; break }
}
if ($tabellenEnde -lt 0) { throw 'Tabellenende nicht gefunden.' }

$eingefuegt = 0
$neueGruppen = New-Object System.Collections.Generic.List[string]

foreach ($eintrag in $neue) {
    $m = [regex]::Match($eintrag, "^\s*'([a-zA-Z]+)\.")
    if (-not $m.Success) { continue }
    $gruppe = $m.Groups[1].Value

    # Letzte Zeile derselben Gruppe suchen - aber nur innerhalb der Tabelle
    $letzte = -1
    for ($i = 0; $i -lt $tabellenEnde; $i++) {
        if ($zeilen[$i] -match ("^\s*'" + [regex]::Escape($gruppe) + "\.")) { $letzte = $i }
    }

    if ($letzte -ge 0) {
        $zeilen.Insert($letzte + 1, $eintrag)
        $tabellenEnde++
        $eingefuegt++
        Write-Host ("  eingefuegt hinter Zeile {0}: {1}" -f ($letzte + 1), $eintrag.Trim()) -ForegroundColor Green
    } else {
        $neueGruppen.Add($eintrag)
        Write-Host ("  neue Gruppe: {0}" -f $eintrag.Trim()) -ForegroundColor Yellow
    }
}

if ($neueGruppen.Count -gt 0) {
    $block = New-Object System.Collections.Generic.List[string]
    $block.Add('')
    $block.Add('  // [REKONSTRUIERT] Gruppe fehlte in der rekonstruierten Tabelle. Schluessel und')
    $block.Add('  // Texte stammen woertlich aus dem Sitzungsmaterial, nicht aus eigener Erfindung.')
    foreach ($e in $neueGruppen) { $block.Add($e) }
    for ($k = $block.Count - 1; $k -ge 0; $k--) { $zeilen.Insert($tabellenEnde, $block[$k]) }
    $eingefuegt += $neueGruppen.Count
}

$ohneBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($Datei, ($zeilen -join "`n"), $ohneBom)

Write-Host ''
Write-Host "Eingefuegt: $eingefuegt Textbausteine"
Write-Host ("Datei hat jetzt " + $zeilen.Count + " Zeilen")
