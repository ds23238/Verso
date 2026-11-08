$ErrorActionPreference = 'Stop'
$root = "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application"
if (-not (Test-Path $root)) {
  $bootstrap = Join-Path $env:RUNNER_TEMP 'webview2-setup.exe'
  Invoke-WebRequest 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $bootstrap
  $process = Start-Process $bootstrap -ArgumentList '/silent','/install' -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "WebView2 installation failed: $($process.ExitCode)" }
}
$version = (Get-ChildItem $root -Directory | Where-Object Name -Match '^\d+\.\d+\.\d+\.\d+$' | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1).Name
if (-not $version) { throw 'No WebView2 runtime found' }
$zip = Join-Path $env:RUNNER_TEMP 'edgedriver.zip'
try { Invoke-WebRequest "https://msedgedriver.microsoft.com/$version/edgedriver_win64.zip" -OutFile $zip }
catch {
  $major = $version.Split('.')[0]
  $release = Join-Path $env:RUNNER_TEMP 'edge-driver-version.txt'
  Invoke-WebRequest "https://msedgedriver.microsoft.com/LATEST_RELEASE_${major}_WINDOWS" -OutFile $release
  $driverVersion = [System.IO.File]::ReadAllText($release).Trim()
  Invoke-WebRequest "https://msedgedriver.microsoft.com/$driverVersion/edgedriver_win64.zip" -OutFile $zip
}
$destination = Join-Path $env:RUNNER_TEMP 'edgedriver'
Expand-Archive $zip -DestinationPath $destination -Force
$destination | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append
Write-Host "WebView2 version: $version"
