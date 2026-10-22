import { CheckCircle2, Info } from "lucide-react";

import { menuFeatureGroups, menuFeatures } from "../menu-features";
import { menuFeatureSteps } from "../menu-feature-steps";

export function MenuFeatureGuide() {
  return (
    <div className="menu-feature-groups">
      {menuFeatureGroups.map((group) => (
        <section className="menu-feature-group" key={group} aria-labelledby={`group-${group}`}>
          <div className="menu-group-heading">
            <span>{group === "工具" ? "展开“工具”查看" : "Zimo 菜单"}</span>
            <h3 id={`group-${group}`}>{group}</h3>
          </div>
          <div className="menu-feature-list">
            {menuFeatures
              .filter((feature) => feature.group === group)
              .map((feature) => {
                const Icon = feature.icon;
                return (
                  <article className="menu-feature" id={feature.id} key={feature.id}>
                    <header className="menu-feature-header">
                      <div className={`menu-feature-icon tone-${feature.tone}`}>
                        <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                      </div>
                      <div>
                        <div className="menu-feature-meta">
                          <span>{feature.eyebrow}</span>
                          <span className={`feature-status status-${feature.status}`}>
                            {feature.status}
                          </span>
                        </div>
                        <p className="menu-label">菜单 · {feature.menuLabel}</p>
                        <h4>{feature.title}</h4>
                      </div>
                    </header>
                    <p className="menu-feature-summary">{feature.summary}</p>
                    <div className="menu-feature-columns">
                      <div>
                        <h5>你可以做什么</h5>
                        <ul>
                          {feature.actions.map((action) => (
                            <li key={action}>
                              <CheckCircle2 size={15} aria-hidden="true" />
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5>如何与其他能力协同</h5>
                        <ul>
                          {feature.collaboration.map((item) => (
                            <li key={item}>
                              <CheckCircle2 size={15} aria-hidden="true" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <ol className="feature-steps">
                      {(menuFeatureSteps[feature.id] ?? []).map((step, index) => (
                        <li key={step.src}>
                          <figure>
                            <figcaption>
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              {step.caption}
                            </figcaption>
                            <div className="feature-step-frame">
                              <img src={step.src} alt={step.alt} width="1440" height="900" />
                            </div>
                          </figure>
                        </li>
                      ))}
                    </ol>
                    {feature.note ? (
                      <div className="feature-note">
                        <Info size={15} aria-hidden="true" />
                        <span>{feature.note}</span>
                      </div>
                    ) : null}
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
