/**
 * Incompatibility and recusal rules per cc. 1447–1448 and DC arts. 66–67.
 *
 * These are HARD BLOCKS. No override. If a proposed case assignment would
 * violate any rule, it must be rejected before persistence.
 *
 *   c. 1447 — One who intervened in a cause as judge, promoter of justice,
 *             defender of bond, procurator, advocate, witness, or expert
 *             CANNOT later judge the same cause in another instance or discharge
 *             the function of assessor in it.
 *   c. 1448 §1 — A judge is not to undertake a case in which he has any personal
 *             interest by reason of consanguinity or affinity in any degree of
 *             the direct line and up to the fourth degree of the collateral line,
 *             or by reason of guardianship or tutelage, close acquaintance,
 *             serious animosity, pursuit of profit, or avoidance of loss.
 *   c. 1448 §2 — Same rule applies to promoter, defender, assessor, auditor.
 *   DC art. 36 §3 — Advocate/procurator cannot simultaneously be defender or promoter.
 *   DC art. 66 §2 — One who served as defender, promoter, procurator, advocate,
 *             witness, or expert cannot judge same cause in same or another instance.
 */

import type { CaseAssignment, CaseRole, RecordId } from "../types/canonical.ts";

export type IncompatRuleId =
  | "JUDGE_AND_DEFENDER_PROMOTER_SAME_CASE"
  | "JUDGE_IN_TWO_INSTANCES_SAME_CAUSE"
  | "ADVOCATE_PROCURATOR_AND_DEFENDER_PROMOTER_SAME_CAUSE"
  | "CONSANGUINITY_AFFINITY_4TH_DEGREE"
  | "PRIOR_INSTANCE_JUDGE_OR_ASSESSOR_HIGHER_INSTANCE"
  | "PRIOR_DEFENDER_PROMOTER_PROCURATOR_ADVOCATE_WITNESS_EXPERT_AS_JUDGE";

export interface IncompatibilityViolation {
  rule: IncompatRuleId;
  canon: string;
  message: string;
}

export interface ProposedAssignment {
  caseId: RecordId;
  /** personId drives person-level incompatibility, not personnel record. */
  personId: RecordId;
  roleInCase: CaseRole;
}

export interface IncompatibilityContext {
  /** All active and historical assignments across all cases for this person. */
  assignmentsForPerson: Array<CaseAssignment & { personId: RecordId; caseInstanceLevel: number; causeId: RecordId }>;
  /** Case ID → cause identifier (same cause may have multiple instance cases). */
  causeIdForCase: Record<RecordId, RecordId>;
  instanceLevelForCase: Record<RecordId, number>;
  /**
   * Optional: consanguinity/affinity degree between the proposed personnel and
   * the case parties, where computable. If the degree is <= 4 collateral or any
   * degree direct line, the assignment is blocked.
   */
  relationshipDegree?: {
    directLine: boolean;
    collateralDegree: number; // 0 = none
  };
  /** Roles on THIS case that the person is already listed for (e.g. witness). */
  existingRolesOnThisCase: CaseRole[];
}

const JUDGE_ROLES: CaseRole[] = ["PresidingJudge", "Ponens", "AssociateJudge"];
const DEFENDER_PROMOTER_ROLES: CaseRole[] = ["DefenderOfBond", "PromoterOfJustice"];
const ADVOCATE_PROCURATOR_ROLES: CaseRole[] = [
  "AdvocatePetitioner",
  "AdvocateRespondent",
  "ProcuratorPetitioner",
  "ProcuratorRespondent",
];
const CONFLICTING_PRIOR_ROLES: CaseRole[] = [
  "DefenderOfBond",
  "PromoterOfJustice",
  "AdvocatePetitioner",
  "AdvocateRespondent",
  "ProcuratorPetitioner",
  "ProcuratorRespondent",
];

