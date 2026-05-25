import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { templateProfiles } from "@workspace/db";
import {
  ListTemplatesQueryParams,
  ListTemplatesResponse,
  GetTemplateParams,
  GetTemplateResponse,
  CreateTemplateBody,
  UpdateTemplateParams,
  UpdateTemplateBody,
  UpdateTemplateResponse,
  DeleteTemplateParams,
} from "@workspace/api-zod";
import { mapTemplate } from "../lib/mappers";

const router: IRouter = Router();

router.get("/templates", async (req, res): Promise<void> => {
  const parsed = ListTemplatesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { active_only } = parsed.data;
  const query = db.select().from(templateProfiles);
  const rows = active_only
    ? await query.where(eq(templateProfiles.isActive, true))
    : await query;
  res.json(ListTemplatesResponse.parse(rows.map(mapTemplate)));
});

router.post("/superadmin/templates", async (req, res): Promise<void> => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(templateProfiles)
    .values({
      id: nanoid(),
      name: d.name,
      tagline: d.tagline ?? "",
      description: d.description ?? "",
      complexityLevel: d.complexity_level,
      estimatedWeeklyMinutes: d.estimated_weekly_minutes,
      icon: d.icon ?? "",
      featureFlags: d.feature_flags,
      suggestedMarkets: d.suggested_markets ?? [],
      suggestedCompetitions: d.suggested_competitions ?? [],
      isSystem: false,
      isActive: d.is_active ?? true,
    })
    .returning();
  res.status(201).json(GetTemplateResponse.parse(mapTemplate(row)));
});

router.get("/templates/:id", async (req, res): Promise<void> => {
  const params = GetTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(templateProfiles)
    .where(eq(templateProfiles.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Template non trovato" });
    return;
  }
  res.json(GetTemplateResponse.parse(mapTemplate(row)));
});

router.patch("/superadmin/templates/:id", async (req, res): Promise<void> => {
  const params = UpdateTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .update(templateProfiles)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.tagline !== undefined && { tagline: d.tagline }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.complexity_level !== undefined && { complexityLevel: d.complexity_level }),
      ...(d.estimated_weekly_minutes !== undefined && { estimatedWeeklyMinutes: d.estimated_weekly_minutes }),
      ...(d.icon !== undefined && { icon: d.icon }),
      ...(d.feature_flags !== undefined && { featureFlags: d.feature_flags }),
      ...(d.suggested_markets !== undefined && { suggestedMarkets: d.suggested_markets }),
      ...(d.suggested_competitions !== undefined && { suggestedCompetitions: d.suggested_competitions }),
      ...(d.is_active !== undefined && { isActive: d.is_active }),
      updatedAt: new Date(),
    })
    .where(eq(templateProfiles.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Template non trovato" });
    return;
  }
  res.json(UpdateTemplateResponse.parse(mapTemplate(row)));
});

router.delete("/superadmin/templates/:id", async (req, res): Promise<void> => {
  const params = DeleteTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(templateProfiles)
    .where(eq(templateProfiles.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Template non trovato" });
    return;
  }
  if (row.isSystem) {
    res.status(403).json({ error: "I template di sistema non possono essere eliminati. Disattivali usando is_active=false." });
    return;
  }
  await db.delete(templateProfiles).where(eq(templateProfiles.id, params.data.id));
  res.sendStatus(204);
});

export default router;
