export const satTaxonomy = {
  reading_writing: {
    label: "Reading and Writing",
    domains: {
      information_ideas: {
        label: "Information and Ideas",
        skills: [
          "Central Ideas and Details",
          "Command of Evidence",
          "Inferences",
        ],
      },
      craft_structure: {
        label: "Craft and Structure",
        skills: [
          "Words in Context",
          "Text Structure and Purpose",
          "Cross-Text Connections",
        ],
      },
      expression_ideas: {
        label: "Expression of Ideas",
        skills: ["Rhetorical Synthesis", "Transitions"],
      },
      standard_english: {
        label: "Standard English Conventions",
        skills: ["Boundaries", "Form, Structure, and Sense"],
      },
    },
  },
  math: {
    label: "Math",
    domains: {
      algebra: {
        label: "Algebra",
        skills: [
          "Linear equations in one variable",
          "Linear functions",
          "Linear equations in two variables",
          "Systems of two linear equations in two variables",
          "Linear inequalities in one or two variables",
        ],
      },
      advanced_math: {
        label: "Advanced Math",
        skills: [
          "Equivalent expressions",
          "Nonlinear equations in one variable",
          "Systems of equations in two variables",
          "Nonlinear functions",
        ],
      },
      problem_solving_data: {
        label: "Problem-Solving and Data Analysis",
        skills: [
          "Ratios, rates, proportional relationships, and units",
          "Percentages",
          "One-variable data",
          "Two-variable data",
          "Probability and conditional probability",
          "Inference from sample statistics and margin of error",
          "Evaluating statistical claims",
        ],
      },
      geometry_trigonometry: {
        label: "Geometry and Trigonometry",
        skills: [
          "Area and volume",
          "Lines, angles, and triangles",
          "Right triangles and trigonometry",
          "Circles",
        ],
      },
    },
  },
} as const;

export type SatSection = keyof typeof satTaxonomy;
export type SatDomain =
  | keyof (typeof satTaxonomy)["reading_writing"]["domains"]
  | keyof (typeof satTaxonomy)["math"]["domains"];
export type SatDifficulty = "easy" | "medium" | "hard";
export type SatQuestion = {
  id: string;
  version: number;
  section: SatSection;
  domain: SatDomain;
  skill: string;
  difficulty: SatDifficulty;
  format: "multiple_choice" | "student_produced_response";
  prompt: string;
  passage?: string;
  choices?: Array<{ id: "A" | "B" | "C" | "D"; text: string }>;
  correctAnswer: string;
  explanation: string;
  distractorExplanations?: Partial<Record<"A" | "B" | "C" | "D", string>>;
  hints: string[];
  source: { type: "unlocked_authored"; label: string; sourceUrl?: string };
  validationStatus: "draft" | "needs_review" | "validated" | "retired";
  calculator: "allowed";
  content?: { kind: "text" | "table" | "equation"; value: string }[];
};

