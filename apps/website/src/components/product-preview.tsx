export function ProductPreview() {
  return (
    <figure className="product-preview">
      <div className="product-screenshot-frame">
        <picture>
          <source media="(max-width: 620px)" srcSet="/screenshots/zimo-conversation-mobile.png" />
          <img
            src="/screenshots/zimo-conversation.png"
            alt="Zimo 桌面应用的新建任务界面，左侧展示 Agent、Skill 与工具导航，主区域提供任务输入和能力选择"
            width="1440"
            height="900"
          />
        </picture>
      </div>
      <figcaption>
        <span>真实产品界面</span>
        截取自 Zimo Desktop 隔离测试环境，内容不含真实账号或用户数据
      </figcaption>
    </figure>
  );
}
