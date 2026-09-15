// The database half of deleting an organization into another one.
//
// Kept apart from `org-merge.ts` because that file is pure and the delete dialog
// imports it into the browser bundle; this one reaches Prisma and must not.

import { prisma } from "./prisma"
import { planGroupFold, buildMergeNote } from "./org-merge"

export class MergeError extends Error {
  constructor(readonly reason: "source-missing" | "target-missing" | "same-org") {
    super(reason)
  }
}

export interface MergeResult {
  targetId:     string
  targetName:   string
  foldedGroups: number
  movedGroups:  number
}

/**
 * Moves every participant group of `sourceId` to `targetId`, folding groups that
 * share a name, then deletes the emptied source organization.
 *
 * Both organizations are re-read inside the transaction rather than passed in:
 * a group added between the caller's check and this call would otherwise be left
 * behind under an organization that is about to disappear.
 */
export async function mergeOrganizationInto(
  sourceId: string,
  targetId: string,
  actorName: string
): Promise<MergeResult> {
  if (sourceId === targetId) throw new MergeError("same-org")

  return prisma.$transaction(async (tx) => {
    const withGroups = {
      participantGroups: {
        select: { id: true, name: true, workshops: { select: { id: true } } },
      },
    } as const

    const source = await tx.organization.findUnique({ where: { id: sourceId }, include: withGroups })
    if (!source) throw new MergeError("source-missing")
    const target = await tx.organization.findUnique({ where: { id: targetId }, include: withGroups })
    if (!target) throw new MergeError("target-missing")

    const countable = (gs: { id: string; name: string; workshops: unknown[] }[]) =>
      gs.map((g) => ({ id: g.id, name: g.name, workshopCount: g.workshops.length }))

    const plan = planGroupFold(
      countable(source.participantGroups),
      countable(target.participantGroups)
    )

    // Folds first: a group's workshops move to the group of the same name and
    // the emptied group goes, so the survivor is never handed two groups of one
    // name. A fold may point at a source group that the moves below carry
    // across — same transaction, so the order is safe either way.
    for (const f of plan.folds) {
      await tx.workshop.updateMany({
        where: { participantGroupId: f.fromGroupId },
        data:  { participantGroupId: f.intoGroupId },
      })
      await tx.participantGroup.delete({ where: { id: f.fromGroupId } })
    }

    if (plan.moves.length > 0) {
      await tx.participantGroup.updateMany({
        where: { id: { in: plan.moves } },
        data:  { organizationId: target.id },
      })
    }

    await tx.organization.update({
      where: { id: target.id },
      data: {
        notes: buildMergeNote(target, source, actorName, target.notes),
        // A point of contact held only by the deleted record is the one piece of
        // data a merge would otherwise destroy — everything else travels with
        // the groups.
        ...(target.pocName  || !source.pocName  ? {} : { pocName:  source.pocName  }),
        ...(target.pocPhone || !source.pocPhone ? {} : { pocPhone: source.pocPhone }),
        ...(target.pocEmail || !source.pocEmail ? {} : { pocEmail: source.pocEmail }),
      },
    })

    // Empty by now. The FK is ON DELETE RESTRICT, so if anything above missed a
    // group this throws and the whole transaction rolls back rather than
    // stranding history under an organization that no longer exists.
    await tx.organization.delete({ where: { id: sourceId } })

    return {
      targetId:     target.id,
      targetName:   target.name,
      foldedGroups: plan.folds.length,
      movedGroups:  plan.moves.length,
    }
  })
}
