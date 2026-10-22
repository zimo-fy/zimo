import { CheckCircle2 } from "lucide-react";

import { adminFeatureGroups, adminFeatures } from "../admin-features";

export function AdminFeatureGuide() {
  return (
    <div className="menu-feature-groups admin-feature-groups">
      {adminFeatureGroups.map((group) => (
        <section className="menu-feature-group" key={group} aria-labelledby={`admin-${group}`}>
          <div className="menu-group-heading">
            <span>企业管理端</span>
            <h3 id={`admin-${group}`}>{group}</h3>
          </div>
          <div className="menu-feature-list">
            {adminFeatures
              .filter((feature) => feature.group === group)
              .map((feature) => (
                <article className="menu-feature admin-feature" id={feature.id} key={feature.id}>
                  <header className="admin-feature-header">
                    <div className="menu-feature-meta">
                      <span>{group}</span>
                    </div>
                    <h4>{feature.title}</h4>
                  </header>
                  <p className="menu-feature-summary">{feature.summary}</p>
                  <div className="menu-feature-columns">
                    <div>
                      <h5>管理员可以做什么</h5>
                      <ul>
                        {feature.actions.map((action) => (
                          <li key={action}>
                            <CheckCircle2 size={15} aria-hidden="true" />
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
