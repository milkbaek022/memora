import { useState } from "react";
import type { QuizQuestion } from "@memora/shared";

export function QuizView({ questions }: { questions: QuizQuestion[] }) {
  if (questions.length === 0) {
    return null;
  }

  return <QuizQuestionSet key={getQuestionSetKey(questions)} questions={questions} />;
}

function getQuestionSetKey(questions: QuizQuestion[]): string {
  return JSON.stringify(
    questions.map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options.map((option) => [option.id, option.text]),
      correct: question.correct_option_id,
      explanation: question.explanation
    }))
  );
}

function QuizQuestionSet({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <section className="quiz-stack">
      <div className="panel-card-heading">
        <span>深入理解</span>
        <h2>巩固测试</h2>
      </div>
      {questions.map((question) => {
        const selected = answers[question.id];
        const isCorrect = selected === question.correct_option_id;
        return (
          <div className="quiz-card" key={question.id}>
            <p>{question.question}</p>
            <div className="quiz-options">
              {question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={selected === option.id ? "selected" : ""}
                  onClick={() =>
                    setAnswers((currentAnswers) => ({
                      ...currentAnswers,
                      [question.id]: option.id
                    }))
                  }
                >
                  {option.text}
                </button>
              ))}
            </div>
            {selected && (
              <p className={isCorrect ? "answer-correct" : "answer-wrong"}>
                {question.explanation}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
