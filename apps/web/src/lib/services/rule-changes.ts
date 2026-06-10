import {
  applyRuleChange,
  mergeProfile,
  replayInnings,
  resolveInningsConfig,
  type DeliveryEvent,
  type RulesProfile,
} from "@howzzat/rules-engine";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import { getRulesProfileFromVersion, parseRulesConfig } from "./rules-helpers";
import { cloneRulesProfile } from "./rules";
import { getTournament } from "./tournaments";
import type { ruleChangeSchema } from "../validations";
import type { z } from "zod";

type RuleChangeInput = z.infer<typeof ruleChangeSchema>;

function deliveryToEvent(d: {
  overNumber: number;
  ballInOver: number;
  isLegalBall: boolean;
  runsOffBat: number;
  extrasType: string | null;
  extrasRuns: number;
  extrasRunsType?: string | null;
  wicketType: string | null;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  fielderId: string | null;
  dismissedBatsmanId: string | null;
}): DeliveryEvent {
  return {
    overNumber: d.overNumber,
    ballInOver: d.ballInOver,
    isLegalBall: d.isLegalBall,
    runsOffBat: d.runsOffBat,
    extrasType: d.extrasType as DeliveryEvent["extrasType"],
    extrasRuns: d.extrasRuns,
    extrasRunsType: d.extrasRunsType as DeliveryEvent["extrasRunsType"],
    wicketType: d.wicketType as DeliveryEvent["wicketType"],
    strikerId: d.strikerId,
    nonStrikerId: d.nonStrikerId,
    bowlerId: d.bowlerId,
    fielderId: d.fielderId ?? undefined,
    dismissedBatsmanId: d.dismissedBatsmanId ?? undefined,
  };
}

export async function previewTournamentRuleChange(
  tournamentId: string,
  input: RuleChangeInput,
) {
  const tournament = await getTournament(tournamentId);
  const fromProfile = parseRulesConfig(
    tournament.rulesProfileVersion.configJson,
  );

  let toProfile: RulesProfile;
  let toVersionId = input.toVersionId;

  if (toVersionId) {
    toProfile = await getRulesProfileFromVersion(toVersionId);
  } else if (input.overrides) {
    toProfile = mergeProfile(
      fromProfile,
      input.overrides as Partial<RulesProfile>,
    );
    toVersionId = "preview-only";
  } else {
    throw new ApiError(
      400,
      "Provide toVersionId or overrides",
      "MISSING_TARGET_RULES",
    );
  }

  const sampleMatch = tournament.matches[0];
  if (!sampleMatch) {
    return {
      message: "No matches to preview",
      fromVersionId: tournament.rulesProfileVersionId,
      toVersionId,
    };
  }

  const innings = await prisma.innings.findFirst({
    where: { matchId: sampleMatch.id },
    include: { deliveries: { orderBy: { sequence: "asc" } } },
  });
  if (!innings) {
    return { message: "No innings in sample match", toVersionId };
  }

  const match = await prisma.match.findUnique({
    where: { id: sampleMatch.id },
  });
  const events = innings.deliveries.map(deliveryToEvent);
  const oldProfile = fromProfile;
  const config = resolveInningsConfig(oldProfile, match?.playersPerSide ?? 8);

  const result = applyRuleChange(
    events,
    {
      playersPerSide: config.playersPerSide,
      totalOvers: config.totalOvers,
    },
    oldProfile,
    toProfile,
    0,
    input.mode,
  );

  return {
    sampleMatchId: sampleMatch.id,
    fromVersionId: tournament.rulesProfileVersionId,
    toVersionId,
    mode: input.mode,
    before: {
      totalRuns: result.oldTotals.totalRuns,
      wickets: result.oldTotals.wickets,
      netRuns: result.oldTotals.batRuns - oldProfile.wicketPenalty * result.oldTotals.wickets,
    },
    after: {
      totalRuns: result.newTotals.totalRuns,
      wickets: result.newTotals.wickets,
      netRuns: result.newTotals.batRuns - toProfile.wicketPenalty * result.newTotals.wickets,
    },
  };
}

export async function applyTournamentRuleChange(
  tournamentId: string,
  input: RuleChangeInput,
) {
  const tournament = await getTournament(tournamentId);
  const fromVersionId = tournament.rulesProfileVersionId;
  const fromProfile = await getRulesProfileFromVersion(fromVersionId);

  let toVersionId = input.toVersionId;
  if (!toVersionId && input.overrides) {
    const cloned = await cloneRulesProfile({
      templateId: tournament.rulesProfileVersion.templateId,
      overrides: input.overrides,
    });
    toVersionId = cloned.id;
  }
  if (!toVersionId) {
    throw new ApiError(
      400,
      "Provide toVersionId or overrides",
      "MISSING_TARGET_RULES",
    );
  }

  const toProfile = await getRulesProfileFromVersion(toVersionId);

  const changeRequest = await prisma.ruleChangeRequest.create({
    data: {
      tournamentId,
      fromVersionId,
      toVersionId,
      mode: input.mode,
      effectiveFromMatchId: input.effectiveFromMatchId,
      status: "PENDING",
    },
  });

  if (input.mode === "BACKFILL") {
    const matches = await prisma.match.findMany({
      where: { tournamentId },
      include: {
        innings: {
          include: { deliveries: { orderBy: { sequence: "asc" } } },
        },
      },
    });

    for (const match of matches) {
      for (const innings of match.innings) {
        const events = innings.deliveries.map(deliveryToEvent);
        const config = resolveInningsConfig(toProfile, match.playersPerSide);
        const state = replayInnings(toProfile, {
          playersPerSide: config.playersPerSide,
          totalOvers: config.totalOvers,
        }, events);

        await prisma.innings.update({
          where: { id: innings.id },
          data: {
            rulesVersionId: toVersionId,
            totalRuns: state.totalRuns,
            wickets: state.wickets,
            batRuns: state.batRuns,
            netRuns: state.batRuns - toProfile.wicketPenalty * state.wickets,
          },
        });

        await prisma.delivery.updateMany({
          where: { inningsId: innings.id },
          data: { rulesVersionId: toVersionId },
        });
      }

      await prisma.match.update({
        where: { id: match.id },
        data: { rulesVersionId: toVersionId },
      });
    }

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { rulesProfileVersionId: toVersionId },
    });
  } else {
    await prisma.tournamentRulesBinding.create({
      data: {
        tournamentId,
        rulesProfileVersionId: toVersionId,
        effectiveFromMatchId: input.effectiveFromMatchId,
        notes: `FUTURE_ONLY from request ${changeRequest.id}`,
      },
    });

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { rulesProfileVersionId: toVersionId },
    });
  }

  await prisma.ruleChangeRequest.update({
    where: { id: changeRequest.id },
    data: { status: "APPLIED", appliedAt: new Date() },
  });

  return {
    changeRequestId: changeRequest.id,
    mode: input.mode,
    fromVersionId,
    toVersionId,
    tournament: await getTournament(tournamentId),
  };
}
