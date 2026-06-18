/**
 * Tool metadata for navigation and homepage cards.
 * UI-only — does not affect worker or PDF logic.
 */
export const TOOL_CATEGORIES = {
  organize: {
    id: 'organize',
    label: 'Organize',
    color: 'category-organize',
  },
  optimize: {
    id: 'optimize',
    label: 'Optimize',
    color: 'category-optimize',
  },
  transform: {
    id: 'transform',
    label: 'Transform',
    color: 'category-transform',
  },
  clean: {
    id: 'clean',
    label: 'Clean',
    color: 'category-clean',
  },
}

export const TOOLS = [
  {
    id: 'merge-test',
    name: 'Merge PDF',
    description: 'Combine multiple PDFs into one document.',
    category: 'organize',
  },
  {
    id: 'split-test',
    name: 'Split PDF',
    description: 'Divide a PDF into separate files at a chosen page.',
    category: 'organize',
  },
  {
    id: 'rearrange-test',
    name: 'Rearrange Pages',
    description: 'Drag and drop to reorder pages in your PDF.',
    category: 'organize',
  },
  {
    id: 'delete-pages-test',
    name: 'Delete Pages',
    description: 'Remove unwanted pages and keep the rest.',
    category: 'organize',
  },
  {
    id: 'compress-test',
    name: 'Compress PDF',
    description: 'Reduce file size while preserving readability.',
    category: 'optimize',
  },
  {
    id: 'rotate-test',
    name: 'Rotate PDF',
    description: 'Rotate pages to the correct orientation.',
    category: 'transform',
  },
  {
    id: 'image-to-pdf-test',
    name: 'Image to PDF',
    description: 'Convert JPG, PNG, or WebP images into a PDF.',
    category: 'transform',
  },
  {
    id: 'notes-cleaner-test',
    name: 'Notes Cleaner',
    description: 'Enhance scanned notes and export as a clean PDF.',
    category: 'clean',
  },
]

export function getToolsByCategory() {
  return Object.values(TOOL_CATEGORIES).map((category) => ({
    ...category,
    tools: TOOLS.filter((tool) => tool.category === category.id),
  }))
}