const source = {
  type: "unlocked_authored" as const,
  label: "UnlockED original practice",
};
export const satQuestionBank: SatQuestion[] = [
  {
    id: "rw-central-park",
    version: 1,
    section: "reading_writing",
    domain: "information_ideas",
    skill: "Central Ideas and Details",
    difficulty: "medium",
    format: "multiple_choice",
    passage:
      "Urban ecologist Mina Patel compared summer temperatures on streets with mature tree canopies to temperatures on nearby streets without trees. The shaded streets were cooler during the afternoon, but the difference narrowed after sunset. Patel cautioned that tree planting is only one part of reducing neighborhood heat because building materials and access to air-conditioning also shape residents’ exposure.",
    prompt: "Which choice best states the main idea of the text?",
    choices: [
      {
        id: "A",
        text: "Tree planting eliminates the effects of summer heat in most neighborhoods.",
      },
      {
        id: "B",
        text: "Mature trees can reduce daytime street temperatures, but other factors also influence heat exposure.",
      },
      {
        id: "C",
        text: "Building materials affect nighttime temperatures more than tree cover does.",
      },
      {
        id: "D",
        text: "Air-conditioning is a more effective response to heat than planting trees.",
      },
    ],
    correctAnswer: "B",
    explanation:
      "The text reports a daytime cooling effect from mature tree cover and then qualifies that finding by naming other influences on heat exposure. Choice B preserves both ideas.",
    distractorExplanations: {
      A: "The passage says tree planting is only one part of the response, not a complete solution.",
      C: "The study does not compare the relative nighttime effects of materials and trees.",
      D: "The passage names air-conditioning as another factor but does not rank the responses.",
    },
    hints: [
      "Look for a choice that includes both the study’s finding and Patel’s caution.",
      "Avoid choices that turn a limited finding into an absolute claim.",
    ],
    source,
    validationStatus: "validated",
    calculator: "allowed",
  },
  {
    id: "rw-word-reserved",
    version: 1,
    section: "reading_writing",
    domain: "craft_structure",
    skill: "Words in Context",
    difficulty: "easy",
    format: "multiple_choice",
    passage:
      "Although the architect’s early sketches were exuberant, the completed library is more reserved: its simple brick exterior gives little indication of the bright, open rooms inside.",
    prompt: "As used in the text, “reserved” most nearly means",
    choices: [
      { id: "A", text: "set aside" },
      { id: "B", text: "restrained" },
      { id: "C", text: "uncertain" },
      { id: "D", text: "scheduled" },
    ],
    correctAnswer: "B",
    explanation:
      "The colon explains the contrast: the finished exterior is simple rather than exuberant. In this context, “reserved” means restrained or understated.",
    distractorExplanations: {
      A: "Nothing has been held for later use.",
      C: "The building’s design is described, not its confidence.",
      D: "The word does not refer to an appointment or time.",
    },
    hints: ["Use the description after the colon as a definition clue."],
    source,
    validationStatus: "validated",
    calculator: "allowed",
  },
  {
    id: "rw-transition-result",
    version: 1,
    section: "reading_writing",
    domain: "expression_ideas",
    skill: "Transitions",
    difficulty: "easy",
    format: "multiple_choice",
    passage:
      "A research team expected the new coating to make solar panels slightly more efficient. In field tests, the coated panels generated 12 percent more electricity than untreated panels. _____ the team expanded the study to three additional climates.",
    prompt: "Which choice completes the text with the most logical transition?",
    choices: [
      { id: "A", text: "As a result," },
      { id: "B", text: "In contrast," },
      { id: "C", text: "For example," },
      { id: "D", text: "Meanwhile," },
    ],
    correctAnswer: "A",
    explanation:
      "The expansion of the study is a consequence of the promising field-test result, so “As a result” expresses the relationship precisely.",
    distractorExplanations: {
      B: "The final sentence does not contrast with the test result.",
      C: "The final sentence is not an example of the result.",
      D: "The events are causally connected, not merely simultaneous.",
    },
    hints: ["Ask how the successful result affected the team’s next action."],
    source,
    validationStatus: "validated",
    calculator: "allowed",
  },
  {
    id: "rw-boundaries-comet",
    version: 1,
    section: "reading_writing",
    domain: "standard_english",
    skill: "Boundaries",
    difficulty: "medium",
    format: "multiple_choice",
    passage:
      "Astronomer Maria Mitchell discovered a comet in 1847 _____ the achievement brought her international recognition and a medal from the king of Denmark.",
    prompt:
      "Which choice completes the text so that it conforms to Standard English conventions?",
    choices: [
      { id: "A", text: ", the" },
      { id: "B", text: "; the" },
      { id: "C", text: "the" },
      { id: "D", text: " and, the" },
    ],
    correctAnswer: "B",
    explanation:
      "The text contains two independent clauses. A semicolon can join them without a coordinating conjunction, so choice B creates a complete, correctly punctuated sentence.",
    distractorExplanations: {
      A: "A comma alone creates a comma splice between two independent clauses.",
      C: "No punctuation separates the independent clauses.",
      D: "A comma should not follow the coordinating conjunction here.",
    },
    hints: [
      "Check whether the words on both sides of the blank could stand as complete sentences.",
    ],
    source,
    validationStatus: "validated",
    calculator: "allowed",
  },
  {
    id: "rw-inference-seeds",
    version: 1,
    section: "reading_writing",
    domain: "information_ideas",
    skill: "Inferences",
    difficulty: "hard",
    format: "multiple_choice",
    passage:
      "Researchers stored seeds from the same plant species under two conditions. After five years, 82 percent of seeds kept at low humidity germinated, compared with 48 percent kept at moderate humidity. The researchers note that the result may not apply to species whose seeds naturally retain high moisture levels.",
    prompt: "Which conclusion is best supported by the text?",
    choices: [
      {
        id: "A",
        text: "Low-humidity storage improves five-year germination for every plant species.",
      },
      {
        id: "B",
        text: "Moderate humidity prevents nearly half of all seeds from germinating.",
      },
      {
        id: "C",
        text: "For the species studied, lower-humidity storage was associated with a higher germination rate after five years.",
      },
      {
        id: "D",
        text: "Seed moisture level is the only factor that affects long-term germination.",
      },
    ],
    correctAnswer: "C",
    explanation:
      "Choice C limits the conclusion to the studied species and describes the observed association accurately. The researchers explicitly warn against extending the result to every species.",
    distractorExplanations: {
      A: "This overgeneralizes beyond the studied species.",
      B: "The percentage applies to one species and does not establish prevention or causation.",
      D: "The study does not claim moisture is the only relevant factor.",
    },
    hints: [
      "Prefer the conclusion that matches both the data and the researchers’ limitation.",
    ],
    source,
    validationStatus: "validated",
    calculator: "allowed",
  },
  {
    id: "math-linear-rental",
    version: 1,
    section: "math",
    domain: "algebra",
    skill: "Linear equations in one variable",
    difficulty: "easy",
    format: "multiple_choice",
    prompt:
      "A bicycle rental shop charges a fixed fee of $8 plus $5 for each hour. If a rental costs $33 in total, how many hours was the bicycle rented?",
    choices: [
      { id: "A", text: "4" },
      { id: "B", text: "5" },
      { id: "C", text: "6" },
      { id: "D", text: "8" },
    ],
    correctAnswer: "B",
    explanation:
      "Let h be the number of hours. The cost equation is 8 + 5h = 33. Subtracting 8 gives 5h = 25, so h = 5.",
    distractorExplanations: {
      A: "This results from subtracting incorrectly or overlooking one hour.",
      C: "Six hours would cost $38.",
      D: "Eight is the fixed fee, not the number of hours.",
    },
    hints: [
      "Write total cost as fixed fee plus hourly cost.",
      "Subtract the fixed fee before dividing by the hourly rate.",
    ],
    source,
    validationStatus: "validated",
    calculator: "allowed",
    content: [{ kind: "equation", value: "8 + 5h = 33" }],
  },
  {
    id: "math-quadratic-k",
    version: 1,
    section: "math",
    domain: "advanced_math",
    skill: "Nonlinear equations in one variable",
    difficulty: "medium",
    format: "multiple_choice",
    prompt:
      "The equation x² − 10x + k = 0 has exactly one real solution. What is the value of k?",
    choices: [
      { id: "A", text: "10" },
      { id: "B", text: "20" },
      { id: "C", text: "25" },
      { id: "D", text: "100" },
    ],
    correctAnswer: "C",
    explanation:
      "A quadratic has exactly one real solution when its discriminant is 0. Here, (−10)² − 4(1)(k) = 0, so 100 − 4k = 0 and k = 25. Equivalently, the expression becomes (x − 5)².",
    distractorExplanations: {
      A: "This uses the coefficient of x without applying the discriminant.",
      B: "This does not make the discriminant zero.",
      D: "This squares 10 but omits division by 4.",
    },
    hints: [
      "Exactly one real solution means the quadratic has a repeated root.",
      "Set the discriminant b² − 4ac equal to zero.",
    ],
    source,
    validationStatus: "validated",
    calculator: "allowed",
    content: [{ kind: "equation", value: "x² − 10x + k = 0" }],
  },
  {
    id: "math-percent-library",
    version: 1,
    section: "math",
    domain: "problem_solving_data",
    skill: "Percentages",
    difficulty: "medium",
    format: "student_produced_response",
    prompt:
      "A library’s collection increased from 24,000 items to 27,600 items. What was the percent increase? Enter your answer as a number without the percent sign.",
    correctAnswer: "15",
    explanation:
      "The increase is 27,600 − 24,000 = 3,600. Divide the increase by the original amount: 3,600 ÷ 24,000 = 0.15, which is 15 percent.",
    hints: [
      "Percent change uses the original amount as the denominator.",
      "Find the increase first, then divide by 24,000.",
    ],
    source,
    validationStatus: "validated",
    calculator: "allowed",
    content: [
      { kind: "equation", value: "percent increase = change ÷ original × 100" },
    ],
  },
  {
    id: "math-circle-area",
    version: 1,
    section: "math",
    domain: "geometry_trigonometry",
    skill: "Circles",
    difficulty: "easy",
    format: "multiple_choice",
    prompt: "A circle has radius 6. What is its area?",
    choices: [
      { id: "A", text: "6π" },
      { id: "B", text: "12π" },
      { id: "C", text: "24π" },
      { id: "D", text: "36π" },
    ],
    correctAnswer: "D",
    explanation:
      "The area of a circle is A = πr². Substituting r = 6 gives A = π(6²) = 36π.",
    distractorExplanations: {
      A: "This multiplies π by the radius without squaring.",
      B: "This is the circumference, 2πr.",
      C: "This does not follow the area formula.",
    },
    hints: ["Use the formula for area, not circumference."],
    source,
    validationStatus: "validated",
    calculator: "allowed",
    content: [{ kind: "equation", value: "A = πr²" }],
  },
  {
    id: "math-system-tickets",
    version: 1,
    section: "math",
    domain: "algebra",
    skill: "Systems of two linear equations in two variables",
    difficulty: "hard",
    format: "student_produced_response",
    prompt:
      "At a school performance, adult tickets cost $12 and student tickets cost $7. A total of 180 tickets were sold for $1,610. How many student tickets were sold?",
    correctAnswer: "110",
    explanation:
      "Let a be adult tickets and s be student tickets. Then a + s = 180 and 12a + 7s = 1,610. Substitute a = 180 − s: 12(180 − s) + 7s = 1,610. This simplifies to 2,160 − 5s = 1,610, so s = 110.",
    hints: [
      "Create one equation for the number of tickets and another for revenue.",
      "Substitute a = 180 − s into the revenue equation.",
    ],
    source,
    validationStatus: "validated",
    calculator: "allowed",
    content: [{ kind: "equation", value: "a + s = 180; 12a + 7s = 1,610" }],
  },
];

