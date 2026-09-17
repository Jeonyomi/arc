# Registers the ArcWatch scheduled task (hourly) — silent via VBS wrapper.
$name = 'ArcWatchSync'
$proj = 'C:\Users\USER\AppData\Local\Temp\arc'
$vbs = Join-Path $proj 'scripts\ops\sync-hidden.vbs'
if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
}
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wscript.exe" -Argument "`"$vbs`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'ArcWatch periodic local sync. Mirrors RobinSync pattern.'
Register-ScheduledTask -TaskName $name -InputObject $task | Out-Null
$t = Get-ScheduledTask -TaskName $name
[ordered]@{ name=$name; state=$t.State; interval=$t.Triggers[0].Repetition.Interval; launcher=$vbs } | ConvertTo-Json -Compress
