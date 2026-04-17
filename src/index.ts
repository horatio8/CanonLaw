/**
 * Canon Law Tribunal — public entrypoint.
 *
 * Legal basis: 1983 Code of Canon Law as amended by Mitis Iudex Dominus Iesus
 * (2015), supplemented by Dignitas Connubii (2005). Where conflict exists,
 * post-2015 canons control.
 */

export * from "./types/canonical.ts";
export * from "./deadlines/time.ts";
export * from "./deadlines/catalog.ts";
export * from "./state-machine/states.ts";
export * from "./state-machine/gates.ts";
export * from "./permissions/matrix.ts";
export * from "./incompatibility/rules.ts";
export * from "./documents/templates.ts";
export * from "./automations/recipes.ts";
