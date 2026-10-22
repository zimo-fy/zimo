!include "LogicLib.nsh"

!macro customInstall
  InitPluginsDir
  File /oname=$PLUGINSDIR\vc_redist.x64.exe "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
  DetailPrint "正在安装 Microsoft Visual C++ x64 运行库..."
  ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /install /quiet /norestart' $0
  ${If} $0 == 3010
    SetRebootFlag true
  ${ElseIf} $0 == 1638
    DetailPrint "系统已安装兼容的 Microsoft Visual C++ x64 运行库。"
  ${ElseIf} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "Microsoft Visual C++ x64 运行库安装失败（错误码：$0）。Zimo 需要该运行库加载本地 ONNX 模型。"
    Abort
  ${EndIf}
!macroend
