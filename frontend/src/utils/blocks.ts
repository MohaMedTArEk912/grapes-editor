import { GrapesEditor } from '../types/grapes';

// Block preview SVGs as data URIs
const blockPreviews = {
  section: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="10" y="10" width="80" height="60" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2"/><rect x="25" y="20" width="50" height="8" rx="2" fill="#6366f1"/><rect x="20" y="35" width="60" height="4" rx="1" fill="#9ca3af"/><rect x="25" y="45" width="50" height="4" rx="1" fill="#9ca3af"/></svg>`,
  text: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="10" y="20" width="80" height="6" rx="2" fill="#6366f1"/><rect x="10" y="32" width="70" height="5" rx="1" fill="#9ca3af"/><rect x="10" y="42" width="75" height="5" rx="1" fill="#9ca3af"/><rect x="10" y="52" width="50" height="5" rx="1" fill="#9ca3af"/></svg>`,
  image: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="10" width="70" height="55" rx="6" fill="#374151" stroke="#6366f1" stroke-width="2"/><circle cx="35" cy="30" r="8" fill="#fbbf24"/><path d="M20 55 L40 40 L55 50 L75 30 L80 55 Z" fill="#6366f1"/></svg>`,
  video: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="15" width="70" height="50" rx="6" fill="#374151" stroke="#6366f1" stroke-width="2"/><polygon points="45,30 45,50 60,40" fill="#6366f1"/></svg>`,
  map: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="15" width="70" height="50" rx="4" fill="#374151"/><path d="M30 20 L45 55 L60 30 L75 50" stroke="#6366f1" stroke-width="2" fill="none"/><circle cx="50" cy="35" r="6" fill="#ef4444"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><path d="M35 40 L45 40 M55 40 L65 40" stroke="#6366f1" stroke-width="3" stroke-linecap="round"/><rect x="20" y="30" width="25" height="20" rx="10" fill="none" stroke="#6366f1" stroke-width="3"/><rect x="55" y="30" width="25" height="20" rx="10" fill="none" stroke="#6366f1" stroke-width="3"/></svg>`,
  'link-block': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="20" width="70" height="40" rx="6" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/><rect x="25" y="35" width="50" height="6" rx="2" fill="#6366f1"/></svg>`,
  column1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="15" width="70" height="50" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/></svg>`,
  column2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="10" y="15" width="35" height="50" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/><rect x="55" y="15" width="35" height="50" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/></svg>`,
  column3: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="8" y="15" width="24" height="50" rx="3" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/><rect x="38" y="15" width="24" height="50" rx="3" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/><rect x="68" y="15" width="24" height="50" rx="3" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/></svg>`,
  column37: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="10" y="15" width="25" height="50" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/><rect x="40" y="15" width="50" height="50" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 2"/></svg>`,
  button: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="20" y="25" width="60" height="30" rx="6" fill="url(#grad1)"/><defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#8b5cf6"/></linearGradient></defs><rect x="30" y="36" width="40" height="8" rx="2" fill="white"/></svg>`,
  divider: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><line x1="15" y1="40" x2="85" y2="40" stroke="#6366f1" stroke-width="2"/></svg>`,
  quote: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="15" width="4" height="50" rx="2" fill="#6366f1"/><rect x="25" y="20" width="60" height="5" rx="1" fill="#9ca3af"/><rect x="25" y="30" width="55" height="5" rx="1" fill="#9ca3af"/><rect x="25" y="40" width="50" height="5" rx="1" fill="#9ca3af"/><rect x="25" y="55" width="30" height="4" rx="1" fill="#6b7280"/></svg>`,
  'product-card': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="20" y="8" width="60" height="64" rx="6" fill="#374151" stroke="#6366f1" stroke-width="1"/><rect x="20" y="8" width="60" height="28" rx="6" fill="#4b5563"/><rect x="26" y="42" width="35" height="5" rx="1" fill="white"/><rect x="26" y="50" width="48" height="3" rx="1" fill="#9ca3af"/><rect x="26" y="60" width="20" height="6" rx="2" fill="#6366f1"/><rect x="54" y="60" width="20" height="6" rx="2" fill="#8b5cf6"/></svg>`,
  hero: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="url(#hero-grad)"/><defs><linearGradient id="hero-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#8b5cf6"/></linearGradient></defs><rect x="20" y="15" width="60" height="10" rx="2" fill="white"/><rect x="25" y="30" width="50" height="5" rx="1" fill="rgba(255,255,255,0.7)"/><rect x="30" y="38" width="40" height="5" rx="1" fill="rgba(255,255,255,0.7)"/><rect x="35" y="52" width="30" height="12" rx="4" fill="white"/></svg>`,
  card: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="20" y="8" width="60" height="64" rx="6" fill="#374151"/><rect x="20" y="8" width="60" height="25" rx="6" fill="url(#card-grad)"/><defs><linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#8b5cf6"/></linearGradient></defs><rect x="26" y="40" width="30" height="5" rx="1" fill="white"/><rect x="26" y="48" width="48" height="3" rx="1" fill="#9ca3af"/><rect x="26" y="54" width="40" height="3" rx="1" fill="#9ca3af"/><rect x="26" y="62" width="25" height="6" rx="2" fill="#6366f1"/></svg>`,
  testimonial: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="10" width="70" height="60" rx="6" fill="#374151"/><circle cx="50" cy="25" r="10" fill="url(#test-grad)"/><defs><linearGradient id="test-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#8b5cf6"/></linearGradient></defs><rect x="25" y="42" width="50" height="4" rx="1" fill="#9ca3af"/><rect x="30" y="50" width="40" height="4" rx="1" fill="#9ca3af"/><rect x="35" y="60" width="30" height="4" rx="1" fill="#6b7280"/></svg>`,
  pricing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="20" y="8" width="60" height="64" rx="6" fill="#374151" stroke="#6366f1" stroke-width="1"/><rect x="35" y="14" width="30" height="5" rx="1" fill="white"/><text x="50" y="35" text-anchor="middle" fill="#6366f1" font-size="14" font-weight="bold">$29</text><rect x="28" y="45" width="44" height="3" rx="1" fill="#9ca3af"/><rect x="28" y="51" width="44" height="3" rx="1" fill="#9ca3af"/><rect x="28" y="57" width="44" height="3" rx="1" fill="#9ca3af"/><rect x="28" y="64" width="44" height="6" rx="3" fill="url(#price-grad)"/><defs><linearGradient id="price-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#8b5cf6"/></linearGradient></defs></svg>`,
  navbar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="5" y="25" width="90" height="30" rx="4" fill="#374151"/><rect x="12" y="35" width="20" height="8" rx="2" fill="#6366f1"/><rect x="40" y="38" width="12" height="4" rx="1" fill="#9ca3af"/><rect x="55" y="38" width="12" height="4" rx="1" fill="#9ca3af"/><rect x="72" y="35" width="18" height="10" rx="3" fill="#6366f1"/></svg>`,
  footer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="5" y="15" width="90" height="55" rx="4" fill="#1f2937"/><rect x="12" y="22" width="25" height="5" rx="1" fill="#6366f1"/><rect x="12" y="30" width="20" height="3" rx="1" fill="#6b7280"/><rect x="45" y="22" width="15" height="4" rx="1" fill="white"/><rect x="45" y="30" width="12" height="2" rx="1" fill="#6b7280"/><rect x="45" y="35" width="12" height="2" rx="1" fill="#6b7280"/><rect x="70" y="22" width="15" height="4" rx="1" fill="white"/><rect x="70" y="30" width="12" height="2" rx="1" fill="#6b7280"/><line x1="12" y1="55" x2="88" y2="55" stroke="#374151" stroke-width="1"/><rect x="35" y="60" width="30" height="3" rx="1" fill="#4b5563"/></svg>`,
  form: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="20" y="8" width="60" height="64" rx="6" fill="#374151"/><rect x="28" y="16" width="30" height="5" rx="1" fill="white"/><rect x="28" y="26" width="44" height="10" rx="3" fill="#4b5563" stroke="#6b7280" stroke-width="1"/><rect x="28" y="40" width="44" height="10" rx="3" fill="#4b5563" stroke="#6b7280" stroke-width="1"/><rect x="28" y="54" width="44" height="12" rx="3" fill="#6366f1"/></svg>`,
  input: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="28" width="70" height="24" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2"/><rect x="22" y="37" width="40" height="6" rx="1" fill="#6b7280"/><line x1="68" y1="33" x2="68" y2="47" stroke="#6366f1" stroke-width="2"/></svg>`,
  textarea: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="15" width="70" height="50" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2"/><rect x="22" y="22" width="50" height="4" rx="1" fill="#6b7280"/><rect x="22" y="30" width="45" height="4" rx="1" fill="#6b7280"/><rect x="22" y="38" width="55" height="4" rx="1" fill="#6b7280"/></svg>`,
  select: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="15" y="28" width="70" height="24" rx="4" fill="#374151" stroke="#6366f1" stroke-width="2"/><rect x="22" y="37" width="40" height="6" rx="1" fill="#9ca3af"/><polygon points="75,36 80,44 70,44" fill="#6366f1"/></svg>`,
  checkbox: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><rect x="25" y="30" width="20" height="20" rx="4" fill="#6366f1"/><polyline points="30,40 37,47 50,34" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="52" y="37" width="30" height="6" rx="2" fill="#9ca3af"/></svg>`,
  radio: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80" fill="none"><rect width="100" height="80" fill="#1e1e2e"/><circle cx="35" cy="30" r="10" fill="none" stroke="#6366f1" stroke-width="2"/><circle cx="35" cy="30" r="5" fill="#6366f1"/><rect x="52" y="27" width="30" height="6" rx="2" fill="#9ca3af"/><circle cx="35" cy="50" r="10" fill="none" stroke="#6b7280" stroke-width="2"/><rect x="52" y="47" width="30" height="6" rx="2" fill="#9ca3af"/></svg>`,
};

const toDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

export const initBlocks = (editor: GrapesEditor) => {
  const bm = editor.BlockManager;

  // ===== BASIC BLOCKS =====
  bm.add('section', {
    label: 'Section',
    category: 'Basic',
    media: toDataUri(blockPreviews.section),
    attributes: { class: 'gjs-fonts gjs-f-b1' },
    content: `<section class="py-8 md:py-12 lg:py-16 px-4 md:px-6 lg:px-8">
      <h2 class="text-center mb-4 md:mb-6 text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">Section Title</h2>
      <p class="text-center max-w-2xl mx-auto text-sm md:text-base lg:text-lg text-gray-600">Add your content here. This is a basic section block.</p>
    </section>`,
  });

  bm.add('text', {
    label: 'Text',
    category: 'Basic',
    media: toDataUri(blockPreviews.text),
    content: '<div data-gjs-type="text" class="text-sm md:text-base lg:text-lg text-gray-700">Insert your text here</div>',
  });

  bm.add('image', {
    label: 'Image',
    category: 'Basic',
    media: toDataUri(blockPreviews.image),
    select: true,
    content: { type: 'image', classes: ['w-full', 'h-auto', 'rounded-lg'] },
    activate: true,
  });

  bm.add('video', {
    label: 'Video',
    category: 'Basic',
    media: toDataUri(blockPreviews.video),
    content: {
      type: 'video',
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      style: { height: '200px', width: '100%' },
      classes: ['w-full', 'h-48', 'md:h-64', 'lg:h-80', 'rounded-lg', 'shadow-md']
    },
  });

  bm.add('map', {
    label: 'Map',
    category: 'Basic',
    media: toDataUri(blockPreviews.map),
    content: {
      type: 'map',
      style: { height: '200px', width: '100%' },
      classes: ['w-full', 'h-48', 'md:h-64', 'lg:h-80', 'rounded-lg', 'shadow-md']
    },
  });

  bm.add('link', {
    label: 'Link',
    category: 'Basic',
    media: toDataUri(blockPreviews.link),
    content: '<a href="#" class="text-sm md:text-base text-indigo-500 hover:text-indigo-600 transition-colors no-underline">Click here</a>',
  });

  bm.add('link-block', {
    label: 'Link Block',
    category: 'Basic',
    media: toDataUri(blockPreviews['link-block']),
    content: '<a href="#" class="block p-3 md:p-4 lg:p-5 bg-slate-50 rounded-lg no-underline text-inherit hover:bg-slate-100 transition-colors border border-dashed border-slate-300 text-sm md:text-base">Link Block Content</a>',
  });

  // ===== LAYOUT BLOCKS =====
  bm.add('column1', {
    label: '1 Column',
    category: 'Layout',
    media: toDataUri(blockPreviews.column1),
    content: `<div class="flex flex-col p-2 md:p-3 lg:p-4">
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  bm.add('column2', {
    label: '2 Columns',
    category: 'Layout',
    media: toDataUri(blockPreviews.column2),
    content: `<div class="flex flex-col md:flex-row p-2 md:p-3 gap-2 md:gap-3">
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  bm.add('column3', {
    label: '3 Columns',
    category: 'Layout',
    media: toDataUri(blockPreviews.column3),
    content: `<div class="flex flex-col md:flex-row p-2 md:p-3 gap-2 md:gap-3">
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  bm.add('column37', {
    label: '2 Columns 3/7',
    category: 'Layout',
    media: toDataUri(blockPreviews.column37),
    content: `<div class="flex flex-col md:flex-row p-2 md:p-3 gap-2 md:gap-3">
      <div class="w-full md:w-[30%] p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="w-full md:w-[70%] p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  // ===== COMPONENT BLOCKS =====
  bm.add('button', {
    label: 'Button',
    category: 'Components',
    media: toDataUri(blockPreviews.button),
    content: '<button class="py-2 md:py-3 px-4 md:px-6 bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-0 rounded-lg text-xs md:text-sm font-medium cursor-pointer hover:shadow-lg hover:to-indigo-600 transition-all transform hover:-translate-y-0.5">Click Me</button>',
  });

  bm.add('divider', {
    label: 'Divider',
    category: 'Components',
    media: toDataUri(blockPreviews.divider),
    content: '<hr class="border-0 border-t border-slate-200 my-3 md:my-4 lg:my-5" />',
  });

  bm.add('quote', {
    label: 'Quote',
    category: 'Components',
    media: toDataUri(blockPreviews.quote),
    content: `<blockquote class="border-l-4 border-indigo-500 pl-3 md:pl-4 lg:pl-5 pr-3 md:pr-4 lg:pr-5 py-3 md:py-4 lg:py-5 my-3 md:my-4 lg:my-5 bg-slate-50 italic rounded-r-lg text-sm md:text-base lg:text-lg">
      "This is a sample quote. Add your inspiring text here."
      <footer class="mt-2 md:mt-3 text-xs md:text-sm text-slate-500 not-italic">— Author Name</footer>
    </blockquote>`,
  });

  // ===== E-COMMERCE BLOCKS =====
  bm.add('product-card', {
    label: 'Product Card',
    category: 'E-commerce',
    media: toDataUri(blockPreviews['product-card']),
    content: `<div class="max-w-sm rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="w-full h-40 bg-slate-100 flex items-center justify-center text-slate-400 text-sm">Product Image</div>
      <div class="p-4">
        <h3 class="text-base font-semibold text-slate-800">Product Name</h3>
        <p class="text-xs text-slate-500 mt-1">Short description of the product.</p>
        <div class="flex items-center justify-between mt-4">
          <span class="text-indigo-600 font-semibold">$99.00</span>
          <button class="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Add to Cart</button>
        </div>
      </div>
    </div>`,
  });

  bm.add('hero', {
    label: 'Hero Section',
    category: 'Components',
    media: toDataUri(blockPreviews.hero),
    content: `<section class="py-12 md:py-20 lg:py-24 px-4 md:px-6 lg:px-8 text-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
      <h1 class="text-3xl md:text-4xl lg:text-5xl mb-3 md:mb-4 lg:mb-5 font-bold tracking-tight">Welcome to Your Website</h1>
      <p class="text-base md:text-lg lg:text-xl max-w-sm md:max-w-lg lg:max-w-xl mx-auto mb-5 md:mb-6 lg:mb-8 opacity-90 leading-relaxed">Create something amazing with our powerful web builder. No coding required.</p>
      <button class="py-3 md:py-4 px-5 md:px-6 lg:px-8 bg-white text-indigo-600 border-0 rounded-lg text-sm md:text-base font-bold cursor-pointer hover:bg-opacity-90 transition-opacity shadow-xl">Get Started</button>
    </section>`,
  });

  bm.add('card', {
    label: 'Card',
    category: 'Components',
    media: toDataUri(blockPreviews.card),
    content: `<div class="w-full max-w-[280px] md:max-w-[320px] lg:max-w-[350px] bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 mx-auto">
      <div class="h-32 md:h-40 lg:h-48 bg-gradient-to-br from-indigo-500 to-violet-600"></div>
      <div class="p-3 md:p-4 lg:p-5">
        <h3 class="m-0 mb-2 text-slate-800 text-base md:text-lg lg:text-xl font-bold">Card Title</h3>
        <p class="m-0 mb-3 md:mb-4 text-slate-500 text-xs md:text-sm leading-relaxed">This is a sample card description. Add your content here.</p>
        <button class="py-2 md:py-2.5 px-4 md:px-5 bg-indigo-500 text-white border-0 rounded-md text-xs md:text-sm cursor-pointer hover:bg-indigo-600 transition-colors">Learn More</button>
      </div>
    </div>`,
  });

  bm.add('testimonial', {
    label: 'Testimonial',
    category: 'Components',
    media: toDataUri(blockPreviews.testimonial),
    content: `<div class="w-full max-w-sm md:max-w-md lg:max-w-lg p-4 md:p-6 lg:p-8 bg-white rounded-xl shadow-lg text-center mx-auto border border-slate-100">
      <div class="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full mx-auto mb-3 md:mb-4 lg:mb-5 shadow-inner"></div>
      <p class="text-sm md:text-base lg:text-lg text-slate-700 italic leading-relaxed mb-3 md:mb-4 lg:mb-5">"This is an amazing product. It has completely transformed how we work!"</p>
      <div class="font-bold text-slate-800 text-sm md:text-base">Jane Doe</div>
      <p class="text-xs md:text-sm text-slate-500 mt-1">CEO, Company Inc.</p>
    </div>`,
  });

  bm.add('pricing', {
    label: 'Pricing Card',
    category: 'Components',
    media: toDataUri(blockPreviews.pricing),
    content: `<div class="w-full max-w-[260px] md:max-w-[280px] lg:max-w-[300px] p-4 md:p-6 lg:p-8 bg-white rounded-xl shadow-lg text-center border border-slate-100 hover:border-indigo-500 transition-colors cursor-pointer group mx-auto">
      <h3 class="m-0 mb-2 text-slate-800 text-base md:text-lg lg:text-xl font-bold group-hover:text-indigo-600 transition-colors">Pro Plan</h3>
      <div class="text-3xl md:text-4xl lg:text-5xl font-bold text-indigo-500 my-3 md:my-4 lg:my-5">$29<span class="text-sm md:text-base lg:text-lg font-normal text-slate-500">/mo</span></div>
      <ul class="list-none p-0 my-3 md:my-4 lg:my-5 text-left space-y-2 md:space-y-3">
        <li class="pb-2 border-b border-slate-100 text-slate-700 flex items-center gap-2 text-xs md:text-sm">
          <span class="text-green-500">✓</span> Unlimited Projects
        </li>
        <li class="pb-2 border-b border-slate-100 text-slate-700 flex items-center gap-2 text-xs md:text-sm">
          <span class="text-green-500">✓</span> Priority Support
        </li>
        <li class="pb-2 text-slate-700 flex items-center gap-2 text-xs md:text-sm">
          <span class="text-green-500">✓</span> Custom Domain
        </li>
      </ul>
      <button class="w-full py-2.5 md:py-3 lg:py-3.5 bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-0 rounded-lg text-sm md:text-base font-medium cursor-pointer shadow-lg hover:shadow-indigo-500/40 transition-all">Get Started</button>
    </div>`,
  });

  bm.add('navbar', {
    label: 'Navbar',
    category: 'Components',
    media: toDataUri(blockPreviews.navbar),
    content: `<nav class="flex flex-wrap justify-between items-center py-3 md:py-4 px-4 md:px-6 lg:px-8 bg-white shadow-md sticky top-0 z-50">
      <div class="text-xl md:text-2xl font-bold text-indigo-600">Logo</div>
      <div class="hidden md:flex gap-4 lg:gap-8">
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">Home</a>
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">About</a>
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">Services</a>
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">Contact</a>
      </div>
      <button class="py-2 md:py-2.5 px-4 md:px-5 bg-indigo-600 text-white border-0 rounded-md text-xs md:text-sm font-medium cursor-pointer hover:bg-indigo-700 transition-colors">Sign Up</button>
    </nav>`,
  });

  bm.add('footer', {
    label: 'Footer',
    category: 'Components',
    media: toDataUri(blockPreviews.footer),
    content: `<footer class="pt-10 md:pt-12 lg:pt-16 pb-6 md:pb-8 px-4 md:px-6 lg:px-8 bg-slate-900 text-white">
      <div class="flex flex-col md:flex-row flex-wrap justify-between max-w-6xl mx-auto mb-6 md:mb-8 lg:mb-10 gap-6 md:gap-8">
        <div class="w-full md:w-auto md:min-w-[200px] mb-4 md:mb-0">
          <h4 class="text-lg md:text-xl m-0 mb-3 md:mb-4 lg:mb-5 text-indigo-500 font-bold">Company</h4>
          <p class="text-sm md:text-base text-slate-400 leading-6 md:leading-7">Building the future of web design, one pixel at a time.</p>
        </div>
        <div class="w-1/2 md:w-auto md:min-w-[150px]">
          <h4 class="text-sm md:text-base m-0 mb-3 md:mb-4 lg:mb-5 font-bold text-slate-200">Quick Links</h4>
          <div class="space-y-2 md:space-y-3">
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Home</a>
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">About</a>
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Contact</a>
          </div>
        </div>
        <div class="w-1/2 md:w-auto md:min-w-[150px]">
          <h4 class="text-sm md:text-base m-0 mb-3 md:mb-4 lg:mb-5 font-bold text-slate-200">Legal</h4>
          <div class="space-y-2 md:space-y-3">
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Privacy</a>
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Terms</a>
          </div>
        </div>
      </div>
      <div class="text-center pt-4 md:pt-6 lg:pt-8 border-t border-slate-800 text-slate-500 text-xs md:text-sm">
        © 2024 Company. All rights reserved.
      </div>
    </footer>`,
  });

  // ===== FORM BLOCKS =====
  bm.add('form', {
    label: 'Form',
    category: 'Forms',
    media: toDataUri(blockPreviews.form),
    content: `<form class="w-full max-w-[320px] md:max-w-[360px] lg:max-w-[400px] p-4 md:p-6 lg:p-8 bg-white rounded-xl shadow-lg border border-slate-100 mx-auto">
      <h3 class="m-0 mb-3 md:mb-4 lg:mb-5 text-slate-800 text-lg md:text-xl font-bold">Contact Us</h3>
      <div class="mb-3 md:mb-4">
        <label class="block mb-1 md:mb-1.5 text-xs md:text-sm text-slate-600 font-medium">Name</label>
        <input type="text" placeholder="Your name" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
      </div>
      <div class="mb-3 md:mb-4">
        <label class="block mb-1 md:mb-1.5 text-xs md:text-sm text-slate-600 font-medium">Email</label>
        <input type="email" placeholder="your@email.com" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
      </div>
      <div class="mb-4 md:mb-5">
        <label class="block mb-1 md:mb-1.5 text-xs md:text-sm text-slate-600 font-medium">Message</label>
        <textarea placeholder="Your message" rows="4" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm resize-y focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"></textarea>
      </div>
      <button type="submit" class="w-full py-2.5 md:py-3 bg-indigo-600 text-white border-0 rounded-md text-xs md:text-sm font-medium cursor-pointer hover:bg-indigo-700 transition-colors shadow-md">Send Message</button>
    </form>`,
  });

  bm.add('input', {
    label: 'Input',
    category: 'Forms',
    media: toDataUri(blockPreviews.input),
    content: '<input type="text" placeholder="Enter text" class="p-2.5 md:p-3 border border-slate-200 rounded-md text-sm w-full focus:outline-none focus:border-indigo-500 transition-colors" />',
  });

  bm.add('textarea', {
    label: 'Textarea',
    category: 'Forms',
    media: toDataUri(blockPreviews.textarea),
    content: '<textarea placeholder="Enter text" rows="4" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm resize-y focus:outline-none focus:border-indigo-500 transition-colors"></textarea>',
  });

  bm.add('select', {
    label: 'Select',
    category: 'Forms',
    media: toDataUri(blockPreviews.select),
    content: `<select class="p-2.5 md:p-3 border border-slate-200 rounded-md text-sm w-full focus:outline-none focus:border-indigo-500 transition-colors bg-white">
      <option value="">Select an option</option>
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
      <option value="3">Option 3</option>
    </select>`,
  });

  bm.add('checkbox', {
    label: 'Checkbox',
    category: 'Forms',
    media: toDataUri(blockPreviews.checkbox),
    content: `<label class="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" class="w-4 h-4 md:w-4.5 md:h-4.5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300" />
      <span class="text-xs md:text-sm text-slate-600">Checkbox label</span>
    </label>`,
  });

  bm.add('radio', {
    label: 'Radio',
    category: 'Forms',
    media: toDataUri(blockPreviews.radio),
    content: `<div>
      <label class="flex items-center gap-2 cursor-pointer select-none mb-2">
        <input type="radio" name="radio-group" class="w-4 h-4 md:w-4.5 md:h-4.5 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
        <span class="text-xs md:text-sm text-slate-600">Option 1</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input type="radio" name="radio-group" class="w-4 h-4 md:w-4.5 md:h-4.5 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
        <span class="text-xs md:text-sm text-slate-600">Option 2</span>
      </label>
    </div>`,
  });
};
