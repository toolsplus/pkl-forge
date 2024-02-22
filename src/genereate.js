import { execSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import update from 'immutability-helper';
import { getExePath } from '@pkl-community/pkl';

const outputDirectory = 'out';
const forgeManifestPackageVersion = '5.5.3';

console.log(
  `Retrieving manifest JSON schema from @forge/manifest@${forgeManifestPackageVersion}...`,
);

const forgeManifestJsonSchemaUrl = `https://cdn.jsdelivr.net/npm/@forge/manifest@${forgeManifestPackageVersion}/out/schema/manifest-schema.json`;

const forgeManifestJsonSchema = await fetch(forgeManifestJsonSchemaUrl).then(
  (r) => r.json(),
);

console.log(`Transforming manifest JSON schema...`);

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

console.log(`Writing transformed manifest JSON schema...`);

if (!existsSync(outputDirectory)) {
  mkdirSync(outputDirectory);
}

const manifestJsonSchemaOutputFile = `${outputDirectory}/manifest-schema.json`;
await writeFile(
  manifestJsonSchemaOutputFile,
  JSON.stringify(transformedForgeManifestJsonSchema, null, 4),
  { encoding: 'utf8' },
);

const command = `${getExePath()} eval package://pkg.pkl-lang.org/pkl-pantry/org.json_schema.contrib@1.0.1#/generate.pkl -m ${outputDirectory} -p source="${manifestJsonSchemaOutputFile}"`;

console.log(`Generating manifest pkl schema with command:\n\t${command}`);

execSync(command);

console.log(`Generated ${outputDirectory}/ManifestSchema.pkl`);
