import { BoxIcon, EnvelopeIcon, FolderIcon, PlusIcon, SettingsIcon } from "../common/UiIcons";

export type BottomNavTab = "box" | "letter-set" | "new" | "my-designs" | "settings";

export function BottomNavBar({ activeTab, onChange }: { activeTab: BottomNavTab; onChange: (tab: BottomNavTab) => void }) {
  const items = [
    { id: "box" as const, label: "BOX", icon: <BoxIcon /> },
    { id: "letter-set" as const, label: "レターセット", icon: <EnvelopeIcon /> },
    { id: "new" as const, label: "新規", icon: <PlusIcon /> },
    { id: "my-designs" as const, label: "マイデザイン", icon: <FolderIcon /> },
    { id: "settings" as const, label: "設定", icon: <SettingsIcon /> },
  ];
  return <nav className="mobile-bottom-nav" aria-label="メインメニュー">{items.map((item) => <button key={item.id} type="button" className={`${activeTab === item.id ? "is-active" : ""} ${item.id === "new" ? "is-new" : ""}`} onClick={() => onChange(item.id)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
}
