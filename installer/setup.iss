; Inno Setup script for Curlys Clip Creator
; To compile: ISCC.exe setup.iss

#define MyAppName "Curlys Clip Creator"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Curly"
#define MyAppURL ""
#define MyAppExeName "Curlys Clip Creator.exe"

[Setup]
AppId={{8A2E5B6C-3D4F-4A1E-9B8C-7D6E5F4A3B2C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={code:GetDefaultDir}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-exe
OutputBaseFilename=Curlys Clip Creator Setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\Icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
PrivilegesRequired=admin
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce

[Files]
Source: "..\dist-exe\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
function GetDefaultDir(Param: string): string;
begin
  Result := ExpandConstant('{pf64}\Curlys Clip Creator');
end;
