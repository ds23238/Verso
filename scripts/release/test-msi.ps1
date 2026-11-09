$ErrorActionPreference = 'Stop'
$msi = (Get-ChildItem release-assets -Filter '*.msi' | Select-Object -First 1).FullName
$destination = Join-Path $env:RUNNER_TEMP 'verso-msi-installed'
$log = Join-Path $env:GITHUB_WORKSPACE 'artifacts/msi-install.log'
New-Item -ItemType Directory -Force artifacts | Out-Null
$process = Start-Process msiexec.exe -ArgumentList @('/i',"`"$msi`"",'/qn','/norestart',"INSTALLDIR=`"$destination`"",'/L*v',"`"$log`"") -Wait -PassThru
if ($process.ExitCode -notin @(0,3010)) { throw "MSI installation failed: $($process.ExitCode)" }
$app = Get-ChildItem $destination -Recurse -Filter verso.exe | Select-Object -First 1
if (-not $app) { throw 'Installed EXE not found in requested MSI directory' }
$env:VERSO_TEST_EXECUTABLE = $app.FullName
$env:VERSO_TEST_REPORT_DIR = 'artifacts/windows-msi'
try { npm run test:desktop; if ($LASTEXITCODE -ne 0) { throw 'Installed MSI application test failed' } }
finally {
  $process = Start-Process msiexec.exe -ArgumentList @('/x',"`"$msi`"",'/qn','/norestart') -Wait -PassThru
  if ($process.ExitCode -notin @(0,3010)) { throw "MSI uninstall failed: $($process.ExitCode)" }
}
