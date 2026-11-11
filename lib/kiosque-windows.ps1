# =====================================================================
#  Kiosque BD - lanceur Windows. Aucune installation nécessaire :
#  PowerShell et Microsoft Edge sont présents sur tous les Windows 10/11.
#
#  1. sert les fichiers du kiosque sur http://localhost (serveur intégré),
#  2. ouvre Chrome (s'il est installé) ou Edge en plein écran,
#  3. s'arrête tout seul quand le navigateur est fermé (Alt+F4).
#
#  Lancé par « Lancer le kiosque - Windows.bat ». Ce fichier doit rester
#  enregistré en UTF-8 avec BOM, sinon les accents s'affichent mal.
# =====================================================================
# -TestSeconds N : mode test (CI) - sert les fichiers N secondes, sans navigateur
# ni boîte de dialogue, et affiche « PORT=... » sur la sortie standard.
param([int]$TestSeconds = 0)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$Root    = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$DataDir = Join-Path $env:LOCALAPPDATA "KiosqueBD"   # profil du navigateur + journal
$LogFile = Join-Path $DataDir "journal.txt"
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function Log($msg) {
  try { Add-Content -LiteralPath $LogFile -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $msg) } catch { }
}
function Fail($msg) {
  Log "ERREUR : $msg"
  if ($TestSeconds -gt 0) { [Console]::Error.WriteLine("ERREUR : $msg"); exit 1 }
  [System.Windows.Forms.MessageBox]::Show($msg, "Kiosque BD", "OK", "Error") | Out-Null
  exit 1
}

try {
  Log "Démarrage depuis $Root"

  # ------------------------------------------------ vérifications
  if (-not (Test-Path -LiteralPath (Join-Path $Root "index.html"))) {
    Fail "Fichiers du kiosque introuvables.`n`nAvez-vous bien extrait le dossier ZIP avant de lancer le kiosque ?"
  }
  $pdfName = "bd_signets.pdf"
  $cfg = Get-Content -LiteralPath (Join-Path $Root "config.js") -Raw -Encoding UTF8
  if ($cfg -match 'pdf\s*:\s*"([^"]+)"') { $pdfName = $Matches[1] }
  # bd_signets.pdf (sortie de outils\ajouter_sommaire.py), sinon le même nom sans « _signets »
  $plainName = $pdfName -replace '_signets\.pdf$', '.pdf'
  if (-not (Test-Path -LiteralPath (Join-Path $Root $pdfName)) -and -not (Test-Path -LiteralPath (Join-Path $Root $plainName))) {
    Fail "La BD « $plainName » est introuvable.`n`nCopiez votre fichier PDF dans le dossier du kiosque et renommez-le « $plainName »."
  }

  # ------------------------------------------------ navigateur
  $chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  $edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  $browser = if ($chrome) { $chrome } else { $edge }
  if (-not $browser -and $TestSeconds -eq 0) { Fail "Ni Google Chrome ni Microsoft Edge n'ont été trouvés sur cet ordinateur." }

  # ------------------------------------------------ serveur local
  # Si le port est pris (kiosque déjà ouvert...), on essaie les suivants.
  $listener = $null
  foreach ($p in 8765..8775) {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$p/")
    try { $l.Start(); $listener = $l; $Port = $p; break } catch { $l.Close() }
  }
  if (-not $listener) { Fail "Impossible de démarrer le serveur local (ports 8765 à 8775 occupés).`n`nRedémarrez l'ordinateur puis réessayez." }
  Log "Serveur sur le port $Port, navigateur : $browser"

  $mime = @{
    ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
    ".mjs"  = "text/javascript; charset=utf-8"; ".css" = "text/css; charset=utf-8"
    ".pdf"  = "application/pdf"; ".json" = "application/json"; ".map" = "application/json"
    ".png"  = "image/png"; ".jpg" = "image/jpeg"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"
  }
  $rootPrefix = $Root.TrimEnd('\') + '\'

  function Send-File($ctx) {
    $res = $ctx.Response
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq "") { $rel = "index.html" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $Root $rel))
    # rien en dehors du dossier du kiosque
    if (-not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $full -PathType Leaf)) { $res.StatusCode = 404; return }
    $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
    $res.Headers.Add("Cache-Control", "no-cache")
    $fs = [System.IO.File]::OpenRead($full)
    try { $res.ContentLength64 = $fs.Length; $fs.CopyTo($res.OutputStream) } finally { $fs.Close() }
  }

  # ------------------------------------------------ lancement du navigateur
  $profileDir = Join-Path $DataDir "profil-navigateur"
  $url = "http://localhost:$Port/index.html"
  $browserArgs = "--kiosk `"$url`" --no-first-run --noerrdialogs --disable-pinch --overscroll-history-navigation=0 " +
          "--disable-session-crashed-bubble --disable-features=TranslateUI --user-data-dir=`"$profileDir`""
  if ($browser -eq $edge) { $browserArgs += " --edge-kiosk-type=fullscreen" }
  if ($TestSeconds -gt 0) { Write-Output "PORT=$Port" }
  else { Start-Process -FilePath $browser -ArgumentList $browserArgs | Out-Null }

  # Le kiosque tourne tant qu'un processus du navigateur utilise notre profil.
  $exe = if ($browser) { [System.IO.Path]::GetFileName($browser) } else { "" }
  function Browser-Running {
    $procs = Get-CimInstance Win32_Process -Filter "Name='$exe'" -ErrorAction SilentlyContinue
    return [bool]($procs | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profileDir) })
  }

  $started = Get-Date
  $nextCheck = $started.AddSeconds(15)   # laisse au navigateur le temps de démarrer
  $deadline = $started.AddSeconds($TestSeconds)
  $task = $null
  while ($true) {
    if ($TestSeconds -gt 0) { if ((Get-Date) -ge $deadline) { break } }
    elseif ((Get-Date) -ge $nextCheck) {
      if (-not (Browser-Running)) { break }
      $nextCheck = (Get-Date).AddSeconds(3)
    }
    if ($null -eq $task) { $task = $listener.GetContextAsync() }
    if (-not $task.Wait(500)) { continue }
    $ctx = $task.Result; $task = $null
    try { Send-File $ctx } catch { Log "Requête interrompue : $($_.Exception.Message)" }
    finally { try { $ctx.Response.Close() } catch { } }
  }
  $listener.Stop()
  Log "Navigateur fermé, arrêt du kiosque."
}
catch {
  Fail "Erreur inattendue :`n$($_.Exception.Message)`n`nJournal : $LogFile"
}
