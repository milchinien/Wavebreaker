# ============================================================================
#  Waverbreaker - Projekt aus den Sitzungsverlaeufen zusammensetzen
# ----------------------------------------------------------------------------
#  Liest _rettung\verlauf\alle-sitzungen.json (21 Sitzungen vom 02.-04.08.2026)
#  und baut daraus den Quellbaum.
#
#  Wichtig: Die Sitzungen laufen ueber drei Tage. Zeilen werden deshalb
#  chronologisch ueberlagert - der zeitlich spaeteste Stand gewinnt. Sonst
#  entstuende aus alten und neuen Staenden eine Datei, die es nie gab.
# ============================================================================

$ErrorActionPreference = 'Stop'

$Root       = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$VerlaufDir = Join-Path $Root '_rettung\verlauf'
$BashDir    = Join-Path $Root '_rettung\bash-ausgaben'
$Bericht    = Join-Path $Root '_rettung\BERICHT.md'
$AltePfade  = @('E:\spiele\Desktop\The Tower\', 'E:/spiele/Desktop/The Tower/',
                '/e/spiele/Desktop/The Tower/', 'E:\\spiele\\Desktop\\The Tower\\')

# Chronologische Reihenfolge der Sitzungen (nach Anlagedatum)
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

if (-not (Test-Path $BashDir)) { New-Item -ItemType Directory -Path $BashDir -Force | Out-Null }

