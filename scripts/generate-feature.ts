#!/usr/bin/env node

/**
 * AI-Powered Feature Code Generator
 * Automatically generates components, tests, styles, and documentation
 */

import fs from 'fs';
import path from 'path';

interface GenerateConfig {
  type: 'feature' | 'bugfix' | 'optimization' | 'docs';
  name: string;
  description: string;
  pages: string[];
  priority?: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const config: GenerateConfig = {
  type: 'feature',
  name: '',
  description: '',
  pages: [],
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--type' && args[i + 1]) {
    config.type = args[i + 1] as any;
    i++;
  } else if (args[i] === '--name' && args[i + 1]) {
    config.name = args[i + 1];
    i++;
  } else if (args[i] === '--description' && args[i + 1]) {
    config.description = args[i + 1];
    i++;
  } else if (args[i] === '--pages' && args[i + 1]) {
    config.pages = args[i + 1].split(',').map(p => p.trim());
    i++;
  } else if (args[i] === '--priority' && args[i + 1]) {
    config.priority = args[i + 1];
    i++;
  }
}

if (!config.name || !config.description) {
  console.error('Error: --name and --description are required');
  process.exit(1);
}

const componentName = toPascalCase(config.name);
const componentFile = `${componentName}.tsx`;
const testFile = `${componentName}.test.tsx`;
const cssFile = `${componentName}.css`;

console.log(`🔧 Generating ${config.type}: ${config.name}`);

// Generate component
function generateComponent(): string {
  return `import React, { useState } from 'react';
import './${cssFile}';

interface ${componentName}Props {
  // Add props as needed
}

export default function ${componentName}(props: ${componentName}Props) {
  const [state, setState] = useState(null);

  return (
    <div className="${toCamelCase(componentName)}">
      <h2>${config.name}</h2>
      {/* Component content */}
      <p>${config.description}</p>
    </div>
  );
}
`;
}

// Generate tests
function generateTests(): string {
  return `import { render, screen } from '@testing-library/react';
import ${componentName} from './${componentName}';

describe('${componentName}', () => {
  it('renders component', () => {
    render(<${componentName} />);
    expect(screen.getByText('${config.name}')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<${componentName} />);
    expect(screen.getByText('${config.description}')).toBeInTheDocument();
  });

  it('matches snapshot', () => {
    const { container } = render(<${componentName} />);
    expect(container).toMatchSnapshot();
  });
});
`;
}

// Generate styles
function generateStyles(): string {
  return `.${toCamelCase(componentName)} {
  padding: 1.5rem;
  border-radius: 8px;
  background: white;
  border: 1px solid #e0e0e0;
}

.${toCamelCase(componentName)} h2 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 1.5rem;
  font-weight: 600;
}

.${toCamelCase(componentName)} p {
  color: #7f8c8d;
  line-height: 1.6;
  margin-bottom: 1rem;
}

@media (max-width: 768px) {
  .${toCamelCase(componentName)} {
    padding: 1rem;
  }
}
`;
}

// Generate unit tests
function generateUnitTests(): string {
  return `import { render, screen, fireEvent } from '@testing-library/react';
import ${componentName} from './${componentName}';

describe('${componentName} - Unit Tests', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<${componentName} />);
    });

    it('displays correct title', () => {
      render(<${componentName} />);
      const title = screen.getByText('${config.name}');
      expect(title).toBeInTheDocument();
      expect(title.tagName).toBe('H2');
    });
  });

  describe('Accessibility', () => {
    it('has accessible heading structure', () => {
      render(<${componentName} />);
      const heading = screen.getByRole('heading', { name: '${config.name}' });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies correct CSS classes', () => {
      const { container } = render(<${componentName} />);
      const element = container.querySelector('.${toCamelCase(componentName)}');
      expect(element).toBeInTheDocument();
    });
  });
});
`;
}

// Generate integration tests
function generateIntegrationTests(): string {
  return `import { render, screen } from '@testing-library/react';
import ${componentName} from './${componentName}';

describe('${componentName} - Integration Tests', () => {
  it('integrates with affected pages', () => {
    const pages = [${config.pages.map(p => `'${p}'`).join(', ')}];

    pages.forEach(page => {
      // Mock page components that would use this component
      console.log(\`Testing integration with \${page}\`);
    });
  });

  it('maintains consistency across pages', () => {
    render(<${componentName} />);
    expect(screen.getByText('${config.description}')).toBeInTheDocument();
  });
});
`;
}

// Utility functions
function toPascalCase(str: string): string {
  return str
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Create directory if it doesn't exist
const featuresDir = path.join(process.cwd(), 'transcend-frontend', 'src', 'features');
if (!fs.existsSync(featuresDir)) {
  fs.mkdirSync(featuresDir, { recursive: true });
}

// Write files
try {
  const componentPath = path.join(featuresDir, componentFile);
  const testPath = path.join(featuresDir, testFile);
  const cssPath = path.join(featuresDir, cssFile);
  const integrationTestPath = path.join(featuresDir, `${componentName}.integration.test.tsx`);

  fs.writeFileSync(componentPath, generateComponent());
  console.log(`✅ Component: ${componentPath}`);

  fs.writeFileSync(testPath, generateUnitTests());
  console.log(`✅ Unit Tests: ${testPath}`);

  fs.writeFileSync(integrationTestPath, generateIntegrationTests());
  console.log(`✅ Integration Tests: ${integrationTestPath}`);

  fs.writeFileSync(cssPath, generateStyles());
  console.log(`✅ Styles: ${cssPath}`);

  // Generate documentation
  const docPath = path.join(process.cwd(), 'docs', `${componentName}.md`);
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const documentation = `# ${config.name}

## Description
${config.description}

## Type
${config.type}

## Priority
${config.priority || 'medium'}

## Affected Pages
${config.pages.map(p => `- ${p}`).join('\n')}

## Component
\`\`\`tsx
import ${componentName} from '@/features/${componentName}';

export default function Example() {
  return <${componentName} />;
}
\`\`\`

## Testing
Run tests with:
\`\`\`bash
npm test -- ${componentName}
\`\`\`

## Generated Files
- Component: \`src/features/${componentFile}\`
- Tests: \`src/features/${testFile}\`
- Styles: \`src/features/${cssFile}\`
- Documentation: \`docs/${componentName}.md\`
`;

  fs.writeFileSync(docPath, documentation);
  console.log(`✅ Documentation: ${docPath}`);

  console.log(`\n🎉 Generated ${config.name} successfully!`);
  console.log(`\nNext steps:`);
  console.log(`1. Review the generated files in src/features/`);
  console.log(`2. Run tests: npm test -- ${componentName}`);
  console.log(`3. Integrate with ${config.pages.join(', ')}`);
  console.log(`4. Commit to feature branch`);
} catch (error) {
  console.error('❌ Generation failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
