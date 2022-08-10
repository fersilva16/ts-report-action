import { error, getInput, setFailed } from '@actions/core';
import ts from 'typescript';
import path from 'path';

const check = async (projectPath: string, files?: string[]) => {
  const json = ts.readConfigFile(projectPath, ts.sys.readFile);

  if (json.error) {
    setFailed(ts.flattenDiagnosticMessageText(json.error.messageText, '\n'));

    return;
  }

  const getFilesOptions = () => {
    if (!files) return {};

    return {
      compilerOptions: {
        skipLibCheck: true,
      },
      files,
      include: [],
    };
  };

  const filesOptions = getFilesOptions();

  const config = ts.parseJsonConfigFileContent(
    {
      ...json.config,
      ...filesOptions,
      compilerOptions: {
        ...json.config.compilerOptions,
        ...filesOptions.compilerOptions,
      },
    },
    ts.sys,
    path.dirname(projectPath),
    undefined,
    path.basename(projectPath)
  );

  const program = ts.createProgram({
    rootNames: config.fileNames,
    options: config.options,
    projectReferences: config.projectReferences,
    configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(config),
  });

  const diagnostics = program.getSemanticDiagnostics();

  const sortedDiagnostics = ts.sortAndDeduplicateDiagnostics(diagnostics);

  const filteredDiagnostics = sortedDiagnostics.filter((diagnostic) => {
    if (!diagnostic.file?.fileName) return true;

    return config.fileNames.includes(diagnostic.file.fileName);
  });

  for (const diagnostic of filteredDiagnostics) {
    const getDiagnosticPosition = () => {
      if (!diagnostic.file || !diagnostic.start) {
        return {
          startLine: undefined,
          startColumn: undefined,
        };
      }

      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start
      );

      return {
        startLine: line + 1,
        startColumn: character + 1,
      };
    };

    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n'
    );

    const { startLine, startColumn } = getDiagnosticPosition();

    error(message, {
      file: diagnostic.file?.fileName,
      startLine,
      startColumn,
    });
  }
};

(async () => {
  try {
    const project = getInput('project') || 'tsconfig.json';
    const projectPath = path.resolve(process.cwd(), project);

    const files = getInput('files');

    await check(projectPath, files.split(' '));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);

    if (e instanceof Error) setFailed(e.message);
  }
})();
