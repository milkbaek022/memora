import type { FormEvent } from "react";
import { useState } from "react";

import { ErrorNotice } from "./ErrorNotice";
import { PotionMotion } from "./PotionMotion";

export function InviteGate({
  error,
  onSubmit
}: {
  error: string | null;
  onSubmit(code: string): Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit(code.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="invite-shell">
      <form className="invite-card" onSubmit={submit}>
        <PotionMotion />

        <div className="invite-copy">
          <p className="eyebrow">Memora 记忆药水</p>
          <h1>输入邀请码</h1>
        </div>

        <label htmlFor="invite-code">邀请码</label>
        <input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="BETA-001"
          autoComplete="off"
        />
        <button type="submit" disabled={loading || code.trim().length === 0}>
          {loading ? "验证中..." : "开始学习"}
        </button>
        {error && (
          <div className="invite-error">
            <ErrorNotice message={error} />
          </div>
        )}
      </form>
    </main>
  );
}
