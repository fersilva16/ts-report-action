import { getInput, debug, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { spawnSync } from 'child_process';
import util from 'util';

const debugConsole = (obj: unknown) => {
  return debug(util.inspect(obj, true, null, true));
};

const check = async (ghToken: string, files: string[]) => {
  debugConsole({
    ghToken,
    files,
  });

  const { owner, repo } = context.repo;
  const prNumber = context.payload.pull_request?.number;
  const baseUrl = `https://github.com/${owner}/${repo}`;

  if (!prNumber) {
    // eslint-disable-next-line i18n-text/no-en
    setFailed('Not in PR');

    return;
  }

  const result = spawnSync('yarn', [
    '--silent',
    'tsc-files',
    '--noEmit',
    ...files,
  ]);

  if (result.error) {
    setFailed(result.error);

    return;
  }

  const stdout = result.stdout.toString();
  const stderr = result.stderr.toString();

  if (result.status === 0) return;

  if (result.status !== 2) {
    setFailed(
      util.inspect(
        {
          result,
          output: result.output.map((output) => output?.toString()).join('\n'),
          files,
          stdout,
          stderr,
        },
        true,
        null,
        true
      )
    );

    return;
  }

  const locations = stdout
    .trim()
    .split('\n')
    .filter(
      (line) =>
        !line.match(/^\s+/) && files.some((file) => line.startsWith(file))
    )
    .map((line) => {
      const [location, ...rest] = line.split(':');
      const githubPath = location.replace(
        /\(([0-9]+),[0-9]+\)$/,
        (_, l) => `#L${l}`
      );
      return {
        location,
        url: `${baseUrl}/tree/main/${githubPath}`,
        error: rest.join(':').trim(),
      };
    });

  const issueTitle = `TypeScript errors - #${prNumber}`;
  const issueBody = [
    ...locations.map(
      ({ location, url, error }) => `- [ ] [${location}](${url}): \`${error}\``
    ),
    `Ref ${baseUrl}/pull/${prNumber}`,
  ].join('\n');

  const encodedIssueTitle = encodeURIComponent(issueTitle);
  const encodedIssueBody = encodeURIComponent(issueBody);

  const table = locations
    .map(
      ({ location, url, error }) => `| [${location}](${url}) | \`${error}\` |`
    )
    .join('\n');

  const body = [
    '<details>',
    '<summary>',
    `TypeScript Report - <a href="${baseUrl}/issues/new?title=${encodedIssueTitle}&body=${encodedIssueBody}">Create an issue</a>`,
    '</summary>',
    '<br>',
    '| Location | Error |',
    '| -------- | ----- |',
    table,
    '</details>',
  ].join('\n');

  const octokit = getOctokit(ghToken);

  await octokit.rest.issues.createComment({
    owner,
    repo,
    // eslint-disable-next-line camelcase
    issue_number: prNumber,
    body,
  });
};

(async () => {
  try {
    const ghToken = getInput('githubToken');
    const files = getInput('files');

    await check(ghToken, files.split(' '));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);

    if (error instanceof Error) setFailed(error.message);
  }
})();
