import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    techStack: z.array(z.string()),
    agentLogicType: z.enum(['ReAct', 'Plan-and-Execute', 'Multi-Agent', 'Self-Correcting', 'Tool-Use']),
    status: z.enum(['live', 'wip', 'archived']),
    demoUrl: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
    publishedAt: z.date(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { projects };
