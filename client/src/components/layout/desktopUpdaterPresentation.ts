import { translateUi } from "@/i18n/legacy";
import type { DesktopUpdaterSnapshot } from "@/lib/desktop";

export function formatDesktopVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed || trimmed === "0.0.0") {
    return "v0.0.0";
  }
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

export function getDesktopUpdaterStatusLabel(status: DesktopUpdaterSnapshot["status"]): string {
  switch (status) {
    case "disabled":
      return translateUi("暂不可用");
    case "idle":
      return translateUi("等待检查");
    case "checking":
      return translateUi("正在检查");
    case "update-available":
      return translateUi("发现新版本");
    case "downloading":
      return translateUi("正在下载");
    case "downloaded":
      return translateUi("等待重启安装");
    case "not-available":
      return translateUi("版本较新");
    case "error":
      return translateUi("检查失败");
    default:
      return status;
  }
}

export function getDesktopUpdaterHint(updater: DesktopUpdaterSnapshot): string {
  if (!updater.isSupported) {
    if (updater.isPortable) {
      return translateUi("便携版需要下载新版安装包后手动替换，现有创作数据不会受到影响。");
    }
    if (!updater.isPackaged) {
      return translateUi("开发环境不会下载安装包，正式安装版可在这里检查和安装更新。");
    }
    return translateUi("此安装包暂时无法连接版本更新服务。");
  }

  switch (updater.status) {
    case "idle":
      return translateUi("可随时检查桌面版更新。发现新版本后，由你确认下载和重启安装。");
    case "checking":
      return translateUi("正在连接版本更新服务，请稍候。");
    case "update-available":
      return translateUi("{{v}} đã có, bạn vẫn dùng được ứng dụng trong lúc tải.", { v: formatDesktopVersion(updater.availableVersion ?? translateUi("新版本")) });
    case "downloading":
      return translateUi("更新包正在后台下载，请保持应用打开。");
    case "downloaded":
      return translateUi("更新包准备完成。重启应用后会自动安装，未保存的输入请先保存。");
    case "not-available":
      return translateUi("当前安装包符合此更新通道的最新版本。");
    case "error":
      return translateUi("未能完成版本检查，请确认网络连接后重试。");
    default:
      return translateUi("可在这里查看桌面版版本状态。");
  }
}

export function getDesktopInstallModeLabel(updater: DesktopUpdaterSnapshot): string {
  if (updater.isPortable) {
    return translateUi("便携版");
  }
  if (!updater.isPackaged) {
    return translateUi("开发环境");
  }
  return translateUi("安装版");
}

export function getDesktopChannelLabel(channel: string): string {
  return channel === "beta" ? translateUi("测试通道") : channel === "latest" ? translateUi("稳定通道") : translateUi("{{v0}} 通道", { v0: channel });
}
