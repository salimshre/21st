@echo off
REM Update FILE_STRUCTURE.md with current project structure
REM This script generates and updates the file structure documentation

setlocal enabledelayedexpansion

cd /d "%~dp0"

echo.
echo ========================================
echo  Updating FILE_STRUCTURE.md
echo ========================================
echo.

REM Run PowerShell script to generate tree structure
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
"$ErrorActionPreference = 'Continue'; ^
function Get-TreeStructure { ^
    param([string]$Path, [string]$Indent = '', [int]$MaxDepth = 10, [int]$CurrentDepth = 0); ^
    if ($CurrentDepth -ge $MaxDepth) { return }; ^
    try { ^
        $items = Get-ChildItem -Path $Path -Force -ErrorAction SilentlyContinue | Sort-Object -Property @{Expression = {-$_.PSIsContainer}}, @{Expression = {$_.Name}} ^
    } catch { ^
        return ^
    }; ^
    for ($i = 0; $i -lt $items.Count; $i++) { ^
        $item = $items[$i]; ^
        $isLastItem = ($i -eq $items.Count - 1); ^
        if ($isLastItem) { ^
            $branch = '└── '; ^
            $nextIndent = $Indent + '    ' ^
        } else { ^
            $branch = '├── '; ^
            $nextIndent = $Indent + '│   ' ^
        }; ^
        if ($item.PSIsContainer) { ^
            Write-Output ('$Indent$branch$($item.Name)/') ^
        } else { ^
            Write-Output ('$Indent$branch$($item.Name)') ^
        }; ^
        if ($item.PSIsContainer -and $item.Name -ne '.git' -and $item.Name -ne '.agents') { ^
            Get-TreeStructure -Path $item.FullName -Indent $nextIndent -MaxDepth $MaxDepth -CurrentDepth ($CurrentDepth + 1) ^
        } ^
    } ^
}; ^
$rootPath = Get-Location; ^
$outputPath = Join-Path $rootPath 'FILE_STRUCTURE.md'; ^
$lines = @(); ^
$lines += '# File Structure - Challenges App'; ^
$lines += ''; ^
$lines += ('Project: ' + $rootPath); ^
$lines += ''; ^
$lines += ('Last Updated: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')); ^
$lines += ''; ^
$lines += '---'; ^
$lines += ''; ^
$lines += 'challenges-app/'; ^
$tree = Get-TreeStructure -Path $rootPath -MaxDepth 10; ^
$lines += $tree; ^
$lines += ''; ^
$lines += '---'; ^
$lines += ''; ^
$lines += 'Legend:'; ^
$lines += '  / = Directory'; ^
$lines += '  (no symbol) = File'; ^
$lines += '  ├── = Item with more below'; ^
$lines += '  └── = Last item'; ^
$content = $lines -join [Environment]::NewLine; ^
$content | Out-File -FilePath $outputPath -Encoding UTF8; ^
Write-Output '✅ FILE_STRUCTURE.md updated successfully!'; ^
Write-Output ('📄 File: ' + $outputPath)"

echo.
echo ========================================
echo  Update Complete!
echo ========================================
echo.
echo Next time, simply run: update-file-structure.bat
echo.

pause
