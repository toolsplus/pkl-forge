import { execSync } from 'node:child_process';
import { select } from '@inquirer/prompts';
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

console.log(`@forge/manifest package version: ${forgeManifestPackageVersion}`);
