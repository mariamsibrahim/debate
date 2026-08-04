export type SeedCategory =
  | "POLITICS"
  | "SCIENCE"
  | "HISTORY"
  | "TECHNOLOGY"
  | "SPORTS"
  | "ENTERTAINMENT"
  | "PHILOSOPHY"
  | "ECONOMICS"
  | "GENERAL";

export interface SeedTopic {
  title: string;
  category: SeedCategory;
  subcategory: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  popularity: number;
  controversy: number;
  qualityScore: number;
  requiresSources: boolean;
  estDebateMinutes: number;
}

// The permanent evergreen library (blueprint §11). Hand-curated, timeless,
// genuinely contestable resolutions — the backbone of the topic taxonomy
// that the live Debate Intelligence Engine (future work) builds on top of.
export const EVERGREEN_TOPICS: SeedTopic[] = [
  // Philosophy
  { title: "Free will does not exist", category: "PHILOSOPHY", subcategory: "Metaphysics", difficulty: "ADVANCED", popularity: 78, controversy: 70, qualityScore: 92, requiresSources: false, estDebateMinutes: 20 },
  { title: "Nature matters more than nurture in shaping who we are", category: "PHILOSOPHY", subcategory: "Human Nature", difficulty: "INTERMEDIATE", popularity: 74, controversy: 65, qualityScore: 88, requiresSources: true, estDebateMinutes: 15 },
  { title: "Happiness is the ultimate meaning of life", category: "PHILOSOPHY", subcategory: "Ethics", difficulty: "INTERMEDIATE", popularity: 80, controversy: 55, qualityScore: 90, requiresSources: false, estDebateMinutes: 15 },
  { title: "It is sometimes morally right to lie", category: "PHILOSOPHY", subcategory: "Ethics", difficulty: "BEGINNER", popularity: 71, controversy: 60, qualityScore: 86, requiresSources: false, estDebateMinutes: 10 },
  { title: "Animal testing is morally justifiable for medical research", category: "PHILOSOPHY", subcategory: "Applied Ethics", difficulty: "INTERMEDIATE", popularity: 68, controversy: 78, qualityScore: 90, requiresSources: true, estDebateMinutes: 15 },
  { title: "A person's identity is defined by their memories", category: "PHILOSOPHY", subcategory: "Personal Identity", difficulty: "ADVANCED", popularity: 55, controversy: 40, qualityScore: 84, requiresSources: false, estDebateMinutes: 20 },
  { title: "Religion and science are fundamentally compatible", category: "PHILOSOPHY", subcategory: "Philosophy of Religion", difficulty: "INTERMEDIATE", popularity: 82, controversy: 85, qualityScore: 91, requiresSources: true, estDebateMinutes: 20 },

  // Politics
  { title: "Voting should be mandatory", category: "POLITICS", subcategory: "Democracy", difficulty: "BEGINNER", popularity: 75, controversy: 68, qualityScore: 89, requiresSources: true, estDebateMinutes: 15 },
  { title: "A technocracy would govern better than a democracy", category: "POLITICS", subcategory: "Systems of Government", difficulty: "ADVANCED", popularity: 60, controversy: 72, qualityScore: 87, requiresSources: true, estDebateMinutes: 20 },
  { title: "Nations should adopt stricter immigration controls", category: "POLITICS", subcategory: "Immigration", difficulty: "INTERMEDIATE", popularity: 88, controversy: 92, qualityScore: 88, requiresSources: true, estDebateMinutes: 20 },
  { title: "Term limits should apply to all national legislators", category: "POLITICS", subcategory: "Governance", difficulty: "BEGINNER", popularity: 65, controversy: 55, qualityScore: 85, requiresSources: true, estDebateMinutes: 15 },
  { title: "Free speech should have no legal limits", category: "POLITICS", subcategory: "Civil Liberties", difficulty: "INTERMEDIATE", popularity: 84, controversy: 88, qualityScore: 92, requiresSources: true, estDebateMinutes: 20 },
  { title: "Governments should be allowed to censor misinformation online", category: "POLITICS", subcategory: "Free Speech", difficulty: "INTERMEDIATE", popularity: 86, controversy: 90, qualityScore: 90, requiresSources: true, estDebateMinutes: 20 },
  { title: "Monarchies still have a legitimate place in the modern world", category: "POLITICS", subcategory: "Systems of Government", difficulty: "BEGINNER", popularity: 58, controversy: 60, qualityScore: 83, requiresSources: false, estDebateMinutes: 15 },
  { title: "Gun ownership should be significantly more restricted", category: "POLITICS", subcategory: "Public Safety", difficulty: "INTERMEDIATE", popularity: 90, controversy: 95, qualityScore: 90, requiresSources: true, estDebateMinutes: 20 },
  { title: "The death penalty should be abolished worldwide", category: "POLITICS", subcategory: "Justice", difficulty: "INTERMEDIATE", popularity: 79, controversy: 85, qualityScore: 90, requiresSources: true, estDebateMinutes: 20 },

  // Economics
  { title: "Universal Basic Income should be implemented nationally", category: "ECONOMICS", subcategory: "Social Policy", difficulty: "INTERMEDIATE", popularity: 85, controversy: 78, qualityScore: 91, requiresSources: true, estDebateMinutes: 20 },
  { title: "Capitalism produces better outcomes than socialism", category: "ECONOMICS", subcategory: "Economic Systems", difficulty: "ADVANCED", popularity: 89, controversy: 93, qualityScore: 90, requiresSources: true, estDebateMinutes: 20 },
  { title: "Billionaires should not exist", category: "ECONOMICS", subcategory: "Wealth Inequality", difficulty: "INTERMEDIATE", popularity: 87, controversy: 89, qualityScore: 88, requiresSources: true, estDebateMinutes: 15 },
  { title: "The minimum wage should be significantly raised", category: "ECONOMICS", subcategory: "Labor", difficulty: "INTERMEDIATE", popularity: 80, controversy: 75, qualityScore: 87, requiresSources: true, estDebateMinutes: 15 },
  { title: "College tuition should be free at public universities", category: "ECONOMICS", subcategory: "Education Policy", difficulty: "BEGINNER", popularity: 82, controversy: 74, qualityScore: 88, requiresSources: true, estDebateMinutes: 15 },
  { title: "Cryptocurrency will replace traditional banking within a generation", category: "ECONOMICS", subcategory: "Finance", difficulty: "INTERMEDIATE", popularity: 76, controversy: 70, qualityScore: 85, requiresSources: true, estDebateMinutes: 15 },
  { title: "Universal healthcare should be a guaranteed right", category: "ECONOMICS", subcategory: "Healthcare Policy", difficulty: "INTERMEDIATE", popularity: 83, controversy: 80, qualityScore: 89, requiresSources: true, estDebateMinutes: 20 },

  // Technology
  { title: "AI will replace most software engineering jobs within a decade", category: "TECHNOLOGY", subcategory: "Artificial Intelligence", difficulty: "INTERMEDIATE", popularity: 94, controversy: 82, qualityScore: 93, requiresSources: true, estDebateMinutes: 15 },
  { title: "AI should replace human teachers in classrooms", category: "TECHNOLOGY", subcategory: "AI in Education", difficulty: "INTERMEDIATE", popularity: 88, controversy: 80, qualityScore: 91, requiresSources: true, estDebateMinutes: 15 },
  { title: "Advanced AI systems deserve some form of moral consideration", category: "TECHNOLOGY", subcategory: "AI Ethics", difficulty: "ADVANCED", popularity: 79, controversy: 76, qualityScore: 89, requiresSources: false, estDebateMinutes: 20 },
  { title: "Social media has done more harm than good to society", category: "TECHNOLOGY", subcategory: "Social Media", difficulty: "BEGINNER", popularity: 91, controversy: 78, qualityScore: 90, requiresSources: true, estDebateMinutes: 15 },
  { title: "Governments should regulate AI development more aggressively", category: "TECHNOLOGY", subcategory: "AI Regulation", difficulty: "INTERMEDIATE", popularity: 90, controversy: 84, qualityScore: 92, requiresSources: true, estDebateMinutes: 20 },
  { title: "Privacy should be valued over national security", category: "TECHNOLOGY", subcategory: "Privacy", difficulty: "INTERMEDIATE", popularity: 81, controversy: 79, qualityScore: 88, requiresSources: true, estDebateMinutes: 15 },
  { title: "Genetic engineering of human embryos should be permitted", category: "TECHNOLOGY", subcategory: "Bioethics", difficulty: "ADVANCED", popularity: 77, controversy: 86, qualityScore: 90, requiresSources: true, estDebateMinutes: 20 },
  { title: "Humanity should prioritize colonizing Mars this century", category: "TECHNOLOGY", subcategory: "Space Exploration", difficulty: "INTERMEDIATE", popularity: 84, controversy: 60, qualityScore: 88, requiresSources: true, estDebateMinutes: 15 },

  // Science
  { title: "Nuclear energy is the best path to decarbonization", category: "SCIENCE", subcategory: "Energy", difficulty: "INTERMEDIATE", popularity: 83, controversy: 74, qualityScore: 90, requiresSources: true, estDebateMinutes: 20 },
  { title: "Climate change policy should prioritize economic growth", category: "SCIENCE", subcategory: "Climate Policy", difficulty: "ADVANCED", popularity: 89, controversy: 88, qualityScore: 89, requiresSources: true, estDebateMinutes: 20 },
  { title: "Space exploration funding is worth the cost", category: "SCIENCE", subcategory: "Space", difficulty: "BEGINNER", popularity: 74, controversy: 50, qualityScore: 85, requiresSources: true, estDebateMinutes: 15 },
  { title: "GMOs are safe and beneficial for the food supply", category: "SCIENCE", subcategory: "Agriculture", difficulty: "INTERMEDIATE", popularity: 70, controversy: 68, qualityScore: 87, requiresSources: true, estDebateMinutes: 15 },

  // History
  { title: "Colonial powers owe reparations to formerly colonized nations", category: "HISTORY", subcategory: "Colonialism", difficulty: "ADVANCED", popularity: 78, controversy: 90, qualityScore: 89, requiresSources: true, estDebateMinutes: 20 },
  { title: "The dropping of the atomic bombs on Japan was justified", category: "HISTORY", subcategory: "WWII", difficulty: "ADVANCED", popularity: 72, controversy: 88, qualityScore: 90, requiresSources: true, estDebateMinutes: 20 },
  { title: "Historical monuments to controversial figures should be removed", category: "HISTORY", subcategory: "Public Memory", difficulty: "INTERMEDIATE", popularity: 75, controversy: 85, qualityScore: 87, requiresSources: true, estDebateMinutes: 15 },

  // Entertainment
  { title: "Streaming has been better for the film industry than theaters", category: "ENTERTAINMENT", subcategory: "Film", difficulty: "BEGINNER", popularity: 68, controversy: 45, qualityScore: 82, requiresSources: false, estDebateMinutes: 10 },
  { title: "AI-generated art should be considered real art", category: "ENTERTAINMENT", subcategory: "Art & AI", difficulty: "INTERMEDIATE", popularity: 85, controversy: 80, qualityScore: 89, requiresSources: false, estDebateMinutes: 15 },
  { title: "Video games are a legitimate competitive sport", category: "ENTERTAINMENT", subcategory: "Esports", difficulty: "BEGINNER", popularity: 73, controversy: 40, qualityScore: 80, requiresSources: false, estDebateMinutes: 10 },
  { title: "Remakes and reboots are hurting creativity in Hollywood", category: "ENTERTAINMENT", subcategory: "Film", difficulty: "BEGINNER", popularity: 66, controversy: 42, qualityScore: 79, requiresSources: false, estDebateMinutes: 10 },

  // Sports
  { title: "VAR technology has made football worse, not better", category: "SPORTS", subcategory: "Football", difficulty: "BEGINNER", popularity: 71, controversy: 65, qualityScore: 83, requiresSources: false, estDebateMinutes: 10 },
  { title: "College athletes should be paid a salary", category: "SPORTS", subcategory: "College Sports", difficulty: "INTERMEDIATE", popularity: 76, controversy: 70, qualityScore: 86, requiresSources: true, estDebateMinutes: 15 },
  { title: "Performance-enhancing drugs should be permitted in professional sports", category: "SPORTS", subcategory: "Doping", difficulty: "INTERMEDIATE", popularity: 62, controversy: 72, qualityScore: 85, requiresSources: true, estDebateMinutes: 15 },

  // General / lifestyle / everyday
  { title: "Remote work is better than working in an office", category: "GENERAL", subcategory: "Work Culture", difficulty: "BEGINNER", popularity: 88, controversy: 55, qualityScore: 87, requiresSources: false, estDebateMinutes: 10 },
  { title: "Social media should require ID verification to prevent anonymity", category: "GENERAL", subcategory: "Internet Culture", difficulty: "INTERMEDIATE", popularity: 79, controversy: 82, qualityScore: 86, requiresSources: true, estDebateMinutes: 15 },
  { title: "School uniforms should be mandatory in all schools", category: "GENERAL", subcategory: "Education", difficulty: "BEGINNER", popularity: 62, controversy: 50, qualityScore: 81, requiresSources: false, estDebateMinutes: 10 },
  { title: "A four-day work week should become the global standard", category: "GENERAL", subcategory: "Work Culture", difficulty: "BEGINNER", popularity: 84, controversy: 58, qualityScore: 86, requiresSources: true, estDebateMinutes: 15 },
  { title: "Pineapple belongs on pizza", category: "GENERAL", subcategory: "Food", difficulty: "BEGINNER", popularity: 70, controversy: 35, qualityScore: 72, requiresSources: false, estDebateMinutes: 5 },
];
