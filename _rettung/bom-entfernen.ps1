# ============================================================================
#  Byte-Order-Mark aus allen rekonstruierten Dateien entfernen
# ----------------------------------------------------------------------------
#  Windows PowerShell schreibt mit "-Encoding UTF8" ein BOM an den Dateianfang.
#  JSON-Parser stolpern darueber ("Unexpected token '\ufeff'"), und in Quelldateien
#  hat es ohnehin nichts verloren. Die Originaldateien hatten keines.
# ============================================================================

$ErrorActionPreference = 'Stop'

$Root = 'D:\Projects\Claude\Desktop\Games\Wavebreaker'
$ohneBom = New-Object System.Text.UTF8Encoding($false)

$dateien = Get-ChildItem $Root -Recurse -File -Force |
    Where-Object {
        $_.FullName -notmatch '\\(node_modules|\.git)\\' -and
        $_.Extension -match '^\.(ts|tsx|js|mjs|cjs|json|html|css|md|txt|ps1|gitignore|gitattributes)$' -or
        $_.Name -in @('.gitignore', '.gitattributes')
    }

$geaendert = 0
foreach ($f in $dateien) {
    if ($f.FullName -match '\\(node_modules|\.git)\\') { continue }
    $bytes = [IO.File]::ReadAllBytes($f.FullName)
    if ($bytes.Length -lt 3) { continue }
    if ($bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) { continue }

    $text = [Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    [IO.File]::WriteAllText($f.FullName, $text, $ohneBom)
    $geaendert++
}

Write-Host "Dateien ohne BOM neu geschrieben: $geaendert"

# Gegenprobe
$rest = 0
foreach ($f in $dateien) {
    if ($f.FullName -match '\\(node_modules|\.git)\\') { continue }
    $b = [IO.File]::ReadAllBytes($f.FullName)
    if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { $rest++ }
}
Write-Host "Noch mit BOM: $rest"
