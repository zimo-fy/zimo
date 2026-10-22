import { ArrowUpRight } from "lucide-react";

import { SiteLogo } from "./site-logo";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <SiteLogo />
        <nav className="top-navigation" aria-label="顶部导航">
          <a href="#getting-started">快速开始</a>
          <a href="#user-overview">用户端</a>
          {/* <a href="#admin-overview">企业管理端</a> */}
          <a className="top-cta" href="#getting-started">
            部署入口
            <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
}
