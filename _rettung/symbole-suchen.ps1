# Sucht die Definitionen fehlender Bezeichner im gesamten Sitzungsmaterial.
$ErrorActionPreference = 'Stop'

$Root   = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$Quelle = Join-Path $Root '_rettung\verlauf\alle-sitzungen.json'
$Aus    = Join-Path $Root '_rettung\symbole'

$gesucht = @(
  'drawBursts', 'drawGains', 'drawHits', 'drawMuzzles', 'drawShards',
  'meanCoinValue', 'rangeCircles', 'stationRange', 'RangeCircle', 'SPIN_MAX',
  'towerHint', 'upgrades.tipTitle', 'upgrades.tipLevel', 'offer.hint'
)

if (Test-Path $Aus) { Remove-Item -LiteralPath $Aus -Recurse -Force }
New-Item -ItemType Directory -Path $Aus -Force | Out-Null

Write-Host 'Lese Rohmaterial ...'
$j = Get-Content $Quelle -Raw -Encoding UTF8 | ConvertFrom-Json

# Korpus aufbauen: jeder Text mit seiner Herkunft
$korpus = New-Object System.Collections.Generic.List[object]
foreach ($s in $j.sitzungen) {
    $kurz = ($s.sid -replace '^session_', '').Substring(0, 10)
    if (-not $s.tools) { continue }
    $i = 0
    foreach ($t in $s.tools) {
        $i++
        $pfad = [string]$t.input.file_path
        foreach ($paar in @(
            @{ T = [string]$t.result;             Q = 'Ergebnis' },
            @{ T = [string]$t.input.content;      Q = 'Write' },
            @{ T = [string]$t.input.new_string;   Q = 'Edit-neu' },
            @{ T = [string]$t.input.old_string;   Q = 'Edit-alt' }
        )) {
            if ($paar.T.Length -lt 20) { continue }
            $korpus.Add([PSCustomObject]@{
                Text = [regex]::Replace($paar.T, '(?m)^\s*\d+\t', '')
                Herkunft = "$kurz #$i $($t.name)/$($paar.Q) $pfad"
            })
        }
    }
}
Write-Host ("Korpuseintraege: " + $korpus.Count)
Write-Host ''

foreach ($sym in $gesucht) {
    # Definitionsstellen bevorzugt, sonst jede Erwaehnung
    $definition = "(export\s+)?(function|const|type|interface)\s+" + [regex]::Escape($sym) + "\b"
    $treffer = New-Object System.Collections.Generic.List[object]

    foreach ($e in $korpus) {
        if ($e.Text.IndexOf($sym, [StringComparison]::Ordinal) -lt 0) { continue }
        $istDef = [regex]::IsMatch($e.Text, $definition)
        $treffer.Add([PSCustomObject]@{ Herkunft = $e.Herkunft; Def = $istDef; Text = $e.Text })
    }

    $defs = @($treffer | Where-Object { $_.Def })
    $status = if ($defs.Count -gt 0) { "DEFINITION gefunden ($($defs.Count)x)" }
              elseif ($treffer.Count -gt 0) { "nur erwaehnt ($($treffer.Count)x)" }
              else { 'NICHT gefunden' }
    $farbe = if ($defs.Count -gt 0) { 'Green' } elseif ($treffer.Count -gt 0) { 'Yellow' } else { 'Red' }
    Write-Host ("{0,-20} {1}" -f $sym, $status) -ForegroundColor $farbe

    $z = New-Object System.Collections.Generic.List[string]
    $z.Add("Gesucht: $sym")
    $z.Add("Erwaehnungen: $($treffer.Count), davon Definitionen: $($defs.Count)")
    $z.Add('')
    $auswahl = if ($defs.Count -gt 0) { $defs | Select-Object -First 3 } else { $treffer | Select-Object -First 3 }
    foreach ($t in $auswahl) {
        $z.Add("======== $($t.Herkunft) ========")
        # Fundstelle mit Umgebung
        $zeilen = $t.Text -split "`r?`n"
        for ($k = 0; $k -lt $zeilen.Count; $k++) {
            if ($zeilen[$k].IndexOf($sym, [StringComparison]::Ordinal) -ge 0) {
                $von = [Math]::Max(0, $k - 6)
                $bis = [Math]::Min($zeilen.Count - 1, $k + 60)
                $z.Add(($zeilen[$von..$bis] -join "`n"))
                $z.Add('   ...')
                break
            }
        }
        $z.Add('')
    }
    Set-Content -Path (Join-Path $Aus ("$($sym -replace '[^A-Za-z0-9]','_').txt")) -Value $z -Encoding UTF8
}

Write-Host ''
Write-Host "Einzelheiten in: $Aus"
