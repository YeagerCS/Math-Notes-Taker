// JSON schemas for request validation (Fastify/ajv).

export const PAPER_TYPES = ['grid', 'lined', 'dotted', 'blank'] as const;
export type Paper = (typeof PAPER_TYPES)[number];

export const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const notebookFields = {
  title: { type: 'string', minLength: 1, maxLength: 120 },
  color: { type: 'string', minLength: 1, maxLength: 32 },
  paper: { type: 'string', enum: PAPER_TYPES },
} as const;

export const createNotebookBody = {
  type: 'object',
  required: ['title'],
  additionalProperties: false,
  properties: notebookFields,
} as const;

export const updateNotebookBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: notebookFields,
} as const;

const stroke = {
  type: 'object',
  required: ['id', 'tool', 'color', 'size', 'points'],
  properties: {
    id: { type: 'string', maxLength: 64 },
    tool: { type: 'string', enum: ['pen', 'highlighter'] },
    color: { type: 'string', maxLength: 32 },
    size: { type: 'number', minimum: 0.1, maximum: 200 },
    // Flat array: [x0, y0, p0, x1, y1, p1, ...] in page units
    points: { type: 'array', items: { type: 'number' } },
  },
} as const;

export const savePageBody = {
  type: 'object',
  required: ['strokes'],
  additionalProperties: false,
  properties: { strokes: { type: 'array', items: stroke } },
} as const;
