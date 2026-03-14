import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma.js";

export async function getPageContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const blocks = await prisma.block.findMany({
      where: { pageId: id as string },
      orderBy: { order: "asc" },
    });

    const serializedBlocks = blocks.map((b) => ({
      id: b.id,
      block_type: b.blockType,
      name: b.name,
      parent_id: b.parentId,
      properties: JSON.parse(b.properties),
      styles: JSON.parse(b.styles),
      responsive_styles: JSON.parse(b.responsiveStyles),
      classes: JSON.parse(b.classes),
      event_handlers: JSON.parse(b.events),
      bindings: JSON.parse(b.bindings),
      children: JSON.parse(b.children),
      order: b.order,
    }));

    res.json({ content: JSON.stringify(serializedBlocks) });
  } catch (error) {
    console.error("Error getting page content:", error);
    res.status(500).json({ error: "Failed to get page content" });
  }
}

export async function listPages(req: Request, res: Response) {
  res.json([]);
}

export async function createPage(req: Request, res: Response) {
  try {
    const { name, path, projectId } = req.body;
    // In reality this should insert into Prisma.
    // Let's implement actual prisma logic for creation too since it's just mocked!
    if (!projectId)
      return res.status(400).json({ error: "projectId required" });

    const page = await prisma.page.create({
      data: {
        id: randomUUID(),
        project: { connect: { id: projectId } },
        name: name || "New Page",
        path: path || "/new-page",
      },
    });

    res.json(page);
  } catch (error) {
    console.error("Error creating page:", error);
    res.status(500).json({ error: "Failed" });
  }
}

export async function archivePage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const page = await prisma.page.update({
      where: { id: id as string },
      data: { archived: true },
    });
    res.json(page);
  } catch (error) {
    console.error("Error archiving page:", error);
    res.status(500).json({ error: "Failed to archive page" });
  }
}

export async function updatePage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, path } = req.body;
    const page = await prisma.page.update({
      where: { id: id as string },
      data: { name, path },
    });
    res.json(page);
  } catch (error) {
    console.error("Error updating page:", error);
    res.status(500).json({ error: "Failed to update page" });
  }
}
