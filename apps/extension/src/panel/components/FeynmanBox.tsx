import type { FormEvent } from "react";
import { useState } from "react";
import type { FeynmanFeedback } from "@memora/shared";

export function FeynmanBox({
  prompt,
  expectedPoints,
  feedbacks,
  onSubmit
}: {
  prompt: string;
  expectedPoints: string[];
  feedbacks: FeynmanFeedback[];
  onSubmit(value: string): Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const round = Math.min(feedbacks.length + 1, 3);
  const canSubmit = feedbacks.length < 3;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit(value);
      setValue("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="feynman-card feynman-block">
      <div className="panel-card-heading">
        <span>深度理解</span>
        <h2>费曼学习</h2>
      </div>
      <p>{prompt}</p>
      {expectedPoints.length > 0 && (
        <div className="feynman-guide">
          <span>可以讲到</span>
          <ul>
            {expectedPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      )}
      {feedbacks.map((feedback, index) => (
        <div className="feedback-box" key={`${index}-${feedback.understanding_score}`}>
          <span>第 {index + 1} 轮反馈</span>
          <strong>{feedback.understanding_score} 分</strong>
          <p>{feedback.what_is_clear}</p>
          <p>{feedback.missing_or_wrong}</p>
          <p>{feedback.better_explanation}</p>
          {index < 2 && <p className="muted">{feedback.next_question}</p>}
        </div>
      ))}
      {canSubmit && (
        <form onSubmit={submit}>
          <label htmlFor="feynman-explanation">你的解释</label>
          <span>第 {round} 轮解释</span>
          <textarea
            id="feynman-explanation"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <button type="submit" disabled={loading || value.trim().length === 0}>
            {loading ? "提交中..." : "提交解释"}
          </button>
        </form>
      )}
    </section>
  );
}
