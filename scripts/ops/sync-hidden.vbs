' ArcWatch silent sync launcher (no visible window)
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """C:\Users\USER\AppData\Local\Temp\arc\scripts\ops\sync-arcwatch.cmd""", 0, False
