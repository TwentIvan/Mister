import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { templateProfilesTable } from "@workspace/db";
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
  const query = db.select().from(templateProfilesTable);
  const rows = active_only
    ? await query.where(eq(templateProfilesTable.active, true))
    : await query;
  res.json(ListTemplatesResponse.parse(rows.map(mapTemplate)));
});

router.post("/templates", async (req, res): Promise<void> => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const d = parsed.data;
  const [row] = await db
    .insert(templateProfilesTable)
    .values({
      id: nanoid(),
      name: d.name,
      slug: d.slug,
      description: d.description ?? "",
      complexityLabel: d.complexity_label,
      minutesPerWeek: d.minutes_per_week,
      featureFlags: d.feature_flags,
      active: d.active ?? true,
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
    .from(templateProfilesTable)
    .where(eq(templateProfilesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(GetTemplateResponse.parse(mapTemplate(row)));
});

router.patch("/templates/:id", async (req, res): Promise<void> => {
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
    .update(templateProfilesTable)
    .set({
      ...(d.name !== undefined && { name: d.name }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.complexity_label !== undefined && { complexityLabel: d.complexity_label }),
      ...(d.minutes_per_week !== undefined && { minutesPerWeek: d.minutes_per_week }),
      ...(d.feature_flags !== undefined && { featureFlags: d.feature_flags }),
      ...(d.active !== undefined && { active: d.active }),
    })
    .where(eq(templateProfilesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json(UpdateTemplateResponse.parse(mapTemplate(row)));
});

router.delete("/templates/:id", async (req, res): Promise<void> => {
  const params = DeleteTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(templateProfilesTable)
    .where(eq(templateProfilesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