function Normalisiere($p) {
    if (-not $p) { return $null }
    $x = [string]$p
    foreach ($a in $AltePfade) { $x = $x.Replace($a, '') }
    $x = $x -replace '^[A-Za-z]:[\\/]', ''
    $x = $x.Replace('/', '\').TrimStart('\')
    if ($x -match '^\.\.') { return $null }
    return $x
}

# Pfad -> @{ Zeilennummer -> @{ text; rang } }
$dateien = @{}
$edits   = @{}
$statistik = @{ Read = 0; Write = 0; Edit = 0; Bash = 0; Sonstige = 0 }

function SetzeZeile($pfad, $nr, $text, $rang) {
    if (-not $dateien.ContainsKey($pfad)) { $dateien[$pfad] = @{} }
    $d = $dateien[$pfad]
    # Spaeterer Stand gewinnt; bei gleichem Rang die laengere Zeile (abgeschnittene meiden)
    if (-not $d.ContainsKey($nr) -or $d[$nr].rang -lt $rang -or
        ($d[$nr].rang -eq $rang -and $d[$nr].text.Length -lt $text.Length)) {
        $d[$nr] = @{ text = $text; rang = $rang }
    }
}

$quelle = Join-Path $VerlaufDir 'alle-sitzungen.json'
Write-Host "Lese $quelle ..."
$j = Get-Content $quelle -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host ("Sitzungen: " + $j.sitzungen.Count)

foreach ($s in $j.sitzungen) {
    $rang = if ($RangTabelle.ContainsKey($s.sid)) { $RangTabelle[$s.sid] } else { 99 }
    if (-not $s.tools) { continue }

    foreach ($tool in $s.tools) {
        switch ($tool.name) {
            'Read' {
                $statistik.Read++
                $pfad = Normalisiere $tool.input.file_path
                if (-not $pfad) { break }
                foreach ($zeile in ($tool.result -split "`r?`n")) {
                    $m = [regex]::Match($zeile, '^\s*(\d+)\t(.*)$')
                    if ($m.Success) { SetzeZeile $pfad ([int]$m.Groups[1].Value) $m.Groups[2].Value $rang }
                }
            }
            'Write' {
                $statistik.Write++
                $pfad = Normalisiere $tool.input.file_path
                if (-not $pfad -or -not $tool.input.content) { break }
                $nr = 1
                foreach ($z in ($tool.input.content -split "`r?`n")) { SetzeZeile $pfad $nr $z $rang; $nr++ }
            }
            'Edit' {
                $statistik.Edit++
                $pfad = Normalisiere $tool.input.file_path
                if (-not $pfad) { break }
                if (-not $edits.ContainsKey($pfad)) { $edits[$pfad] = @() }
                $edits[$pfad] += [PSCustomObject]@{
                    Rang = $rang; Sid = $s.sid
                    Alt = [string]$tool.input.old_string
                    Neu = [string]$tool.input.new_string
                }
            }
            'Bash' {
                $statistik.Bash++
                $cmd = [string]$tool.input.command
                if ($cmd -match '(?:^|&&|;|\|)\s*cat\s+["'']?([^"''|>&;]+\.(?:ts|tsx|js|mjs|json|html|css|md))["'']?') {
                    $p = Normalisiere $Matches[1].Trim()
                    if ($p -and $tool.result -and $tool.result.Length -gt 20) {
                        $ziel = Join-Path $BashDir (($p -replace '[\\/:]', '_') + ".r$rang.txt")
                        Set-Content -Path $ziel -Value $tool.result -Encoding UTF8
                    }
                }
            }
            default { $statistik.Sonstige++ }
        }
    }
}

# --- Dateien schreiben -------------------------------------------------------
$zeilen = New-Object System.Collections.Generic.List[string]
$zeilen.Add("# Waverbreaker - Rekonstruktionsbericht")
$zeilen.Add("")
$zeilen.Add("Quelle: 21 Sitzungsverlaeufe vom 02. bis 04.08.2026, abgerufen aus dem Claude-Konto.")
$zeilen.Add("Urspruenglicher Projektpfad: ``E:\spiele\Desktop\The Tower``")
$zeilen.Add("")
$zeilen.Add("Werkzeugaufrufe ausgewertet: Read $($statistik.Read), Write $($statistik.Write), Edit $($statistik.Edit), Bash $($statistik.Bash)")
$zeilen.Add("")
$zeilen.Add("**Lesehinweis:** Die Sitzungen laufen ueber drei Tage. Zeilen wurden chronologisch")
$zeilen.Add("ueberlagert - der zeitlich spaeteste bekannte Stand gewinnt. Wo Zeilen fehlen, steht")
$zeilen.Add("eine Markierung ``### FEHLENDE ZEILE n ###`` im Quelltext.")
$zeilen.Add("")
$zeilen.Add("| Datei | Zeilen | Luecken | vollstaendig |")
$zeilen.Add("|---|---:|---:|---|")

$geschrieben = 0; $vollstaendig = 0; $gesamtZeilen = 0; $gesamtLuecken = 0
$ergebnisse = @()

foreach ($pfad in ($dateien.Keys | Sort-Object)) {
    $map = $dateien[$pfad]
    if ($map.Count -eq 0) { continue }
    if ($pfad -match '(^|\\)node_modules(\\|$)') { continue }

    $max = ($map.Keys | Measure-Object -Maximum).Maximum
    $inhalt = New-Object System.Collections.Generic.List[string]
    $luecken = 0
    for ($i = 1; $i -le $max; $i++) {
        if ($map.ContainsKey($i)) { $inhalt.Add($map[$i].text) }
        else { $inhalt.Add("/* ### FEHLENDE ZEILE $i ### */"); $luecken++ }
    }

    $ziel = Join-Path $Root $pfad
    $ordner = Split-Path $ziel -Parent
    if ($ordner -and -not (Test-Path $ordner)) { New-Item -ItemType Directory -Path $ordner -Force | Out-Null }
    Set-Content -Path $ziel -Value $inhalt -Encoding UTF8
    $geschrieben++
    $gesamtZeilen += $max; $gesamtLuecken += $luecken
    if ($luecken -eq 0) { $vollstaendig++ }
    $ergebnisse += [PSCustomObject]@{ Pfad = $pfad; Zeilen = $max; Luecken = $luecken }
}

foreach ($e in ($ergebnisse | Sort-Object Luecken, @{e='Zeilen';d=$true})) {
    $voll = if ($e.Luecken -eq 0) { 'ja' } else { 'nein' }
    $zeilen.Add("| ``$($e.Pfad)`` | $($e.Zeilen) | $($e.Luecken) | $voll |")
}

$zeilen.Add("")
$zeilen.Add("**Summe:** $geschrieben Dateien, davon $vollstaendig lueckenlos. $gesamtZeilen Zeilen, davon $gesamtLuecken fehlend.")

if ($edits.Count -gt 0) {
    $zeilen.Add("")
    $zeilen.Add("## Aenderungen aus Edit-Aufrufen")
    $zeilen.Add("")
    $zeilen.Add("Diese Aenderungen stehen im Verlauf und koennen fehlende Stellen fuellen.")
    $zeilen.Add("")
    foreach ($p in ($edits.Keys | Sort-Object)) {
        $zeilen.Add("### ``$p`` ($($edits[$p].Count) Aenderungen)")
        $zeilen.Add("")
        foreach ($e in ($edits[$p] | Sort-Object Rang)) {
            $zeilen.Add('```diff')
            foreach ($z in ($e.Alt -split "`r?`n")) { $zeilen.Add("- $z") }
            foreach ($z in ($e.Neu -split "`r?`n")) { $zeilen.Add("+ $z") }
            $zeilen.Add('```')
            $zeilen.Add("")
        }
    }
}

Set-Content -Path $Bericht -Value $zeilen -Encoding UTF8

Write-Host ""
Write-Host "Geschriebene Dateien : $geschrieben  (lueckenlos: $vollstaendig)"
Write-Host "Zeilen gesamt        : $gesamtZeilen  (fehlend: $gesamtLuecken)"
Write-Host "Bericht              : $Bericht"
