@echo off
setlocal enabledelayedexpansion

echo =====================================================
echo  PREPARE FOR DEEPSEEK - All-in-one script
echo  Step 1: Generate FILE_STRUCTURE.md (project tree)
echo  Step 2: Copy code files to tmp/ (flat)
echo =====================================================
echo.

REM Get the current directory (folder this .bat lives in)
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM ====================================================================
REM  STEP 1: GENERATE FILE_STRUCTURE.md
REM ====================================================================
echo [STEP 1] Generating FILE_STRUCTURE.md ...
echo.

set "OUTPUT_FILE=FILE_STRUCTURE.md"
set "EXCLUDE_FOLDERS=.git .agents"
set "MAX_DEPTH=10"

set "TEMP_SCRIPT=%~dp0temp_tree.ps1"

REM Extract the embedded PowerShell script (between ::PS_BEGIN and ::PS_END)
set "in=0"
(for /f "usebackq delims=" %%a in ("%~f0") do (
    set "line=%%a"
    if "!line!"=="::PS_BEGIN" set "in=1"
    if "!line!"=="::PS_END" set "in=0"
    if !in! equ 1 if not "!line!"=="::PS_BEGIN" echo(!line!
)) > "%TEMP_SCRIPT%"

REM Check if extraction succeeded
for %%A in ("%TEMP_SCRIPT%") do if %%~zA equ 0 (
    echo ERROR: Temporary script is empty. Extraction failed.
    pause
    exit /b 1
)

echo Running PowerShell to build tree...
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP_SCRIPT%" -OutputFile "%OUTPUT_FILE%" -ExcludeFolders "%EXCLUDE_FOLDERS%" -MaxDepth %MAX_DEPTH%

if exist "%OUTPUT_FILE%" (
    for %%A in ("%OUTPUT_FILE%") do if %%~zA gtr 0 (
        echo   FILE_STRUCTURE.md generated successfully.
    ) else (
        echo   WARNING: FILE_STRUCTURE.md is empty.
    )
) else (
    echo   WARNING: FILE_STRUCTURE.md was not created.
)

del "%TEMP_SCRIPT%" >nul 2>&1

echo.
echo [STEP 1] Done.
echo.

REM ====================================================================
REM  STEP 2: COPY CODE FILES TO tmp/ (FLAT)
REM ====================================================================
echo [STEP 2] Copying code files to tmp/ ...
echo.

REM 1. Delete old tmp folder
if exist tmp (
    echo   Removing old tmp folder...
    rmdir /s /q tmp
)

REM 2. Create fresh tmp folder
mkdir tmp
if not exist tmp (
    echo ERROR: Could not create tmp folder!
    pause
    exit /b 1
)

set "PROJECT_ROOT=%CD%"
echo   Scanning files from: %PROJECT_ROOT%
echo.

REM === Which extensions count as "code" ===
set "CODE_EXTS=.php .js .css .html"

REM === Folders to SKIP are defined in the findstr patterns below ===

set "file_count=0"
set "skip_count=0"

REM Temp file to log skipped files for the preview at the end
set "skip_log=%TEMP%\copy_tmp_skipped_%RANDOM%.txt"
if exist "%skip_log%" del "%skip_log%"
type nul > "%skip_log%"

echo   --- Copied files ---
REM Walk through ALL files recursively
for /r %%F in (*) do (
    set "filepath=%%F"
    set "filename=%%~nxF"
    set "ext=%%~xF"
    set "skip=0"
    set "skip_reason="

    REM --- Check if extension is in the whitelist ---
    set "is_code=0"
    for %%E in (%CODE_EXTS%) do (
        if /i "%%~xF"=="%%E" set "is_code=1"
    )

    if "!is_code!"=="0" (
        set "skip=1"
        set "skip_reason=not code ext (!ext!)"
    )

    REM --- Check if file is inside a skipped folder ---
    REM   Get relative path then check each skip name as a path segment
    if "!skip!"=="0" (
        set "relpath=!filepath:%PROJECT_ROOT%\=!"
                        :: main folder skips
        echo !relpath! | findstr /i /r "^archive\\ ^\.git\\ ^\.github\\ ^\.agents\\ ^tmp\\ ^journal\\ ^data\\ ^deploy\\ ^versions\\" >nul 2>&1
        if not errorlevel 1 (
            set "skip=1"
            for /f "tokens=1 delims=\" %%D in ("!relpath!") do set "skip_reason=in skipped folder: %%D"
        )
    )

    if "!skip!"=="0" ( :: sub folder skips.
        echo !relpath! | findstr /i /r "\\archive\\ \\parsedown\\ \\icons\\ \\__pycache__\\ \\.venv\\ \\server-logs\\ \\trash\\ \\previous-version\\ \\tmp\\" >nul 2>&1
        if not errorlevel 1 (
            set "skip=1"
            set "skip_reason=in skipped subfolder"
        )
    )

    if "!skip!"=="1" (
        set /a skip_count+=1
        set "relpath=!filepath:%PROJECT_ROOT%\=!"
        echo   !relpath!  [!skip_reason!]>> "%skip_log%"
    ) else (
        REM --- Copy to tmp/ ---
        if exist "tmp\!filename!" (
            REM Duplicate name - prefix with parent folder
            for %%P in ("%%~dpF.") do set "parentname=%%~nxP"
            set "destname=!parentname!--!filename!"
            copy "%%F" "tmp\!destname!" >nul 2>&1
            if !errorlevel! equ 0 (
                set /a file_count+=1
                echo     !destname!  ^(from !filename!^)
            ) else (
                echo     WARNING: Failed to copy %%F
            )
        ) else (
            copy "%%F" "tmp\!filename!" >nul 2>&1
            if !errorlevel! equ 0 (
                set /a file_count+=1
                echo     !filename!
            ) else (
                echo     WARNING: Failed to copy %%F
            )
        )
    )
)

REM 3. Also copy FILE_STRUCTURE.md into tmp/
if exist "%OUTPUT_FILE%" (
    copy "%OUTPUT_FILE%" "tmp\%OUTPUT_FILE%" >nul 2>&1
    if !errorlevel! equ 0 (
        set /a file_count+=1
        echo     %OUTPUT_FILE%  ^(project tree^)
    )
)

echo.
echo   --- Skipped files ---
type "%skip_log%"
del "%skip_log%" >nul 2>&1

echo.
echo =====================================================
echo  ALL DONE!
echo -----------------------------------------------------
echo  FILE_STRUCTURE.md:  generated
echo  Code files copied:  %file_count%
echo  Files skipped:      %skip_count%
echo =====================================================
echo.

REM 4. Open tmp folder
echo Opening tmp folder in Explorer...
start explorer tmp
echo.
pause
exit /b

::PS_BEGIN
# PowerShell script - embedded between markers
param(
    [string]$OutputFile = "FILE_STRUCTURE.md",
    [string]$ExcludeFolders = ".git .agents",
    [int]$MaxDepth = 10
)

$rootDir = Get-Location
Write-Host "Processing: $rootDir"

# Build exclusion sets (case-insensitive)
$excludeFoldersArray = $ExcludeFolders -split ' '
$summaryFolders = @('__pycache__', '.pytest_cache', '.ruff_cache')
$excludeSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($name in ($excludeFoldersArray + $OutputFile)) { $excludeSet.Add($name) | Out-Null }
$summarySet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($name in $summaryFolders) { $summarySet.Add($name) | Out-Null }

# Human-readable file size
function Get-FileSize($bytes) {
    if ($bytes -ge 1TB) { "{0:N2} TB" -f ($bytes / 1TB) }
    elseif ($bytes -ge 1GB) { "{0:N2} GB" -f ($bytes / 1GB) }
    elseif ($bytes -ge 1MB) { "{0:N2} MB" -f ($bytes / 1MB) }
    elseif ($bytes -ge 1KB) { "{0:N2} KB" -f ($bytes / 1KB) }
    else { "$bytes B" }
}

# Tree characters as ASCII codes (safe for plain-text embedding)
$script:dirCount = 0
$script:fileCount = 0
$script:treeLines = @()

function Get-Tree {
    param([string]$path, [string]$indent = "", [int]$depth = 0)
    if ($depth -gt $MaxDepth) { return }

    $items = Get-ChildItem -Path $path -Force | Sort-Object { $_.PSIsContainer }, Name
    $count = $items.Count
    $index = 0
    foreach ($item in $items) {
        $index++
        $isLast = ($index -eq $count)
        $prefix = if ($isLast) { "$([char]0x2514)$([char]0x2500)$([char]0x2500) " } else { "$([char]0x251C)$([char]0x2500)$([char]0x2500) " }
        $linePrefix = if ($isLast) { "    " } else { "$([char]0x2502)   " }

        if ($excludeSet.Contains($item.Name)) { continue }

        if ($item.PSIsContainer -and $summarySet.Contains($item.Name)) {
            $script:treeLines += "$indent$prefix$($item.Name)/ (summary: compiled/pycache)"
            $script:dirCount++
            continue
        }

        $line = "$indent$prefix$($item.Name)"
        if ($item.PSIsContainer) {
            $line += "/"
            $script:treeLines += $line
            $script:dirCount++
            $newIndent = $indent + $linePrefix
            Get-Tree $item.FullName $newIndent ($depth + 1)
        } else {
            $size = Get-FileSize $item.Length
            $line += " ($size)"
            $script:treeLines += $line
            $script:fileCount++
        }
    }
}

# First, traverse the tree to collect lines and counts
Get-Tree $rootDir

# Now build the header with correct counts
$header = @"
# Repository file structure

Generated: $(Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')

A cleaner, hierarchical view of the repository. Directories end with '/'.
Cache folders ($($summaryFolders -join ', ')) are summarised.
Excluded: $($excludeFoldersArray -join ', '), $OutputFile.

## Summary
- Directories: $($script:dirCount)
- Files: $($script:fileCount)

## Tree
"@

# Write header and tree lines
$header | Out-File -Encoding UTF8 $OutputFile
$script:treeLines | Out-File -Append -Encoding UTF8 $OutputFile

Write-Host "Done. Directories: $($script:dirCount), Files: $($script:fileCount)"
::PS_END
