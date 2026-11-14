#!/usr/bin/env bash
# Verify that the working tree is ready to be tagged and published.
# Changes nothing: it only reads the repository and the npm registry.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

name="$(node -p "require('./package.json').name")"
version="$(node -p "require('./package.json').version")"
tag="v$version"
fail(){ echo "release check failed: $*" >&2; exit 1; }

[[ -z "$(git status --porcelain)" ]] || fail "working tree is not clean"
git rev-parse -q --verify "refs/tags/$tag" >/dev/null && fail "tag $tag already exists"
grep -q "^## \[$version\]" CHANGELOG.md || fail "CHANGELOG.md has no section [$version]"

if npm view "$name@$version" version >/dev/null 2>&1; then
  fail "$name@$version is already published; bump the version"
fi

npm test
npm pack --dry-run >/dev/null
echo "release check passed: $name@$version, tag $tag"
echo "next: git tag -a $tag -m \"Release $version\" && git push origin main $tag"
