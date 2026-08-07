# Zeigt fuer bestimmte Dateien alle Staende im Rohmaterial - welcher ist der beste?
$ErrorActionPreference = 'Stop'

$Root = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$j = Get-Content (Join-Path $Root '_rettung\verlauf\alle-sitzungen.json') -Raw -Encoding UTF8 | ConvertFrom-Json

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

$dateien = @('sim/economy.ts', 'sim/towers.ts', 'sim/enemies.ts', 'data/strings.ts', 'ui/dialogs.ts')

foreach ($ziel in $dateien) {
    Write-Host ''
    Write-Host "=== $ziel ===" -ForegroundColor Cyan
    $zeilen = @()
    foreach ($s in $j.sitzungen) {
        if (-not $RangTabelle.ContainsKey($s.sid)) { continue }
        $rang = $RangTabelle[$s.sid]
        $idx = 0
        foreach ($t in $s.tools) {
            $idx++
            $p = ([string]$t.input.file_path).Replace('\', '/')
            if (-not $p.EndsWith($ziel)) { continue }

            if ($t.name -eq 'Read') {
                $min = [int]::MaxValue; $max = 0; $n = 0
                foreach ($z in ([string]$t.result -split "`r?`n")) {
                    if ($z -match '^\s*(\d+)\t') {
                        $nr = [int]$Matches[1]; $n++
                        if ($nr -lt $min) { $min = $nr }
                        if ($nr -gt $max) { $max = $nr }
                    }
                }
                if ($n -eq 0) { continue }
                $voll = ($min -eq 1 -and ($max - $min + 1) -eq $n)
                $txt = [regex]::Replace([string]$t.result, '(?m)^\s*\d+\t', '')
                $bilanz = ([regex]::Matches($txt, '\{')).Count - ([regex]::Matches($txt, '\}')).Count
                $zeilen += [PSCustomObject]@{ Rang = $rang; Idx = $idx; Art = 'Read'; Von = $min; Bis = $max; Ganz = $voll; Bilanz = $bilanz }
            }
            elseif ($t.name -eq 'Write') {
                $c = [string]$t.input.content
                $bilanz = ([regex]::Matches($c, '\{')).Count - ([regex]::Matches($c, '\}')).Count
                $zeilen += [PSCustomObject]@{ Rang = $rang; Idx = $idx; Art = 'Write'; Von = 1; Bis = ($c -split "`n").Count; Ganz = $true; Bilanz = $bilanz }
            }
            elseif ($t.name -eq 'Edit') {
                $zeilen += [PSCustomObject]@{ Rang = $rang; Idx = $idx; Art = 'Edit'; Von = 0; Bis = 0; Ganz = $false; Bilanz = 0 }
            }
        }
    }
    $zeilen | Sort-Object Rang, Idx | Format-Table -AutoSize | Out-String | Write-Host
    $ist = Join-Path $Root ($ziel.Replace('/', '\'))
    if (Test-Path $ist) {
        Write-Host ("  Rekonstruiert: " + (Get-Content $ist | Measure-Object -Line).Lines + " Zeilen")
    }
}
