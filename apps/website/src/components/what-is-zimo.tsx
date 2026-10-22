import { whatIsZimoLead, whatIsZimoSentence, zimoOfferings, zimoScenarios } from "../what-is-zimo";
import { ProductPreview } from "./product-preview";

export function WhatIsZimo() {
  return (
    <section className="hero-section" id="what-is-zimo">
      <p className="hero-kicker">平台概览</p>
      <h1>Zimo 是什么</h1>
      <p className="hero-lead">{whatIsZimoLead}</p>
      <div className="definition-callout">
        <strong>一句话理解 Zimo：</strong>
        <span>{whatIsZimoSentence}</span>
      </div>
      {/* <ProductPreview /> */}
      <div className="intro-block">
        <h2>Zimo 提供什么</h2>
        <ul className="page-compose">
          {zimoOfferings.map((offering) => (
            <li key={offering.title}>
              <strong>{offering.title}</strong>
              <span>{offering.summary}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="intro-block">
        <h2>适合什么场景</h2>
        <ul className="scenario-list">
          {zimoScenarios.map((scenario) => (
            <li key={scenario}>{scenario}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
