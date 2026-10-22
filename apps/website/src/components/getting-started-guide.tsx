import { gettingStartedEntries, gettingStartedSteps } from "../getting-started";

export function GettingStartedGuide() {
  return (
    <div className="getting-started-guide">
      <ol className="guide-steps">
        {gettingStartedSteps.map((step, index) => (
          <li className="guide-step" id={step.id} key={step.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {step.commands ? (
                <pre className="guide-code">
                  <code>{step.commands.join("\n")}</code>
                </pre>
              ) : null}
              {step.notes ? (
                <ul>
                  {step.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <table className="start-table">
        <thead>
          <tr>
            <th>入口</th>
            <th>地址</th>
            <th>用途</th>
          </tr>
        </thead>
        <tbody>
          {gettingStartedEntries.map((entry) => (
            <tr key={entry.name}>
              <td>{entry.name}</td>
              <td>
                <code>{entry.address}</code>
              </td>
              <td>{entry.use}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="guide-followup">
        用户端启动后发一条普通对话即可验收。企业管理端需确认默认模型已配置。
      </p>
    </div>
  );
}