export type SatAttemptRecord = {
  questionId: string;
  questionVersion: number;
  answer: string;
  correct: boolean;
  elapsedSeconds?: number;
  markedForReview: boolean;
  attemptedAt: string;
  reflection?:
    | "didnt_know"
    | "misread"
    | "calculation"
    | "time"
    | "changed_answer"
    | "careless"
    | "not_sure";
};
export type SatPracticeSession = {
  id: string;
  mode: "quick" | "focused" | "reattempt";
  section?: SatSection;
  domain?: SatDomain;
  difficulty?: SatDifficulty;
  timed: boolean;
  durationSeconds?: number;
  questionIds: string[];
  attempts: SatAttemptRecord[];
  status: "active" | "completed";
  createdAt: string;
  completedAt?: string;
};
export type SatPracticeStore = {
  privacy: "private";
  sessions: SatPracticeSession[];
  version: number;
  updatedAt?: string;
};
export const emptySatPracticeStore = (): SatPracticeStore => ({
  privacy: "private",
  sessions: [],
  version: 0,
});

export function validateSatQuestion(question: SatQuestion) {
  const errors: string[] = [];
  const section = satTaxonomy[question.section];
  const domain =
    section &&
    (section.domains as Record<string, { skills: readonly string[] }>)[
      question.domain
    ];
  if (!domain) errors.push("invalid domain");
  else if (!domain.skills.includes(question.skill))
    errors.push("invalid skill");
  if (!question.prompt.trim()) errors.push("missing prompt");
  if (!question.correctAnswer.trim()) errors.push("missing answer");
  if (question.explanation.trim().length < 40)
    errors.push("missing useful explanation");
  if (!question.source.label) errors.push("missing source");
  if (question.format === "multiple_choice") {
    if (question.choices?.length !== 4)
      errors.push("multiple choice must have four choices");
    if (
      new Set(
        question.choices?.map((choice) => choice.text.trim().toLowerCase()),
      ).size !== question.choices?.length
    )
      errors.push("duplicate choices");
    if (
      !question.choices?.some((choice) => choice.id === question.correctAnswer)
    )
      errors.push("answer not in choices");
  }
  return errors;
}

