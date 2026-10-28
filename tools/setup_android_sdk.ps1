# Instala el Android SDK (cmdline-tools, platform-tools, platform 36 y build-tools 36)
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$sdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
Write-Output "SDK root: $sdkRoot"

# 1) URL del cmdline-tools más reciente
$repoXml = Invoke-WebRequest -Uri "https://dl.google.com/android/repository/repository2-3.xml" -UseBasicParsing -TimeoutSec 30
$m = [regex]::Match($repoXml.Content, 'commandlinetools-win-[\d]+_latest\.zip')
if (-not $m.Success) { throw "No se encontró commandlinetools en el repo XML" }
$file = $m.Value
$url = "https://dl.google.com/android/repository/$file"
Write-Output "Descargando: $url"

# 2) Descarga (curl.exe es mucho más rápido que Invoke-WebRequest)
$zip = Join-Path $env:TEMP $file
if (Test-Path $zip) { Remove-Item $zip -Force }
curl.exe -sSL --retry 3 --retry-delay 2 -o $zip $url
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $zip)) { throw "La descarga falló (curl exit $LASTEXITCODE)" }
Write-Output ("Descargado {0:N1} MB" -f ((Get-Item $zip).Length / 1MB))

# 3) Extracción
$tmp = Join-Path $env:TEMP "cmdtools_extract"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $tmp -Force

# 4) Mover a cmdline-tools/latest
$latest = Join-Path $sdkRoot "cmdline-tools\latest"
New-Item -ItemType Directory -Force -Path $latest | Out-Null
$src = Join-Path $tmp "cmdline-tools"
if (-not (Test-Path $src)) { $src = $tmp }
Get-ChildItem -Path $src | ForEach-Object { Copy-Item $_.FullName -Destination $latest -Recurse -Force }
Write-Output "cmdline-tools instalado en: $latest"

# 5) Aceptar licencias (escribiendo los hashes conocidos)
$licDir = Join-Path $sdkRoot "licenses"
New-Item -ItemType Directory -Force -Path $licDir | Out-Null
$hashes = @{
  "android-sdk-license"          = "24333f8a63b6825ea9c5514f83c2829b004d1fee"
  "android-sdk-preview-license"  = "84831b9409646a918e30573bab4c9c91346d8abd"
  "google-gdk-license"           = "33b6a2b64607f11b759f320ef9dff4ae5c47d97a"
  "android-googletv-license"     = "601085b94cd77f0b54ff86406957099ebe79c4d6"
  "mips-android-sysimage-license"= "e9acab5b5fbb560a72cfaecce8946896ff6aab9d"
  "android-sdk-arm-dbt-license"  = "859f317696f67ef3d7f30a50a5560e7834b43903"
}
foreach ($k in $hashes.Keys) {
  Set-Content -Path (Join-Path $licDir $hashes[$k]) -Value $hashes[$k] -NoNewline
  Add-Content -Path (Join-Path $licDir $hashes[$k]) -Value "`n" -NoNewline
}
Write-Output "Licencias aceptadas."

# 6) Instalar paquetes
$sdkmanager = Join-Path $latest "bin\sdkmanager.bat"
Write-Output "Instalando platform-tools, platforms;android-36 y build-tools;36.0.0 ..."
& $sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
Write-Output "=== SDK listo ==="
Get-ChildItem $sdkRoot | Select-Object Name
