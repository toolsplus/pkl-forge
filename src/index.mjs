import { execSync } from 'node:child_process';
import { select } from '@inquirer/prompts';
import { writeFile } from 'node:fs/promises';
import update from 'immutability-helper';
import semverRsort from 'semver/functions/rsort.js';

const forgeManifestPackageVersionJson = execSync(
  'npm view @forge/manifest versions --json',
);
const forgeManifestPackageVersions = JSON.parse(
  forgeManifestPackageVersionJson.toString(),
);

const forgeManifestPackageVersionOption = await select({
  loop: false,
  default: 'latest',
  message:
    'From which @forge/manifest package version should I retrieve the manifest JSON schema?',
  choices: [
    {
      name: 'Use latest',
      value: 'latest',
    },
    {
      name: 'Select a version',
      value: 'select',
    },
  ],
});

const reverseSortedForgeManifestPackageVersions = semverRsort(
  forgeManifestPackageVersions,
);
const forgeManifestPackageVersion =
  forgeManifestPackageVersionOption === 'select'
    ? await select({
        message:
          'Select the @forge/manifest package version from which to retrieve the Forge manifest definition',
        loop: false,
        choices: reverseSortedForgeManifestPackageVersions.map((value) => ({
          value,
        })),
      })
    : reverseSortedForgeManifestPackageVersions[0];

console.log(
  `Retrieving manifest JSON schema from @forge/manifest@${forgeManifestPackageVersion}...`,
);

const forgeManifestJsonSchemaUrl = `https://cdn.jsdelivr.net/npm/@forge/manifest@${forgeManifestPackageVersion}/out/schema/manifest-schema.json`;

const forgeManifestJsonSchema = await fetch(forgeManifestJsonSchemaUrl).then(
  (r) => r.json(),
);

const connectModulesProperties = Object.fromEntries(
  Object.entries(forgeManifestJsonSchema.definitions.ModuleSchema.properties)
    .filter(([name]) => name.startsWith('connect-'))
    .map(([name, def]) => [name.replace(/connect-/g, ''), def]),
);

const missingConnectModulesProperties = {
  'jira:serviceDeskPortalRequestViewPanels': {
    type: 'array',
    items: {
      properties: {
        weight: {
          type: 'integer',
          fieldDescription:
            '\n\n<p>Determines the order in which the tab panel\'s link appears in the menu or list.</p>\n\n <p>The "lightest" weight (i.e., lowest number) appears first, rising relative to other items,\n while the "heaviest" weights sink to the bottom of the menu or list.</p>\n\n <p>Built-in web items have weights that are incremented by numbers that leave room for additional\n items, such as by 10 or 100. Be mindful of the weight you choose for your item, so that it appears\n in a sensible order given existing items.</p>\n\n',
        },
        conditions: {
          items: {
            type: 'object',
            anyOf: [
              {
                $ref: '#/definitions/singleCondition',
              },
              {
                $ref: '#/definitions/compositeCondition',
              },
            ],
          },
          type: 'array',
          fieldDescription:
            '\n\n<a href="../../conditions/">Conditions</a> can be added to display only when all the given conditions are true.\n\n',
        },
        url: {
          format: 'uri',
          type: 'string',
          fieldDescription:
            "\n\nSpecifies the URL targeted by the tab panel. The URL is relative to the add-on's base URL.\n\n",
        },
        key: {
          $ref: '#/definitions/ModuleKeySchema',
        },
      },
      required: ['key'],
      not: {
        required: ['unlicensedAccess'],
      },
    },
    minItems: 1,
  },
};

const transformedForgeManifestJsonSchema = update(forgeManifestJsonSchema, {
  definitions: {
    ConnectModuleSchema: {
      properties: {
        $set: {
          ...forgeManifestJsonSchema.definitions.ConnectModuleSchema.properties,
          ...connectModulesProperties,
          ...missingConnectModulesProperties,
        },
      },
    },
  },
});

const manifestJsonSchemaOutputFile = `out/manifest-schema.json`;

await writeFile(
  manifestJsonSchemaOutputFile,
  JSON.stringify(transformedForgeManifestJsonSchema, null, 4),
  { encoding: 'utf8' },
);

execSync(
  `pkl eval package://pkg.pkl-lang.org/pkl-pantry/org.json_schema.contrib@1.0.0#/generate.pkl -m out -p source="${manifestJsonSchemaOutputFile}"`,
);
