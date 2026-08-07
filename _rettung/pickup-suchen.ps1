# Sucht die neuere Pickup-Umsetzung (mit pos/value/mean) im Rohmaterial.
$ErrorActionPreference = 'Stop'

$Root = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$Aus  = Join-Path $Root '_rettung\pickup-funde.txt'
$j = Get-Content (Join-Path $Root '_rettung\verlauf\alle-sitzungen.json') -Raw -Encoding UTF8 | ConvertFrom-Json

$z = New-Object System.Collections.Generic.List[string]
$treffer = 0

foreach ($s in $j.sitzungen) {
    $kurz = ($s.sid -replace '^session_', '').Substring(0, 10)
    $i = 0
    foreach ($t in $s.tools) {
        $i++
        $pfad = [string]$t.input.file_path
        foreach ($paar in @(
            @{ T = [string]$t.result;           Q = 'Ergebnis' },
            @{ T = [string]$t.input.content;    Q = 'Write' },
            @{ T = [string]$t.input.new_string; Q = 'Edit-neu' }
        )) {
            $txt = $paar.T
            if ($txt.Length -lt 60) { continue }
            # Nur Stellen, die die NEUE Pickup-Gestalt zeigen
            if ($txt -notmatch 'pickup\.pos|pickup\.value|pickup\.mean|spawnPickups\(') { continue }

            $treffer++
            $zeilen = [regex]::Replace($txt, '(?m)^\s*\d+\t', '') -split "`r?`n"
            for ($k = 0; $k -lt $zeilen.Count; $k++) {
                if ($zeilen[$k] -match 'pickup\.pos|pickup\.value|pickup\.mean|spawnPickups\(|type Pickup') {
                    $von = [Math]::Max(0, $k - 10)
                    $bis = [Math]::Min($zeilen.Count - 1, $k + 40)
                    $z.Add("======== $kurz #$i $($t.name)/$($paar.Q)  $pfad ========")
                    $z.Add(($zeilen[$von..$bis] -join "`n"))
                    $z.Add('')
                    break
                }
            }
        }
    }
}

Set-Content -Path $Aus -Value $z -Encoding UTF8
Write-Host "Fundstellen: $treffer"
Write-Host "Abgelegt in: $Aus"
