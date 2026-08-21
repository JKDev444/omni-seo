/**
 * CLI to update the Project Tracker as work happens.
 *
 * Usage:
 *   npx tsx scripts/markTask.ts task <phaseKey> "<title-substring>" <TODO|IN_PROGRESS|DONE|SKIPPED>
 *   npx tsx scripts/markTask.ts phase <phaseKey> <NOT_STARTED|IN_PROGRESS|PARTIAL|COMPLETE|SKIPPED|OUT_OF_SCOPE>
 *   npx tsx scripts/markTask.ts add <phaseKey> "<new task title>" [<status>]
 *
 * Task lookup is by case-insensitive substring match against the phase's
 * tasks -- errors (rather than guessing) if zero or more than one match.
 */
import { PrismaClient, ProjectPhaseStatus, ProjectTaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [cmd, phaseKey, ...rest] = process.argv.slice(2);
  if (!cmd || !phaseKey) {
    console.error("Usage: npx tsx scripts/markTask.ts <task|phase|add> <phaseKey> ...");
    process.exit(1);
  }

  const phase = await prisma.projectPhase.findUnique({ where: { key: phaseKey }, include: { tasks: true } });
  if (!phase) throw new Error(`No phase with key "${phaseKey}". Existing keys: ${(await prisma.projectPhase.findMany({ select: { key: true } })).map((p) => p.key).join(", ")}`);

  if (cmd === "phase") {
    const status = rest[0] as ProjectPhaseStatus;
    if (!Object.values(ProjectPhaseStatus).includes(status)) throw new Error(`Invalid phase status "${status}".`);
    await prisma.projectPhase.update({ where: { id: phase.id }, data: { status } });
    console.log(`Phase ${phaseKey} -> ${status}`);
    return;
  }

  if (cmd === "task") {
    const [titleSubstring, statusArg] = rest;
    const status = statusArg as ProjectTaskStatus;
    if (!Object.values(ProjectTaskStatus).includes(status)) throw new Error(`Invalid task status "${status}".`);

    const matches = phase.tasks.filter((t) => t.title.toLowerCase().includes(titleSubstring.toLowerCase()));
    if (matches.length === 0) throw new Error(`No task in phase ${phaseKey} matches "${titleSubstring}". Tasks:\n${phase.tasks.map((t) => `  - ${t.title}`).join("\n")}`);
    if (matches.length > 1) throw new Error(`"${titleSubstring}" matches ${matches.length} tasks in phase ${phaseKey}, be more specific:\n${matches.map((t) => `  - ${t.title}`).join("\n")}`);

    await prisma.projectTask.update({
      where: { id: matches[0].id },
      data: { status, completedAt: status === "DONE" ? new Date() : null },
    });
    console.log(`[${phaseKey}] "${matches[0].title}" -> ${status}`);
    return;
  }

  if (cmd === "add") {
    const [title, statusArg] = rest;
    const status = (statusArg as ProjectTaskStatus) ?? "TODO";
    if (!Object.values(ProjectTaskStatus).includes(status)) throw new Error(`Invalid task status "${status}".`);
    const maxOrder = phase.tasks.reduce((m, t) => Math.max(m, t.order), -1);
    await prisma.projectTask.create({
      data: { phaseId: phase.id, title, status, order: maxOrder + 1, completedAt: status === "DONE" ? new Date() : null },
    });
    console.log(`[${phaseKey}] added "${title}" (${status})`);
    return;
  }

  throw new Error(`Unknown command "${cmd}". Use task, phase, or add.`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
