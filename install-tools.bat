@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: ATP Installation Wizard - Standalone Tools Installer
:: Source of tool definitions: src/main/lib/system.ts
::
:: Tools managed:
::   1. Node.js (v22)                 - OpenJS.NodeJS.22
::   2. Git                           - Git.Git
::   3. Yarn                          - Yarn.Yarn
::   4. PostgreSQL                    - PostgreSQL.PostgreSQL.16
::   5. AWS CLI                       - Amazon.AWSCLI
::   6. Visual C++ Build Environment  - Microsoft.VisualStudio.2022.BuildTools
::   7. Python 3.11                   - Python.Python.3.11
:: ============================================================================

set "SCRIPT_NAME=%~nx0"
set "SCRIPT_DIR=%~dp0"
set "PF86=%ProgramFiles(x86)%"
if not defined PF86 set "PF86=C:\Program Files (x86)"
set "PF64=%ProgramFiles%"
if not defined PF64 set "PF64=C:\Program Files"

:: Default execution options
set "MODE_CHECK_ONLY=0"
set "MODE_AUTO_YES=0"
set "MODE_SKIP_CHECKOUT=0"
set "MODE_SKIP_AWS=0"
set "MODE_NO_START=0"
set "NO_PAUSE=0"
set "NO_ELEVATE=0"
set "CLI_INSTALL_DIR="
set "CLI_AWS_KEY="
set "CLI_AWS_SECRET="
set "CLI_AWS_REGION="

