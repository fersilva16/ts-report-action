# TypeScript report action

GitHub Action to report TypeScript errors in Pull Requests

![Example](https://i.imgur.com/pfI3zw1.png)

## Usage

### Only running in change files

```yml
- name: Get changed typescript files
  id: changed-typescript-files
  uses: tj-actions/changed-files@v20
  with:
    base_sha: ${{ github.event.pull_request.base.sha }}
    files: |
      **/*.ts
      **/*.tsx

- name: TypeScript report
  if: steps.changed-typescript-files.outputs.any_changed == 'true'
  uses: fersilva16/ts-report-action@1.1.0
  with:
    files: ${{ steps.changed-typescript-files.outputs.all_changed_files }}
```

### With project

```yml
- name: TypeScript report
  uses: fersilva16/ts-report-action@1.1.0
  with:
    project: path/to/tsconfig.json
```
