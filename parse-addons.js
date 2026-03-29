const fs = require('fs');
const path = require('path');

const BASE_DIR = __dirname;
const GITBOOK_BASE_URL = '.gitbook/assets';

// Category files to parse (skip README and SUMMARY)
const CATEGORY_FILES = [
  'actions-bars.md',
  'aide-aux-boss.md',
  'buffs-and-debuffs.md',
  'classes.md',
  'combat.md',
  'courriers.md',
  'data-export.md',
  'economie.md',
  'hauts-faits.md',
  'interface.md',
  'inventaire.md',
  'macros-chat-and-communication.md',
  'map-and-minimap.md',
  'metiers.md',
  'multiboxing.md',
  'notes-checklists-and-copy-paste.md',
  'plugins-and-libraries.md',
  'pvp.md',
  'quetes-and-leveling.md',
  'raids.md',
  'tooltip.md',
  'unit-frames.md',
];

function parseCategoryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const addons = [];

  let i = 0;
  let currentAddon = null;
  let descLines = [];

  while (i < lines.length) {
    const line = lines[i];

    // Detect addon title: ## heading (but not # page title)
    if (/^## .+/.test(line)) {
      // Save previous addon
      if (currentAddon) {
        currentAddon.desc = cleanDesc(descLines.join('\n'));
        addons.push(currentAddon);
      }
      currentAddon = {
        title: line.replace(/^## /, '').trim(),
        desc: '',
        thumb: null,
        url: null,
      };
      descLines = [];
      i++;
      continue;
    }

    if (!currentAddon) {
      i++;
      continue;
    }

    // Detect thumbnail image: ![](.gitbook/assets/...)
    const imgMatch = line.match(/!\[.*?\]\(<?(\.gitbook\/assets\/[^>)\s]+)>?\)/);
    if (imgMatch && !currentAddon.thumb) {
      currentAddon.thumb = 'assets/' + path.basename(imgMatch[1]);
      i++;
      continue;
    }

    // Detect file URL: {% file src=".gitbook/assets/..." %}
    const fileMatch = line.match(/\{%\s*file\s+src="(\.gitbook\/assets\/[^"]+)"/);
    if (fileMatch) {
      currentAddon.url = 'addons/' + path.basename(fileMatch[1]);
      // Skip until end of file block
      while (i < lines.length && !lines[i].includes('{% endfile %}') && !lines[i].match(/^\{% endfile/)) {
        i++;
      }
      i++;
      continue;
    }

    // Skip hint blocks
    if (line.includes('{% hint')) {
      while (i < lines.length && !lines[i].includes('{% endhint %}')) {
        i++;
      }
      i++;
      continue;
    }

    // Collect description lines (skip empty lines at start)
    const cleanLine = line.trim();
    if (cleanLine && !cleanLine.startsWith('---') && !cleanLine.startsWith('{% ')) {
      descLines.push(cleanLine);
    } else if (cleanLine === '' && descLines.length > 0) {
      descLines.push('');
    }

    i++;
  }

  // Save last addon
  if (currentAddon) {
    currentAddon.desc = cleanDesc(descLines.join('\n'));
    addons.push(currentAddon);
  }

  return addons;
}

function cleanDesc(text) {
  return text
    .replace(/&#x20;/g, ' ')
    .replace(/\\_/g, '_')
    .replace(/\\\*/g, '*')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove markdown links, keep text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const allAddons = [];

for (const file of CATEGORY_FILES) {
  const filePath = path.join(BASE_DIR, file);
  if (!fs.existsSync(filePath)) continue;

  const category = file.replace('.md', '');
  const addons = parseCategoryFile(filePath);

  for (const addon of addons) {
    if (addon.title) {
      allAddons.push({ ...addon, category });
    }
  }
}

// Output JSON
const output = JSON.stringify(allAddons, null, 2);
const outputPath = path.join(BASE_DIR, 'addons.json');
fs.writeFileSync(outputPath, output, 'utf-8');

console.log(`✓ ${allAddons.length} addons extraits → addons.json`);

// Stats
const withThumb = allAddons.filter(a => a.thumb).length;
const withUrl = allAddons.filter(a => a.url).length;
const withDesc = allAddons.filter(a => a.desc).length;
console.log(`  - Avec thumbnail : ${withThumb}`);
console.log(`  - Avec URL       : ${withUrl}`);
console.log(`  - Avec desc      : ${withDesc}`);
