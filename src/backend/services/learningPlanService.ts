export interface LearningResource {
  label: string
  url: string
  kind: "video" | "tutorial"
}

export interface LearningPlanItem {
  skill: string
  whyItMatters: string
  practiceTask: string
  estimatedEffort: string
  resources: LearningResource[]
}

interface CuratedSkillGuide {
  tutorialLabel: string
  tutorialUrl: string
  practiceTask: string
  estimatedEffort: string
}

const guides: Record<string, CuratedSkillGuide> = {
  react: {
    tutorialLabel: "React Learn",
    tutorialUrl: "https://react.dev/learn",
    practiceTask: "Build a small searchable list with loading, empty, and error states.",
    estimatedEffort: "6–10 hours"
  },
  typescript: {
    tutorialLabel: "TypeScript Handbook",
    tutorialUrl: "https://www.typescriptlang.org/docs/handbook/intro.html",
    practiceTask: "Convert a small JavaScript project to typed data models and API responses.",
    estimatedEffort: "5–8 hours"
  },
  javascript: {
    tutorialLabel: "MDN JavaScript Guide",
    tutorialUrl: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
    practiceTask: "Write a fetch-based UI that handles success, empty, and failed responses.",
    estimatedEffort: "5–8 hours"
  },
  python: {
    tutorialLabel: "Python Tutorial",
    tutorialUrl: "https://docs.python.org/3/tutorial/",
    practiceTask: "Create a command-line tool that reads a CSV and produces a useful summary.",
    estimatedEffort: "6–10 hours"
  },
  sql: {
    tutorialLabel: "SQLBolt lessons",
    tutorialUrl: "https://sqlbolt.com/",
    practiceTask: "Model a job application tracker and write joins, aggregates, and window queries.",
    estimatedEffort: "4–7 hours"
  },
  postgresql: {
    tutorialLabel: "PostgreSQL Tutorial",
    tutorialUrl: "https://www.postgresql.org/docs/current/tutorial.html",
    practiceTask: "Design and query a job application database with indexes for common filters.",
    estimatedEffort: "5–8 hours"
  },
  docker: {
    tutorialLabel: "Docker Get Started",
    tutorialUrl: "https://docs.docker.com/get-started/",
    practiceTask: "Containerize a small API and run it with a database using Docker Compose.",
    estimatedEffort: "4–7 hours"
  },
  aws: {
    tutorialLabel: "AWS Skill Builder",
    tutorialUrl: "https://explore.skillbuilder.aws/learn",
    practiceTask: "Deploy a static portfolio and document the architecture, security, and cost choices.",
    estimatedEffort: "8–12 hours"
  },
  git: {
    tutorialLabel: "Pro Git book",
    tutorialUrl: "https://git-scm.com/book/en/v2",
    practiceTask: "Use branches, pull requests, and conventional commits for a small feature.",
    estimatedEffort: "3–5 hours"
  },
  node: {
    tutorialLabel: "Node.js Learn",
    tutorialUrl: "https://nodejs.org/en/learn",
    practiceTask: "Build a small REST endpoint with validation and clear error responses.",
    estimatedEffort: "5–8 hours"
  }
}

function normalizeSkill(skill: string) {
  return skill.trim().toLowerCase().replace(/\.js$/i, "").replace(/\s+/g, " ")
}

function makeYouTubeSearchUrl(skill: string) {
  const query = `${skill} tutorial project based beginner to intermediate`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

export function createLearningPlan(skills: string[]): LearningPlanItem[] {
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))].slice(0, 5)

  return uniqueSkills.map((skill) => {
    const guide = guides[normalizeSkill(skill)]
    const tutorialUrl = guide?.tutorialUrl ?? `https://www.google.com/search?q=${encodeURIComponent(`${skill} official documentation tutorial`)}`

    return {
      skill,
      whyItMatters: `This was identified as a missing requirement for the target role. Build evidence of it before adding it to your resume.`,
      practiceTask:
        guide?.practiceTask ?? `Build a small, publicly shareable project that uses ${skill} to solve one concrete problem.`,
      estimatedEffort: guide?.estimatedEffort ?? "4–8 hours for foundations",
      resources: [
        { label: `YouTube: learn ${skill}`, url: makeYouTubeSearchUrl(skill), kind: "video" },
        { label: guide?.tutorialLabel ?? `${skill} documentation`, url: tutorialUrl, kind: "tutorial" }
      ]
    }
  })
}
