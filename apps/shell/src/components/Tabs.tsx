import { navigate, route } from "../router";
import { t } from "../i18n/es";
import { Icon, type IconName } from "./Icon";

const TABS: Array<{ name: "home" | "ranking" | "profile"; icon: IconName; label: "tabs.games" | "tabs.ranking" | "tabs.profile" }> = [
  { name: "home", icon: "games", label: "tabs.games" },
  { name: "ranking", icon: "ranking", label: "tabs.ranking" },
  { name: "profile", icon: "user", label: "tabs.profile" },
];

export function Tabs() {
  const current = route.value.name;
  return (
    <nav class="tabs" aria-label="Principal" style={{ "--tab-i": Math.max(0, TABS.findIndex((x) => x.name === current)) }}>
      <span class="tabs__bar" aria-hidden="true" />
      {TABS.map((tab) => (
        <button
          key={tab.name} type="button" class="tab" aria-current={current === tab.name ? "page" : undefined}
          onClick={() => navigate({ name: tab.name })}
        >
          <Icon name={tab.icon} />
          {t(tab.label)}
        </button>
      ))}
    </nav>
  );
}