export function checkIncompatibilities(
  proposed: ProposedAssignment,
  ctx: IncompatibilityContext,
): IncompatibilityViolation[] {
  const violations: IncompatibilityViolation[] = [];
  const proposedIsJudge = JUDGE_ROLES.includes(proposed.roleInCase);
  const proposedIsAssessor = proposed.roleInCase === "Assessor";
  const proposedIsDefPro = DEFENDER_PROMOTER_ROLES.includes(proposed.roleInCase);
  const proposedIsAdvocate = ADVOCATE_PROCURATOR_ROLES.includes(proposed.roleInCase);

  // Rule 1: Judge + Defender/Promoter on same case.
  if (proposedIsJudge || proposedIsDefPro) {
    const conflicting = ctx.existingRolesOnThisCase.some((r) =>
      proposedIsJudge ? DEFENDER_PROMOTER_ROLES.includes(r) : JUDGE_ROLES.includes(r),
    );
    if (conflicting) {
      violations.push({
        rule: "JUDGE_AND_DEFENDER_PROMOTER_SAME_CASE",
        canon: "c. 1447; DC art. 66",
        message: "Person cannot be both judge and defender/promoter in the same case.",
      });
    }
  }

  // Rule 3: Advocate/procurator + Defender/Promoter on same cause.
  if (proposedIsAdvocate || proposedIsDefPro) {
    const conflicting = ctx.existingRolesOnThisCase.some((r) =>
      proposedIsAdvocate ? DEFENDER_PROMOTER_ROLES.includes(r) : ADVOCATE_PROCURATOR_ROLES.includes(r),
    );
    if (conflicting) {
      violations.push({
        rule: "ADVOCATE_PROCURATOR_AND_DEFENDER_PROMOTER_SAME_CAUSE",
        canon: "DC art. 36 §3",
        message: "Advocate/procurator cannot simultaneously serve as defender or promoter in the same cause.",
      });
    }
  }

  const thisCauseId = ctx.causeIdForCase[proposed.caseId];
  const thisInstance = ctx.instanceLevelForCase[proposed.caseId] ?? 1;

  // Rule 2 & 5: Same cause across instances.
  if (proposedIsJudge || proposedIsAssessor) {
    for (const prior of ctx.assignmentsForPerson) {
      if (prior.personId !== proposed.personId) continue;
      if (prior.causeId !== thisCauseId) continue;
      if (prior.caseId === proposed.caseId) continue;
      if (JUDGE_ROLES.includes(prior.roleInCase) || prior.roleInCase === "Assessor") {
        if (prior.caseInstanceLevel !== thisInstance) {
          violations.push({
            rule: "PRIOR_INSTANCE_JUDGE_OR_ASSESSOR_HIGHER_INSTANCE",
            canon: "c. 1447; DC art. 66",
            message: `Person judged/assessed this cause at instance ${prior.caseInstanceLevel}; cannot serve at instance ${thisInstance}.`,
          });
        } else {
          violations.push({
            rule: "JUDGE_IN_TWO_INSTANCES_SAME_CAUSE",
            canon: "c. 1447",
            message: "Cannot serve as judge in two connected instances of the same cause.",
          });
        }
      }
      // Rule 6: Prior defender/promoter/procurator/advocate/witness/expert → cannot judge.
      if (CONFLICTING_PRIOR_ROLES.includes(prior.roleInCase)) {
        violations.push({
          rule: "PRIOR_DEFENDER_PROMOTER_PROCURATOR_ADVOCATE_WITNESS_EXPERT_AS_JUDGE",
          canon: "DC art. 66 §2",
          message: `Person previously served as ${prior.roleInCase} in this cause; cannot now judge/assess it.`,
        });
      }
    }
  }

  // Rule 4: Consanguinity / affinity.
  if (JUDGE_ROLES.includes(proposed.roleInCase) || proposedIsAssessor || proposedIsDefPro) {
    const deg = ctx.relationshipDegree;
    if (deg) {
      if (deg.directLine) {
        violations.push({
          rule: "CONSANGUINITY_AFFINITY_4TH_DEGREE",
          canon: "c. 1448; DC art. 67",
          message: "Related to a party in direct line — must recuse.",
        });
      } else if (deg.collateralDegree > 0 && deg.collateralDegree <= 4) {
        violations.push({
          rule: "CONSANGUINITY_AFFINITY_4TH_DEGREE",
          canon: "c. 1448; DC art. 67",
          message: `Related to a party within 4th degree collateral (degree ${deg.collateralDegree}) — must recuse.`,
        });
      }
    }
  }

  return violations;
}
