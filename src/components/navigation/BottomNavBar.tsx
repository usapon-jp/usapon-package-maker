import { HomeIcon, FolderIcon, SettingsIcon } from "../common/UiIcons";

export type BottomNavTab = "home" | "my-designs" | "settings";

export function BottomNavBar({ activeTab, onChange }: { activeTab: BottomNavTab; onChange: (tab: BottomNavTab) => void }) {
  const items = [
    { id: "home" as const, label: "ホーム", icon: <HomeIcon /> },
    { id: "my-designs" as const, label: "マイデザイン", icon: <FolderIcon /> },
    { id: "settings" as const, label: "設定", icon: <SettingsIcon /> },
  ];
  return <nav className="mobile-bottom-nav" data-ui-id="global.bottom-nav" aria-label="メインメニュー">{items.map((item) => <button key={item.id} type="button" className={`${activeTab === item.id ? "is-active" : ""}`} onClick={() => onChange(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
}