:: ----------------------------------------------------------------------------
:: Parse Command Line Arguments
:: ----------------------------------------------------------------------------
:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--check" (
    set "MODE_CHECK_ONLY=1"
    set "NO_PAUSE=1"
    shift
    goto :parse_args
)
if /i "%~1"=="-c" (
    set "MODE_CHECK_ONLY=1"
    set "NO_PAUSE=1"
    shift
    goto :parse_args
)
if /i "%~1"=="/check" (
    set "MODE_CHECK_ONLY=1"
    set "NO_PAUSE=1"
    shift
    goto :parse_args
)
if /i "%~1"=="-y" (
    set "MODE_AUTO_YES=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--yes" (
    set "MODE_AUTO_YES=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--no-pause" (
    set "NO_PAUSE=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--no-elevate" (
    set "NO_ELEVATE=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--skip-checkout" (
    set "MODE_SKIP_CHECKOUT=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--tools-only" (
    set "MODE_SKIP_CHECKOUT=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--skip-aws" (
    set "MODE_SKIP_AWS=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--aws-key" (
    set "CLI_AWS_KEY=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--aws-secret" (
    set "CLI_AWS_SECRET=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--aws-region" (
    set "CLI_AWS_REGION=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--no-start" (
    set "MODE_NO_START=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--skip-start" (
    set "MODE_NO_START=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--dir" (
    set "CLI_INSTALL_DIR=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--dest" (
    set "CLI_INSTALL_DIR=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="-d" (
    set "CLI_INSTALL_DIR=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--help" (
    set "NO_PAUSE=1"
    goto :show_help
)
if /i "%~1"=="-h" (
    set "NO_PAUSE=1"
    goto :show_help
)
if /i "%~1"=="/?" (
    set "NO_PAUSE=1"
    goto :show_help
)

echo [!] Unknown argument: %~1
echo Use --help or -h for usage instructions.
echo.
set "EXIT_CODE=1"
goto :script_exit

:args_done

:: ----------------------------------------------------------------------------
:: Administrative Privileges Check & Self-Elevation
:: ----------------------------------------------------------------------------
net session >nul 2>&1
if %errorlevel% neq 0 (
    if "%MODE_CHECK_ONLY%"=="1" goto :skip_elevation
    if "%NO_ELEVATE%"=="1" goto :skip_elevation

    echo [INFO] Administrator rights are recommended to install developer packages.
    echo [INFO] Requesting elevation...
    
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\" %*\"' -Verb RunAs" 2>nul
    if %errorlevel% equ 0 (
        exit /b 0
    )
    
    echo [WARN] UAC elevation was declined or unavailable.
    echo        Continuing without Administrator privileges. Some package installations
    echo        such as Visual C++ Build Tools or PostgreSQL may fail or prompt separately.
    echo.
)
:skip_elevation

:: ----------------------------------------------------------------------------
:: Banner Display
:: ----------------------------------------------------------------------------
echo ==============================================================================
echo                 ATP INSTALLATION WIZARD - PREREQUISITE TOOLS
echo ==============================================================================
echo  Tool definitions loaded from src/main/lib/system.ts
echo.

:: ----------------------------------------------------------------------------
:: Check for Windows Package Manager (winget)
:: ----------------------------------------------------------------------------
set "WINGET_VER="
for /f "tokens=*" %%w in ('winget --version 2^>nul') do set "WINGET_VER=%%w"
if not defined WINGET_VER (
    echo [ERROR] Windows Package Manager [winget] was not found on this system!
    echo.
    echo winget is required to automatically install missing tools.
    echo To install winget:
    echo   1. Install 'App Installer' from the Microsoft Store:
    echo      https://aka.ms/getwinget
    echo   2. Or download the latest msixbundle from GitHub:
    echo      https://github.com/microsoft/winget-cli/releases
    echo.
    set "EXIT_CODE=1"
    goto :script_exit
)
echo [OK] Windows Package Manager detected: %WINGET_VER%
echo.

:: ----------------------------------------------------------------------------
:: Run Checks for All Tools
:: ----------------------------------------------------------------------------
:run_all_checks
call :check_prerequisites
call :display_status_table

:: Count how many tools require installation
set /a MISSING_COUNT=0
if "!NODE_OK!"=="0" set /a MISSING_COUNT+=1
if "!GIT_OK!"=="0" set /a MISSING_COUNT+=1
if "!YARN_OK!"=="0" set /a MISSING_COUNT+=1
if "!PSQL_OK!"=="0" set /a MISSING_COUNT+=1
if "!AWS_OK!"=="0" set /a MISSING_COUNT+=1
if "!VCPP_OK!"=="0" set /a MISSING_COUNT+=1
if "!PYTHON_OK!"=="0" set /a MISSING_COUNT+=1

if "!MISSING_COUNT!"=="0" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] All prerequisite tools are installed and ready!
    echo ==============================================================================
    if "%MODE_CHECK_ONLY%"=="1" (
        set "EXIT_CODE=0"
        goto :script_exit
    )
    if "%MODE_SKIP_CHECKOUT%"=="1" (
        set "EXIT_CODE=0"
        goto :script_exit
    )
    goto :setup_repository
)

echo.
echo Found !MISSING_COUNT! tool(s) missing or needing attention:
if "!NODE_OK!"=="0"   echo   - Node.js (v22)                [!NODE_STATUS!] !NODE_DETAIL!
if "!GIT_OK!"=="0"    echo   - Git                          [!GIT_STATUS!] !GIT_DETAIL!
if "!YARN_OK!"=="0"   echo   - Yarn                         [!YARN_STATUS!] !YARN_DETAIL!
if "!PSQL_OK!"=="0"   echo   - PostgreSQL                   [!PSQL_STATUS!] !PSQL_DETAIL!
if "!AWS_OK!"=="0"    echo   - AWS CLI                      [!AWS_STATUS!] !AWS_DETAIL!
if "!VCPP_OK!"=="0"   echo   - Visual C++ Build Environment [!VCPP_STATUS!] !VCPP_DETAIL!
if "!PYTHON_OK!"=="0" echo   - Python 3.11                  [!PYTHON_STATUS!] !PYTHON_DETAIL!
echo.

if "%MODE_CHECK_ONLY%"=="1" (
    echo [INFO] Check-only mode specified. Exiting without installing.
    set "EXIT_CODE=1"
    goto :script_exit
)

:: Prompt for confirmation unless -y is specified
if "%MODE_AUTO_YES%"=="0" (
    set "CONFIRM="
    set /p "CONFIRM=Would you like to install the missing tools now? [Y/n]: "
    if not defined CONFIRM set "CONFIRM=Y"
    if /i "!CONFIRM:~0,1!"=="n" (
        echo [INFO] Installation aborted by user.
        set "EXIT_CODE=1"
        goto :script_exit
    )
)

:: ----------------------------------------------------------------------------
:: Install Missing Tools
:: ----------------------------------------------------------------------------
echo.
echo ==============================================================================
echo                 STARTING INSTALLATION OF MISSING TOOLS
echo ==============================================================================
set "INSTALL_FAILED=0"

:: 1. Node.js (v22)
if "!NODE_OK!"=="0" (
    call :install_tool "node" "Node.js v22" "OpenJS.NodeJS.22" ""
)

:: 2. Git
if "!GIT_OK!"=="0" (
    call :install_tool "git" "Git" "Git.Git" ""
)

:: 3. Yarn
if "!YARN_OK!"=="0" (
    call :install_tool "yarn" "Yarn" "Yarn.Yarn" ""
)

:: 4. PostgreSQL
if "!PSQL_OK!"=="0" (
    call :install_tool "psql" "PostgreSQL" "PostgreSQL.PostgreSQL.16" ""
)

:: 5. AWS CLI
if "!AWS_OK!"=="0" (
    call :install_tool "aws" "AWS CLI" "Amazon.AWSCLI" ""
)

:: 6. Visual C++ Build Environment
if "!VCPP_OK!"=="0" (
    call :install_tool "vcpp" "Visual C++ Build Environment" "Microsoft.VisualStudio.2022.BuildTools" "--override \"\"--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended\"\""
)

:: 7. Python 3.11
if "!PYTHON_OK!"=="0" (
    call :install_tool "python" "Python 3.11" "Python.Python.3.11" ""
)

:: ----------------------------------------------------------------------------
:: Refresh Environment Variables (PATH)
:: ----------------------------------------------------------------------------
echo.
echo ==============================================================================
echo [INFO] Refreshing PATH environment variable from Windows Registry...
echo ==============================================================================
set "SYS_PATH="
set "USER_PATH="
for /f "tokens=2*" %%a in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USER_PATH=%%b"
if defined SYS_PATH (
    if defined USER_PATH (
        set "PATH=!SYS_PATH!;!USER_PATH!;!PATH!"
    ) else (
        set "PATH=!SYS_PATH!;!PATH!"
    )
)

:: ----------------------------------------------------------------------------
:: Post-Installation Verification Pass
:: ----------------------------------------------------------------------------
echo.
echo ==============================================================================
echo                 POST-INSTALLATION VERIFICATION PASS
echo ==============================================================================
call :check_prerequisites
call :display_status_table

set /a STILL_MISSING=0
if "!NODE_OK!"=="0" set /a STILL_MISSING+=1
if "!GIT_OK!"=="0" set /a STILL_MISSING+=1
if "!YARN_OK!"=="0" set /a STILL_MISSING+=1
if "!PSQL_OK!"=="0" set /a STILL_MISSING+=1
if "!AWS_OK!"=="0" set /a STILL_MISSING+=1
if "!VCPP_OK!"=="0" set /a STILL_MISSING+=1
if "!PYTHON_OK!"=="0" set /a STILL_MISSING+=1

if "!STILL_MISSING!"=="0" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] All prerequisite tools are now installed and verified!
    echo ==============================================================================
    if "!PSQL_OK!"=="1" (
        echo [NOTE] If you just installed PostgreSQL, the default database user is
        echo        'postgres' with password 'postgres' configured in the wizard.
        echo.
    )
    if "%MODE_SKIP_CHECKOUT%"=="1" (
        set "EXIT_CODE=0"
        goto :script_exit
    )
    goto :setup_repository
) else (
    echo.
    echo ==============================================================================
    echo [WARNING] !STILL_MISSING! tool[s] could not be verified automatically.
    echo           Note: Some newly installed tools require closing and reopening your
    echo           terminal or restarting Windows before their PATH entries take effect.
    echo ==============================================================================
    if "%MODE_SKIP_CHECKOUT%"=="0" (
        if "%MODE_AUTO_YES%"=="1" goto :setup_repository
        set "CONTINUE_ANYWAY="
        set /p "CONTINUE_ANYWAY=Would you still like to attempt repository checkout and setup? [y/N]: "
        if /i "!CONTINUE_ANYWAY:~0,1!"=="y" goto :setup_repository
    )
    set "EXIT_CODE=1"
    goto :script_exit
)

:: ============================================================================
:: Subroutines: Prerequisite Checks
:: ============================================================================
:check_prerequisites
call :sub_check_node
call :sub_check_git
call :sub_check_yarn
call :sub_check_psql
call :sub_check_aws
call :sub_check_vcpp
call :sub_check_python
exit /b

:: --- 1. Node.js (v22) ---
:sub_check_node
set "NODE_OK=0"
set "NODE_STATUS=MISSING"
set "NODE_DETAIL=Not installed"
set "NODE_VER="
for /f "tokens=*" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
if defined NODE_VER (
    if "!NODE_VER:~0,4!"=="v22." (
        set "NODE_OK=1"
        set "NODE_STATUS=OK"
        set "NODE_DETAIL=!NODE_VER!"
    ) else (
        set "NODE_STATUS=MISMATCH"
        set "NODE_DETAIL=!NODE_VER! [Requires v22.x]"
    )
)
exit /b

:: --- 2. Git ---
:sub_check_git
set "GIT_OK=0"
set "GIT_STATUS=MISSING"
set "GIT_DETAIL=Not installed"
set "GIT_VER="
for /f "tokens=*" %%v in ('git --version 2^>nul') do set "GIT_VER=%%v"
if defined GIT_VER (
    set "GIT_OK=1"
    set "GIT_STATUS=OK"
    set "GIT_DETAIL=!GIT_VER!"
)
exit /b

:: --- 3. Yarn ---
:sub_check_yarn
set "YARN_OK=0"
set "YARN_STATUS=MISSING"
set "YARN_DETAIL=Not installed"
set "YARN_VER="
for /f "tokens=*" %%v in ('yarn --version 2^>nul') do set "YARN_VER=%%v"
if defined YARN_VER (
    set "YARN_OK=1"
    set "YARN_STATUS=OK"
    set "YARN_DETAIL=v!YARN_VER!"
)
exit /b

:: --- 4. PostgreSQL (psql) ---
:sub_check_psql
set "PSQL_OK=0"
set "PSQL_STATUS=MISSING"
set "PSQL_DETAIL=Not installed"
set "PSQL_VER="
for /f "tokens=*" %%v in ('psql --version 2^>nul') do set "PSQL_VER=%%v"
if defined PSQL_VER (
    set "PSQL_OK=1"
    set "PSQL_STATUS=OK"
    set "PSQL_DETAIL=!PSQL_VER!"
) else (
    for %%p in (
        "!PF64!\PostgreSQL\18\bin\psql.exe"
        "!PF64!\PostgreSQL\17\bin\psql.exe"
        "!PF64!\PostgreSQL\16\bin\psql.exe"
        "!PF64!\PostgreSQL\15\bin\psql.exe"
    ) do (
        if "!PSQL_OK!"=="0" if exist "%%~p" (
            for /f "tokens=*" %%v in ('"%%~p" --version 2^>nul') do (
                set "PSQL_OK=1"
                set "PSQL_STATUS=OK"
                set "PSQL_DETAIL=%%v"
            )
        )
    )
)
exit /b

:: --- 5. AWS CLI ---
:sub_check_aws
set "AWS_OK=0"
set "AWS_STATUS=MISSING"
set "AWS_DETAIL=Not installed"
set "AWS_VER="
for /f "tokens=*" %%v in ('aws --version 2^>nul') do set "AWS_VER=%%v"
if defined AWS_VER (
    set "AWS_OK=1"
    set "AWS_STATUS=OK"
    set "AWS_DETAIL=!AWS_VER!"
) else (
    for %%p in (
        "!PF64!\Amazon\AWSCLIV2\aws.exe"
        "!PF64!\Amazon\AWSCLI\aws.exe"
    ) do (
        if "!AWS_OK!"=="0" if exist "%%~p" (
            for /f "tokens=*" %%v in ('"%%~p" --version 2^>nul') do (
                set "AWS_OK=1"
                set "AWS_STATUS=OK"
                set "AWS_DETAIL=%%v"
            )
        )
    )
)
exit /b

:: --- 6. Visual C++ Build Environment ---
:sub_check_vcpp
set "VCPP_OK=0"
set "VCPP_STATUS=MISSING"
set "VCPP_DETAIL=Not installed"
set "VSWHERE_EXE="
if exist "!PF86!\Microsoft Visual Studio\Installer\vswhere.exe" (
    set "VSWHERE_EXE=!PF86!\Microsoft Visual Studio\Installer\vswhere.exe"
) else if exist "!PF64!\Microsoft Visual Studio\Installer\vswhere.exe" (
    set "VSWHERE_EXE=!PF64!\Microsoft Visual Studio\Installer\vswhere.exe"
)
if defined VSWHERE_EXE (
    for /f "usebackq delims=" %%p in (`"!VSWHERE_EXE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do (
        if not "%%p"=="" (
            set "VCPP_OK=1"
            set "VCPP_STATUS=OK"
            set "VCPP_DETAIL=%%p"
        )
    )
)
exit /b

:: --- 7. Python 3.11 ---
:sub_check_python
set "PYTHON_OK=0"
set "PYTHON_STATUS=MISSING"
set "PYTHON_DETAIL=Not installed"
set "PYTHON_VER="
for /f "tokens=*" %%v in ('py -3.11 --version 2^>nul') do set "PYTHON_VER=%%v"
if defined PYTHON_VER (
    set "PYTHON_OK=1"
    set "PYTHON_STATUS=OK"
    set "PYTHON_DETAIL=!PYTHON_VER!"
) else (
    for /f "tokens=*" %%v in ('python --version 2^>nul') do (
        set "PY_TEMP=%%v"
        if "!PY_TEMP:~0,11!"=="Python 3.11" (
            set "PYTHON_OK=1"
            set "PYTHON_STATUS=OK"
            set "PYTHON_DETAIL=!PY_TEMP!"
        ) else (
            set "PYTHON_STATUS=MISMATCH"
            set "PYTHON_DETAIL=!PY_TEMP! [Requires Python 3.11]"
        )
    )
)
exit /b

:: ============================================================================
:: Subroutines: Display Status Table
:: ============================================================================
:display_status_table
echo.
echo ---------------------------------------------------------------------------------------------------------
echo   Tool Name                     Winget ID                           Status       Details
echo ---------------------------------------------------------------------------------------------------------
call :format_row "Node.js (v22)"                "OpenJS.NodeJS.22"                  "!NODE_STATUS!"   "!NODE_DETAIL!"
call :format_row "Git"                          "Git.Git"                           "!GIT_STATUS!"    "!GIT_DETAIL!"
call :format_row "Yarn"                         "Yarn.Yarn"                         "!YARN_STATUS!"   "!YARN_DETAIL!"
call :format_row "PostgreSQL"                   "PostgreSQL.PostgreSQL.16"          "!PSQL_STATUS!"   "!PSQL_DETAIL!"
call :format_row "AWS CLI"                      "Amazon.AWSCLI"                     "!AWS_STATUS!"    "!AWS_DETAIL!"
call :format_row "Visual C++ Build Environment" "Microsoft.VisualStudio.2022.B..."  "!VCPP_STATUS!"   "!VCPP_DETAIL!"
call :format_row "Python 3.11"                  "Python.Python.3.11"                "!PYTHON_STATUS!" "!PYTHON_DETAIL!"
echo ---------------------------------------------------------------------------------------------------------
exit /b

:format_row
set "R_NAME=%~1                              "
set "R_NAME=!R_NAME:~0,30!"
set "R_ID=%~2                                      "
set "R_ID=!R_ID:~0,36!"
set "R_STATUS=[%~3]            "
set "R_STATUS=!R_STATUS:~0,13!"
set "R_DETAIL=%~4"
echo   !R_NAME!!R_ID!!R_STATUS!!R_DETAIL!
exit /b

:: ============================================================================
:: Subroutine: Install a Tool via Winget
:: ============================================================================
:install_tool
set "T_KEY=%~1"
set "T_NAME=%~2"
set "T_WINGET_ID=%~3"
set "T_EXTRA_ARGS=%~4"

echo.
echo ------------------------------------------------------------------------------
echo [INSTALLING] !T_NAME! [!T_WINGET_ID!]
echo ------------------------------------------------------------------------------

if "!T_KEY!"=="vcpp" (
    echo Executing: winget install --id !T_WINGET_ID! -e --source winget --accept-source-agreements --accept-package-agreements --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    winget install --id !T_WINGET_ID! -e --source winget --accept-source-agreements --accept-package-agreements --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
) else (
    echo Executing: winget install --id !T_WINGET_ID! -e --source winget --accept-source-agreements --accept-package-agreements
    winget install --id !T_WINGET_ID! -e --source winget --accept-source-agreements --accept-package-agreements
)

set "W_RES=!errorlevel!"
if "!W_RES!"=="0" (
    echo [OK] !T_NAME! installed successfully.
    exit /b
)
if "!W_RES!"=="3010" (
    echo [OK] !T_NAME! installed successfully - reboot required for full integration.
    exit /b
)
if "!W_RES!"=="-1978335189" (
    echo [INFO] !T_NAME! is already installed or up-to-date according to winget.
    exit /b
)
echo [ERROR] Installation of !T_NAME! finished with exit code !W_RES!.
set "INSTALL_FAILED=1"
exit /b

:: ============================================================================
:: Repository Checkout & Dependency Installation
:: ============================================================================
:setup_repository
echo.
echo ==============================================================================
echo                 REPOSITORY CHECKOUT AND DEPENDENCIES SETUP
echo ==============================================================================
echo.

:: Ensure Git is in PATH
where git >nul 2>&1
if !errorlevel! neq 0 (
    if exist "!PF64!\Git\cmd\git.exe" set "PATH=!PF64!\Git\cmd;!PATH!"
    if exist "!PF86!\Git\cmd\git.exe" set "PATH=!PF86!\Git\cmd;!PATH!"
)
where git >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Git command was not found in PATH or standard installation locations.
    echo         Cannot checkout repository.
    set "EXIT_CODE=1"
    goto :script_exit
)

:: Ensure Yarn is in PATH
where yarn >nul 2>&1
if !errorlevel! neq 0 (
    if exist "%APPDATA%\npm\yarn.cmd" set "PATH=%APPDATA%\npm;!PATH!"
    if exist "%LOCALAPPDATA%\Yarn\bin\yarn.cmd" set "PATH=%LOCALAPPDATA%\Yarn\bin;!PATH!"
    if exist "!PF86!\Yarn\bin\yarn.cmd" set "PATH=!PF86!\Yarn\bin;!PATH!"
    if exist "!PF64!\Yarn\bin\yarn.cmd" set "PATH=!PF64!\Yarn\bin;!PATH!"
)
where yarn >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Yarn command was not found in PATH or standard installation locations.
    echo         Cannot install project dependencies.
    set "EXIT_CODE=1"
    goto :script_exit
)

:: Determine origin repository URL
set "REPO_URL="
for /f "tokens=*" %%u in ('git -C "%SCRIPT_DIR%" config --get remote.origin.url 2^>nul') do set "REPO_URL=%%u"
if not defined REPO_URL (
    for /f "tokens=*" %%u in ('git config --get remote.origin.url 2^>nul') do set "REPO_URL=%%u"
)
if not defined REPO_URL set "REPO_URL=https://github.com/EvilInnocence-Studios/atp-installer.git"

echo Repository URL: !REPO_URL!
echo.

:: Determine target installation directory
set "TARGET_DIR="
if defined CLI_INSTALL_DIR (
    call :resolve_path "!CLI_INSTALL_DIR!"
    set "TARGET_DIR=!RESOLVED_PATH!"
)

if not defined TARGET_DIR (
    set "DEFAULT_DIR=%USERPROFILE%\atp-installer"
    echo Please enter the directory where you want to install and checkout this repository.
    echo Press [ENTER] to accept the default [!DEFAULT_DIR!]
    echo Or enter 'q' to skip and exit.
    echo.
    set "USER_DIR="
    set /p "USER_DIR=Install location [!DEFAULT_DIR!]: "
    if not defined USER_DIR set "USER_DIR=!DEFAULT_DIR!"
    
    if /i "!USER_DIR:~0,1!"=="q" (
        echo [INFO] Repository checkout and setup skipped by user.
        set "EXIT_CODE=0"
        goto :script_exit
    )
    
    set "USER_DIR=!USER_DIR:"=!"
    call :resolve_path "!USER_DIR!"
    set "TARGET_DIR=!RESOLVED_PATH!"
)

echo.
echo [INFO] Target installation directory: !TARGET_DIR!
echo.

:: Checkout / Clone Repository
if exist "!TARGET_DIR!\.git" (
    echo [INFO] Existing Git repository detected in target directory.
    echo [INFO] Pulling latest changes from remote...
    git -C "!TARGET_DIR!" pull
) else (
    if not exist "!TARGET_DIR!" (
        echo [INFO] Creating directory: !TARGET_DIR!
        mkdir "!TARGET_DIR!" 2>nul
    )
    echo [INFO] Cloning repository into !TARGET_DIR!...
    git clone "!REPO_URL!" "!TARGET_DIR!"
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] Git clone failed with exit code !errorlevel!.
        set "EXIT_CODE=1"
        goto :script_exit
    )
)

:: Run Yarn in the install directory
echo.
echo ==============================================================================
echo [INFO] Installing dependencies with Yarn in !TARGET_DIR!...
echo ==============================================================================
echo.

pushd "!TARGET_DIR!"
echo Executing: call yarn install
call yarn install
set "YARN_RES=!errorlevel!"
popd

if "!YARN_RES!"=="0" (
    echo.
    echo ==============================================================================
    echo [SUCCESS] Repository checkout and dependency installation completed!
    echo ==============================================================================
    echo.
    echo Installed project location:
    echo   !TARGET_DIR!
    echo.
    goto :setup_aws_credentials
) else (
    echo.
    echo ==============================================================================
    echo [ERROR] Yarn failed to install dependencies with exit code !YARN_RES!.
    echo ==============================================================================
    echo You can inspect the logs above or retry manually:
    echo   cd /d "!TARGET_DIR!"
    echo   yarn install
    echo.
    set "EXIT_CODE=1"
    goto :script_exit
)

:: ============================================================================
:: Subroutine: Resolve Absolute Path
:: ============================================================================
:resolve_path
set "RESOLVED_PATH=%~f1"
exit /b

:: ============================================================================
:: Subroutine: AWS Credentials Configuration
:: ============================================================================
:setup_aws_credentials
echo.
echo ==============================================================================
echo                    AWS CREDENTIALS CONFIGURATION
echo ==============================================================================
echo.

if "%MODE_SKIP_AWS%"=="1" (
    echo [INFO] AWS credentials configuration skipped [--skip-aws specified].
    goto :finish_all
)

:: Ensure AWS CLI is accessible
where aws >nul 2>&1
if !errorlevel! neq 0 (
    if exist "!PF64!\Amazon\AWSCLIV2\aws.exe" set "PATH=!PF64!\Amazon\AWSCLIV2;!PATH!"
    if exist "!PF64!\Amazon\AWSCLI\aws.exe" set "PATH=!PF64!\Amazon\AWSCLI;!PATH!"
)
where aws >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARN] AWS CLI is not available in PATH.
    echo        Skipping automatic AWS credentials setup.
    goto :finish_all
)

:: Check if AWS credentials were provided via CLI flags
if defined CLI_AWS_KEY if defined CLI_AWS_SECRET (
    echo [INFO] Applying AWS credentials from command line parameters...
    set "IN_AWS_KEY=!CLI_AWS_KEY!"
    set "IN_AWS_SECRET=!CLI_AWS_SECRET!"
    set "IN_AWS_REGION=!CLI_AWS_REGION!"
    if not defined IN_AWS_REGION set "IN_AWS_REGION=us-east-1"
    goto :apply_aws_credentials
)

:: Check for existing active credentials
set "EXISTING_ACCOUNT="
for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Account --output text 2^>nul') do set "EXISTING_ACCOUNT=%%a"

if defined EXISTING_ACCOUNT (
    set "EXISTING_ARN="
    for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Arn --output text 2^>nul') do set "EXISTING_ARN=%%a"
    set "EXISTING_REGION="
    for /f "tokens=*" %%r in ('aws configure get region 2^>nul') do set "EXISTING_REGION=%%r"
    if not defined EXISTING_REGION set "EXISTING_REGION=us-east-1"
    
    echo [OK] Active AWS credentials detected:
    echo   Account ID:     !EXISTING_ACCOUNT!
    echo   Identity [ARN]: !EXISTING_ARN!
    echo   Default Region: !EXISTING_REGION!
    echo.
    
    if "%MODE_AUTO_YES%"=="1" (
        echo [INFO] Retaining existing AWS credentials [--yes specified].
        goto :finish_all
    )
    
    set "KEEP_AWS="
    set /p "KEEP_AWS=Do you want to keep these existing AWS credentials? [Y/n]: "
    if not defined KEEP_AWS set "KEEP_AWS=Y"
    if /i "!KEEP_AWS:~0,1!"=="y" (
        echo [INFO] Retaining existing AWS credentials.
        goto :finish_all
    )
)

echo.
echo Please enter your AWS credentials for deployment.
echo [Credentials will be saved to your local %USERPROFILE%\.aws configuration]
echo [Or press ENTER with an empty key to skip AWS setup]
echo.

:prompt_aws_key
set "IN_AWS_KEY="
set /p "IN_AWS_KEY=AWS Access Key ID: "
if not defined IN_AWS_KEY (
    echo [INFO] AWS credentials setup skipped by user.
    goto :finish_all
)
set "IN_AWS_KEY=!IN_AWS_KEY:"=!"
set "IN_AWS_KEY=!IN_AWS_KEY: =!"

set "IN_AWS_SECRET="
set /p "IN_AWS_SECRET=AWS Secret Access Key: "
if not defined IN_AWS_SECRET (
    echo [WARN] Secret key cannot be empty. Please retry.
    goto :prompt_aws_key
)
set "IN_AWS_SECRET=!IN_AWS_SECRET:"=!"
set "IN_AWS_SECRET=!IN_AWS_SECRET: =!"

set "IN_AWS_REGION="
set /p "IN_AWS_REGION=AWS Default Region [us-east-1]: "
if not defined IN_AWS_REGION set "IN_AWS_REGION=us-east-1"
set "IN_AWS_REGION=!IN_AWS_REGION:"=!"
set "IN_AWS_REGION=!IN_AWS_REGION: =!"

:apply_aws_credentials
echo.
echo [INFO] Configuring AWS credentials profile [default]...
call aws configure set aws_access_key_id "!IN_AWS_KEY!"
call aws configure set aws_secret_access_key "!IN_AWS_SECRET!"
call aws configure set region "!IN_AWS_REGION!"
call aws configure set output "json"

if not exist "%USERPROFILE%\.aws" mkdir "%USERPROFILE%\.aws" 2>nul

echo [INFO] Verifying configured AWS credentials...
set "VERIFIED_ACCOUNT="
for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Account --output text 2^>nul') do set "VERIFIED_ACCOUNT=%%a"

if defined VERIFIED_ACCOUNT (
    set "VERIFIED_ARN="
    for /f "tokens=*" %%a in ('aws sts get-caller-identity --query Arn --output text 2^>nul') do set "VERIFIED_ARN=%%a"
    echo.
    echo [SUCCESS] AWS credentials verified successfully!
    echo   Account ID:     !VERIFIED_ACCOUNT!
    echo   Identity [ARN]: !VERIFIED_ARN!
    echo   Default Region: !IN_AWS_REGION!
) else (
    echo.
    echo [WARNING] Could not verify credentials with AWS STS [network or key error].
    echo           Credentials have been stored in %USERPROFILE%\.aws.
)

:finish_all
echo.
echo ==============================================================================
echo                     ALL STEPS COMPLETED SUCCESSFULLY!
echo ==============================================================================
echo.
echo The ATP Installer application, prerequisites, and AWS setup are ready.
echo.
echo Project location:
echo   !TARGET_DIR!
echo.

if "%MODE_NO_START%"=="1" (
    echo [INFO] Automatic application start skipped [--no-start specified].
    echo To start the application in development mode:
    echo   cd /d "!TARGET_DIR!"
    echo   yarn dev
    echo.
    set "EXIT_CODE=0"
    goto :script_exit
)

echo ==============================================================================
echo                 STARTING ATP INSTALLATION WIZARD [yarn dev]
echo ==============================================================================
echo.
echo Launching application in !TARGET_DIR!...
echo Press Ctrl+C in this console or close the application window to stop.
echo.

cd /d "!TARGET_DIR!"
call yarn dev
set "EXIT_CODE=!errorlevel!"
goto :script_exit

:: ============================================================================
:: Subroutine: Help Text
:: ============================================================================
:show_help
echo ==============================================================================
echo ATP Installation Wizard - Standalone Tools Installer
echo ==============================================================================
echo.
echo Usage: %SCRIPT_NAME% [options]
echo.
echo Options:
echo   --check, -c, /check             Check the status of all tools without installing.
echo   -y, --yes                       Automatically proceed with tool installation without confirmation.
echo   --dir, --dest, -d ^<path^>        Specify installation directory directly for repo checkout.
echo   --skip-checkout, --tools-only   Check/install tools only, skip repo checkout and yarn.
echo   --skip-aws                      Skip AWS credentials configuration.
echo   --aws-key ^<key^>                 Specify AWS Access Key ID via command line.
echo   --aws-secret ^<secret^>           Specify AWS Secret Access Key via command line.
echo   --aws-region ^<region^>           Specify AWS Default Region [default: us-east-1].
echo   --no-start, --skip-start        Do not automatically start the app [yarn dev].
echo   --no-pause                      Do not wait for a keypress before exiting.
echo   --no-elevate                    Do not attempt to prompt for Administrator privileges.
echo   --help, -h, /?                  Display this help message.
echo.
echo Tools checked and installed (mirrored from src/main/lib/system.ts):
echo   - Node.js (v22)                 [Winget: OpenJS.NodeJS.22]
echo   - Git                           [Winget: Git.Git]
echo   - Yarn                          [Winget: Yarn.Yarn]
echo   - PostgreSQL                    [Winget: PostgreSQL.PostgreSQL.16]
echo   - AWS CLI                       [Winget: Amazon.AWSCLI]
echo   - Visual C++ Build Environment  [Winget: Microsoft.VisualStudio.2022.BuildTools]
echo   - Python 3.11                   [Winget: Python.Python.3.11]
echo.
set "EXIT_CODE=0"
goto :script_exit

:: ============================================================================
:: Exit Handler
:: ============================================================================
:script_exit
if "%NO_PAUSE%"=="0" (
    echo.
    echo Press any key to exit . . .
    pause >nul
)
exit /b %EXIT_CODE%
