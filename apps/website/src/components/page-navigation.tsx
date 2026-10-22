import { ChevronDown, Menu } from "lucide-react";

import { navigationGroups } from "../content";

function NavigationLinks() {
  return (
    <>
      {navigationGroups.map((group) => (
        <section className="navigation-group" key={group.title}>
          <h2>{group.title}</h2>
          <ul>
            {group.links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export function DesktopNavigation() {
  return (
    <aside className="side-navigation" aria-label="页面导航">
      <NavigationLinks />
    </aside>
  );
}

export function MobileNavigation() {
  return (
    <details className="mobile-navigation">
      <summary>
        <span>
          <Menu size={17} aria-hidden="true" />
          浏览本页
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <nav aria-label="移动端页面导航">
        <NavigationLinks />
      </nav>
    </details>
  );
}

export function PageOutline() {
  return (
    <aside className="page-outline" aria-label="本页内容">
      <p>本页内容</p>
      <a href="#what-is-zimo">Zimo 是什么</a>
      <a href="#getting-started">快速开始</a>
      <a href="#user-overview">用户端</a>
      <a href="#user-start">从哪里开始</a>
      <a href="#menu-features">用户端功能</a>
      {/* <a href="#admin-overview">企业管理端</a> */}
    </aside>
  );
}
