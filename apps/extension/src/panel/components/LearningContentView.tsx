import type { LearningContent } from "@memora/shared";

export function LearningContentView({ content }: { content: LearningContent }) {
  return (
    <section className="learning-card" aria-label="概念解释卡片">
      <div className="learning-card-header">
        <div>
          <span>大概了解</span>
          <h2>概念解释</h2>
        </div>
        <p>{content.concept_type}</p>
      </div>

      <div className="learning-row">
        <span>背景</span>
        <p>{content.background}</p>
      </div>

      <div className="learning-row definition-row">
        <span>一句话定义</span>
        <p>{content.plain_definition}</p>
      </div>

      <div className="learning-row">
        <span>生活化例子</span>
        <p>{content.simple_example}</p>
        <p className="muted">{content.example_mapping}</p>
      </div>
    </section>
  );
}
