import { resolve } from 'path';
import fs from 'fs-extra';
import assert from 'assert';
import { template } from 'underscore';
import { format } from 'prettier';

export const makePath = str => str.toLowerCase().replace(/ /g, '-');

export const listToArray = list => list.replace(/ /g, '').split(',');

const camelize = str =>
  str
    // 1st deal w/ scoped packages (e.g. remove `@bpanel/`)
    .replace(/^\W+[\w]+[\W]/, '')
    .replace(/_/g, '-')
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function(letter, index) {
      return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
    })
    .replace(/[^\w]/gi, '');

// Will return mutated string with str being inserted in destination
// at specified target
export const insertText = (str, destination, target) => {
  const index = destination.indexOf(target);
  assert(index > -1, 'Target in destination for string insertion did not exit');
  const beginning = destination.slice(0, index);
  const end = destination.slice(index);
  return format(beginning + str + '\n' + end);
};

export const setupDeps = async (deps_, pluginRoot) => {
  const deps = Array.isArray(deps_) ? deps_ : listToArray(deps_);
  let pluginsIndex = '';
  let pluginsList = ' ';
  deps.forEach(async dep => {
    const camelized = camelize(dep);
    pluginsList += `${camelized}, `;
    pluginsIndex += `import * as ${camelized} from '${dep}'; \n`;
  });

  pluginsIndex += `\nexport default {${pluginsList}};`;
  pluginsIndex = format(pluginsIndex, { singleQuote: true });
  if (!fs.existsSync(resolve(pluginRoot, 'lib')))
    fs.mkdirSync(resolve(pluginRoot, 'lib'));
  if (!fs.existsSync(resolve(pluginRoot, 'dist')))
    fs.mkdirSync(resolve(pluginRoot, 'dist'));
  await fs.appendFile(resolve(pluginRoot, 'lib', 'plugins.js'), pluginsIndex);

  return {
    import: format(`import modules from './plugins';`),
    arr: format(
      `const plugins = Object.keys(modules).map(name => modules[name]);`
    ),
    export: format(`export const pluginConfig = {plugins};`)
  };
};

export const setupTheme = async (indexText_, pluginRoot) => {
  let indexText = indexText_;
  let configText = format(
    `// Configuration for your plugin theme.` +
    `\n` +
    `// The "skeleton" of your styles` +
    `\n\n` +
    `import themeVariables from './themeVariables';` +
    `\n\n` +
    `const { } = themeVariables; // import the variables for your config here` +
    `\n\n` +
    `// setup your configs here, e.g. \`app\` or \`sidebar\` objects` +
    `\n` +
    `const themeCreator = defaultThemeVariables => {\n  return {}; \n};` +
    `\n\n` +
    `export default themeCreator;` +
    `\n`);

  let varText = format(
    `// Set the variables that you would like to update for your theme \n\n` +
      `// Setup variables object to be imported in your themeConfigs \n` +
      `const themeVariables = {}; \n\n` +
      `export default themeVariables;\n`
  );

  const themeImports = format(
    `import themeVariables from './themeVariables';` +
      `\n` +
      `import themeConfig from './themeConfig';` +
      `\n`
  );

  const themeExport = format(
    `export const decorateTheme = themeCreator => () =>` +
      `\n` +
      `  themeCreator(themeVariables, themeConfig);` +
      `\n`
  );

  await Promise.all([
    fs.appendFile(resolve(pluginRoot, 'lib', 'themeConfig.js'), configText),
    fs.appendFile(resolve(pluginRoot, 'lib', 'themeVariables.js'), varText)
  ]);

  return {
    imports: themeImports,
    exports: themeExport
  };
};

export const modulesWithTarget = [
  'decorateComponent',
  'mapComponentState',
  'mapComponentDispatch'
];

export const setupModule = targetComponent => module => {
  let moduleTemplate = fs.readFileSync(
    resolve(__dirname, '../indexTemplates/', `${module}.txt`),
    'utf8'
  );
  if (targetComponent) {
    moduleTemplate = template(moduleTemplate);
    return moduleTemplate({ targetComponent });
  }
  return moduleTemplate;
};
