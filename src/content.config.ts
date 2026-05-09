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

    // Ragas evaluation results — present only on showcases that actually do RAG
    // (today: Showcase 1). All sub-fields are required when `ragas` is set.
    // `preliminary: true` flags placeholder values that haven't yet been
    // overwritten by the CI eval gate (Step 8b of Phase 3).
    ragas: z.object({
      faithfulness:      z.number().min(0).max(1),
      answer_relevancy:  z.number().min(0).max(1),
      context_precision: z.number().min(0).max(1),
      context_recall:    z.number().min(0).max(1),
      evaluatedAt:       z.date(),
      questionCount:     z.number().int().positive(),
      preliminary:       z.boolean().default(false),
    }).optional(),
  }),
});

export const collections = { projects };
