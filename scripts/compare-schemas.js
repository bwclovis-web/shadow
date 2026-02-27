#!/usr/bin/env node

/**
 * Compare schema.prisma vs schema.prod.prisma to find differences
 */

const fs = require('fs');
const path = require('path');

const devSchema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
const prodSchema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prod.prisma'), 'utf8');

console.log('🔍 Comparing Schemas...');
console.log('='.repeat(80));
console.log('');

// Extract models from schemas
function extractModels(schema) {
  const modelRegex = /model\s+(\w+)\s*{([^}]+)}/gs;
  const models = {};
  let match;
  
  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const modelBody = match[2].trim();
    models[modelName] = modelBody;
  }
  
  return models;
}

// Extract enums from schemas
function extractEnums(schema) {
  const enumRegex = /enum\s+(\w+)\s*{([^}]+)}/gs;
  const enums = {};
  let match;
  
  while ((match = enumRegex.exec(schema)) !== null) {
    const enumName = match[1];
    const enumBody = match[2].trim();
    enums[enumName] = enumBody;
  }
  
  return enums;
}

const devModels = extractModels(devSchema);
const prodModels = extractModels(prodSchema);

const devEnums = extractEnums(devSchema);
const prodEnums = extractEnums(devSchema);

let hasDifferences = false;

// Check for missing models
console.log('📋 Checking Models...');
console.log('-'.repeat(80));

const devModelNames = Object.keys(devModels);
const prodModelNames = Object.keys(prodModels);

const missingInProd = devModelNames.filter(name => !prodModelNames.includes(name));
const extraInProd = prodModelNames.filter(name => !devModelNames.includes(name));

if (missingInProd.length > 0) {
  console.log('❌ Models missing in PRODUCTION schema:');
  missingInProd.forEach(name => console.log(`   - ${name}`));
  hasDifferences = true;
}

if (extraInProd.length > 0) {
  console.log('⚠️  Extra models in PRODUCTION schema (not in dev):');
  extraInProd.forEach(name => console.log(`   - ${name}`));
  hasDifferences = true;
}

// Compare model fields
console.log('');
console.log('🔬 Detailed Model Comparison...');
console.log('-'.repeat(80));

for (const modelName of devModelNames) {
  if (!prodModels[modelName]) continue;
  
  const devFields = devModels[modelName].split('\n').map(l => l.trim()).filter(l => l);
  const prodFields = prodModels[modelName].split('\n').map(l => l.trim()).filter(l => l);
  
  // Check for missing fields
  const missingFields = [];
  const differentFields = [];
  
  for (const devField of devFields) {
    // Skip comments and directives for now
    if (devField.startsWith('//')) continue;
    
    const fieldName = devField.split(/\s+/)[0];
    const prodField = prodFields.find(f => f.startsWith(fieldName + ' '));
    
    if (!prodField && !devField.startsWith('@@')) {
      missingFields.push(devField);
    } else if (prodField && devField !== prodField) {
      // Check for meaningful differences (not just whitespace)
      const devNormalized = devField.replace(/\s+/g, ' ');
      const prodNormalized = prodField.replace(/\s+/g, ' ');
      
      if (devNormalized !== prodNormalized) {
        differentFields.push({ dev: devField, prod: prodField });
      }
    }
  }
  
  // Check for directives
  const devDirectives = devFields.filter(f => f.startsWith('@@'));
  const prodDirectives = prodFields.filter(f => f.startsWith('@@'));
  
  const missingDirectives = devDirectives.filter(d => !prodDirectives.includes(d));
  
  if (missingFields.length > 0 || differentFields.length > 0 || missingDirectives.length > 0) {
    console.log('');
    console.log(`⚠️  ${modelName}:`);
    
    if (missingFields.length > 0) {
      console.log('   Missing fields in PRODUCTION:');
      missingFields.forEach(f => console.log(`     ❌ ${f}`));
    }
    
    if (differentFields.length > 0) {
      console.log('   Different field definitions:');
      differentFields.forEach(({ dev, prod }) => {
        console.log(`     DEV:  ${dev}`);
        console.log(`     PROD: ${prod}`);
      });
    }
    
    if (missingDirectives.length > 0) {
      console.log('   Missing directives in PRODUCTION:');
      missingDirectives.forEach(d => console.log(`     ❌ ${d}`));
    }
    
    hasDifferences = true;
  }
}

console.log('');
console.log('='.repeat(80));

if (!hasDifferences) {
  console.log('✅ Schemas are in sync!');
} else {
  console.log('❌ Schemas have differences that need to be fixed!');
}

console.log('');
