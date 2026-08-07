# Vergleicht die rekonstruierte Texttabelle mit dem neuesten Stand aus dem Rohmaterial.
$ErrorActionPreference = 'Stop'

$Root = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$j = Get-Content (Join-Path $Root '_rettung\verlauf\alle-sitzungen.json') -Raw -Encoding UTF8 | ConvertFrom-Json

# Alle Textbausteine aus dem gesamten Rohmaterial einsammeln, spaetere gewinnen.
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

# Schluessel -> @{ wert; rang }
$gefunden = @{}
$muster = "^\s*'([a-zA-Z]+\.[a-zA-Z0-9]+)':\s*'(.*)',?\s*$"

foreach ($s in $j.sitzungen) {
    if (-not $RangTabelle.ContainsKey($s.sid)) { continue }
    $rang = $RangTabelle[$s.sid]
    foreach ($t in $s.tools) {
        foreach ($txt in @([string]$t.result, [string]$t.input.content, [string]$t.input.new_string)) {
            if ($txt.Length -lt 40) { continue }
            # Nur Quellen, die wirklich nach der Texttabelle aussehen
            if ($txt -notmatch "'(hud|view|shop|offer|upgrades)\.") { continue }
            foreach ($z in ($txt -split "`r?`n")) {
                $ohneNr = $z -replace '^\s*\d+\t', ''
                $m = [regex]::Match($ohneNr, $muster)
                if (-not $m.Success) { continue }
                $k = $m.Groups[1].Value
                if (-not $gefunden.ContainsKey($k) -or $gefunden[$k].rang -le $rang) {
                    $gefunden[$k] = @{ wert = $m.Groups[2].Value; rang = $rang }
                }
            }
        }
    }
}

Write-Host ("Schluessel im Rohmaterial gesamt: " + $gefunden.Count)

# Was hat unsere Datei?
$datei = Join-Path $Root 'src\data\strings.ts'
$unsere = @{}
foreach ($z in (Get-Content $datei -Encoding UTF8)) {
    $m = [regex]::Match($z, $muster)
    if ($m.Success) { $unsere[$m.Groups[1].Value] = $m.Groups[2].Value }
}
Write-Host ("Schluessel in unserer Datei     : " + $unsere.Count)
Write-Host ''

$fehlend = @($gefunden.Keys | Where-Object { -not $unsere.ContainsKey($_) } | Sort-Object)
Write-Host ("FEHLEND: " + $fehlend.Count) -ForegroundColor Yellow
foreach ($k in $fehlend) {
    Write-Host ("  '{0}': '{1}'   (aus Rang {2})" -f $k, $gefunden[$k].wert, $gefunden[$k].rang)
}

# Zum Einsetzen vorbereiten
$aus = Join-Path $Root '_rettung\strings-fehlend.txt'
$z = New-Object System.Collections.Generic.List[string]
foreach ($k in $fehlend) { $z.Add(("  '{0}': '{1}'," -f $k, $gefunden[$k].wert)) }
Set-Content -Path $aus -Value $z -Encoding UTF8
Write-Host ''
Write-Host "Zum Einsetzen vorbereitet: $aus"
