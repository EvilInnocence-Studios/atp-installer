# ATP Installation Wizard — Manual Tools & Environment Setup Guide

This guide provides complete instructions for manually installing and configuring all the prerequisites, dependencies, and environment configurations automated by [`install-tools.bat`](file:///p:/WebApp%20Projects/atp/install-wizard/install-tools.bat).

Use this manual guide if:
- You cannot or do not wish to execute batch scripts in your environment.
- You are behind a corporate proxy or firewall where `winget` cannot connect.
- You want granular control over installation paths, versions, and configurations.
- You are troubleshooting issues encountered during automated installation.

---

## Table of Contents

1. [Prerequisites Matrix](#prerequisites-matrix)
2. [Phase 1: Terminal Setup & Windows Package Manager](#phase-1-terminal-setup--windows-package-manager)
3. [Phase 2: Installing the 7 Required Tools](#phase-2-installing-the-7-required-tools)
   - [Tool 1: Node.js (v22.x)](#1-nodejs-v22x)
   - [Tool 2: Git](#2-git)
   - [Tool 3: Yarn](#3-yarn)
   - [Tool 4: PostgreSQL 16](#4-postgresql-16)
   - [Tool 5: AWS CLI v2](#5-aws-cli-v2)
   - [Tool 6: Visual C++ Build Tools 2022](#6-visual-c-build-environment)
   - [Tool 7: Python 3.11](#7-python-311)
4. [Phase 3: Refreshing Environment Variables (PATH)](#phase-3-refreshing-environment-variables-path)
5. [Phase 4: Verification Pass](#phase-4-verification-pass)
6. [Phase 5: Repository Checkout & Dependency Installation](#phase-5-repository-checkout--dependency-installation)
7. [Phase 6: AWS Credentials Setup & Validation](#phase-6-aws-credentials-setup--validation)
8. [Phase 7: Running the ATP Installation Wizard](#phase-7-running-the-atp-installation-wizard)
9. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## Prerequisites Matrix

The following tools correspond directly to the definitions in `install-tools.bat` and [`src/main/lib/system.ts`](file:///p:/WebApp%20Projects/atp/install-wizard/src/main/lib/system.ts):

| Tool | Required Version | Winget Package ID | Purpose | Verification Command |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | **v22.x** *(Strict)* | `OpenJS.NodeJS.22` | Core JavaScript runtime | `node -v` |
| **Git** | Latest stable | `Git.Git` | Source code management | `git --version` |
| **Yarn** | 1.x (Classic) | `Yarn.Yarn` | Node package manager | `yarn --version` |
| **PostgreSQL** | 16 (or 15–18 client) | `PostgreSQL.PostgreSQL.16` | Database & `psql` CLI | `psql --version` |
| **AWS CLI** | v2 | `Amazon.AWSCLI` | Cloud deployment & S3 sync | `aws --version` |
| **Visual C++ Build Tools** | VS 2022 (VC++ Workload) | `Microsoft.VisualStudio.2022.BuildTools` | Compiling native Node modules (`node-pty`) | `vswhere.exe` check |
| **Python** | **3.11.x** *(Strict)* | `Python.Python.3.11` | Build dependency for `node-gyp` | `py -3.11 --version` or `python --version` |

> [!IMPORTANT]
> **Strict Version Requirements**:
> - **Node.js** must be version **22.x** (e.g. `v22.14.0`). Other major versions (v18, v20, v23) will fail the installer pre-checks.
> - **Python** must be version **3.11.x**. Versions 3.12+ or 3.10- can trigger compilation issues with `node-gyp` when building `node-pty`.

---

## Phase 1: Terminal Setup & Windows Package Manager

### 1. Open Terminal as Administrator
Most developer tools and system-wide PATH configurations require administrative privileges.
1. Press `Windows Key + S`, type `powershell` or `cmd`.
2. Right-click on **Windows PowerShell** or **Command Prompt** and select **Run as Administrator**.

### 2. Verify Windows Package Manager (`winget`)
Windows 10 (1809+) and Windows 11 include `winget` by default via the **App Installer** package.

Test if `winget` is available:
```cmd
winget --version
```

If `winget` is missing:
- **Option A**: Install **App Installer** directly from the [Microsoft Store](https://aka.ms/getwinget).
- **Option B**: Download the latest `.msixbundle` from the [winget-cli GitHub Releases](https://github.com/microsoft/winget-cli/releases).
- **Option C**: Proceed without `winget` by downloading the manual standalone installers linked in each step below.

---

## Phase 2: Installing the 7 Required Tools

You can install each tool either using `winget` or via direct download links.

### 1. Node.js (v22.x)
- **Role**: Executes the ATP Wizard and its development servers.
- **Using Winget**:
  ```cmd
  winget install --id OpenJS.NodeJS.22 -e --source winget --accept-source-agreements --accept-package-agreements
  ```
- **Manual Installer**:
  1. Download the Windows x64 `.msi` for Node.js 22 from the [Official Node.js Releases](https://nodejs.org/dist/latest-v22.x/).
  2. Run the installer with default settings. Ensure **Add to PATH** is checked.
- **Verification**:
  ```cmd
  node -v
  ```
  *(Output must begin with `v22.`)*

---

### 2. Git
- **Role**: Clones and synchronizes repository source code.
- **Using Winget**:
  ```cmd
  winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
  ```
- **Manual Installer**:
  1. Download the 64-bit installer from [Git for Windows](https://git-scm.com/download/win).
  2. Install using recommended defaults (ensuring Git is added to the system PATH).
- **Verification**:
  ```cmd
  git --version
  ```

---

### 3. Yarn
- **Role**: Package manager that installs JavaScript and native dependencies.
- **Using Winget**:
  ```cmd
  winget install --id Yarn.Yarn -e --source winget --accept-source-agreements --accept-package-agreements
  ```
- **Manual / Alternative (via npm)**:
  Once Node.js is installed, you can also install Yarn globally:
  ```cmd
  npm install -g yarn
  ```
  *Or activate Corepack:*
  ```cmd
  corepack enable
  ```
- **Verification**:
  ```cmd
  yarn --version
  ```

---

### 4. PostgreSQL 16
- **Role**: Provides the database server and `psql` command-line utility used by the wizard to verify databases and execute schema setups.
- **Using Winget**:
  ```cmd
  winget install --id PostgreSQL.PostgreSQL.16 -e --source winget --accept-source-agreements --accept-package-agreements
  ```
- **Manual Installer**:
  1. Download the PostgreSQL 16 installer for Windows x86-64 from [EnterpriseDB PostgreSQL Downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
  2. During installation:
     - Set password for the superuser `postgres` to: `postgres` *(matching default installer expectation)*.
     - Port: `5432` *(default)*.
  3. Ensure the `bin` directory is in your system PATH (e.g. `C:\Program Files\PostgreSQL\16\bin`).
- **Verification**:
  ```cmd
  psql --version
  ```
  *(Note: If `psql` is not recognized, see the PATH refresh steps below).*

---

### 5. AWS CLI v2
- **Role**: Used for provisioning infrastructure, uploading installers, and managing AWS resources.
- **Using Winget**:
  ```cmd
  winget install --id Amazon.AWSCLI -e --source winget --accept-source-agreements --accept-package-agreements
  ```
- **Manual Installer**:
  1. Download the AWS CLI v2 MSI: [AWSCLIV2.msi](https://awscli.amazonaws.com/AWSCLIV2.msi).
  2. Run the installer and complete the setup.
- **Verification**:
  ```cmd
  aws --version
  ```

---

### 6. Visual C++ Build Environment
- **Role**: Compiles native C++ Node.js add-ons (specifically `node-pty` required by the terminal components).
- **Using Winget** *(runs non-interactively and installs the required C++ workload)*:
  ```cmd
  winget install --id Microsoft.VisualStudio.2022.BuildTools -e --source winget --accept-source-agreements --accept-package-agreements --override "--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  ```
- **Manual Installer**:
  1. Download **Visual Studio Build Tools 2022** from [Visual Studio Downloads](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
  2. Run `vs_BuildTools.exe`.
  3. In the installer, select the workload: **Desktop development with C++** (`Microsoft.VisualStudio.Workload.VCTools`).
  4. Ensure the following components are selected:
     - MSVC v143 - VS 2022 C++ x64/x86 build tools
     - Windows 10 SDK or Windows 11 SDK
     - C++ CMake tools for Windows
  5. Click **Install**.
- **Verification**:
  Run this command to check whether the VC tools component is registered:
  ```cmd
  "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  ```
  *(Expected output: Path to the Visual Studio / BuildTools directory, e.g. `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools`)*.

---

### 7. Python 3.11
- **Role**: Required by `node-gyp` during compilation of native modules.
- **Using Winget**:
  ```cmd
  winget install --id Python.Python.3.11 -e --source winget --accept-source-agreements --accept-package-agreements
  ```
- **Manual Installer**:
  1. Download the Windows installer (64-bit) for Python 3.11 (e.g. 3.11.9) from [Python.org Downloads](https://www.python.org/downloads/release/python-3119/).
  2. **CRITICAL**: On the very first screen of the installer, check the box: **"Add python.exe to PATH"**.
  3. Select **Install Now** or customize install locations.
- **Verification**:
  ```cmd
  py -3.11 --version
  ```
  or
  ```cmd
  python --version
  ```
  *(Output must read `Python 3.11.x`)*.

---

## Phase 3: Refreshing Environment Variables (PATH)

Newly installed applications register their binaries in the Windows Registry (`HKLM` and `HKCU`).

### Quick Refresh (Recommended)
Close your current Command Prompt or PowerShell window and **open a new terminal window**.

### In-Session Refresh (PowerShell)
If you wish to refresh PATH inside an active PowerShell session without restarting:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### Common Default Locations Checklist
If any tool reports as "not recognized", ensure these folders are present in your `Path`:
- **Node.js**: `C:\Program Files\nodejs\`
- **Git**: `C:\Program Files\Git\cmd\`
- **Yarn**: `%LOCALAPPDATA%\Yarn\bin\` or `%APPDATA%\npm\`
- **PostgreSQL**: `C:\Program Files\PostgreSQL\16\bin\`
- **AWS CLI**: `C:\Program Files\Amazon\AWSCLIV2\`
- **Python 3.11**: `%LOCALAPPDATA%\Programs\Python\Python311\` and `%LOCALAPPDATA%\Programs\Python\Python311\Scripts\`

---

## Phase 4: Verification Pass

Run each of these 7 commands in your new terminal to verify everything matches the exact criteria in `install-tools.bat`:

```cmd
:: 1. Node.js (must be v22.x)
node -v

:: 2. Git
git --version

:: 3. Yarn
yarn --version

:: 4. PostgreSQL psql
psql --version

:: 5. AWS CLI
aws --version

:: 6. Visual C++ Build Tools
"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath

:: 7. Python 3.11
py -3.11 --version
```

If all 7 return valid version information without errors, your toolchain is complete.

---

## Phase 5: Repository Checkout & Dependency Installation

`install-tools.bat` automatically clones or updates the `atp-installer` repository and runs `yarn install`. Follow these steps to perform this manually:

### 1. Choose Target Directory
The default location is `%USERPROFILE%\atp-installer` (e.g. `C:\Users\<username>\atp-installer`):

```cmd
set "TARGET_DIR=%USERPROFILE%\atp-installer"
```

*(You may substitute any desired folder path, such as your existing workspace).*

### 2. Clone or Update Repository
- **For a new installation**:
  ```cmd
  git clone https://github.com/EvilInnocence-Studios/atp-installer.git "%TARGET_DIR%"
  ```
- **If updating an existing folder**:
  ```cmd
  cd /d "%TARGET_DIR%"
  git pull
  ```

### 3. Install Project Dependencies
Navigate into the repository directory and execute Yarn:
```cmd
cd /d "%TARGET_DIR%"
yarn install
```

> [!TIP]
> `yarn install` will trigger native compilation for `node-pty`. This utilizes your newly installed Visual C++ Build Tools and Python 3.11. If `yarn install` completes with exit code `0`, native dependencies compiled successfully.

---

## Phase 6: AWS Credentials Setup & Validation

`install-tools.bat` configures AWS CLI credentials so that the installer can interact with your AWS account for infrastructure setup.

### 1. Check for Existing Credentials
```cmd
aws sts get-caller-identity
```
If this command outputs your `Account`, `UserId`, and `Arn`, your AWS environment is already active and valid.

### 2. Configure AWS Profile
If credentials are not yet configured:
```cmd
aws configure
```
You will be prompted to enter:
- **AWS Access Key ID**: `[Your Access Key]`
- **AWS Secret Access Key**: `[Your Secret Access Key]`
- **Default region name**: `us-east-1` *(or your desired default region)*
- **Default output format**: `json`

*(Alternatively, to configure them non-interactively:)*
```cmd
aws configure set aws_access_key_id "YOUR_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "YOUR_SECRET_ACCESS_KEY"
aws configure set region "us-east-1"
aws configure set output "json"
```

Credentials are saved in:
- `%USERPROFILE%\.aws\credentials`
- `%USERPROFILE%\.aws\config`

### 3. Verify Account Identity
Verify that AWS STS accepts the credentials:
```cmd
aws sts get-caller-identity --query Account --output text
```
Expected output: Your 12-digit AWS Account ID.

---

## Phase 7: Running the ATP Installation Wizard

Once prerequisites and dependencies are configured, you can start the application:

### Run in Development Mode
```cmd
cd /d "%TARGET_DIR%"
yarn dev
```
This launches the Electron + Vite development environment with hot reloading.

### Build Standalone Windows Installer
If you wish to compile a production `.exe` installer package:
```cmd
cd /d "%TARGET_DIR%"
yarn build:win
```
The packaged installer will be generated in `dist/` (e.g. `dist/ATP_Installer_v1.0.0.exe`).

---

## Troubleshooting & FAQs

### 1. `Node 22 required (found v20.x or v18.x)`
- The installer relies on Node.js 22.
- If you use NVM (Node Version Manager for Windows):
  ```cmd
  nvm install 22.14.0
  nvm use 22.14.0
  ```
- Or update your PATH so that Node 22 takes precedence over older versions.

### 2. `node-gyp` or `node-pty` Build Failures During `yarn install`
- **Check Python**: Run `python --version`. If it is Python 3.12+, set `PYTHON` to point to Python 3.11:
  ```cmd
  set PYTHON=%LOCALAPPDATA%\Programs\Python\Python311\python.exe
  yarn install
  ```
- **Check Visual C++**: Verify that `Microsoft.VisualStudio.Component.VC.Tools.x86.x64` is installed. Run the Visual Studio Installer and ensure **Desktop development with C++** is checked.

### 3. `psql` is not recognized as an internal or external command
- PostgreSQL installer does not always add its `bin` folder to system PATH automatically.
- Add `C:\Program Files\PostgreSQL\16\bin` to your System Environment `Path` variable:
  ```powershell
  [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\PostgreSQL\16\bin", [EnvironmentVariableTarget]::Machine)
  ```

### 4. AWS STS `SignatureDoesNotMatch` or `InvalidClientTokenId`
- Verify that your system clock is synchronized (Windows Settings -> Time & Language -> Sync now).
- Verify there are no trailing whitespace characters or quotes in your access key or secret key.
- Verify credentials using `aws sts get-caller-identity`.