export const validatedSatQuestions = satQuestionBank.filter(
  (question) =>
    question.validationStatus === "validated" &&
    !validateSatQuestion(question).length,
);

export function normalizeSatPracticeStore(value: unknown): SatPracticeStore {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return emptySatPracticeStore();
  const input = value as Partial<SatPracticeStore>;
  const ids = new Set(satQuestionBank.map((question) => question.id));
  const safeTime = (value: unknown) =>
    typeof value === "string" && Number.isFinite(Date.parse(value))
      ? new Date(value).toISOString()
      : new Date().toISOString();
  const sessions = (input.sessions ?? []).slice(-200).flatMap((raw) => {
    if (
      !raw ||
      !raw.id ||
      !["quick", "focused", "reattempt"].includes(raw.mode) ||
      !["active", "completed"].includes(raw.status)
    )
      return [];
    const questionIds = raw.questionIds
      .filter((id) => ids.has(id))
      .slice(0, 30);
    if (!questionIds.length) return [];
    const attempts = raw.attempts
      .filter(
        (attempt) =>
          questionIds.includes(attempt.questionId) &&
          ids.has(attempt.questionId),
      )
      .slice(-100)
      .map((attempt) => ({
        ...attempt,
        answer: String(attempt.answer).slice(0, 80),
        correct: Boolean(attempt.correct),
        markedForReview: Boolean(attempt.markedForReview),
        attemptedAt: safeTime(attempt.attemptedAt),
      }));
    return [
      {
        ...raw,
        questionIds,
        attempts,
        status: raw.status,
        createdAt: safeTime(raw.createdAt),
        completedAt: raw.completedAt ? safeTime(raw.completedAt) : undefined,
      },
    ];
  });
  return {
    privacy: "private",
    sessions,
    version: Number.isInteger(input.version) ? Number(input.version) : 0,
    updatedAt: input.updatedAt,
  };
}

