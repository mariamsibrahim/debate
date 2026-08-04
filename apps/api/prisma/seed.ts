import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { EVERGREEN_TOPICS } from "../src/topics/seed-data/evergreen-topics";

const prisma = new PrismaClient();

const ACHIEVEMENTS = [
  { key: "first_debate", name: "First Argument", description: "Complete your first debate." },
  { key: "mind_changed", name: "Changed My Mind", description: "Have your position changed in a Change My Mind challenge." },
  { key: "ten_sources", name: "Well Sourced", description: "Cite 10 pieces of evidence across your debates." },
  { key: "clean_record", name: "Spotless", description: "Complete 20 debates with zero incivility flags." },
];

async function main() {
  console.log(`Seeding ${EVERGREEN_TOPICS.length} evergreen topics...`);
  for (const topic of EVERGREEN_TOPICS) {
    // `title` isn't a unique column (the future intelligence engine may
    // merge/rename topics), so re-running the seed idempotently means a
    // plain existence check rather than an upsert.
    const existing = await prisma.topic.findFirst({ where: { title: topic.title } });
    if (!existing) {
      await prisma.topic.create({ data: { ...topic, isEvergreen: true, status: "PUBLISHED" } });
    }
  }

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { key: achievement.key },
      update: {},
      create: achievement,
    });
  }

  const demoUsers = [
    { email: "ada@example.com", username: "ada", password: "password123" },
    { email: "grace@example.com", username: "grace", password: "password123" },
  ];

  for (const demo of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: demo.email } });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(demo.password, 10);
    const user = await prisma.user.create({
      data: {
        email: demo.email,
        passwordHash,
        profile: { create: { username: demo.username, interests: ["Technology", "Philosophy"] } },
        trustScore: { create: {} },
      },
    });
    for (const category of ["POLITICS", "SCIENCE", "TECHNOLOGY", "PHILOSOPHY"]) {
      await prisma.rating.create({ data: { userId: user.id, category: category as any, elo: 1000 } });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
