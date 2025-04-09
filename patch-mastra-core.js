const fs = require('fs');
const path = require('path');

// Path to @mastra/core dist directory
const mastraCorePath = path.resolve('./node_modules/@mastra/core/dist');

// Function to recursively find and patch files
function patchFiles(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      patchFiles(filePath);
    } else if (stats.isFile() && file.endsWith('.js')) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file contains any node: protocol imports
      if (content.includes('node:')) {
        console.log(`Patching file: ${filePath}`);
        let patchedContent = content;
        
        // Replace all node: protocol imports with regular imports
        patchedContent = patchedContent.replace(/from\s+['"]node:fs\/promises['"]/g, "from 'fs/promises'");
        patchedContent = patchedContent.replace(/from\s+['"]node:fs['"]/g, "from 'fs'");
        patchedContent = patchedContent.replace(/from\s+['"]node:path['"]/g, "from 'path'");
        patchedContent = patchedContent.replace(/from\s+['"]node:os['"]/g, "from 'os'");
        patchedContent = patchedContent.replace(/from\s+['"]node:events['"]/g, "from 'events'");
        patchedContent = patchedContent.replace(/from\s+['"]node:url['"]/g, "from 'url'");
        patchedContent = patchedContent.replace(/from\s+['"]node:crypto['"]/g, "from 'crypto'");
        patchedContent = patchedContent.replace(/from\s+['"]node:util['"]/g, "from 'util'");
        patchedContent = patchedContent.replace(/from\s+['"]node:stream['"]/g, "from 'stream'");
        patchedContent = patchedContent.replace(/from\s+['"]node:buffer['"]/g, "from 'buffer'");
        patchedContent = patchedContent.replace(/from\s+['"]node:string_decoder['"]/g, "from 'string_decoder'");
        
        // Also patch require statements
        patchedContent = patchedContent.replace(/require\(['"]node:fs\/promises['"]\)/g, "require('fs/promises')");
        patchedContent = patchedContent.replace(/require\(['"]node:fs['"]\)/g, "require('fs')");
        patchedContent = patchedContent.replace(/require\(['"]node:path['"]\)/g, "require('path')");
        patchedContent = patchedContent.replace(/require\(['"]node:os['"]\)/g, "require('os')");
        patchedContent = patchedContent.replace(/require\(['"]node:events['"]\)/g, "require('events')");
        patchedContent = patchedContent.replace(/require\(['"]node:url['"]\)/g, "require('url')");
        patchedContent = patchedContent.replace(/require\(['"]node:crypto['"]\)/g, "require('crypto')");
        patchedContent = patchedContent.replace(/require\(['"]node:util['"]\)/g, "require('util')");
        patchedContent = patchedContent.replace(/require\(['"]node:stream['"]\)/g, "require('stream')");
        patchedContent = patchedContent.replace(/require\(['"]node:buffer['"]\)/g, "require('buffer')");
        patchedContent = patchedContent.replace(/require\(['"]node:string_decoder['"]\)/g, "require('string_decoder')");
        
        // More aggressive pattern to catch any import patterns
        patchedContent = patchedContent.replace(/['"]node:(fs\/promises|fs|path|os|events|url|crypto|util|stream|buffer|string_decoder)['"]/g, "'$1'");
        
        // Write patched content back to file
        fs.writeFileSync(filePath, patchedContent, 'utf8');
      }
    }
  }
}

try {
  // Ensure the directory exists
  if (fs.existsSync(mastraCorePath)) {
    console.log('Patching @mastra/core module...');
    patchFiles(mastraCorePath);
    console.log('Patching completed successfully!');
  } else {
    console.error('Error: @mastra/core module not found!');
    process.exit(1);
  }
} catch (error) {
  console.error('Error patching @mastra/core:', error);
  process.exit(1);
} 