export function satPerformance(store: SatPracticeStore) {
  const questionMap = new Map(
    satQuestionBank.map((question) => [question.id, question]),
  );
  const attempts = store.sessions.flatMap((session) => session.attempts);
  const groups = new Map<
    string,
    {
      section: SatSection;
      domain: SatDomain;
      label: string;
      attempted: number;
      correct: number;
      lastAttempt?: string;
    }
  >();
  for (const attempt of attempts) {
    const question = questionMap.get(attempt.questionId);
    if (!question) continue;
    const label = (
      satTaxonomy[question.section].domains as Record<string, { label: string }>
    )[question.domain].label;
    const group = groups.get(question.domain) ?? {
      section: question.section,
      domain: question.domain,
      label,
      attempted: 0,
      correct: 0,
    };
    group.attempted += 1;
    group.correct += attempt.correct ? 1 : 0;
    group.lastAttempt =
      !group.lastAttempt || attempt.attemptedAt > group.lastAttempt
        ? attempt.attemptedAt
        : group.lastAttempt;
    groups.set(question.domain, group);
  }
  return {
    attempts,
    domains: [...groups.values()],
    mistakes: attempts.filter((attempt) => !attempt.correct),
    marked: attempts.filter((attempt) => attempt.markedForReview),
  };
}
